from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SettingOut(BaseModel):
    key: str
    value: Optional[str]
    description: Optional[str]
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberCreate(BaseModel):
    full_name: str
    email: str
    role: str = "sales"   # admin | sales | csm | implementation
    password: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class TeamMemberOut(BaseModel):
    id: uuid.UUID
    entra_id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class IntegrationStatus(BaseModel):
    name: str
    status: str   # configured | not_configured | not_connected
    detail: Optional[str] = None
