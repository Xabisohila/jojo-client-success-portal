-- ============================================================
-- JOJO CLIENT SUCCESS PORTAL — Initial Migration
-- Run once against a fresh PostgreSQL database
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entra_id    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    full_name   TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'sales', 'csm', 'implementation')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- System user for automated actions
INSERT INTO users (id, entra_id, email, full_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'system',
    'system@jojo.internal',
    'Jojo System',
    'admin'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name           TEXT NOT NULL,
    last_name            TEXT NOT NULL,
    email                TEXT UNIQUE NOT NULL,
    phone                TEXT,
    job_title            TEXT,
    company_name         TEXT NOT NULL,
    industry             TEXT,
    company_size         TEXT,
    monthly_call_volume  TEXT,
    current_solution     TEXT,
    pain_points          TEXT,
    source               TEXT NOT NULL DEFAULT 'other',
    status               TEXT NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new','contacted','engaged','qualified','disqualified','converted')),
    lead_score           INTEGER CHECK (lead_score BETWEEN 0 AND 100),
    opportunity_score    INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
    score_rationale      TEXT,
    recommended_action   TEXT,
    assigned_to          UUID REFERENCES users(id),
    disqualified_reason  TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_activities (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id        UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type  TEXT NOT NULL CHECK (activity_type IN ('email','call','note','status_change','score_update','system')),
    subject        TEXT,
    body           TEXT,
    performed_by   UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_status_history (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_status  TEXT,
    to_status    TEXT NOT NULL,
    changed_by   UUID REFERENCES users(id),
    note         TEXT,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES leads(id),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','in_progress','ai_scored','pending_approval','approved','changes_requested','flagged')),
    total_score         INTEGER CHECK (total_score BETWEEN 0 AND 100),
    risk_level          TEXT CHECK (risk_level IN ('low','medium','high','critical')),
    ai_summary          TEXT,
    ai_recommendations  TEXT,
    reviewer_notes      TEXT,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_sections (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id  UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    section_type   TEXT NOT NULL CHECK (section_type IN ('business','operational','technology','leadership')),
    score          INTEGER CHECK (score BETWEEN 0 AND 25),
    max_score      INTEGER NOT NULL DEFAULT 25,
    ai_analysis    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id      UUID NOT NULL REFERENCES assessment_sections(id) ON DELETE CASCADE,
    question_key    TEXT NOT NULL,
    question_text   TEXT NOT NULL,
    response_value  TEXT,
    weight          NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    points_earned   NUMERIC(5,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_risks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id     UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    risk_category     TEXT NOT NULL,
    risk_description  TEXT NOT NULL,
    severity          TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    mitigation        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROPOSALS
-- ============================================================
CREATE TABLE IF NOT EXISTS proposals (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id           UUID NOT NULL REFERENCES leads(id),
    assessment_id     UUID REFERENCES assessments(id),
    version           INTEGER NOT NULL DEFAULT 1,
    status            TEXT NOT NULL DEFAULT 'generating'
                      CHECK (status IN ('generating','draft','pending_approval','approved','sent','viewed','accepted','rejected','expired')),
    pricing_tier      TEXT NOT NULL CHECK (pricing_tier IN ('starter','professional','enterprise','custom')),
    scope_summary     TEXT,
    executive_summary TEXT,
    monthly_fee       NUMERIC(10,2),
    setup_fee         NUMERIC(10,2),
    contract_months   INTEGER NOT NULL DEFAULT 12,
    roi_monthly       NUMERIC(10,2),
    roi_annual        NUMERIC(10,2),
    roi_rationale     TEXT,
    valid_until       DATE,
    reviewer_notes    TEXT,
    approved_by       UUID REFERENCES users(id),
    approved_at       TIMESTAMPTZ,
    sent_at           TIMESTAMPTZ,
    accepted_at       TIMESTAMPTZ,
    created_by        UUID NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal_line_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id  UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    item_name    TEXT NOT NULL,
    description  TEXT,
    quantity     INTEGER NOT NULL DEFAULT 1,
    unit_price   NUMERIC(10,2) NOT NULL,
    total_price  NUMERIC(10,2) NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS & AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT,
    entity_type  TEXT,
    entity_id    UUID,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  TEXT NOT NULL,
    entity_id    UUID NOT NULL,
    action       TEXT NOT NULL,
    performed_by UUID REFERENCES users(id),
    old_value    JSONB,
    new_value    JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to  ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_email        ON leads(email);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_assessments_lead   ON assessments(lead_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_proposals_lead     ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status   ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_notifs_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_log(entity_type, entity_id);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
