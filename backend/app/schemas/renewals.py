from __future__ import annotations
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class RenewalCreate(BaseModel):
    contract_start: date
    contract_end: date
    contract_months: int = 12
    monthly_fee: Optional[Decimal] = None
    setup_fee: Optional[Decimal] = None
    renewal_notes: Optional[str] = None
    next_contact_date: Optional[date] = None


class RenewalUpdate(BaseModel):
    status: Optional[str] = None
    renewal_notes: Optional[str] = None
    next_contact_date: Optional[date] = None
    new_contract_months: Optional[int] = None
    new_monthly_fee: Optional[Decimal] = None


class RenewalOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    contract_start: date
    contract_end: date
    contract_months: int
    monthly_fee: Optional[Decimal]
    setup_fee: Optional[Decimal]
    status: str
    renewal_notes: Optional[str]
    next_contact_date: Optional[date]
    renewed_at: Optional[datetime]
    new_contract_months: Optional[int]
    new_monthly_fee: Optional[Decimal]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RenewalListItem(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    company_name: str
    client_status: str
    contract_start: date
    contract_end: date
    contract_months: int
    monthly_fee: Optional[Decimal]
    status: str
    renewal_notes: Optional[str]
    next_contact_date: Optional[date]
    days_to_renewal: int
    renewed_at: Optional[datetime]
    new_contract_months: Optional[int]
    new_monthly_fee: Optional[Decimal]
    upsell_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpsellCreate(BaseModel):
    type: str = "custom"
    title: str
    description: Optional[str] = None
    estimated_mrr: Optional[Decimal] = None
    notes: Optional[str] = None


class UpsellUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_mrr: Optional[Decimal] = None
    notes: Optional[str] = None


class UpsellOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    type: str
    title: str
    description: Optional[str]
    estimated_mrr: Optional[Decimal]
    status: str
    identified_at: datetime
    pitched_at: Optional[datetime]
    closed_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RenewalDashboard(BaseModel):
    total_active: int
    due_soon: int       # ≤60 days
    urgent: int         # ≤30 days
    overdue: int        # past contract_end
    in_negotiation: int
    renewed_this_quarter: int
    mrr_at_risk: float
    total_mrr: float
    upsell_identified: int
    upsell_pitched: int
    upsell_won_quarter: int
    upsell_pipeline_value: float
    upsell_won_value: float
