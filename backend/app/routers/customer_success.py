import uuid
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.client import Client, ImplementationProject
from app.models.customer_success import GoLiveEvent, CustomerHealth, Checkin, NpsResponse
from app.models.proposal import Proposal
from app.schemas.customer_success import (
    GoLiveConfirm, GoLiveEventOut,
    HealthScoreCreate, CustomerHealthOut,
    CheckinCreate, CheckinComplete, CheckinOut,
    NpsCreate, NpsResponseOut,
    CSDashboardSummary, ClientHealthSummary,
)

router = APIRouter(tags=["customer-success"])
SYSTEM_USER = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _get_client(db: Session, client_id: uuid.UUID) -> Client:
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Client not found.")
    return c


def _nps_category(score: int) -> str:
    if score >= 9:
        return "promoter"
    if score >= 7:
        return "passive"
    return "detractor"


def _days_since_date(d) -> int | None:
    if d is None:
        return None
    today = date.today()
    if isinstance(d, datetime):
        d = d.date()
    return (today - d).days


# ── CS Dashboard ──────────────────────────────────────────────────────────

@router.get("/customer-success/dashboard", response_model=CSDashboardSummary)
def cs_dashboard(db: Session = Depends(get_db)):
    active = db.query(Client).filter(Client.status == "active").count()
    go_live = db.query(Client).filter(Client.status == "go_live").count()

    # Latest health per client
    latest_health = (
        db.query(CustomerHealth)
        .distinct(CustomerHealth.client_id)
        .order_by(CustomerHealth.client_id, CustomerHealth.calculated_at.desc())
        .all()
    )
    risk_counts = {"healthy": 0, "at_risk": 0, "critical": 0}
    scores = []
    for h in latest_health:
        risk_counts[h.risk_level] = risk_counts.get(h.risk_level, 0) + 1
        if h.health_score is not None:
            scores.append(h.health_score)

    avg_health = round(sum(scores) / len(scores), 1) if scores else None

    # NPS
    all_nps = db.query(NpsResponse).all()
    nps_scores = [n.score for n in all_nps]
    nps_avg = round(sum(nps_scores) / len(nps_scores), 1) if nps_scores else None
    promoters = sum(1 for n in all_nps if n.category == "promoter")
    passives = sum(1 for n in all_nps if n.category == "passive")
    detractors = sum(1 for n in all_nps if n.category == "detractor")

    # Check-ins due (next_checkin_date within 7 days)
    today = date.today()
    in_7 = today + timedelta(days=7)
    checkins_due = db.query(Checkin).filter(
        Checkin.next_checkin_date != None,
        Checkin.next_checkin_date <= in_7,
        Checkin.next_checkin_date >= today,
    ).count()

    # Renewals due — based on proposal accepted_at + contract_months
    renewals_30 = renewals_60 = 0
    clients = db.query(Client).filter(Client.status.in_(["active", "go_live"])).all()
    for c in clients:
        proposal = db.query(Proposal).filter(Proposal.id == c.proposal_id).first() if c.proposal_id else None
        if proposal and proposal.accepted_at and proposal.contract_months:
            renewal = proposal.accepted_at + timedelta(days=proposal.contract_months * 30)
            days_until = (renewal.date() - today).days if hasattr(renewal, 'date') else (renewal - today).days
            if 0 <= days_until <= 30:
                renewals_30 += 1
            elif 0 <= days_until <= 60:
                renewals_60 += 1

    return CSDashboardSummary(
        active_clients=active,
        go_live_clients=go_live,
        healthy=risk_counts.get("healthy", 0),
        at_risk=risk_counts.get("at_risk", 0),
        critical=risk_counts.get("critical", 0),
        avg_health_score=avg_health,
        nps_average=nps_avg,
        promoters=promoters,
        passives=passives,
        detractors=detractors,
        checkins_due_7_days=checkins_due,
        renewals_due_30_days=renewals_30,
        renewals_due_60_days=renewals_60,
    )


@router.get("/customer-success/clients")
def cs_client_list(page: int = 1, page_size: int = 25, db: Session = Depends(get_db)):
    clients = db.query(Client).filter(Client.status.in_(["active", "go_live"])).order_by(Client.company_name).all()
    result = []
    for c in clients:
        latest_health = (
            db.query(CustomerHealth)
            .filter(CustomerHealth.client_id == c.id)
            .order_by(CustomerHealth.calculated_at.desc())
            .first()
        )
        latest_checkin = (
            db.query(Checkin)
            .filter(Checkin.client_id == c.id, Checkin.completed_at != None)
            .order_by(Checkin.completed_at.desc())
            .first()
        )
        latest_nps = (
            db.query(NpsResponse)
            .filter(NpsResponse.client_id == c.id)
            .order_by(NpsResponse.submitted_at.desc())
            .first()
        )
        project = db.query(ImplementationProject).filter(ImplementationProject.client_id == c.id).first()
        days_live = _days_since_date(project.actual_go_live if project else None)

        result.append(ClientHealthSummary(
            client_id=c.id, company_name=c.company_name, status=c.status,
            health_score=latest_health.health_score if latest_health else None,
            risk_level=latest_health.risk_level if latest_health else "healthy",
            last_checkin=latest_checkin.completed_at if latest_checkin else None,
            last_nps=latest_nps.score if latest_nps else None,
            days_since_go_live=days_live,
        ))

    import math
    total = len(result)
    start = (page - 1) * page_size
    page_items = result[start: start + page_size]
    return {
        "items": [i.model_dump() for i in page_items],
        "total": total, "page": page, "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)),
    }


