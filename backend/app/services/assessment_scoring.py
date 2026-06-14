"""
Assessment Scoring Service.
Scores 4 sections × 25 pts = 100 pts total.
Generates risk report and recommendations via Claude API.
"""
import uuid
import json
import logging
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.assessment import Assessment, AssessmentSection, AssessmentResponse, AssessmentRisk

logger = logging.getLogger(__name__)
client = Anthropic(api_key=settings.anthropic_api_key)


# ---------------------------------------------------------------------------
# QUESTION DEFINITIONS — The canonical 16-question assessment
# Each question has: key, text, max_points, weight, scoring_guide
# ---------------------------------------------------------------------------

ASSESSMENT_QUESTIONS = {
    "business": [
        {
            "key": "b1_call_volume",
            "text": "What is your average daily inbound call volume?",
            "max_points": 8,
            "weight": 1.0,
            "options": {
                "Less than 10 calls/day": 2,
                "10–30 calls/day": 5,
                "31–60 calls/day": 7,
                "More than 60 calls/day": 8,
            },
        },
        {
            "key": "b2_services",
            "text": "Which of these services does the AI receptionist need to handle? (select all that apply)",
            "max_points": 7,
            "weight": 1.0,
            "options": {
                "Answer general enquiries": 1,
                "Book / reschedule appointments": 2,
                "Capture lead information": 2,
                "Qualify callers": 1,
                "Transfer urgent calls": 1,
            },
        },
        {
            "key": "b3_business_hours",
            "text": "Do you have documented and consistent business hours?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Yes, fixed hours with no exceptions": 5,
                "Yes, but hours vary by day/season": 3,
                "No, it varies": 1,
            },
        },
        {
            "key": "b4_after_hours",
            "text": "How are calls currently handled outside of business hours?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Voicemail only — calls are missed": 5,
                "Calls go unanswered": 5,
                "Staff member takes calls": 2,
                "Third-party answering service": 3,
            },
        },
    ],
    "operational": [
        {
            "key": "o1_call_script",
            "text": "Do your staff currently follow a consistent call script or process?",
            "max_points": 8,
            "weight": 1.0,
            "options": {
                "Yes, fully documented and followed": 8,
                "Partially — some guidelines exist": 5,
                "No — staff handle calls differently": 2,
            },
        },
        {
            "key": "o2_booking_process",
            "text": "How are appointments currently booked?",
            "max_points": 7,
            "weight": 1.0,
            "options": {
                "Online booking system (e.g. Calendly, HotDoc)": 7,
                "Manual calendar (Google Calendar, Outlook)": 5,
                "Paper-based / spreadsheet": 2,
                "No formal booking process": 1,
            },
        },
        {
            "key": "o3_escalation",
            "text": "Is there a documented process for escalating urgent or sensitive calls?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Yes, clear escalation rules exist": 5,
                "Informal — staff use judgment": 2,
                "No — all calls treated the same": 0,
            },
        },
        {
            "key": "o4_champion",
            "text": "Who will be the internal champion responsible for the Jojo implementation?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Owner / Managing Director": 5,
                "Practice / Office Manager": 4,
                "Senior staff member": 2,
                "Not yet identified": 0,
            },
        },
    ],
    "technology": [
        {
            "key": "t1_phone_system",
            "text": "What phone system does the business currently use?",
            "max_points": 8,
            "weight": 1.0,
            "options": {
                "VoIP system (e.g. RingCentral, 3CX, Teams)": 8,
                "Business landline (PSTN)": 6,
                "Mobile only": 4,
                "Mixed / unknown": 3,
            },
        },
        {
            "key": "t2_calendar",
            "text": "What calendar or booking system is used?",
            "max_points": 7,
            "weight": 1.0,
            "options": {
                "Google Calendar": 7,
                "Microsoft Outlook / Exchange": 7,
                "Industry-specific software (e.g. Cliniko, Mindbody)": 6,
                "Paper diary / no system": 1,
            },
        },
        {
            "key": "t3_crm",
            "text": "Do you use a CRM system? If yes, which one?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Yes — HubSpot, Salesforce, or similar": 5,
                "Yes — industry-specific CRM": 4,
                "No CRM currently": 2,
            },
        },
        {
            "key": "t4_call_forwarding",
            "text": "Are you able to set up call forwarding to a new number?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Yes, we can do this immediately": 5,
                "Yes, but need IT/provider assistance": 3,
                "Unsure": 1,
                "No": 0,
            },
        },
    ],
    "leadership": [
        {
            "key": "l1_decision_maker",
            "text": "Is the primary decision maker actively engaged in this evaluation?",
            "max_points": 8,
            "weight": 1.0,
            "options": {
                "Yes — they initiated this process": 8,
                "Yes — they are aware and supportive": 6,
                "Partially — they have delegated it": 3,
                "No — I am evaluating without their knowledge": 0,
            },
        },
        {
            "key": "l2_budget",
            "text": "Has a budget been allocated for an AI receptionist solution?",
            "max_points": 7,
            "weight": 1.0,
            "options": {
                "Yes — approved budget in place": 7,
                "Budget is available but not formally approved": 5,
                "Exploring options to build a case": 2,
                "No budget allocated": 0,
            },
        },
        {
            "key": "l3_timeline",
            "text": "What is the target go-live timeline?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "Within 4 weeks": 5,
                "1–3 months": 4,
                "3–6 months": 2,
                "No specific timeline": 0,
            },
        },
        {
            "key": "l4_blockers",
            "text": "Are there any known internal blockers to implementation?",
            "max_points": 5,
            "weight": 1.0,
            "options": {
                "No blockers — ready to proceed": 5,
                "Minor concerns — manageable": 3,
                "Staff resistance or training concerns": 1,
                "Significant blockers identified": 0,
            },
        },
    ],
}


