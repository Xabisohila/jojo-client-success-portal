import uuid
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.client import Client
from app.models.renewals import Renewal, UpsellOpportunity
from app.schemas.renewals import (
    RenewalCreate, RenewalUpdate, RenewalOut, RenewalListItem, RenewalDashboard,
    UpsellCreate, UpsellUpdate, UpsellOut,
)

router = APIRouter(tags=["renewals"])
SYSTEM_USER = uuid.UUID("00000000-0000-0000-0000-000000000001")


# ── Dashboard ──────────────────────────────────────────────────────────────

@router.get("/renewals/dashboard", response_model=RenewalDashboard)
def renewals_dashboard(db: Session = Depends(get_db)):
    today = date.today()
    now = datetime.now(timezone.utc)
    quarter_start = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)

    all_renewals = db.query(Renewal).all()
    active = [r for r in all_renewals if r.status in ("active", "in_negotiation")]
    active_only = [r for r in all_renewals if r.status == "active"]
    in_neg = [r for r in all_renewals if r.status == "in_negotiation"]
    overdue = [r for r in active_only if r.contract_end < today]
    urgent = [r for r in active_only if 0 <= (r.contract_end - today).days <= 30]
    due_soon = [r for r in active_only if 0 <= (r.contract_end - today).days <= 60]
    renewed_q = [r for r in all_renewals if r.status == "renewed" and r.renewed_at and r.renewed_at.date() >= quarter_start]

    mrr_at_risk = sum(float(r.monthly_fee or 0) for r in [*due_soon, *in_neg])
    total_mrr = sum(float(r.monthly_fee or 0) for r in active)

    upsells = db.query(UpsellOpportunity).all()
    upsell_identified = sum(1 for u in upsells if u.status == "identified")
    upsell_pitched = sum(1 for u in upsells if u.status == "pitched")
    upsell_won_q = [u for u in upsells if u.status == "won" and u.closed_at and u.closed_at.date() >= quarter_start]
    pipeline_value = sum(float(u.estimated_mrr or 0) for u in upsells if u.status in ("identified", "pitched"))
    won_value = sum(float(u.estimated_mrr or 0) for u in upsell_won_q)

    return RenewalDashboard(
        total_active=len(active),
        due_soon=len(due_soon),
        urgent=len(urgent),
        overdue=len(overdue),
        in_negotiation=len(in_neg),
        renewed_this_quarter=len(renewed_q),
        mrr_at_risk=mrr_at_risk,
        total_mrr=total_mrr,
        upsell_identified=upsell_identified,
        upsell_pitched=upsell_pitched,
        upsell_won_quarter=len(upsell_won_q),
        upsell_pipeline_value=pipeline_value,
        upsell_won_value=won_value,
    )


# ── Renewals list (global) ─────────────────────────────────────────────────

