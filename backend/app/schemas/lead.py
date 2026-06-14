import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


LEAD_STATUSES = ["new", "contacted", "engaged", "qualified", "disqualified", "converted"]
LEAD_SOURCES = ["website", "referral", "cold_outreach", "linkedin", "event", "partner", "inbound_call", "other"]
ACTIVITY_TYPES = ["email", "call", "note", "status_change", "score_update", "system"]


class LeadCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    job_title: Optional[str] = None
    company_name: str
    industry: Optional[str] = None
    company_size: Optional[str] = None
    monthly_call_volume: Optional[str] = None
    current_solution: Optional[str] = None
    pain_points: Optional[str] = None
    source: str = "other"
    assigned_to: Optional[uuid.UUID] = None


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    monthly_call_volume: Optional[str] = None
    current_solution: Optional[str] = None
    pain_points: Optional[str] = None
    source: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None


class LeadQualify(BaseModel):
    note: Optional[str] = None


class LeadDisqualify(BaseModel):
    reason: str


class ActivityCreate(BaseModel):
    activity_type: str
    subject: Optional[str] = None
    body: Optional[str] = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    activity_type: str
    subject: Optional[str]
    body: Optional[str]
    performed_by: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    job_title: Optional[str]
    company_name: str
    industry: Optional[str]
    company_size: Optional[str]
    monthly_call_volume: Optional[str]
    current_solution: Optional[str]
    pain_points: Optional[str]
    source: str
    status: str
    lead_score: Optional[int]
    opportunity_score: Optional[int]
    score_rationale: Optional[str]
    recommended_action: Optional[str]
    assigned_to: Optional[uuid.UUID]
    disqualified_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    activities: list[ActivityOut] = []

    model_config = {"from_attributes": True}


class LeadListItem(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    company_name: str
    industry: Optional[str]
    status: str
    lead_score: Optional[int]
    opportunity_score: Optional[int]
    recommended_action: Optional[str]
    assigned_to: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineSummary(BaseModel):
    new: int = 0
    contacted: int = 0
    engaged: int = 0
    qualified: int = 0
    disqualified: int = 0
    converted: int = 0
    total: int = 0
