import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    # draft -> in_progress -> ai_scored -> pending_approval -> approved | changes_requested | flagged
    total_score: Mapped[Optional[int]] = mapped_column(Integer)
    risk_level: Mapped[Optional[str]] = mapped_column(String)  # low, medium, high, critical
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    ai_recommendations: Mapped[Optional[str]] = mapped_column(Text)
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=datetime.utcnow)

    lead: Mapped["Lead"] = relationship("Lead", back_populates="assessments")  # type: ignore
    sections: Mapped[list["AssessmentSection"]] = relationship("AssessmentSection", back_populates="assessment", cascade="all, delete-orphan")
    risks: Mapped[list["AssessmentRisk"]] = relationship("AssessmentRisk", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentSection(Base):
    __tablename__ = "assessment_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    section_type: Mapped[str] = mapped_column(String, nullable=False)  # business, operational, technology, leadership
    score: Mapped[Optional[int]] = mapped_column(Integer)
    max_score: Mapped[int] = mapped_column(Integer, default=25)
    ai_analysis: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="sections")
    responses: Mapped[list["AssessmentResponse"]] = relationship("AssessmentResponse", back_populates="section", cascade="all, delete-orphan")


class AssessmentResponse(Base):
    __tablename__ = "assessment_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assessment_sections.id", ondelete="CASCADE"), nullable=False)
    question_key: Mapped[str] = mapped_column(String, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_value: Mapped[Optional[str]] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Numeric(4, 2), default=1.0)
    points_earned: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    section: Mapped["AssessmentSection"] = relationship("AssessmentSection", back_populates="responses")


class AssessmentRisk(Base):
    __tablename__ = "assessment_risks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    risk_category: Mapped[str] = mapped_column(String, nullable=False)
    risk_description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)  # low, medium, high, critical
    mitigation: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="risks")