@router.get("/renewals")
def list_renewals(status: Optional[str] = None, page: int = 1, page_size: int = 25, db: Session = Depends(get_db)):
    today = date.today()
    query = db.query(Renewal, Client.company_name, Client.status.label("client_status")).join(
        Client, Client.id == Renewal.client_id
    )
    if status:
        query = query.filter(Renewal.status == status)
    rows = query.order_by(Renewal.contract_end.asc()).all()

    upsell_counts = {
        client_id: count
        for client_id, count in db.query(
            UpsellOpportunity.client_id, func.count(UpsellOpportunity.id)
        ).filter(UpsellOpportunity.status.in_(["identified", "pitched"])).group_by(UpsellOpportunity.client_id).all()
    }

    all_items = []
    for renewal, company_name, client_status in rows:
        days = (renewal.contract_end - today).days
        all_items.append(RenewalListItem(
            id=renewal.id, client_id=renewal.client_id,
            company_name=company_name, client_status=client_status,
            contract_start=renewal.contract_start, contract_end=renewal.contract_end,
            contract_months=renewal.contract_months, monthly_fee=renewal.monthly_fee,
            status=renewal.status, renewal_notes=renewal.renewal_notes,
            next_contact_date=renewal.next_contact_date, days_to_renewal=days,
            renewed_at=renewal.renewed_at, new_contract_months=renewal.new_contract_months,
            new_monthly_fee=renewal.new_monthly_fee,
            upsell_count=upsell_counts.get(renewal.client_id, 0),
            created_at=renewal.created_at, updated_at=renewal.updated_at,
        ))

    import math
    total = len(all_items)
    start = (page - 1) * page_size
    page_items = all_items[start: start + page_size]
    return {
        "items": [i.model_dump() for i in page_items],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


# ── Client-scoped renewals ─────────────────────────────────────────────────

@router.get("/clients/{client_id}/renewals", response_model=list[RenewalOut])
def get_client_renewals(client_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(Renewal).filter(Renewal.client_id == client_id).order_by(Renewal.contract_end.desc()).all()


@router.post("/clients/{client_id}/renewals", response_model=RenewalOut, status_code=201)
def create_renewal(client_id: uuid.UUID, payload: RenewalCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found.")
    renewal = Renewal(client_id=client_id, created_by=SYSTEM_USER, **payload.model_dump())
    db.add(renewal)
    db.commit()
    db.refresh(renewal)
    return renewal


@router.patch("/clients/{client_id}/renewals/{renewal_id}", response_model=RenewalOut)
def update_renewal(client_id: uuid.UUID, renewal_id: uuid.UUID, payload: RenewalUpdate, db: Session = Depends(get_db)):
    renewal = db.query(Renewal).filter(Renewal.id == renewal_id, Renewal.client_id == client_id).first()
    if not renewal:
        raise HTTPException(404, "Renewal not found.")
    data = payload.model_dump(exclude_none=True)
    if "status" in data and data["status"] == "renewed" and not renewal.renewed_at:
        renewal.renewed_at = datetime.now(timezone.utc)
        renewal.renewed_by = SYSTEM_USER
    for k, v in data.items():
        setattr(renewal, k, v)
    db.commit()
    db.refresh(renewal)
    return renewal


# ── Upsell opportunities ───────────────────────────────────────────────────

@router.get("/clients/{client_id}/upsells", response_model=list[UpsellOut])
def get_upsells(client_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(UpsellOpportunity).filter(UpsellOpportunity.client_id == client_id).order_by(UpsellOpportunity.created_at.desc()).all()


@router.post("/clients/{client_id}/upsells", response_model=UpsellOut, status_code=201)
def create_upsell(client_id: uuid.UUID, payload: UpsellCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found.")
    upsell = UpsellOpportunity(client_id=client_id, created_by=SYSTEM_USER, **payload.model_dump())
    db.add(upsell)
    db.commit()
    db.refresh(upsell)
    return upsell


@router.patch("/clients/{client_id}/upsells/{upsell_id}", response_model=UpsellOut)
def update_upsell(client_id: uuid.UUID, upsell_id: uuid.UUID, payload: UpsellUpdate, db: Session = Depends(get_db)):
    upsell = db.query(UpsellOpportunity).filter(UpsellOpportunity.id == upsell_id, UpsellOpportunity.client_id == client_id).first()
    if not upsell:
        raise HTTPException(404, "Upsell opportunity not found.")
    data = payload.model_dump(exclude_none=True)
    now = datetime.now(timezone.utc)
    if "status" in data:
        if data["status"] == "pitched" and not upsell.pitched_at:
            upsell.pitched_at = now
        elif data["status"] in ("won", "lost") and not upsell.closed_at:
            upsell.closed_at = now
    for k, v in data.items():
        setattr(upsell, k, v)
    db.commit()
    db.refresh(upsell)
    return upsell


@router.delete("/clients/{client_id}/upsells/{upsell_id}", status_code=204)
def delete_upsell(client_id: uuid.UUID, upsell_id: uuid.UUID, db: Session = Depends(get_db)):
    upsell = db.query(UpsellOpportunity).filter(UpsellOpportunity.id == upsell_id, UpsellOpportunity.client_id == client_id).first()
    if not upsell:
        raise HTTPException(404, "Upsell opportunity not found.")
    db.delete(upsell)
    db.commit()
