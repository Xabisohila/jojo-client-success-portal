import math
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.proposal import Proposal, ProposalLineItem
from app.models.user import User
from app.schemas.proposal import (
    ProposalOut, ProposalListItem, ProposalUpdate, ProposalApprove, ProposalReject,
)

router = APIRouter(prefix="/proposals", tags=["proposals"])


def _get_or_404(db: Session, proposal_id: uuid.UUID) -> Proposal:
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    return p


@router.get("")
def list_proposals(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Proposal).order_by(Proposal.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [ProposalListItem.model_validate(i).model_dump() for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_or_404(db, proposal_id)


@router.patch("/{proposal_id}", response_model=ProposalOut)
def update_proposal(proposal_id: uuid.UUID, payload: ProposalUpdate, db: Session = Depends(get_db)):
    proposal = _get_or_404(db, proposal_id)
    if proposal.status not in ("draft", "pending_approval"):
        raise HTTPException(status_code=400, detail="Only draft or pending proposals can be edited.")

    for field, value in payload.model_dump(exclude_none=True, exclude={"line_items"}).items():
        setattr(proposal, field, value)

    if payload.line_items is not None:
        db.query(ProposalLineItem).filter(ProposalLineItem.proposal_id == proposal.id).delete()
        for item in payload.line_items:
            db.add(ProposalLineItem(proposal_id=proposal.id, **item.model_dump()))

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/submit", response_model=ProposalOut)
def submit_proposal(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    proposal = _get_or_404(db, proposal_id)
    if proposal.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft proposals can be submitted for approval.")
    proposal.status = "pending_approval"
    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/approve", response_model=ProposalOut)
def approve_proposal(proposal_id: uuid.UUID, payload: ProposalApprove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    proposal = _get_or_404(db, proposal_id)
    if proposal.status != "pending_approval":
        raise HTTPException(status_code=400, detail="Proposal must be pending_approval to approve.")
    proposal.status = "approved"
    proposal.approved_by = current_user.id
    proposal.approved_at = datetime.now(timezone.utc)
    if payload.reviewer_notes:
        proposal.reviewer_notes = payload.reviewer_notes
    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/send", response_model=ProposalOut)
def send_proposal(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    proposal = _get_or_404(db, proposal_id)
    if proposal.status != "approved":
        raise HTTPException(status_code=400, detail="Proposal must be approved before sending.")
    proposal.status = "sent"
    proposal.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/accept", response_model=ProposalOut)
def accept_proposal(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    from app.models.lead import Lead
    from app.models.client import Client, Onboarding

    proposal = _get_or_404(db, proposal_id)
    if proposal.status not in ("sent", "viewed"):
        raise HTTPException(status_code=400, detail="Proposal must be sent or viewed to accept.")

    proposal.status = "accepted"
    proposal.accepted_at = datetime.now(timezone.utc)

    lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
    if lead:
        lead.status = "converted"

    # Auto-create client and onboarding record
    existing_client = db.query(Client).filter(Client.lead_id == proposal.lead_id).first()
    if not existing_client:
        new_client = Client(
            lead_id=proposal.lead_id,
            proposal_id=proposal.id,
            company_name=lead.company_name if lead else "Unknown",
            industry=lead.industry if lead else None,
            status="onboarding",
        )
        db.add(new_client)
        db.flush()
        db.add(Onboarding(
            client_id=new_client.id,
            business_name=lead.company_name if lead else None,
            business_phone=lead.phone if lead else None,
            status="draft",
            created_by=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        ))

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/reject", response_model=ProposalOut)
def reject_proposal(proposal_id: uuid.UUID, payload: ProposalReject, db: Session = Depends(get_db)):
    proposal = _get_or_404(db, proposal_id)
    proposal.status = "rejected"
    proposal.reviewer_notes = payload.reason
    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/{proposal_id}/pdf")
def download_proposal_pdf(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    from app.models.lead import Lead
    from app.services.proposal_pdf import generate_proposal_pdf

    proposal = _get_or_404(db, proposal_id)
    if proposal.status == "generating":
        raise HTTPException(400, "Proposal is still generating.")

    lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found for this proposal.")

    pdf_bytes = generate_proposal_pdf(proposal, lead)
    filename = f"jojo-proposal-{lead.company_name.replace(' ', '-').lower()}-v{proposal.version}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
