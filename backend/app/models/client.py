import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    proposal_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("proposals.id"))
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False, default="onboarding")
    # onboarding → implementation → go_live → active → churned
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    onboarding: Mapped[Optional["Onboarding"]] = relationship("Onboarding", back_populates="client", uselist=False)
    jojo_configs: Mapped[list["JojoConfig"]] = relationship("JojoConfig", back_populates="client")
    implementation_projects: Mapped[list["ImplementationProject"]] = relationship("ImplementationProject", back_populates="client")
    go_live_events: Mapped[list["GoLiveEvent"]] = relationship("GoLiveEvent", back_populates="client")  # type: ignore[name-defined]
    health_scores: Mapped[list["CustomerHealth"]] = relationship("CustomerHealth", back_populates="client", order_by="CustomerHealth.calculated_at.desc()")  # type: ignore[name-defined]
    checkins: Mapped[list["Checkin"]] = relationship("Checkin", back_populates="client", order_by="Checkin.created_at.desc()")  # type: ignore[name-defined]
    nps_responses: Mapped[list["NpsResponse"]] = relationship("NpsResponse", back_populates="client", order_by="NpsResponse.submitted_at.desc()")  # type: ignore[name-defined]
    renewals: Mapped[list["Renewal"]] = relationship("Renewal", back_populates="client", order_by="Renewal.contract_end.desc()")  # type: ignore[name-defined]
    upsell_opportunities: Mapped[list["UpsellOpportunity"]] = relationship("UpsellOpportunity", back_populates="client", order_by="UpsellOpportunity.created_at.desc()")  # type: ignore[name-defined]


class Onboarding(Base):
    __tablename__ = "onboardings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    # draft → in_progress → pending_approval → approved

    # Business Profile
    business_name: Mapped[Optional[str]] = mapped_column(String)
    abn: Mapped[Optional[str]] = mapped_column(String)
    business_phone: Mapped[Optional[str]] = mapped_column(String)
    business_email: Mapped[Optional[str]] = mapped_column(String)
    website: Mapped[Optional[str]] = mapped_column(String)
    business_address: Mapped[Optional[str]] = mapped_column(Text)
    staff_count: Mapped[Optional[str]] = mapped_column(String)

    # Business Hours & Availability
    business_hours: Mapped[Optional[dict]] = mapped_column(JSONB)
    timezone: Mapped[str] = mapped_column(String, default="Australia/Sydney")
    public_holiday_handling: Mapped[Optional[str]] = mapped_column(Text)
    emergency_policy: Mapped[Optional[str]] = mapped_column(Text)

    # Services & Call Types
    primary_services: Mapped[Optional[list]] = mapped_column(JSONB)
    call_types: Mapped[Optional[list]] = mapped_column(JSONB)
    excluded_topics: Mapped[Optional[str]] = mapped_column(Text)
    greeting_style: Mapped[str] = mapped_column(String, default="professional")
    # professional, friendly, formal

    # FAQs & Knowledge
    faqs: Mapped[Optional[list]] = mapped_column(JSONB)
    key_policies: Mapped[Optional[str]] = mapped_column(Text)
    special_instructions: Mapped[Optional[str]] = mapped_column(Text)

    # Integrations
    calendar_system: Mapped[Optional[str]] = mapped_column(String)
    calendar_details: Mapped[Optional[dict]] = mapped_column(JSONB)
    crm_system: Mapped[Optional[str]] = mapped_column(String)
    crm_details: Mapped[Optional[dict]] = mapped_column(JSONB)
    phone_system: Mapped[Optional[str]] = mapped_column(String)
    existing_number: Mapped[Optional[str]] = mapped_column(String)
    can_forward_calls: Mapped[Optional[bool]] = mapped_column(Boolean)

    # Escalation Contacts
    escalation_contacts: Mapped[Optional[list]] = mapped_column(JSONB)

    # Approval
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="onboarding")


class JojoConfig(Base):
    __tablename__ = "jojo_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    onboarding_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("onboardings.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String, nullable=False, default="generating")
    # generating → draft → pending_review → approved → deployed

    # AI-generated content
    # NOTE: columns are still named greeting_message/call_flow in the DB (migration
    # 006 renaming them to missed_call_message/conversation_flow is written but not
    # yet applied — needs Postgres table-owner privileges this app's role lacks).
    # The content/behavior fix (no live voice AI, WhatsApp-first flow) lives in the
    # prompts and fallback text in config_generator.py, not in these column names.
    greeting_message: Mapped[Optional[str]] = mapped_column(Text)
    after_hours_message: Mapped[Optional[str]] = mapped_column(Text)
    call_flow: Mapped[Optional[dict]] = mapped_column(JSONB)
    booking_rules: Mapped[Optional[dict]] = mapped_column(JSONB)
    escalation_rules: Mapped[Optional[list]] = mapped_column(JSONB)
    knowledge_base: Mapped[Optional[dict]] = mapped_column(JSONB)
    config_summary: Mapped[Optional[str]] = mapped_column(Text)

    # Deployment
    jojo_phone_number: Mapped[Optional[str]] = mapped_column(String)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deployed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="jojo_configs")
    implementation_project: Mapped[Optional["ImplementationProject"]] = relationship(
        "ImplementationProject", back_populates="jojo_config", uselist=False
    )


class ImplementationProject(Base):
    __tablename__ = "implementation_projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    jojo_config_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("jojo_configs.id"))
    status: Mapped[str] = mapped_column(String, nullable=False, default="not_started")
    # not_started → in_progress → blocked → completed
    target_go_live: Mapped[Optional[date]] = mapped_column(Date)
    actual_go_live: Mapped[Optional[date]] = mapped_column(Date)
    project_manager: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="implementation_projects")
    jojo_config: Mapped[Optional["JojoConfig"]] = relationship("JojoConfig", back_populates="implementation_project")
    tasks: Mapped[list["ImplementationTask"]] = relationship(
        "ImplementationTask", back_populates="project",
        cascade="all, delete-orphan",
        order_by="ImplementationTask.sort_order"
    )


class ImplementationTask(Base):
    __tablename__ = "implementation_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("implementation_projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String, nullable=False, default="setup")
    # setup, integration, configuration, testing, training, sign_off
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    # pending, in_progress, completed, blocked, skipped
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    # low, medium, high, critical
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    project: Mapped["ImplementationProject"] = relationship("ImplementationProject", back_populates="tasks")
