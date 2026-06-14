"""
Health scorer — calculates a customer health score (0-100) using available signals.
Score = usage_score (0-25) + support_score (0-25) + engagement_score (0-25) + roi_score (0-25)

Since Jojo API is not yet connected, we use proxy signals:
- Days since go-live, implementation completeness → usage proxy
- Check-in outcomes and frequency → engagement + support
- NPS score → roi proxy
- Manual override notes from CSM
"""
import json
import logging
from datetime import datetime, timezone, date

from sqlalchemy.orm import Session

from app.models.client import Client, ImplementationProject
from app.models.customer_success import CustomerHealth, Checkin, NpsResponse
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001"


def _days_since(dt) -> int:
    if dt is None:
        return 999
    if isinstance(dt, date) and not isinstance(dt, datetime):
        now = date.today()
        return (now - dt).days
    now = datetime.now(timezone.utc)
    if hasattr(dt, "tzinfo") and dt.tzinfo:
        return (now - dt).days
    return (now - dt.replace(tzinfo=timezone.utc)).days


def _rule_based_score(client: Client, checkins: list, nps_responses: list) -> dict:
    """Rule-based scoring when Claude is unavailable."""

    # 1. Usage score (0–25) — proxy via implementation + days since go-live
    project = client.implementation_projects[0] if client.implementation_projects else None
    usage = 0
    if project and project.actual_go_live:
        days = _days_since(project.actual_go_live)
        if days >= 30:
            usage = 20
        elif days >= 14:
            usage = 15
        elif days >= 7:
            usage = 10
        else:
            usage = 5
        if project.status == "completed":
            usage = min(usage + 5, 25)
    elif client.status in ("go_live", "active"):
        usage = 12

    # 2. Support score (0–25) — recent check-in outcomes
    support = 18  # default neutral
    recent = [c for c in checkins if c.outcome is not None]
    if recent:
        outcome_scores = {"positive": 25, "neutral": 18, "negative": 8, "escalated": 0}
        avg = sum(outcome_scores.get(c.outcome, 12) for c in recent[:3]) / min(len(recent), 3)
        support = round(avg)

    # 3. Engagement score (0–25) — check-in frequency
    engagement = 10
    if checkins:
        last = checkins[0]
        days_since_last = _days_since(last.created_at)
        completed_count = sum(1 for c in checkins if c.completed_at)
        if days_since_last <= 14 and completed_count >= 2:
            engagement = 25
        elif days_since_last <= 30 and completed_count >= 1:
            engagement = 20
        elif days_since_last <= 60:
            engagement = 15
        else:
            engagement = 8

    # 4. ROI score (0–25) — NPS proxy
    roi = 15
    if nps_responses:
        latest_nps = nps_responses[0]
        nps_to_roi = {range(9, 11): 25, range(7, 9): 18, range(4, 7): 10, range(0, 4): 3}
        for r, v in nps_to_roi.items():
            if latest_nps.score in r:
                roi = v
                break

    health = usage + support + engagement + roi
    risk = "healthy" if health >= 70 else ("at_risk" if health >= 40 else "critical")

    return {
        "usage_score": usage,
        "support_score": support,
        "engagement_score": engagement,
        "roi_score": roi,
        "health_score": health,
        "risk_level": risk,
        "ai_summary": f"Rule-based score: {health}/100. Usage {usage}/25, Support {support}/25, Engagement {engagement}/25, ROI {roi}/25.",
        "ai_recommendations": _rule_recommendations(health, usage, support, engagement, roi),
    }


def _rule_recommendations(health, usage, support, engagement, roi) -> str:
    recs = []
    if usage < 15:
        recs.append("Schedule a product adoption call to ensure Jojo is routing calls correctly.")
    if support < 12:
        recs.append("Recent check-ins show negative outcomes — escalate to senior CSM.")
    if engagement < 12:
        recs.append("No recent check-ins — book a health check call this week.")
    if roi < 12:
        recs.append("Low NPS or value perception — conduct a ROI review and gather testimonial or case study.")
    if not recs:
        recs.append("Client is healthy. Maintain cadence and explore expansion opportunities.")
    return " ".join(recs)


