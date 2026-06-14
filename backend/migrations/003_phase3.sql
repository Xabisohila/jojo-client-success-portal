-- Phase 3: Go Live + Customer Success tables

-- Go-Live confirmation events (Gate 6)
CREATE TABLE IF NOT EXISTS go_live_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    confirmed_by            UUID REFERENCES users(id),
    actual_go_live          DATE,
    jojo_number_confirmed   VARCHAR(50),
    call_forwarding_verified BOOLEAN NOT NULL DEFAULT FALSE,
    test_call_completed     BOOLEAN NOT NULL DEFAULT FALSE,
    client_signed_off       BOOLEAN NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_go_live_client ON go_live_events(client_id);

-- Customer health score snapshots
CREATE TABLE IF NOT EXISTS customer_health (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    health_score        INTEGER CHECK (health_score BETWEEN 0 AND 100),
    usage_score         INTEGER CHECK (usage_score BETWEEN 0 AND 25),
    support_score       INTEGER CHECK (support_score BETWEEN 0 AND 25),
    engagement_score    INTEGER CHECK (engagement_score BETWEEN 0 AND 25),
    roi_score           INTEGER CHECK (roi_score BETWEEN 0 AND 25),
    risk_level          VARCHAR(20) NOT NULL DEFAULT 'healthy',
    -- healthy | at_risk | critical
    ai_summary          TEXT,
    ai_recommendations  TEXT,
    notes               TEXT,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculated_by       UUID REFERENCES users(id)
    -- NULL = auto-calculated by AI
);

CREATE INDEX IF NOT EXISTS idx_health_client ON customer_health(client_id);
CREATE INDEX IF NOT EXISTS idx_health_calculated ON customer_health(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_risk ON customer_health(risk_level);

-- Check-ins / touchpoints
CREATE TABLE IF NOT EXISTS checkins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    checkin_type        VARCHAR(30) NOT NULL DEFAULT 'ad_hoc',
    -- onboarding_call | qbr | health_check | renewal_discussion | ad_hoc
    scheduled_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    conducted_by        UUID REFERENCES users(id),
    outcome             VARCHAR(20),
    -- positive | neutral | negative | escalated
    summary             TEXT,
    action_items        JSONB,
    next_checkin_date   DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_client ON checkins(client_id);
CREATE INDEX IF NOT EXISTS idx_checkin_next_date ON checkins(next_checkin_date);

-- NPS survey responses
CREATE TABLE IF NOT EXISTS nps_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
    category        VARCHAR(20) NOT NULL,
    -- promoter (9-10) | passive (7-8) | detractor (0-6)
    verbatim        TEXT,
    survey_period   VARCHAR(20),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by     UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_nps_client ON nps_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_nps_submitted ON nps_responses(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_nps_category ON nps_responses(category);

-- Apply updated_at trigger to checkins
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_checkins ON checkins;
CREATE TRIGGER set_updated_at_checkins
    BEFORE UPDATE ON checkins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
