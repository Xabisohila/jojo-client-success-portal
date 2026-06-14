import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Date, ForeignKey, Text, text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Renewal(Base):
    __tablename__ = "renewals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    contract_start: Mapped[date] = mapped_column(Date, nullable=False)
    contract_end: Mapped[date] = mapped_column(Date, nullable=False)
    contract_months: Mapped[int] = mapped_column(Integer, default=12)
    monthly_fee: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    setup_fee: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    # active | in_negotiation | renewed | lost
    renewal_notes: Mapped[Optional[str]] = mapped_column(Text)
    next_contact_date: Mapped[Optional[date]] = mapped_column(Date)
    renewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    renewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    new_contract_months: Mapped[Optional[int]] = mapped_column(Integer)
    new_monthly_fee: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    client: Mapped["Client"] = relationship("Client", back_populates="renewals")  # type: ignore[name-defined]


class UpsellOpportunity(Base):
    __tablename__ = "upsell_opportunities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False, default="custom")
    # tier_upgrade | additional_location | add_on_feature | volume_increase | referral | custom
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    estimated_mrr: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String, nullable=False, default="identified")
    # identified | pitched | won | lost
    identified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    pitched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="upsell_opportunities")  # type: ignore[name-defined]
