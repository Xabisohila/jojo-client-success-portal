# Jojo Client Success Portal

Internal tool for managing the Jojo missed-call recovery service's customer lifecycle — from lead capture through onboarding, configuration, and renewals.

Jojo has no live voice AI: a client's phone number rings through to staff exactly as it does today. Only when a call goes unanswered does Jojo activate — it instantly texts the caller on WhatsApp, then handles qualification, FAQs, and appointment booking entirely over WhatsApp text. This portal tracks the sales and success pipeline around that service; it does not run the call/WhatsApp handling itself.

## Modules

- **Leads** — capture, AI scoring (fit + opportunity), activity tracking
- **Assessments** — 16-question readiness scoring (business, operational, technology, leadership) with AI-generated risk analysis
- **Proposals** — auto-generated pricing (Starter/Professional/Enterprise tiers), ROI estimate, AI narrative, PDF export
- **Onboarding & Config** — Jojo configuration blueprint generation (missed-call WhatsApp message, after-hours message, conversation flow, booking rules, escalation, knowledge base) via Claude API
- **Clients** — client records, contracts/renewals, knowledge base editor (FAQs + services)
- **Customer Success** — post-go-live tracking
- **Dashboard** — pipeline and portfolio overview

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, React Query, React Hook Form + Zod
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **AI**: Anthropic Claude API (lead scoring, assessment analysis, proposal narratives, config generation)
- **Infra**: Docker Compose (Postgres + backend + frontend)

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 16 (or use the provided `docker-compose.yml`)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env       # fill in DATABASE_URL, ANTHROPIC_API_KEY, etc.
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env       # set NEXT_PUBLIC_API_URL
npm run dev
```

### Database

Schema lives in `backend/migrations/`, applied in order (`001_init.sql` through `006_missed_call_model.sql`). Either run them against a local Postgres instance, or use:

```bash
docker-compose up -d
```

which auto-applies `001_init.sql` on a fresh Postgres volume, then starts the backend and frontend. The later migrations (002–006) aren't part of that auto-init script — run them manually against the running `db` container if you're starting from a fresh volume:

```bash
docker exec -i <db-container> psql -U jojo -d jojo_portal < backend/migrations/002_phase2.sql
# ...repeat for 003, 004, 005, 006 in order
```

If you already have an existing database, only `006_missed_call_model.sql` needs to be applied — it renames/drops a few `jojo_configs` columns to match Jojo's actual missed-call → WhatsApp behavior (see migration comments).

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection string |
| `ANTHROPIC_API_KEY` | backend | Claude API access for scoring/proposals/config generation |
| `CLAUDE_MODEL` | backend | Claude model id to use |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | backend | Azure AD auth |
| `SECRET_KEY` | backend | App secret for tokens |
| `NEXT_PUBLIC_API_URL` | frontend | Backend API base URL |
