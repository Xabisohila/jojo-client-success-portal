from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db
from app.models.lead import Lead, LeadActivity
from app.models.assessment import Assessment
from app.models.proposal import Proposal

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardSummary(BaseModel):
    leads_total: int
    leads_new: int
    leads_qualified: int
    leads_converted: int
    assessments_pending_approval: int
    proposals_pending_approval: int
    proposals_sent: int
    proposals_accepted: int


class RecentActivityItem(BaseModel):
    activity_type: str
    subject: str
    lead_id: str
    company_name: str
    created_at: str


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db)):
    lead_counts = {
        row[0]: row[1]
        for row in db.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all()
    }
    return DashboardSummary(
        leads_total=sum(lead_counts.values()),
        leads_new=lead_counts.get("new", 0),
        leads_qualified=lead_counts.get("qualified", 0),
        leads_converted=lead_counts.get("converted", 0),
        assessments_pending_approval=db.query(Assessment).filter(Assessment.status == "pending_approval").count(),
        proposals_pending_approval=db.query(Proposal).filter(Proposal.status == "pending_approval").count(),
        proposals_sent=db.query(Proposal).filter(Proposal.status == "sent").count(),
        proposals_accepted=db.query(Proposal).filter(Proposal.status == "accepted").count(),
    )


@router.get("/recent-activity", response_model=list[RecentActivityItem])
def get_recent_activity(db: Session = Depends(get_db)):
    rows = (
        db.query(LeadActivity, Lead.company_name)
        .join(Lead, Lead.id == LeadActivity.lead_id)
        .order_by(LeadActivity.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        RecentActivityItem(
            activity_type=act.activity_type,
            subject=act.subject or "",
            lead_id=str(act.lead_id),
            company_name=company_name,
            created_at=act.created_at.isoformat(),
        )
        for act, company_name in rows
    ]
