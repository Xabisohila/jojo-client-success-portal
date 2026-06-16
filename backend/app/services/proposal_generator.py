"""
Proposal Generator Service.
Pricing engine + Claude API for scope/ROI narrative generation.
Triggered automatically when an assessment is approved (Gate 2).
"""
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.assessment import Assessment
from app.models.lead import Lead
from app.models.proposal import Proposal, ProposalLineItem

logger = logging.getLogger(__name__)
client = Anthropic(api_key=settings.anthropic_api_key)


# ---------------------------------------------------------------------------
# PRICING MODEL
# ---------------------------------------------------------------------------

PRICING_TIERS = {
    "starter": {
        "label": "Jojo Starter",
        "monthly_fee": 297.00,
        "setup_fee": 497.00,
        "includes": [
            "Up to 200 calls/month",
            "WhatsApp message handling",
            "Missed-call follow-up and callback automation",
            "Appointment booking (Google Calendar)",
            "Lead capture and qualification",
            "FAQ handling (up to 20 FAQs)",
            "After-hours call handling",
            "Email notifications",
            "Monthly performance report",
        ],
    },
    "professional": {
        "label": "Jojo Professional",
        "monthly_fee": 597.00,
        "setup_fee": 997.00,
        "includes": [
            "Up to 600 calls/month",
            "WhatsApp message handling (unlimited)",
            "Missed-call follow-up and callback automation",
            "Appointment booking (Google Calendar + Outlook)",
            "Advanced lead qualification",
            "FAQ handling (up to 50 FAQs)",
            "After-hours and overflow handling",
            "CRM integration (HubSpot or Zoho)",
            "Call escalation rules",
            "SMS notifications",
            "Weekly performance report",
            "Dedicated onboarding specialist",
        ],
    },
    "enterprise": {
        "label": "Jojo Enterprise",
        "monthly_fee": 1197.00,
        "setup_fee": 1997.00,
        "includes": [
            "Unlimited calls",
            "Unlimited WhatsApp message handling",
            "Missed-call follow-up and callback automation",
            "All calendar and booking integrations",
            "Advanced qualification workflows",
            "Unlimited FAQs",
            "Multi-location support",
            "Custom CRM integration",
            "Advanced escalation rules",
            "SMS + email + webhook notifications",
            "Custom reporting dashboard",
            "Priority support",
            "Quarterly success review",
        ],
    },
}

COMPLEXITY_MULTIPLIERS = {
    "none": 1.0,
    "one_integration": 1.3,
    "multiple_integrations": 1.6,
    "custom_development": 2.0,
}


def _select_tier(lead: Lead, assessment: Assessment) -> str:
    vol = (lead.monthly_call_volume or "").lower()
    if "500+" in vol:
        return "enterprise"
    elif "100-500" in vol:
        return "professional"
    else:
        return "starter"


def _calculate_complexity(assessment: Assessment) -> str:
    if not assessment.sections:
        return "none"
    tech_section = next((s for s in assessment.sections if s.section_type == "technology"), None)
    if not tech_section:
        return "none"
    responses = {r.question_key: r.response_value for r in tech_section.responses}
    has_crm = responses.get("t3_crm", "") and "no crm" not in responses.get("t3_crm", "").lower()
    has_calendar = responses.get("t2_calendar", "") not in ("", None)
    integrations = (1 if has_crm else 0) + (1 if has_calendar else 0)
    if integrations == 0:
        return "none"
    elif integrations == 1:
        return "one_integration"
    else:
        return "multiple_integrations"


def _estimate_roi(lead: Lead, monthly_fee: float) -> tuple[float, float, str]:
    vol = (lead.monthly_call_volume or "100-500").lower()
    if "500+" in vol:
        daily_calls = 30
    elif "100-500" in vol:
        daily_calls = 15
    else:
        daily_calls = 5

    monthly_calls = daily_calls * 22
    receptionist_hours_saved = monthly_calls * 0.08  # ~5 min per call
    receptionist_cost = receptionist_hours_saved * 28  # $28/hr avg
    missed_call_recovery = monthly_calls * 0.15 * 150 * 0.3  # 15% missed, $150 avg value, 30% convert
    monthly_roi = receptionist_cost + missed_call_recovery
    annual_roi = monthly_roi * 12
    rationale = (
        f"Based on approximately {int(monthly_calls)} calls per month, "
        f"Jojo is estimated to save {int(receptionist_hours_saved)} hours of staff time "
        f"(valued at ${receptionist_cost:,.0f}/month at $28/hr). "
        f"Additionally, recovering missed calls, unanswered WhatsApp messages, and after-hours enquiries is projected to generate "
        f"${missed_call_recovery:,.0f}/month in new revenue. "
        f"Total estimated monthly ROI: ${monthly_roi:,.0f} against a Jojo investment of ${monthly_fee:,.0f}/month."
    )
    return round(monthly_roi, 2), round(annual_roi, 2), rationale


