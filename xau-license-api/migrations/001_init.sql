CREATE TABLE IF NOT EXISTS xau_licenses (
    id BIGSERIAL PRIMARY KEY,
    license_key_hash TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,
    sku TEXT,
    plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly', 'permanent')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    paypal_order_id TEXT,
    paypal_capture_id TEXT UNIQUE,
    paypal_event_id TEXT,
    issued_by TEXT NOT NULL CHECK (issued_by IN ('api', 'manual')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    latest_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS xau_license_bindings (
    id BIGSERIAL PRIMARY KEY,
    license_id BIGINT NOT NULL REFERENCES xau_licenses(id) ON DELETE CASCADE,
    account_login BIGINT NOT NULL,
    account_server TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS xau_license_bindings_one_active
    ON xau_license_bindings (license_id)
    WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS xau_license_audit_log (
    id BIGSERIAL PRIMARY KEY,
    license_id BIGINT REFERENCES xau_licenses(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xau_licenses_customer_email_idx
    ON xau_licenses (customer_email);

CREATE INDEX IF NOT EXISTS xau_license_audit_log_license_id_idx
    ON xau_license_audit_log (license_id);
