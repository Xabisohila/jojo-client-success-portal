import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.lead import Lead
from app.models.assessment import Assessment, AssessmentSection, AssessmentResponse
from app.schemas.assessment import (
    AssessmentCreate, AssessmentOut, AssessmentListItem,
    SectionResponsesUpdate, AssessmentApprove, AssessmentRequestChanges,
)
from app.services.assessment_scoring import score_assessment, get_questions_for_section

router = APIRouter(tags=["assessments"])

SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
SECTION_TYPES = ["business", "operational", "technology", "leadership"]


def _get_or_404(db: Session, model, id: uuid.UUID, label: str):
    obj = db.query(model).filter(model.id == id).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found.")
    return obj


# ── Create assessment for a lead ──────────────────────────────────────────
@router.post("/leads/{lead_id}/assessments", response_model=AssessmentOut, status_code=201)
def create_assessment(lead_id: uuid.UUID, db: Session = Depends(get_db)):
    lead = _get_or_404(db, Lead, lead_id, "Lead")
    if lead.status != "qualified":
        raise HTTPException(status_code=400, detail="Only qualified leads can have an assessment created.")

    assessment = Assessment(lead_id=lead_id, created_by=SYSTEM_USER_ID, status="in_progress")
    db.add(assessment)
    db.flush()

    for section_type in SECTION_TYPES:
        section = AssessmentSection(assessment_id=assessment.id, section_type=section_type)
        db.add(section)
        db.flush()
        for q in get_questions_for_section(section_type):
            db.add(AssessmentResponse(
                section_id=section.id,
                question_key=q["key"],
                question_text=q["text"],
                weight=q["weight"],
            ))

    db.commit()
    db.refresh(assessment)
    return assessment


# ── Get assessment detail ─────────────────────────────────────────────────
@router.get("/assessments/{assessment_id}", response_model=AssessmentOut)
def get_assessment(assessment_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_or_404(db, Assessment, assessment_id, "Assessment")


# ── List assessments ──────────────────────────────────────────────────────
@router.get("/assessments")
def list_assessments(
    page: int = 1, page_size: int = 25, db: Session = Depends(get_db)
):
    import math
    q = db.query(Assessment).order_by(Assessment.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [AssessmentListItem.model_validate(i).model_dump() for i in items],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


# ── Save section responses ────────────────────────────────────────────────
@router.patch("/assessments/{assessment_id}/sections", response_model=AssessmentOut)
def update_section_responses(
    assessment_id: uuid.UUID,
    payload: SectionResponsesUpdate,
    db: Session = Depends(get_db),
):
    assessment = _get_or_404(db, Assessment, assessment_id, "Assessment")
    if assessment.status not in ("draft", "in_progress", "changes_requested"):
        raise HTTPException(status_code=400, detail="Assessment is not editable in its current status.")

    section = next((s for s in assessment.sections if s.section_type == payload.section_type), None)
    if not section:
        raise HTTPException(status_code=404, detail=f"Section '{payload.section_type}' not found.")

    for update in payload.responses:
        response = next((r for r in section.responses if r.question_key == update.question_key), None)
        if response:
            response.response_value = update.response_value
        else:
            db.add(AssessmentResponse(
                section_id=section.id,
                question_key=update.question_key,
                question_text=update.question_text,
                response_value=update.response_value,
                weight=update.weight,
            ))

    assessment.status = "in_progress"
    db.commit()
    db.refresh(assessment)
    return assessment


# ── Submit for AI scoring ─────────────────────────────────────────────────
@router.post("/assessments/{assessment_id}/submit", response_model=AssessmentOut)
def submit_assessment(assessment_id: uuid.UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    assessment = _get_or_404(db, Assessment, assessment_id, "Assessment")
    if assessment.status not in ("in_progress", "changes_requested"):
        raise HTTPException(status_code=400, detail="Assessment must be in_progress to submit.")

    answered = sum(
        1 for s in assessment.sections
        for r in s.responses if r.response_value
    )
    if answered < 12:
        raise HTTPException(status_code=400, detail=f"At least 12 of 16 questions must be answered (answered: {answered}).")

    assessment.status = "ai_scored"
    db.commit()
    background_tasks.add_task(score_assessment, assessment_id)
    db.refresh(assessment)
    return assessment


# ── Human Gate 2 — Approve ────────────────────────────────────────────────
@router.post("/assessments/{assessment_id}/approve", response_model=AssessmentOut)
def approve_assessment(
    assessment_id: uuid.UUID,
    payload: AssessmentApprove,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.services.proposal_generator import generate_proposal

    assessment = _get_or_404(db, Assessment, assessment_id, "Assessment")
    if assessment.status != "pending_approval":
        raise HTTPException(status_code=400, detail="Assessment must be pending_approval to approve.")

    assessment.status = "approved"
    assessment.approved_by = SYSTEM_USER_ID
    assessment.approved_at = datetime.now(timezone.utc)
    if payload.reviewer_notes:
        assessment.reviewer_notes = payload.reviewer_notes
    db.commit()

    background_tasks.add_task(generate_proposal, assessment_id)
    db.refresh(assessment)
    return assessment


# ── Human Gate 2 — Request Changes ────────────────────────────────────────
@router.post("/assessments/{assessment_id}/request-changes", response_model=AssessmentOut)
def request_changes(assessment_id: uuid.UUID, payload: AssessmentRequestChanges, db: Session = Depends(get_db)):
    assessment = _get_or_404(db, Assessment, assessment_id, "Assessment")
    if assessment.status != "pending_approval":
        raise HTTPException(status_code=400, detail="Assessment must be pending_approval to request changes.")

    assessment.status = "changes_requested"
    assessment.reviewer_notes = payload.reviewer_notes
    db.commit()
    db.refresh(assessment)
    return assessment
