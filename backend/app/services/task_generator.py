"""
Implementation Task Generator.
Produces a structured task list for deploying Jojo based on the approved config.
Triggered when JojoConfig is approved.
"""
import uuid
import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.client import JojoConfig, ImplementationProject, ImplementationTask

logger = logging.getLogger(__name__)

SYSTEM_USER = uuid.UUID("00000000-0000-0000-0000-000000000001")


# Standard task definitions — tuple: (title, description, category, priority, day_offset)
# Note: Jojo never answers calls live. The Twilio number rings the client's real phone first;
# Jojo only activates — via WhatsApp text — once a call is missed.
BASE_TASKS = [
    # Setup
    ("Provision Jojo Twilio number", "Request and assign a dedicated Twilio number to front the client's calls and detect missed calls.", "setup", "critical", 0),
    ("Configure call forwarding to practice", "Set the Twilio number to ring the client's existing phone/landline for ~20 seconds before treating the call as missed.", "setup", "critical", 1),
    ("Upload missed-call WhatsApp scripts to Jojo", "Load the AI-generated missed-call and after-hours WhatsApp message scripts into the Jojo platform.", "setup", "high", 2),
    ("Configure business hours in Jojo", "Set operating hours and timezone so Jojo sends the correct after-hours WhatsApp message when a call is missed outside business hours.", "setup", "high", 2),
    ("Set after-hours handling rules", "Configure what Jojo's WhatsApp follow-up offers outside business hours: take a message, book an appointment, or refer to an emergency contact.", "setup", "high", 3),

    # Configuration
    ("Upload knowledge base and FAQs", "Import the approved FAQs and service information into the Jojo knowledge base.", "configuration", "high", 3),
    ("Configure booking rules", "Set appointment types, collection fields, advance booking window, and confirmation method for the WhatsApp booking flow.", "configuration", "high", 4),
    ("Configure escalation rules", "Set up triggers and actions for complaint handling, urgent enquiries, and manager escalation notifications raised during a WhatsApp conversation.", "configuration", "high", 4),

    # Testing
    ("Internal test — call answered normally", "Call the practice number during business hours and confirm it rings through to staff exactly as before, with no Jojo intervention.", "testing", "critical", 7),
    ("Internal test — missed call triggers WhatsApp", "Let a test call go unanswered during business hours and verify the caller receives the missed-call WhatsApp message within seconds.", "testing", "critical", 7),
    ("Internal test — missed call after hours", "Let a test call go unanswered outside business hours and verify the WhatsApp follow-up correctly references closed hours.", "testing", "critical", 7),
    ("Internal test — booking flow end-to-end", "Test the full WhatsApp booking flow: name/reason collection, calendar entry creation, confirmation.", "testing", "critical", 8),
    ("Internal test — escalation flow", "Test escalation triggers over WhatsApp: complaint keyword, urgent enquiry, manager request.", "testing", "high", 8),
    ("Internal test — FAQ responses", "Verify Jojo answers the top 5 FAQs correctly and accurately over WhatsApp.", "testing", "high", 9),

    # Training
    ("Staff briefing — what Jojo handles", "Brief all staff that Jojo never answers calls live — it only follows up missed calls via WhatsApp. Distribute a one-page summary.", "training", "high", 10),
    ("Client admin training — reporting dashboard", "Train the client champion on accessing Jojo's missed-call and WhatsApp conversation logs and performance reports.", "training", "medium", 11),

    # Sign-off
    ("Client UAT sign-off", "Client reviews and signs off on Jojo's behaviour via the UAT checklist.", "sign_off", "critical", 12),
    ("Go-live approval", "Internal team signs off that all tasks are complete and Jojo is ready to handle live missed calls.", "sign_off", "critical", 13),
]

INTEGRATION_TASKS = {
    "Google Calendar": ("Connect Google Calendar integration", "Authorise Jojo to access Google Calendar for booking creation and availability checking.", "integration", "critical", 3),
    "Microsoft Outlook / Exchange": ("Connect Microsoft Exchange / Outlook integration", "Authorise Jojo to access the Outlook/Exchange calendar via Microsoft Graph API.", "integration", "critical", 3),
    "Industry-specific software": ("Connect industry-specific calendar/booking system", "Configure API or webhook connection to the client's booking software.", "integration", "high", 4),
    "HubSpot": ("Connect HubSpot CRM integration", "Authorise Jojo to log calls and create contacts in HubSpot.", "integration", "high", 4),
    "Zoho CRM": ("Connect Zoho CRM integration", "Configure Zoho CRM API credentials and field mappings for Jojo contact logging.", "integration", "high", 4),
    "Yes — HubSpot, Salesforce, or similar": ("Connect CRM integration", "Configure CRM API credentials and field mappings so Jojo logs call data automatically.", "integration", "high", 4),
    "Yes — industry-specific CRM": ("Connect industry CRM integration", "Configure industry-specific CRM API for call logging and contact creation.", "integration", "high", 5),
}


def generate_implementation_tasks(config_id: uuid.UUID) -> None:
    db: Session = SessionLocal()
    try:
        config = db.query(JojoConfig).filter(JojoConfig.id == config_id).first()
        if not config:
            return

        # Check for existing project
        existing = db.query(ImplementationProject).filter(ImplementationProject.client_id == config.client_id).first()
        if existing:
            logger.info(f"Implementation project already exists for client {config.client_id}")
            return

        today = date.today()
        target_go_live = today + timedelta(days=14)

        project = ImplementationProject(
            client_id=config.client_id,
            jojo_config_id=config.id,
            status="not_started",
            target_go_live=target_go_live,
            project_manager=SYSTEM_USER,
        )
        db.add(project)
        db.flush()

        # Determine integration tasks from onboarding
        onboarding = config.client.onboarding if config.client else None
        extra_tasks = []
        if onboarding:
            cal = onboarding.calendar_system or ""
            crm = onboarding.crm_system or ""
            if cal and cal in INTEGRATION_TASKS:
                extra_tasks.append(INTEGRATION_TASKS[cal])
            if crm and crm in INTEGRATION_TASKS:
                extra_tasks.append(INTEGRATION_TASKS[crm])

        all_tasks = list(BASE_TASKS) + extra_tasks
        # Sort by day_offset to get natural ordering
        all_tasks.sort(key=lambda t: t[4])

        for i, (title, description, category, priority, day_offset) in enumerate(all_tasks):
            db.add(ImplementationTask(
                project_id=project.id,
                title=title,
                description=description,
                category=category,
                priority=priority,
                due_date=today + timedelta(days=day_offset),
                sort_order=i,
            ))

        db.commit()
        logger.info(f"Generated {len(all_tasks)} implementation tasks for project {project.id}")
    except Exception as e:
        logger.error(f"Error generating tasks for config {config_id}: {e}")
        db.rollback()
    finally:
        db.close()
