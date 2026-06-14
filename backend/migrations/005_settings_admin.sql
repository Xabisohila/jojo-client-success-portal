-- ============================================================
-- JOJO CLIENT SUCCESS PORTAL — Phase 4: Settings & Admin
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(id)
);

INSERT INTO system_settings (key, value, description) VALUES
    ('company_name',           'Jojo AI',            'Company display name'),
    ('company_timezone',       'Australia/Sydney',   'Default timezone for dates'),
    ('notification_email',     '',                   'Email address for system notifications'),
    ('slack_webhook_url',      '',                   'Slack webhook URL for alerts'),
    ('renewal_reminder_days',  '60',                 'Days before contract end to flag renewal as due soon')
ON CONFLICT DO NOTHING;
