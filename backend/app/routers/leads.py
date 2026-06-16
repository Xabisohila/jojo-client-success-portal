import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import get_current_user
from app.database import get_db
from app.models.lead import Lead, LeadActivity, LeadStatusHistory
from app.models.user import User
from app.schemas.lead import (
    LeadCreate, LeadUpdate, LeadOut, LeadListItem,
    LeadQualify, LeadDisqualify, ActivityCreate, ActivityOut, PipelineSummary
)
from app.services.ai_scoring import score_lead

router = APIRouter(prefix="/leads", tags=["leads"])


def _log_status_change(db: Session, lead: Lead, to_status: str, changed_by: uuid.UUID, note: Optional[str] = None):
    history = LeadStatusHistory(
        lead_id=lead.id,
        from_status=lead.status,
        to_status=to_status,
        changed_by=changed_by,
        note=note,
    )
    db.add(history)
    activity = LeadActivity(
        lead_id=lead.id,
        activity_type="status_change",
        subject=f"Status changed: {lead.status} → {to_status}",
        body=note,
        performed_by=changed_by,
    )
    db.add(activity)


@router.get("/pipeline-summary", response_model=PipelineSummary)
def get_pipeline_summary(db: Session = Depends(get_db)):
    rows = db.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    return PipelineSummary(
        new=counts.get("new", 0),
        contacted=counts.get("contacted", 0),
        engaged=counts.get("engaged", 0),
        qualified=counts.get("qualified", 0),
        disqualified=counts.get("disqualified", 0),
        converted=counts.get("converted", 0),
        total=total,
    )


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing = db.query(Lead).filter(Lead.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="A lead with this email already exists.")

    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.flush()

    db.add(LeadActivity(
        lead_id=lead.id,
        activity_type="system",
        subject="Lead created",
        performed_by=lead.assigned_to,
    ))
    db.add(LeadStatusHistory(lead_id=lead.id, to_status="new"))
    db.commit()
    db.refresh(lead)

    background_tasks.add_task(score_lead, lead.id)
    return lead


@router.get("")
def list_leads(
    status: Optional[str] = Query(None),
    assigned_to: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    import math
    q = db.query(Lead)
    if status:
        q = q.filter(Lead.status == status)
    if assigned_to:
        q = q.filter(Lead.assigned_to == assigned_to)
    q = q.order_by(Lead.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [LeadListItem.model_validate(i).model_dump() for i in items],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: uuid.UUID, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: uuid.UUID, payload: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/score", response_model=LeadOut)
def rescore_lead(lead_id: uuid.UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    background_tasks.add_task(score_lead, lead_id)
    return lead


@router.post("/{lead_id}/qualify", response_model=LeadOut)
def qualify_lead(lead_id: uuid.UUID, payload: LeadQualify, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    if lead.status in ("disqualified", "converted"):
        raise HTTPException(status_code=400, detail=f"Cannot qualify a lead with status '{lead.status}'.")

    _log_status_change(db, lead, "qualified", current_user.id, payload.note)
    lead.status = "qualified"
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/disqualify", response_model=LeadOut)
def disqualify_lead(lead_id: uuid.UUID, payload: LeadDisqualify, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    if lead.status == "converted":
        raise HTTPException(status_code=400, detail="Cannot disqualify a converted lead.")

    _log_status_change(db, lead, "disqualified", current_user.id, payload.reason)
    lead.status = "disqualified"
    lead.disqualified_reason = payload.reason
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/activities", response_model=ActivityOut, status_code=201)
def add_activity(lead_id: uuid.UUID, payload: ActivityCreate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    activity = LeadActivity(lead_id=lead_id, **payload.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/{lead_id}/activities", response_model=list[ActivityOut])
def get_activities(lead_id: uuid.UUID, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead.activities
