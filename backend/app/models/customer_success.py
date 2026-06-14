import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class GoLiveEvent(Base):
    """Gate 6 — formal go-live confirmation, transitions client active."""
    __tablename__ = "go_live_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    actual_go_live: Mapped[Optional[date]] = mapped_column(Date)
    jojo_number_confirmed: Mapped[Optional[str]] = mapped_column(String)
    call_forwarding_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    test_call_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    client_signed_off: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    client: Mapped["Client"] = relationship("Client", back_populates="go_live_events")  # type: ignore[name-defined]


class CustomerHealth(Base):
    """Periodic health score snapshot — AI-calculated or manually entered."""
    __tablename__ = "customer_health"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)

    # 4 sub-scores × 25 = 100
    health_score: Mapped[Optional[int]] = mapped_column(Integer)       # 0–100 composite
    usage_score: Mapped[Optional[int]] = mapped_column(Integer)        # 0–25 product adoption
    support_score: Mapped[Optional[int]] = mapped_column(Integer)      # 0–25 support sentiment
    engagement_score: Mapped[Optional[int]] = mapped_column(Integer)   # 0–25 check-in regularity
    roi_score: Mapped[Optional[int]] = mapped_column(Integer)          # 0–25 value realisation

    risk_level: Mapped[str] = mapped_column(String, nullable=False, default="healthy")
    # healthy (70–100), at_risk (40–69), critical (<40)

    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendations: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    calculated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    # null = auto-calculated by AI

    client: Mapped["Client"] = relationship("Client", back_populates="health_scores")  # type: ignore[name-defined]


class Checkin(Base):
    """Scheduled or ad-hoc customer touchpoint."""
    __tablename__ = "checkins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)

    checkin_type: Mapped[str] = mapped_column(String, nullable=False, default="ad_hoc")
    # onboarding_call, qbr, health_check, renewal_discussion, ad_hoc

    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    conducted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    outcome: Mapped[Optional[str]] = mapped_column(String)
    # positive, neutral, negative, escalated
    summary: Mapped[Optional[str]] = mapped_column(Text)
    action_items: Mapped[Optional[list]] = mapped_column(JSONB)
    # [{item, owner, due_date, completed}]

    next_checkin_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    client: Mapped["Client"] = relationship("Client", back_populates="checkins")  # type: ignore[name-defined]


class NpsResponse(Base):
    """NPS survey response from client."""
    __tablename__ = "nps_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)

    score: Mapped[int] = mapped_column(Integer, nullable=False)   # 0–10
    category: Mapped[str] = mapped_column(String, nullable=False)
    # promoter (9–10), passive (7–8), detractor (0–6)
    verbatim: Mapped[Optional[str]] = mapped_column(Text)
    survey_period: Mapped[Optional[str]] = mapped_column(String)   # e.g. "Q2 2026"

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    recorded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    client: Mapped["Client"] = relationship("Client", back_populates="nps_responses")  # type: ignore[name-defined]
