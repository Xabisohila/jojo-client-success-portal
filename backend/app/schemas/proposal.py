import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

PRICING_TIERS = ["starter", "professional", "enterprise", "custom"]
PROPOSAL_STATUSES = ["generating", "draft", "pending_approval", "approved", "sent", "viewed", "accepted", "rejected", "expired"]


class LineItemCreate(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: int = 1
    unit_price: float
    total_price: float
    is_recurring: bool = True
    sort_order: int = 0


class ProposalUpdate(BaseModel):
    pricing_tier: Optional[str] = None
    scope_summary: Optional[str] = None
    executive_summary: Optional[str] = None
    monthly_fee: Optional[float] = None
    setup_fee: Optional[float] = None
    contract_months: Optional[int] = None
    roi_monthly: Optional[float] = None
    roi_annual: Optional[float] = None
    roi_rationale: Optional[str] = None
    valid_until: Optional[date] = None
    line_items: Optional[list[LineItemCreate]] = None


class ProposalApprove(BaseModel):
    reviewer_notes: Optional[str] = None


class ProposalReject(BaseModel):
    reason: str


class LineItemOut(BaseModel):
    id: uuid.UUID
    item_name: str
    description: Optional[str]
    quantity: int
    unit_price: float
    total_price: float
    is_recurring: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ProposalOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    assessment_id: Optional[uuid.UUID]
    version: int
    status: str
    pricing_tier: str
    scope_summary: Optional[str]
    executive_summary: Optional[str]
    monthly_fee: Optional[float]
    setup_fee: Optional[float]
    contract_months: int
    roi_monthly: Optional[float]
    roi_annual: Optional[float]
    roi_rationale: Optional[str]
    valid_until: Optional[date]
    reviewer_notes: Optional[str]
    approved_by: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    sent_at: Optional[datetime]
    accepted_at: Optional[datetime]
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    line_items: list[LineItemOut] = []

    model_config = {"from_attributes": True}


class ProposalListItem(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    status: str
    pricing_tier: str
    monthly_fee: Optional[float]
    setup_fee: Optional[float]
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}