def _build_line_items(tier_key: str, setup_fee: float) -> list[dict]:
    tier = PRICING_TIERS[tier_key]
    items = [
        {
            "item_name": f"{tier['label']} — Monthly Subscription",
            "description": "\n".join(tier["includes"]),
            "quantity": 1,
            "unit_price": tier["monthly_fee"],
            "total_price": tier["monthly_fee"],
            "is_recurring": True,
            "sort_order": 1,
        },
        {
            "item_name": "One-Time Setup & Configuration Fee",
            "description": "Includes: call flow design, knowledge base setup, calendar integration, testing, and go-live support.",
            "quantity": 1,
            "unit_price": setup_fee,
            "total_price": setup_fee,
            "is_recurring": False,
            "sort_order": 2,
        },
    ]
    return items


def generate_proposal(assessment_id: uuid.UUID) -> None:
    db: Session = SessionLocal()
    try:
        assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
        if not assessment:
            return
        lead = db.query(Lead).filter(Lead.id == assessment.lead_id).first()
        if not lead:
            return

        tier_key = _select_tier(lead, assessment)
        complexity = _calculate_complexity(assessment)
        tier = PRICING_TIERS[tier_key]

        monthly_fee = tier["monthly_fee"]
        setup_fee = round(tier["setup_fee"] * COMPLEXITY_MULTIPLIERS[complexity], 2)
        roi_monthly, roi_annual, roi_rationale = _estimate_roi(lead, monthly_fee)

        proposal = Proposal(
            lead_id=lead.id,
            assessment_id=assessment.id,
            status="generating",
            pricing_tier=tier_key,
            monthly_fee=monthly_fee,
            setup_fee=setup_fee,
            contract_months=12,
            roi_monthly=roi_monthly,
            roi_annual=roi_annual,
            roi_rationale=roi_rationale,
            valid_until=(datetime.now(timezone.utc) + timedelta(days=30)).date(),
            created_by=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        )
        db.add(proposal)
        db.flush()

        for item_data in _build_line_items(tier_key, setup_fee):
            db.add(ProposalLineItem(proposal_id=proposal.id, **item_data))

        _generate_ai_narrative(db, proposal, lead, assessment, tier_key, tier)
        proposal.status = "pending_approval"
        db.commit()
        logger.info(f"Proposal {proposal.id} generated for lead {lead.id} — tier: {tier_key}")
    except Exception as e:
        logger.error(f"Error generating proposal for assessment {assessment_id}: {e}")
        db.rollback()
    finally:
        db.close()


def _generate_ai_narrative(
    db: Session,
    proposal: Proposal,
    lead: Lead,
    assessment: Assessment,
    tier_key: str,
    tier: dict,
) -> None:
    prompt = f"""You are a senior sales consultant writing a professional proposal for Jojo AI Receptionist, which handles inbound calls, WhatsApp messages, and missed-call follow-up.

Write two sections for this proposal:

1. SCOPE SUMMARY (3–4 sentences): What Jojo will do for this specific business, referencing their industry and their call, WhatsApp, and missed-call handling needs.
2. EXECUTIVE SUMMARY (4–5 sentences): The business case for this client — what problem Jojo solves, the ROI, and the recommended next step.

Client details:
- Business: {lead.company_name}
- Industry: {lead.industry or 'Not specified'}
- Contact: {lead.first_name} {lead.last_name}, {lead.job_title or 'Decision Maker'}
- Call Volume: {lead.monthly_call_volume or 'Not specified'}/month
- Current Solution: {lead.current_solution or 'Not specified'}
- Pain Points: {lead.pain_points or 'Not specified'}

Proposal:
- Tier: {tier['label']}
- Monthly Fee: ${proposal.monthly_fee:,.2f}/month
- Setup Fee: ${proposal.setup_fee:,.2f} one-time
- Estimated Monthly ROI: ${proposal.roi_monthly:,.2f}
- Estimated Annual ROI: ${proposal.roi_annual:,.2f}

Assessment Score: {assessment.total_score}/100 (Risk: {assessment.risk_level})

Keep the tone professional, confident, and client-focused. Use the client's company name and industry context.

Respond ONLY with valid JSON:
{{
  "scope_summary": "<scope summary text>",
  "executive_summary": "<executive summary text>"
}}"""

    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        result = json.loads(response.content[0].text)
        proposal.scope_summary = result.get("scope_summary", "")
        proposal.executive_summary = result.get("executive_summary", "")
    except Exception as e:
        logger.warning(f"Claude narrative generation failed for proposal {proposal.id}: {e}")
        proposal.scope_summary = f"Jojo AI Receptionist will handle inbound calls, WhatsApp messages, and missed-call follow-up for {lead.company_name}, providing appointment booking, lead capture, FAQ handling, and after-hours coverage under the {tier['label']} plan."
        proposal.executive_summary = f"This proposal outlines how Jojo can transform {lead.company_name}'s call, WhatsApp, and missed-call handling, delivering an estimated ${proposal.roi_monthly:,.0f}/month in ROI at an investment of ${proposal.monthly_fee:,.0f}/month."
