import uuid
from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel


# ── Client ────────────────────────────────────────────────────────────────

class ClientOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    proposal_id: Optional[uuid.UUID]
    company_name: str
    industry: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListItem(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    company_name: str
    industry: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Onboarding ────────────────────────────────────────────────────────────

class BusinessHoursDay(BaseModel):
    is_open: bool = True
    open: str = "09:00"
    close: str = "17:00"


class EscalationContact(BaseModel):
    name: str
    role: str
    phone: str
    trigger: str  # when to escalate to this person


class FAQ(BaseModel):
    question: str
    answer: str


class OnboardingStep1(BaseModel):
    """Business Profile"""
    business_name: Optional[str] = None
    abn: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    website: Optional[str] = None
    business_address: Optional[str] = None
    staff_count: Optional[str] = None


class OnboardingStep2(BaseModel):
    """Business Hours & Availability"""
    business_hours: Optional[dict] = None  # {monday: {is_open, open, close}, ...}
    timezone: Optional[str] = None
    public_holiday_handling: Optional[str] = None
    emergency_policy: Optional[str] = None


class OnboardingStep3(BaseModel):
    """Services & Call Handling"""
    primary_services: Optional[list[str]] = None
    call_types: Optional[list[str]] = None
    excluded_topics: Optional[str] = None
    greeting_style: Optional[str] = None  # professional, friendly, formal


class OnboardingStep4(BaseModel):
    """FAQs & Knowledge Base"""
    faqs: Optional[list[dict]] = None  # [{question, answer}]
    key_policies: Optional[str] = None
    special_instructions: Optional[str] = None


class OnboardingStep5(BaseModel):
    """Integrations & Technical Setup"""
    calendar_system: Optional[str] = None
    calendar_details: Optional[dict] = None
    crm_system: Optional[str] = None
    crm_details: Optional[dict] = None
    phone_system: Optional[str] = None
    existing_number: Optional[str] = None
    can_forward_calls: Optional[bool] = None
    escalation_contacts: Optional[list[dict]] = None


class OnboardingApprove(BaseModel):
    reviewer_notes: Optional[str] = None


class OnboardingOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    status: str
    business_name: Optional[str]
    abn: Optional[str]
    business_phone: Optional[str]
    business_email: Optional[str]
    website: Optional[str]
    business_address: Optional[str]
    staff_count: Optional[str]
    business_hours: Optional[Any]
    timezone: str
    public_holiday_handling: Optional[str]
    emergency_policy: Optional[str]
    primary_services: Optional[Any]
    call_types: Optional[Any]
    excluded_topics: Optional[str]
    greeting_style: str
    faqs: Optional[Any]
    key_policies: Optional[str]
    special_instructions: Optional[str]
    calendar_system: Optional[str]
    calendar_details: Optional[Any]
    crm_system: Optional[str]
    crm_details: Optional[Any]
    phone_system: Optional[str]
    existing_number: Optional[str]
    can_forward_calls: Optional[bool]
    escalation_contacts: Optional[Any]
    reviewer_notes: Optional[str]
    approved_by: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Jojo Config ───────────────────────────────────────────────────────────

class JojoConfigUpdate(BaseModel):
    missed_call_message: Optional[str] = None
    after_hours_message: Optional[str] = None
    conversation_flow: Optional[dict] = None
    booking_rules: Optional[dict] = None
    escalation_rules: Optional[list] = None
    knowledge_base: Optional[dict] = None
    jojo_phone_number: Optional[str] = None


class JojoConfigApprove(BaseModel):
    reviewer_notes: Optional[str] = None
    jojo_phone_number: Optional[str] = None


class JojoConfigOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    onboarding_id: Optional[uuid.UUID]
    version: int
    status: str
    missed_call_message: Optional[str]
    after_hours_message: Optional[str]
    conversation_flow: Optional[Any]
    booking_rules: Optional[Any]
    escalation_rules: Optional[Any]
    knowledge_base: Optional[Any]
    config_summary: Optional[str]
    jojo_phone_number: Optional[str]
    reviewer_notes: Optional[str]
    approved_by: Optional[uuid.UUID]
    approved_at: Optional[datetime]
    deployed_at: Optional[datetime]
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Implementation ────────────────────────────────────────────────────────

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    due_date: Optional[date] = None


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str]
    category: str
    status: str
    priority: str
    assigned_to: Optional[uuid.UUID]
    due_date: Optional[date]
    completed_at: Optional[datetime]
    notes: Optional[str]
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ImplementationProjectOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    jojo_config_id: Optional[uuid.UUID]
    status: str
    target_go_live: Optional[date]
    actual_go_live: Optional[date]
    project_manager: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    tasks: list[TaskOut] = []

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    status: Optional[str] = None
    target_go_live: Optional[date] = None
    project_manager: Optional[uuid.UUID] = None
