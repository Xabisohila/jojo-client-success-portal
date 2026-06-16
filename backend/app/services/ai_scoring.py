"""
AI Lead Scoring Service — uses Claude API to score leads 0-100.
Called as a background task after lead creation or manual rescore.
"""
import uuid
import json
import logging
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.lead import Lead, LeadActivity

logger = logging.getLogger(__name__)

client = Anthropic(api_key=settings.anthropic_api_key)

# Industries where Jojo has strongest ROI
HIGH_FIT_INDUSTRIES = [
    "medical", "dental", "healthcare", "legal", "law",
    "plumbing", "hvac", "electrical", "trades", "construction",
    "hospitality", "restaurant", "salon", "spa", "beauty",
    "real estate", "property management", "veterinary",
]

DECISION_MAKER_TITLES = [
    "owner", "founder", "ceo", "director", "manager",
    "practice manager", "office manager", "principal",
]


def _rule_based_score(lead: Lead) -> dict:
    """
    Fast rule-based scoring as a fallback / seed for AI.
    Returns dimension scores summing to 100.
    """
    score = 0
    breakdown = {}

    # DIMENSION 1 — Company Fit (40 pts)
    company_fit = 0
    industry_lower = (lead.industry or "").lower()
    if any(ind in industry_lower for ind in HIGH_FIT_INDUSTRIES):
        company_fit += 15
    elif lead.industry:
        company_fit += 5

    size = lead.company_size or ""
    if size in ("1-10", "11-50"):
        company_fit += 10
    elif size in ("51-200"):
        company_fit += 8
    elif size in ("201-500"):
        company_fit += 4

    vol = lead.monthly_call_volume or ""
    if "500+" in vol:
        company_fit += 15
    elif "100-500" in vol:
        company_fit += 12
    elif "<100" in vol:
        company_fit += 6
    breakdown["company_fit"] = min(company_fit, 40)
    score += breakdown["company_fit"]

    # DIMENSION 2 — Pain Signal (30 pts)
    pain_signal = 0
    solution = (lead.current_solution or "").lower()
    pain = (lead.pain_points or "").lower()
    if any(w in solution for w in ["receptionist", "manual", "voicemail", "nothing", "staff"]):
        pain_signal += 15
    elif solution:
        pain_signal += 5
    if any(w in pain for w in ["missed", "after hours", "overflow", "busy", "booking", "cost", "expensive"]):
        pain_signal += 15
    elif pain:
        pain_signal += 5
    breakdown["pain_signal"] = min(pain_signal, 30)
    score += breakdown["pain_signal"]

    # DIMENSION 3 — Readiness Signal (30 pts)
    readiness = 0
    title = (lead.job_title or "").lower()
    if any(t in title for t in DECISION_MAKER_TITLES):
        readiness += 10
    elif title:
        readiness += 4
    breakdown["readiness_signal"] = min(readiness, 30)
    score += breakdown["readiness_signal"]

    return {"total": min(score, 100), "breakdown": breakdown}


def _classify_score(score: int) -> tuple[str, str]:
    if score >= 70:
        return "high", "Qualify this lead and schedule a discovery call within 24 hours."
    elif score >= 40:
        return "medium", "Nurture this lead — send product overview and follow up in 5–7 days."
    else:
        return "low", "Disqualify or place in long-term nurture. Low fit for Jojo at this time."


def score_lead(lead_id: uuid.UUID) -> None:
    """Background task: score a lead using Claude API with rule-based seed."""
    db: Session = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return

        seed = _rule_based_score(lead)

        prompt = f"""You are a sales qualification expert for Jojo, an AI Receptionist service.

Jojo's ideal customer:
- Small to medium business (1–200 employees)
- Industries: medical, dental, legal, trades (plumbing, HVAC, electrical), hospitality, real estate, veterinary, salon/spa
- Contact volume: 50+ inbound calls, WhatsApp messages, and missed calls per month combined
- Currently handling calls, WhatsApp enquiries, and missed-call follow-up with a human receptionist, voicemail, or no system
- Decision maker: owner, practice manager, director, or office manager
- Pain points: missed calls after hours, unanswered WhatsApp messages, high receptionist costs, overflow calls, appointment booking inefficiency

Score this lead on two dimensions (0–100 each):

1. LEAD SCORE: Likelihood this is a good fit for Jojo (based on company profile)
2. OPPORTUNITY SCORE: Likelihood of closing if pursued (based on engagement and readiness signals)

Lead data:
- Name: {lead.first_name} {lead.last_name}
- Title: {lead.job_title or 'Unknown'}
- Company: {lead.company_name}
- Industry: {lead.industry or 'Unknown'}
- Company Size: {lead.company_size or 'Unknown'}
- Monthly Call Volume: {lead.monthly_call_volume or 'Unknown'}
- Current Solution: {lead.current_solution or 'Unknown'}
- Pain Points: {lead.pain_points or 'None stated'}
- Source: {lead.source}

Rule-based seed score: {seed['total']}/100
Breakdown: {seed['breakdown']}

Respond ONLY with valid JSON in this exact format:
{{
  "lead_score": <0-100>,
  "opportunity_score": <0-100>,
  "score_rationale": "<2-3 sentence explanation of the scores>",
  "recommended_action": "<specific next action the sales team should take>",
  "key_strengths": ["<strength 1>", "<strength 2>"],
  "key_risks": ["<risk 1>", "<risk 2>"]
}}"""

        try:
            response = client.messages.create(
                model=settings.claude_model,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            result = json.loads(response.content[0].text)
            lead_score = int(result.get("lead_score", seed["total"]))
            opportunity_score = int(result.get("opportunity_score", seed["total"]))
            rationale = result.get("score_rationale", "")
            recommended_action = result.get("recommended_action", _classify_score(lead_score)[1])
        except Exception as e:
            logger.warning(f"Claude API scoring failed for lead {lead_id}, using rule-based: {e}")
            lead_score = seed["total"]
            opportunity_score = seed["total"]
            _, recommended_action = _classify_score(lead_score)
            rationale = f"Rule-based score. Company fit: {seed['breakdown'].get('company_fit', 0)}/40, Pain signal: {seed['breakdown'].get('pain_signal', 0)}/30, Readiness: {seed['breakdown'].get('readiness_signal', 0)}/30."

        lead.lead_score = lead_score
        lead.opportunity_score = opportunity_score
        lead.score_rationale = rationale
        lead.recommended_action = recommended_action

        db.add(LeadActivity(
            lead_id=lead.id,
            activity_type="score_update",
            subject=f"Lead scored: {lead_score}/100 (Opportunity: {opportunity_score}/100)",
            body=rationale,
        ))
        db.commit()
        logger.info(f"Lead {lead_id} scored: {lead_score}/100")
    except Exception as e:
        logger.error(f"Error scoring lead {lead_id}: {e}")
        db.rollback()
    finally:
        db.close()
