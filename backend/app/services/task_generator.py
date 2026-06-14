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
BASE_TASKS = [
    # Setup
    ("Provision Jojo phone number", "Request and assign a dedicated Jojo phone number for call forwarding.", "setup", "critical", 0),
    ("Configure call forwarding", "Set up call forwarding from client's existing number to the Jojo number.", "setup", "critical", 1),
    ("Upload greeting scripts to Jojo", "Load the AI-generated greeting, after-hours, and voicemail scripts into the Jojo platform.", "setup", "high", 2),
    ("Configure business hours in Jojo", "Set operating hours and timezone so Jojo switches between business/after-hours modes correctly.", "setup", "high", 2),
    ("Set after-hours handling rules", "Configure what Jojo does outside business hours: take message, book appointment, or refer to emergency contact.", "setup", "high", 3),

    # Configuration
    ("Upload knowledge base and FAQs", "Import the approved FAQs and service information into the Jojo knowledge base.", "configuration", "high", 3),
    ("Configure booking rules", "Set appointment types, collection fields, advance booking window, and confirmation method.", "configuration", "high", 4),
    ("Configure escalation rules", "Set up triggers and actions for complaint handling, urgent calls, and manager escalations.", "configuration", "high", 4),

    # Testing
    ("Internal test — business hours call", "Call Jojo during business hours and verify: greeting, FAQ responses, booking flow.", "testing", "critical", 7),
    ("Internal test — after-hours call", "Call Jojo after hours and verify: after-hours message, message capture, voicemail.", "testing", "critical", 7),
    ("Internal test — booking flow end-to-end", "Test full booking: name/phone/reason collection, calendar entry creation, confirmation.", "testing", "critical", 8),
    ("Internal test — escalation flow", "Test escalation triggers: complaint keyword, urgent call, manager request.", "testing", "high", 8),
    ("Internal test — FAQ responses", "Verify Jojo answers the top 5 FAQs correctly and accurately.", "testing", "high", 9),

    # Training
    ("Staff briefing — what Jojo handles", "Brief all staff on what Jojo will and won't handle. Distribute one-page summary.", "training", "high", 10),
    ("Client admin training — reporting dashboard", "Train the client champion on accessing Jojo call logs and performance reports.", "training", "medium", 11),

    # Sign-off
    ("Client UAT sign-off", "Client reviews and signs off on Jojo's behaviour via the UAT checklist.", "sign_off", "critical", 12),
    ("Go-live approval", "Internal team signs off that all tasks are complete and Jojo is ready for live calls.", "sign_off", "critical", 13),
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
