import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String)
    job_title: Mapped[Optional[str]] = mapped_column(String)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String)
    company_size: Mapped[Optional[str]] = mapped_column(String)        # '1-10','11-50','51-200','201-500','500+'
    monthly_call_volume: Mapped[Optional[str]] = mapped_column(String) # '<100','100-500','500+'
    current_solution: Mapped[Optional[str]] = mapped_column(Text)
    pain_points: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String, nullable=False, default="other")
    status: Mapped[str] = mapped_column(String, nullable=False, default="new")
    lead_score: Mapped[Optional[int]] = mapped_column(Integer)
    opportunity_score: Mapped[Optional[int]] = mapped_column(Integer)
    score_rationale: Mapped[Optional[str]] = mapped_column(Text)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    disqualified_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    activities: Mapped[list["LeadActivity"]] = relationship("LeadActivity", back_populates="lead", order_by="LeadActivity.created_at.desc()")
    status_history: Mapped[list["LeadStatusHistory"]] = relationship("LeadStatusHistory", back_populates="lead")
    assessments: Mapped[list["Assessment"]] = relationship("Assessment", back_populates="lead")  # type: ignore


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String, nullable=False)  # email, call, note, status_change, score_update, system
    subject: Mapped[Optional[str]] = mapped_column(String)
    body: Mapped[Optional[str]] = mapped_column(Text)
    performed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    lead: Mapped["Lead"] = relationship("Lead", back_populates="activities")


class LeadStatusHistory(Base):
    __tablename__ = "lead_status_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[Optional[str]] = mapped_column(String)
    to_status: Mapped[str] = mapped_column(String, nullable=False)
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    note: Mapped[Optional[str]] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    lead: Mapped["Lead"] = relationship("Lead", back_populates="status_history")
