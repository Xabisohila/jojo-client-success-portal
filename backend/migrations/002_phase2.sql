-- ============================================================
-- JOJO CLIENT SUCCESS PORTAL — Phase 2 Migration
-- Modules: Client Onboarding, Jojo Config Engine, Implementation
-- Run after 001_init.sql
-- ============================================================

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id      UUID NOT NULL REFERENCES leads(id),
    proposal_id  UUID REFERENCES proposals(id),
    company_name TEXT NOT NULL,
    industry     TEXT,
    status       TEXT NOT NULL DEFAULT 'onboarding'
                 CHECK (status IN ('onboarding','implementation','go_live','active','churned')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ONBOARDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS onboardings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               UUID NOT NULL UNIQUE REFERENCES clients(id),
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','in_progress','pending_approval','approved')),

    -- Business Profile
    business_name           TEXT,
    abn                     TEXT,
    business_phone          TEXT,
    business_email          TEXT,
    website                 TEXT,
    business_address        TEXT,
    staff_count             TEXT,

    -- Business Hours
    business_hours          JSONB,
    timezone                TEXT NOT NULL DEFAULT 'Australia/Sydney',
    public_holiday_handling TEXT,
    emergency_policy        TEXT,

    -- Services & Call Types
    primary_services        JSONB,
    call_types              JSONB,
    excluded_topics         TEXT,
    greeting_style          TEXT NOT NULL DEFAULT 'professional',

    -- FAQs & Knowledge
    faqs                    JSONB,
    key_policies            TEXT,
    special_instructions    TEXT,

    -- Integrations
    calendar_system         TEXT,
    calendar_details        JSONB,
    crm_system              TEXT,
    crm_details             JSONB,
    phone_system            TEXT,
    existing_number         TEXT,
    can_forward_calls       BOOLEAN,
    escalation_contacts     JSONB,

    -- Approval
    reviewer_notes          TEXT,
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- JOJO CONFIGS
-- ============================================================
CREATE TABLE IF NOT EXISTS jojo_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID NOT NULL REFERENCES clients(id),
    onboarding_id       UUID REFERENCES onboardings(id),
    version             INTEGER NOT NULL DEFAULT 1,
    status              TEXT NOT NULL DEFAULT 'generating'
                        CHECK (status IN ('generating','draft','pending_review','approved','deployed')),

    -- AI-generated scripts
    greeting_message    TEXT,
    after_hours_message TEXT,
    voicemail_message   TEXT,

    -- AI-generated structured config
    call_flow           JSONB,
    booking_rules       JSONB,
    escalation_rules    JSONB,
    knowledge_base      JSONB,
    config_summary      TEXT,

    -- Deployment
    jojo_phone_number   TEXT,
    reviewer_notes      TEXT,
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    deployed_at         TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- IMPLEMENTATION PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS implementation_projects (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id        UUID NOT NULL REFERENCES clients(id),
    jojo_config_id   UUID REFERENCES jojo_configs(id),
    status           TEXT NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started','in_progress','blocked','completed')),
    target_go_live   DATE,
    actual_go_live   DATE,
    project_manager  UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- IMPLEMENTATION TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS implementation_tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES implementation_projects(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    category     TEXT NOT NULL DEFAULT 'setup'
                 CHECK (category IN ('setup','integration','configuration','testing','training','sign_off')),
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','completed','blocked','skipped')),
    priority     TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','critical')),
    assigned_to  UUID REFERENCES users(id),
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    notes        TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clients_lead_id        ON clients(lead_id);
CREATE INDEX IF NOT EXISTS idx_clients_status         ON clients(status);
CREATE INDEX IF NOT EXISTS idx_onboardings_client     ON onboardings(client_id);
CREATE INDEX IF NOT EXISTS idx_onboardings_status     ON onboardings(status);
CREATE INDEX IF NOT EXISTS idx_jojo_configs_client    ON jojo_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_jojo_configs_status    ON jojo_configs(status);
CREATE INDEX IF NOT EXISTS idx_impl_projects_client   ON implementation_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_impl_tasks_project     ON implementation_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_impl_tasks_status      ON implementation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_impl_tasks_category    ON implementation_tasks(category);

-- ============================================================
-- Triggers
-- ============================================================
CREATE OR REPLACE TRIGGER clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER onboardings_updated_at
    BEFORE UPDATE ON onboardings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER jojo_configs_updated_at
    BEFORE UPDATE ON jojo_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER impl_projects_updated_at
    BEFORE UPDATE ON implementation_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
