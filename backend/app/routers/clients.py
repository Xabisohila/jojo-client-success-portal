import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.client import Client, Onboarding, JojoConfig, ImplementationProject, ImplementationTask
from app.schemas.client import (
    ClientOut, ClientListItem,
    OnboardingStep1, OnboardingStep2, OnboardingStep3, OnboardingStep4, OnboardingStep5,
    OnboardingApprove, OnboardingOut,
    JojoConfigOut, JojoConfigUpdate, JojoConfigApprove,
    ImplementationProjectOut, TaskOut, TaskUpdate, ProjectUpdate,
)

router = APIRouter(tags=["clients"])
SYSTEM_USER = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _get_client(db: Session, client_id: uuid.UUID) -> Client:
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found.")
    return c


# ── Clients ───────────────────────────────────────────────────────────────

@router.get("/clients")
def list_clients(
    page: int = 1, page_size: int = 25, db: Session = Depends(get_db)
):
    import math
    from app.schemas.client import ClientListItem as CLI
    q = db.query(Client).order_by(Client.created_at.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [CLI.model_validate(i).model_dump() for i in items],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/clients/{client_id}", response_model=ClientOut)
def get_client(client_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_client(db, client_id)


# ── Onboarding — Step saves (PATCH per step) ──────────────────────────────

def _get_onboarding(db: Session, client_id: uuid.UUID) -> Onboarding:
    client = _get_client(db, client_id)
    if not client.onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found for this client.")
    return client.onboarding


@router.get("/clients/{client_id}/onboarding", response_model=OnboardingOut)
def get_onboarding(client_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_onboarding(db, client_id)


@router.patch("/clients/{client_id}/onboarding/step1", response_model=OnboardingOut)
def save_step1(client_id: uuid.UUID, payload: OnboardingStep1, db: Session = Depends(get_db)):
    ob = _get_onboarding(db, client_id)
    if ob.status not in ("draft", "in_progress"):
        raise HTTPException(400, "Onboarding cannot be edited in its current status.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ob, k, v)
    ob.status = "in_progress"
    db.commit(); db.refresh(ob)
    return ob


@router.patch("/clients/{client_id}/onboarding/step2", response_model=OnboardingOut)
def save_step2(client_id: uuid.UUID, payload: OnboardingStep2, db: Session = Depends(get_db)):
    ob = _get_onboarding(db, client_id)
    if ob.status not in ("draft", "in_progress"):
        raise HTTPException(400, "Onboarding cannot be edited in its current status.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ob, k, v)
    ob.status = "in_progress"
    db.commit(); db.refresh(ob)
    return ob


@router.patch("/clients/{client_id}/onboarding/step3", response_model=OnboardingOut)
def save_step3(client_id: uuid.UUID, payload: OnboardingStep3, db: Session = Depends(get_db)):
    ob = _get_onboarding(db, client_id)
    if ob.status not in ("draft", "in_progress"):
        raise HTTPException(400, "Onboarding cannot be edited in its current status.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ob, k, v)
    ob.status = "in_progress"
    db.commit(); db.refresh(ob)
    return ob


@router.patch("/clients/{client_id}/onboarding/step4", response_model=OnboardingOut)
def save_step4(client_id: uuid.UUID, payload: OnboardingStep4, db: Session = Depends(get_db)):
    ob = _get_onboarding(db, client_id)
    if ob.status not in ("draft", "in_progress"):
        raise HTTPException(400, "Onboarding cannot be edited in its current status.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ob, k, v)
    ob.status = "in_progress"
    db.commit(); db.refresh(ob)
    return ob


@router.patch("/clients/{client_id}/onboarding/step5", response_model=OnboardingOut)
def save_step5(client_id: uuid.UUID, payload: OnboardingStep5, db: Session = Depends(get_db)):
    ob = _get_onboarding(db, client_id)
    if ob.status not in ("draft", "in_progress"):
        raise HTTPException(400, "Onboarding cannot be edited in its current status.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(ob, k, v)
    ob.status = "in_progress"
    db.commit(); db.refresh(ob)
    return ob


@router.post("/clients/{client_id}/onboarding/submit", response_model=OnboardingOut)
def submit_onboarding(client_id: uuid.UUID, db: Session = Depends(get_db)):
    ob = _get_onboarding(db, client_id)
    if ob.status != "in_progress":
        raise HTTPException(400, "Onboarding must be in_progress to submit.")
    if not ob.business_name or not ob.business_phone:
        raise HTTPException(400, "Business name and phone are required before submitting.")
    ob.status = "pending_approval"
    db.commit(); db.refresh(ob)
    return ob


@router.post("/clients/{client_id}/onboarding/approve", response_model=OnboardingOut)
def approve_onboarding(
    client_id: uuid.UUID,
    payload: OnboardingApprove,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.services.config_generator import generate_jojo_config

    ob = _get_onboarding(db, client_id)
    if ob.status != "pending_approval":
        raise HTTPException(400, "Onboarding must be pending_approval to approve.")
    ob.status = "approved"
    ob.approved_by = SYSTEM_USER
    ob.approved_at = datetime.now(timezone.utc)
    if payload.reviewer_notes:
        ob.reviewer_notes = payload.reviewer_notes
    db.commit()
    background_tasks.add_task(generate_jojo_config, ob.id)
    db.refresh(ob)
    return ob


# ── Jojo Config ───────────────────────────────────────────────────────────

@router.post("/clients/{client_id}/config/regenerate")
def regenerate_config(client_id: uuid.UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from app.services.config_generator import generate_jojo_config
    ob = db.query(Onboarding).filter(Onboarding.client_id == client_id, Onboarding.status == "approved").first()
    if not ob:
        raise HTTPException(404, "No approved onboarding found for this client.")
    background_tasks.add_task(generate_jojo_config, ob.id)
    return {"message": "Config generation started"}


@router.get("/clients/{client_id}/config", response_model=JojoConfigOut)
def get_config(client_id: uuid.UUID, db: Session = Depends(get_db)):
    client = _get_client(db, client_id)
    config = db.query(JojoConfig).filter(JojoConfig.client_id == client_id).order_by(JojoConfig.version.desc()).first()
    if not config:
        raise HTTPException(404, "No Jojo configuration found for this client.")
    return config


@router.patch("/clients/{client_id}/config/{config_id}", response_model=JojoConfigOut)
def update_config(client_id: uuid.UUID, config_id: uuid.UUID, payload: JojoConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(JojoConfig).filter(JojoConfig.id == config_id, JojoConfig.client_id == client_id).first()
    if not config:
        raise HTTPException(404, "Config not found.")
    if config.status not in ("draft", "pending_review"):
        raise HTTPException(400, "Config cannot be edited in its current status.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(config, k, v)
    db.commit(); db.refresh(config)
    return config


@router.post("/clients/{client_id}/config/{config_id}/approve", response_model=JojoConfigOut)
def approve_config(
    client_id: uuid.UUID,
    config_id: uuid.UUID,
    payload: JojoConfigApprove,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.services.task_generator import generate_implementation_tasks

    config = db.query(JojoConfig).filter(JojoConfig.id == config_id, JojoConfig.client_id == client_id).first()
    if not config:
        raise HTTPException(404, "Config not found.")
    if config.status != "pending_review":
        raise HTTPException(400, "Config must be pending_review to approve.")
    config.status = "approved"
    config.approved_by = SYSTEM_USER
    config.approved_at = datetime.now(timezone.utc)
    if payload.reviewer_notes:
        config.reviewer_notes = payload.reviewer_notes
    if payload.jojo_phone_number:
        config.jojo_phone_number = payload.jojo_phone_number

    # Update client status
    client = _get_client(db, client_id)
    client.status = "implementation"
    db.commit()

    background_tasks.add_task(generate_implementation_tasks, config_id)
    db.refresh(config)
    return config


# ── Implementation ────────────────────────────────────────────────────────

@router.get("/clients/{client_id}/implementation", response_model=ImplementationProjectOut)
def get_implementation(client_id: uuid.UUID, db: Session = Depends(get_db)):
    project = db.query(ImplementationProject).filter(ImplementationProject.client_id == client_id).first()
    if not project:
        raise HTTPException(404, "No implementation project found for this client.")
    return project


@router.patch("/clients/{client_id}/implementation", response_model=ImplementationProjectOut)
def update_project(client_id: uuid.UUID, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(ImplementationProject).filter(ImplementationProject.client_id == client_id).first()
    if not project:
        raise HTTPException(404, "Implementation project not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(project, k, v)
    db.commit(); db.refresh(project)
    return project


@router.patch("/clients/{client_id}/implementation/tasks/{task_id}", response_model=TaskOut)
def update_task(
    client_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
):
    task = (
        db.query(ImplementationTask)
        .join(ImplementationProject)
        .filter(ImplementationTask.id == task_id, ImplementationProject.client_id == client_id)
        .first()
    )
    if not task:
        raise HTTPException(404, "Task not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(task, k, v)
    if payload.status == "completed" and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc)
    elif payload.status and payload.status != "completed":
        task.completed_at = None

    db.commit()

    # Auto-update project status based on task completion
    project = task.project
    total = len(project.tasks)
    done = sum(1 for t in project.tasks if t.status in ("completed", "skipped"))
    if done == total and total > 0:
        project.status = "completed"
        _get_client(db, client_id).status = "go_live"
    elif any(t.status == "in_progress" for t in project.tasks):
        project.status = "in_progress"
    db.commit()
    db.refresh(task)
    return task