async def calculate_health_score(client_id, db: Session) -> None:
    """Background task: calculate health score for a client and save snapshot."""
    import uuid as uuid_mod
    client_uuid = client_id if isinstance(client_id, uuid_mod.UUID) else uuid_mod.UUID(str(client_id))

    client = db.query(Client).filter(Client.id == client_uuid).first()
    if not client:
        logger.error(f"Health score: client {client_id} not found")
        return

    checkins = db.query(Checkin).filter(Checkin.client_id == client_uuid).order_by(Checkin.created_at.desc()).all()
    nps = db.query(NpsResponse).filter(NpsResponse.client_id == client_uuid).order_by(NpsResponse.submitted_at.desc()).all()

    # Try Claude first
    try:
        result = await _ai_score(client, checkins, nps)
    except Exception as e:
        logger.warning(f"Claude health scoring failed: {e} — falling back to rule-based")
        result = _rule_based_score(client, checkins, nps)

    score = CustomerHealth(
        client_id=client_uuid,
        health_score=result["health_score"],
        usage_score=result["usage_score"],
        support_score=result["support_score"],
        engagement_score=result["engagement_score"],
        roi_score=result["roi_score"],
        risk_level=result["risk_level"],
        ai_summary=result["ai_summary"],
        ai_recommendations=result["ai_recommendations"],
    )
    db.add(score)
    db.commit()
    logger.info(f"Health score saved for client {client_id}: {result['health_score']}/100 ({result['risk_level']})")


async def _ai_score(client: Client, checkins: list, nps_responses: list) -> dict:
    """Use Claude to analyse signals and produce a health score."""
    import anthropic
    ac = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    project = client.implementation_projects[0] if client.implementation_projects else None
    go_live_date = project.actual_go_live.isoformat() if project and project.actual_go_live else "unknown"
    days_live = _days_since(project.actual_go_live) if (project and project.actual_go_live) else None

    checkin_summary = []
    for c in checkins[:5]:
        checkin_summary.append({
            "type": c.checkin_type,
            "outcome": c.outcome,
            "days_ago": _days_since(c.created_at) if c.created_at else None,
            "summary": c.summary[:200] if c.summary else None,
        })

    nps_summary = [{"score": n.score, "category": n.category, "verbatim": n.verbatim} for n in nps_responses[:3]]

    prompt = f"""You are a Customer Success analyst scoring the health of an AI Receptionist (Jojo) client.

CLIENT: {client.company_name} | Status: {client.status} | Industry: {client.industry or "unknown"}
GO-LIVE DATE: {go_live_date} ({days_live} days ago if known)
IMPLEMENTATION STATUS: {project.status if project else "unknown"}

RECENT CHECK-INS (latest first):
{json.dumps(checkin_summary, indent=2)}

NPS RESPONSES (latest first):
{json.dumps(nps_summary, indent=2)}

Score this client on four dimensions (0–25 each, total 0–100):
1. usage_score: Product adoption proxy — time since go-live, implementation health
2. support_score: Support experience — check-in outcomes, escalations
3. engagement_score: Engagement regularity — frequency and recency of check-ins
4. roi_score: Value realisation — NPS scores, stated satisfaction, verbatim sentiment

Return ONLY valid JSON (no markdown):
{{
  "usage_score": <0-25>,
  "support_score": <0-25>,
  "engagement_score": <0-25>,
  "roi_score": <0-25>,
  "health_score": <sum of above>,
  "risk_level": "healthy|at_risk|critical",
  "ai_summary": "<2-3 sentence health narrative>",
  "ai_recommendations": "<2-3 concrete actions for the CSM>"
}}"""

    response = ac.messages.create(
        model=settings.claude_model,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    data = json.loads(text)
    data["health_score"] = data["usage_score"] + data["support_score"] + data["engagement_score"] + data["roi_score"]
    data["risk_level"] = "healthy" if data["health_score"] >= 70 else ("at_risk" if data["health_score"] >= 40 else "critical")
    return data
