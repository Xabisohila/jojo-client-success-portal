import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import hash_password
from app.database import get_db
from app.config import settings as app_settings
from app.models.user import User, UserCredential
from app.models.settings import SystemSetting
from app.schemas.settings import (
    SettingOut, TeamMemberCreate, TeamMemberUpdate, TeamMemberOut, IntegrationStatus,
)

router = APIRouter(tags=["settings"])
SYSTEM_USER = uuid.UUID("00000000-0000-0000-0000-000000000001")
VALID_ROLES = ("admin", "sales", "csm", "implementation")


# ── System settings ────────────────────────────────────────────────────────

@router.get("/settings/system")
def get_system_settings(db: Session = Depends(get_db)):
    rows = db.query(SystemSetting).all()
    return {row.key: row.value for row in rows}


@router.patch("/settings/system")
def update_system_settings(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for key, value in payload.items():
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if row:
            row.value = str(value) if value is not None else ""
            row.updated_at = datetime.now(timezone.utc)
            row.updated_by = current_user.id
        else:
            db.add(SystemSetting(key=key, value=str(value) if value is not None else "", updated_by=current_user.id))
    db.commit()
    rows = db.query(SystemSetting).all()
    return {row.key: row.value for row in rows}


# ── Integrations ───────────────────────────────────────────────────────────

@router.get("/settings/integrations", response_model=list[IntegrationStatus])
def get_integrations():
    api_key = app_settings.anthropic_api_key or ""
    claude_ok = bool(api_key and "placeholder" not in api_key and api_key.startswith("sk-ant-"))
    return [
        IntegrationStatus(
            name="Claude AI",
            status="configured" if claude_ok else "not_configured",
            detail=f"Model: {app_settings.claude_model}" if claude_ok else "Add ANTHROPIC_API_KEY to .env",
        ),
        IntegrationStatus(name="Google Calendar", status="not_connected", detail="Calendar integration not yet set up"),
        IntegrationStatus(name="CRM", status="not_connected", detail="CRM integration not yet set up"),
        IntegrationStatus(name="Telephony / Jojo API", status="not_connected", detail="Live Jojo connection not yet configured"),
    ]


# ── Team members ───────────────────────────────────────────────────────────

@router.get("/settings/team", response_model=list[TeamMemberOut])
def list_team(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.full_name.asc()).all()


@router.post("/settings/team", response_model=TeamMemberOut, status_code=201)
def add_team_member(payload: TeamMemberCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can add team members.")
    if payload.role not in VALID_ROLES:
        raise HTTPException(400, f"Role must be one of: {', '.join(VALID_ROLES)}")
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "A team member with this email already exists.")
    member = User(
        entra_id=payload.email,  # use email as entra_id placeholder until Azure AD integration
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    db.add(member)
    db.flush()
    if payload.password:
        db.add(UserCredential(user_id=member.id, password_hash=hash_password(payload.password)))
    db.commit()
    db.refresh(member)
    return member


@router.patch("/settings/team/{user_id}", response_model=TeamMemberOut)
def update_team_member(user_id: uuid.UUID, payload: TeamMemberUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can modify team members.")
    if user_id == SYSTEM_USER:
        raise HTTPException(400, "Cannot edit the system user.")
    member = db.query(User).filter(User.id == user_id).first()
    if not member:
        raise HTTPException(404, "Team member not found.")
    if payload.role and payload.role not in VALID_ROLES:
        raise HTTPException(400, f"Role must be one of: {', '.join(VALID_ROLES)}")
    data = payload.model_dump(exclude_none=True)
    password = data.pop("password", None)
    for k, v in data.items():
        setattr(member, k, v)
    if password:
        creds = db.query(UserCredential).filter(UserCredential.user_id == member.id).first()
        if creds:
            creds.password_hash = hash_password(password)
            creds.updated_at = datetime.now(timezone.utc)
        else:
            db.add(UserCredential(user_id=member.id, password_hash=hash_password(password)))
    db.commit()
    db.refresh(member)
    return member


@router.delete("/settings/team/{user_id}", status_code=204)
def deactivate_team_member(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can deactivate team members.")
    if user_id == SYSTEM_USER:
        raise HTTPException(400, "Cannot deactivate the system user.")
    member = db.query(User).filter(User.id == user_id).first()
    if not member:
        raise HTTPException(404, "Team member not found.")
    member.is_active = False
    db.commit()
