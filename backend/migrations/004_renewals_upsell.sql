-- ============================================================
-- JOJO CLIENT SUCCESS PORTAL — Phase 4: Renewals & Upsell
-- ============================================================

CREATE TABLE IF NOT EXISTS renewals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id        UUID NOT NULL REFERENCES clients(id),
    contract_start   DATE NOT NULL,
    contract_end     DATE NOT NULL,
    contract_months  INTEGER NOT NULL DEFAULT 12,
    monthly_fee      NUMERIC(10, 2),
    setup_fee        NUMERIC(10, 2) DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'in_negotiation', 'renewed', 'lost')),
    renewal_notes    TEXT,
    next_contact_date DATE,
    renewed_at       TIMESTAMPTZ,
    renewed_by       UUID REFERENCES users(id),
    new_contract_months INTEGER,
    new_monthly_fee  NUMERIC(10, 2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS upsell_opportunities (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id      UUID NOT NULL REFERENCES clients(id),
    type           TEXT NOT NULL DEFAULT 'custom'
                   CHECK (type IN ('tier_upgrade', 'additional_location', 'add_on_feature', 'volume_increase', 'referral', 'custom')),
    title          TEXT NOT NULL,
    description    TEXT,
    estimated_mrr  NUMERIC(10, 2),
    status         TEXT NOT NULL DEFAULT 'identified'
                   CHECK (status IN ('identified', 'pitched', 'won', 'lost')),
    identified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    pitched_at     TIMESTAMPTZ,
    closed_at      TIMESTAMPTZ,
    notes          TEXT,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_renewals_client_id   ON renewals(client_id);
CREATE INDEX idx_renewals_status      ON renewals(status);
CREATE INDEX idx_renewals_contract_end ON renewals(contract_end);
CREATE INDEX idx_upsell_client_id     ON upsell_opportunities(client_id);
CREATE INDEX idx_upsell_status        ON upsell_opportunities(status);