# ── Go-Live ───────────────────────────────────────────────────────────────

@router.post("/clients/{client_id}/go-live", response_model=GoLiveEventOut)
def confirm_go_live(
    client_id: uuid.UUID,
    payload: GoLiveConfirm,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from app.services.health_scorer import calculate_health_score

    client = _get_client(db, client_id)
    if client.status != "go_live":
        raise HTTPException(400, "Client must be in go_live status to confirm launch.")

    event = GoLiveEvent(
        client_id=client_id,
        confirmed_by=SYSTEM_USER,
        actual_go_live=payload.actual_go_live or date.today(),
        jojo_number_confirmed=payload.jojo_number_confirmed,
        call_forwarding_verified=payload.call_forwarding_verified,
        test_call_completed=payload.test_call_completed,
        client_signed_off=payload.client_signed_off,
        notes=payload.notes,
    )
    db.add(event)

    # Update implementation project actual go-live
    project = db.query(ImplementationProject).filter(ImplementationProject.client_id == client_id).first()
    if project:
        project.actual_go_live = event.actual_go_live

    client.status = "active"
    db.commit()

    # Trigger initial health score
    background_tasks.add_task(calculate_health_score, client_id, db)

    db.refresh(event)
    return event


@router.get("/clients/{client_id}/go-live", response_model=list[GoLiveEventOut])
def list_go_live_events(client_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_client(db, client_id)
    return db.query(GoLiveEvent).filter(GoLiveEvent.client_id == client_id).order_by(GoLiveEvent.created_at.desc()).all()


# ── Health Scores ─────────────────────────────────────────────────────────

@router.get("/clients/{client_id}/health", response_model=list[CustomerHealthOut])
def get_health_scores(client_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_client(db, client_id)
    return (
        db.query(CustomerHealth)
        .filter(CustomerHealth.client_id == client_id)
        .order_by(CustomerHealth.calculated_at.desc())
        .limit(10)
        .all()
    )


@router.post("/clients/{client_id}/health/score", response_model=dict)
def trigger_health_score(
    client_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    _get_client(db, client_id)
    from app.services.health_scorer import calculate_health_score
    background_tasks.add_task(calculate_health_score, client_id, db)
    return {"message": "Health score calculation started."}


@router.post("/clients/{client_id}/health/manual", response_model=CustomerHealthOut)
def save_manual_health(
    client_id: uuid.UUID,
    payload: HealthScoreCreate,
    db: Session = Depends(get_db),
):
    _get_client(db, client_id)
    usage = payload.usage_score or 0
    support = payload.support_score or 0
    engagement = payload.engagement_score or 0
    roi = payload.roi_score or 0
    total = usage + support + engagement + roi
    risk = "healthy" if total >= 70 else ("at_risk" if total >= 40 else "critical")

    score = CustomerHealth(
        client_id=client_id,
        health_score=total,
        usage_score=usage,
        support_score=support,
        engagement_score=engagement,
        roi_score=roi,
        risk_level=risk,
        notes=payload.notes,
        calculated_by=SYSTEM_USER,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


# ── Check-ins ─────────────────────────────────────────────────────────────

@router.get("/clients/{client_id}/checkins", response_model=list[CheckinOut])
def list_checkins(client_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_client(db, client_id)
    return (
        db.query(Checkin)
        .filter(Checkin.client_id == client_id)
        .order_by(Checkin.created_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/checkins", response_model=CheckinOut)
def create_checkin(client_id: uuid.UUID, payload: CheckinCreate, db: Session = Depends(get_db)):
    _get_client(db, client_id)
    checkin = Checkin(
        client_id=client_id,
        checkin_type=payload.checkin_type,
        scheduled_at=payload.scheduled_at,
        summary=payload.summary,
        outcome=payload.outcome,
        action_items=payload.action_items,
        next_checkin_date=payload.next_checkin_date,
        conducted_by=SYSTEM_USER,
        completed_at=datetime.now(timezone.utc) if payload.outcome else None,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.patch("/clients/{client_id}/checkins/{checkin_id}", response_model=CheckinOut)
def complete_checkin(
    client_id: uuid.UUID,
    checkin_id: uuid.UUID,
    payload: CheckinComplete,
    db: Session = Depends(get_db),
):
    checkin = db.query(Checkin).filter(
        Checkin.id == checkin_id, Checkin.client_id == client_id
    ).first()
    if not checkin:
        raise HTTPException(404, "Check-in not found.")
    checkin.outcome = payload.outcome
    checkin.summary = payload.summary
    checkin.action_items = payload.action_items
    checkin.next_checkin_date = payload.next_checkin_date
    checkin.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(checkin)
    return checkin


# ── NPS ───────────────────────────────────────────────────────────────────

@router.get("/clients/{client_id}/nps", response_model=list[NpsResponseOut])
def list_nps(client_id: uuid.UUID, db: Session = Depends(get_db)):
    _get_client(db, client_id)
    return (
        db.query(NpsResponse)
        .filter(NpsResponse.client_id == client_id)
        .order_by(NpsResponse.submitted_at.desc())
        .all()
    )


@router.post("/clients/{client_id}/nps", response_model=NpsResponseOut)
def add_nps(client_id: uuid.UUID, payload: NpsCreate, db: Session = Depends(get_db)):
    _get_client(db, client_id)
    response = NpsResponse(
        client_id=client_id,
        score=payload.score,
        category=_nps_category(payload.score),
        verbatim=payload.verbatim,
        survey_period=payload.survey_period,
        recorded_by=SYSTEM_USER,
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return response
