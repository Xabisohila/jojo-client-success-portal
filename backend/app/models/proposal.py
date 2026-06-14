import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Date, ForeignKey, Text, text, Numeric, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    assessment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("assessments.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String, nullable=False, default="generating")
    # generating -> draft -> pending_approval -> approved -> sent -> viewed -> accepted | rejected | expired
    pricing_tier: Mapped[str] = mapped_column(String, nullable=False)  # starter, professional, enterprise, custom
    scope_summary: Mapped[Optional[str]] = mapped_column(Text)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text)
    monthly_fee: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    setup_fee: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    contract_months: Mapped[int] = mapped_column(Integer, default=12)
    roi_monthly: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    roi_annual: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    roi_rationale: Mapped[Optional[str]] = mapped_column(Text)
    valid_until: Mapped[Optional[date]] = mapped_column(Date)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    line_items: Mapped[list["ProposalLineItem"]] = relationship(
        "ProposalLineItem", back_populates="proposal",
        cascade="all, delete-orphan",
        order_by="ProposalLineItem.sort_order"
    )


class ProposalLineItem(Base):
    __tablename__ = "proposal_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False)
    item_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    proposal: Mapped["Proposal"] = relationship("Proposal", back_populates="line_items")