def get_questions_for_section(section_type: str) -> list[dict]:
    return ASSESSMENT_QUESTIONS.get(section_type, [])


def score_response(question: dict, response_value: str) -> float:
    """Map a response string to its point value."""
    options = question.get("options", {})
    for option_text, points in options.items():
        if option_text.lower() == response_value.lower():
            return float(points)
    return 0.0


def calculate_section_score(section: AssessmentSection) -> int:
    questions = get_questions_for_section(section.section_type)
    total = 0.0
    for q_def in questions:
        for resp in section.responses:
            if resp.question_key == q_def["key"] and resp.response_value:
                points = score_response(q_def, resp.response_value)
                resp.points_earned = points
                total += points
    return min(int(total), 25)


def score_assessment(assessment_id: uuid.UUID) -> None:
    """Background task: score all sections and generate AI risk report."""
    db: Session = SessionLocal()
    try:
        assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
        if not assessment:
            return

        section_scores = {}
        section_analyses = {}
        all_responses = {}

        for section in assessment.sections:
            section.score = calculate_section_score(section)
            section_scores[section.section_type] = section.score
            all_responses[section.section_type] = {
                r.question_key: r.response_value for r in section.responses if r.response_value
            }

        total_score = sum(section_scores.values())
        assessment.total_score = total_score

        if total_score >= 75:
            assessment.risk_level = "low"
        elif total_score >= 50:
            assessment.risk_level = "medium"
        elif total_score >= 25:
            assessment.risk_level = "high"
        else:
            assessment.risk_level = "critical"

        db.flush()
        _generate_ai_analysis(db, assessment, section_scores, all_responses)
        assessment.status = "pending_approval"
        db.commit()
        logger.info(f"Assessment {assessment_id} scored: {total_score}/100, risk: {assessment.risk_level}")
    except Exception as e:
        logger.error(f"Error scoring assessment {assessment_id}: {e}")
        db.rollback()
    finally:
        db.close()


def _generate_ai_analysis(
    db: Session,
    assessment: Assessment,
    section_scores: dict,
    all_responses: dict,
) -> None:
    prompt = f"""You are a senior solutions consultant for Jojo AI Receptionist.

A readiness assessment has been completed. Analyse the results and produce:
1. An executive summary (3–4 sentences)
2. A prioritised list of 3–5 implementation recommendations
3. A list of implementation risks with severity and mitigation

Assessment scores:
- Business Readiness: {section_scores.get('business', 0)}/25
- Operational Readiness: {section_scores.get('operational', 0)}/25
- Technology Readiness: {section_scores.get('technology', 0)}/25
- Leadership Readiness: {section_scores.get('leadership', 0)}/25
- TOTAL: {assessment.total_score}/100
- Risk Level: {assessment.risk_level.upper()}

Key responses:
{json.dumps(all_responses, indent=2)}

Respond ONLY with valid JSON:
{{
  "summary": "<executive summary>",
  "recommendations": [
    {{"priority": 1, "text": "<recommendation>", "category": "<business|operational|technology|leadership>"}},
    ...
  ],
  "risks": [
    {{
      "category": "<risk category>",
      "description": "<risk description>",
      "severity": "<low|medium|high|critical>",
      "mitigation": "<mitigation action>"
    }},
    ...
  ]
}}"""

    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        result = json.loads(response.content[0].text)

        assessment.ai_summary = result.get("summary", "")
        recs = result.get("recommendations", [])
        assessment.ai_recommendations = json.dumps(recs)

        db.query(AssessmentRisk).filter(AssessmentRisk.assessment_id == assessment.id).delete()
        for risk in result.get("risks", []):
            db.add(AssessmentRisk(
                assessment_id=assessment.id,
                risk_category=risk.get("category", "General"),
                risk_description=risk.get("description", ""),
                severity=risk.get("severity", "medium"),
                mitigation=risk.get("mitigation"),
            ))
    except Exception as e:
        logger.warning(f"Claude API analysis failed for assessment {assessment.id}: {e}")
        assessment.ai_summary = f"Assessment complete. Total score: {assessment.total_score}/100. Risk level: {assessment.risk_level}. Manual review recommended."
        assessment.ai_recommendations = json.dumps([
            {"priority": 1, "text": "Review low-scoring sections with the client before proceeding.", "category": "general"}
        ])
