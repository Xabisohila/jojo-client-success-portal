import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

SECTION_TYPES = ["business", "operational", "technology", "leadership"]
ASSESSMENT_STATUSES = ["draft", "in_progress", "ai_scored", "pending_approval", "approved", "changes_requested", "flagged"]
RISK_LEVELS = ["low", "medium", "high", "critical"]


class ResponseUpsert(BaseModel):
    question_key: str
    question_text: str
    response_value: Optional[str]
    weight: float = 1.0


class SectionResponsesUpdate(BaseModel):
    section_type: str
    responses: list[ResponseUpsert]


class AssessmentCreate(BaseModel):
    lead_id: uuid.UUID


class AssessmentApprove(BaseModel):
    reviewer_notes: Optional[str] = None


class AssessmentRequestChanges(BaseModel):
    reviewer_notes: str


class RiskOut(BaseModel):
    id: uuid.UUID
    risk_category: str
    risk_description: str
    severity: str
    mitigation: Optional[str]

    model_config = {"from_attributes": True}


class ResponseOut(BaseModel):
    id: uuid.UUID
    question_key: str
    question_text: str
    response_value: Optional[str]
    weight: float
    points_earned: Optional[float]

    model_config = {"from_attributes": True}


class SectionOut(BaseModel):
    id: uuid.UUID
    section_type: str
    score: Optional[int]
    max_score: int
    ai_analysis: Optional[str]
    responses: list[ResponseOut] = []

    model_config = {"from_attributes": True}


class AssessmentOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    status: str
    total_score: Optional[int]
    risk_level: Optional[str]
    ai_summary: Optional[str]
    ai_recommendations: Optional[str]
    reviewer_notes: Optional[str]
    approved_by: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    sections: list[SectionOut] = []
    risks: list[RiskOut] = []

    model_config = {"from_attributes": True}


class AssessmentListItem(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    status: str
    total_score: Optional[int]
    risk_level: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
