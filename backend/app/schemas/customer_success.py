import uuid
from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel, Field


# ── Go Live ───────────────────────────────────────────────────────────────

class GoLiveConfirm(BaseModel):
    actual_go_live: Optional[date] = None
    jojo_number_confirmed: Optional[str] = None
    call_forwarding_verified: bool = False
    test_call_completed: bool = False
    client_signed_off: bool = False
    notes: Optional[str] = None


class GoLiveEventOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    confirmed_by: Optional[uuid.UUID]
    actual_go_live: Optional[date]
    jojo_number_confirmed: Optional[str]
    call_forwarding_verified: bool
    test_call_completed: bool
    client_signed_off: bool
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Customer Health ────────────────────────────────────────────────────────

class HealthScoreCreate(BaseModel):
    usage_score: Optional[int] = Field(None, ge=0, le=25)
    support_score: Optional[int] = Field(None, ge=0, le=25)
    engagement_score: Optional[int] = Field(None, ge=0, le=25)
    roi_score: Optional[int] = Field(None, ge=0, le=25)
    notes: Optional[str] = None


class CustomerHealthOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    health_score: Optional[int]
    usage_score: Optional[int]
    support_score: Optional[int]
    engagement_score: Optional[int]
    roi_score: Optional[int]
    risk_level: str
    ai_summary: Optional[str]
    ai_recommendations: Optional[str]
    notes: Optional[str]
    calculated_at: datetime
    calculated_by: Optional[uuid.UUID]

    model_config = {"from_attributes": True}


# ── Check-ins ─────────────────────────────────────────────────────────────

class CheckinCreate(BaseModel):
    checkin_type: str = "ad_hoc"
    scheduled_at: Optional[datetime] = None
    summary: Optional[str] = None
    outcome: Optional[str] = None
    action_items: Optional[list[dict[str, Any]]] = None
    next_checkin_date: Optional[date] = None


class CheckinComplete(BaseModel):
    outcome: str
    summary: str
    action_items: Optional[list[dict[str, Any]]] = None
    next_checkin_date: Optional[date] = None


class CheckinOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    checkin_type: str
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    conducted_by: Optional[uuid.UUID]
    outcome: Optional[str]
    summary: Optional[str]
    action_items: Optional[list[dict[str, Any]]]
    next_checkin_date: Optional[date]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── NPS ───────────────────────────────────────────────────────────────────

class NpsCreate(BaseModel):
    score: int = Field(..., ge=0, le=10)
    verbatim: Optional[str] = None
    survey_period: Optional[str] = None


class NpsResponseOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    score: int
    category: str
    verbatim: Optional[str]
    survey_period: Optional[str]
    submitted_at: datetime
    recorded_by: Optional[uuid.UUID]

    model_config = {"from_attributes": True}


# ── CS Dashboard ──────────────────────────────────────────────────────────

class CSDashboardSummary(BaseModel):
    active_clients: int
    go_live_clients: int
    healthy: int
    at_risk: int
    critical: int
    avg_health_score: Optional[float]
    nps_average: Optional[float]
    promoters: int
    passives: int
    detractors: int
    checkins_due_7_days: int
    renewals_due_30_days: int
    renewals_due_60_days: int


class ClientHealthSummary(BaseModel):
    client_id: uuid.UUID
    company_name: str
    status: str
    health_score: Optional[int]
    risk_level: str
    last_checkin: Optional[datetime]
    last_nps: Optional[int]
    days_since_go_live: Optional[int]
