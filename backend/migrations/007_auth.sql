-- ============================================================
-- Local email/password authentication.
--
-- Stored in a separate table (not a new column on `users`) because
-- the `jojo` application role does not own the `users` table in
-- some environments and cannot ALTER it, but it can freely create
-- and manage new tables of its own.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_credentials (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed a default admin login so the portal is usable immediately.
-- Email: admin@jojo.internal / Password: ChangeMe123!
-- Change this password via Settings > Team after first login.
INSERT INTO users (entra_id, email, full_name, role)
VALUES ('local-admin', 'admin@jojo.internal', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_credentials (user_id, password_hash)
SELECT id, '$2b$12$rnmtOSNAa2bkgzZgBDhL3.rOJWzZ7RzVEFLcUsvpkSaouqr5V9pw2'
FROM users WHERE email = 'admin@jojo.internal'
ON CONFLICT (user_id) DO NOTHING;
