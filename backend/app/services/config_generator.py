"""
Jojo Configuration Generator.
Takes approved onboarding data and produces the full Jojo configuration
blueprint via Claude API. Triggered when onboarding is approved (Gate 4).
"""
import uuid
import json
import logging
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.client import Onboarding, JojoConfig

logger = logging.getLogger(__name__)
client = Anthropic(api_key=settings.anthropic_api_key)


def _format_hours(hours: dict) -> str:
    if not hours:
        return "Monday–Friday 9:00am–5:00pm"
    lines = []
    day_order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for day in day_order:
        info = hours.get(day, {})
        if info.get("is_open"):
            lines.append(f"{day.capitalize()}: {info.get('open','9:00')}–{info.get('close','17:00')}")
    return ", ".join(lines) if lines else "Monday–Friday 9:00am–5:00pm"


def generate_jojo_config(onboarding_id: uuid.UUID) -> None:
    db: Session = SessionLocal()
    config = None
    try:
        ob = db.query(Onboarding).filter(Onboarding.id == onboarding_id).first()
        if not ob:
            logger.warning(f"Onboarding {onboarding_id} not found for config generation")
            return

        hours_str = _format_hours(ob.business_hours or {})
        faqs = ob.faqs or []
        services = ob.primary_services or []
        escalation = ob.escalation_contacts or []
        call_types = ob.call_types or []
        style = ob.greeting_style or "professional"
        business = ob.business_name or "your business"
        escalation_phone = escalation[0]["phone"] if escalation else "N/A"
        booking_types = json.dumps(services[:5] if services else ["Standard Appointment"])

        config = JojoConfig(
            client_id=ob.client_id,
            onboarding_id=ob.id,
            status="generating",
            created_by=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        )
        db.add(config)
        db.commit()  # commit immediately so the record always exists
        db.refresh(config)
        logger.info(f"Jojo config {config.id} record created for onboarding {onboarding_id}")

        prompt = f"""You are designing the configuration for Jojo, an AI Receptionist service that handles inbound phone calls, WhatsApp messages, and missed-call follow-up.

Generate a complete, production-ready Jojo configuration for this business:

Business: {business}
Industry/Services: {', '.join(services) if services else 'General business'}
Call Types: {', '.join(call_types) if call_types else 'General enquiries, Bookings'}
Greeting Style: {style}
Business Hours: {hours_str}
Timezone: {ob.timezone}
Excluded Topics (Jojo should not handle): {ob.excluded_topics or 'None specified'}
Key Policies: {ob.key_policies or 'None specified'}
Special Instructions: {ob.special_instructions or 'None'}
Calendar System: {ob.calendar_system or 'None configured'}
CRM: {ob.crm_system or 'None'}
Escalation Contacts: {json.dumps(escalation)}

FAQs ({len(faqs)} total):
{json.dumps(faqs[:10], indent=2)}

Produce a configuration in this EXACT JSON format:

{{
  "greeting_message": "<warm opening greeting script — 2-3 sentences>",
  "after_hours_message": "<after-hours message — acknowledge closed, state hours, offer to take a message or book>",
  "voicemail_message": "<voicemail prompt — short, friendly, ask for name/number/reason>",
  "config_summary": "<2-3 sentence summary of what this Jojo configuration does for this business>",
  "call_flow": {{
    "steps": [
      {{"id": "greeting", "type": "speak", "text": "<opening line>"}},
      {{"id": "intent", "type": "ask", "question": "<what can I help you with question>", "options": [
        {{"key": "1", "label": "<option 1>", "action": "booking"}},
        {{"key": "2", "label": "<option 2>", "action": "faq"}},
        {{"key": "0", "label": "Speak to someone", "action": "escalate"}}
      ]}},
      {{"id": "booking", "type": "flow", "steps": [
        {{"id": "collect_name", "type": "ask", "question": "May I have your name please?"}},
        {{"id": "collect_phone", "type": "ask", "question": "And your best contact number?"}},
        {{"id": "collect_reason", "type": "ask", "question": "What is the appointment for?"}},
        {{"id": "confirm_booking", "type": "action", "action": "create_booking"}}
      ]}}
    ]
  }},
  "booking_rules": {{
    "calendar_system": "{ob.calendar_system or 'manual'}",
    "appointment_fields": ["name", "phone", "email", "reason"],
    "confirmation_method": "sms",
    "advance_booking_days": 30,
    "min_notice_hours": 2,
    "booking_types": {booking_types}
  }},
  "escalation_rules": [
    {{"trigger": "complaint", "priority": "high", "action": "transfer", "contact": "{escalation_phone}", "message": "I understand your concern. Let me connect you with someone who can help right away."}},
    {{"trigger": "urgent_medical", "priority": "critical", "action": "transfer_immediately", "contact": "000", "message": "If this is a medical emergency, please call 000 immediately."}},
    {{"trigger": "request_manager", "priority": "medium", "action": "take_message", "contact": "{escalation_phone}", "message": "I'll pass your message to our manager and they'll call you back within 2 hours."}}
  ],
  "knowledge_base": {{
    "business_name": "{business}",
    "business_hours": "{hours_str}",
    "timezone": "{ob.timezone}",
    "services": {json.dumps(services)},
    "faqs": {json.dumps(faqs)},
    "policies": "{ob.key_policies or ''}",
    "address": "{ob.business_address or ''}",
    "phone": "{ob.business_phone or ''}",
    "email": "{ob.business_email or ''}",
    "website": "{ob.website or ''}"
  }}
}}

The greeting and scripts must sound natural and conversational. Reference the specific business, its services, and the greeting style ({style}). Respond ONLY with valid JSON."""

        try:
            response = client.messages.create(
                model=settings.claude_model,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            result = json.loads(response.content[0].text)
            config.greeting_message = result.get("greeting_message", "")
            config.after_hours_message = result.get("after_hours_message", "")
            config.voicemail_message = result.get("voicemail_message", "")
            config.call_flow = result.get("call_flow", {})
            config.booking_rules = result.get("booking_rules", {})
            config.escalation_rules = result.get("escalation_rules", [])
            config.knowledge_base = result.get("knowledge_base", {})
            config.config_summary = result.get("config_summary", "")
        except Exception as e:
            logger.warning(f"Claude config generation failed for onboarding {onboarding_id}, using template fallback: {e}")
            config.greeting_message = f"Thank you for calling {business}. This is Jojo, your virtual assistant. How can I help you today?"
            config.after_hours_message = f"Thank you for calling {business}. Our office is currently closed. Our hours are {hours_str}. Please leave your name and number and we'll call you back the next business day."
            config.voicemail_message = f"You've reached {business}. Please leave your name, number, and a brief message after the tone."
            config.call_flow = {"steps": [{"id": "greeting", "type": "speak", "text": config.greeting_message}]}
            config.booking_rules = {"calendar_system": ob.calendar_system or "manual", "appointment_fields": ["name", "phone", "reason"]}
            config.escalation_rules = [{"trigger": "complaint", "priority": "high", "action": "take_message"}]
            config.knowledge_base = {"business_name": business, "business_hours": hours_str, "services": services, "faqs": faqs}
            config.config_summary = f"Jojo will handle inbound calls, WhatsApp messages, and missed-call follow-up for {business}, managing bookings, FAQs, and escalations."

        config.status = "pending_review"
        db.commit()
        logger.info(f"Jojo config {config.id} completed (pending_review) for client {ob.client_id}")
    except Exception as e:
        logger.error(f"Error generating config for onboarding {onboarding_id}: {e}", exc_info=True)
        db.rollback()
        if config is not None:
            try:
                db.refresh(config)
                config.status = "error"
                db.commit()
            except Exception:
                pass
    finally:
        db.close()
