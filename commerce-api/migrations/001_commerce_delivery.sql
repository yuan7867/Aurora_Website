SELECT pg_advisory_lock(76020041);

CREATE TABLE IF NOT EXISTS commerce_payments (
    id BIGSERIAL PRIMARY KEY,
    paypal_capture_id TEXT NOT NULL UNIQUE,
    paypal_order_id TEXT,
    paypal_event_id TEXT,
    sku TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    delivery_status TEXT NOT NULL CHECK (delivery_status IN ('claimed', 'delivered', 'manual_recovery', 'failed')),
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_deliveries (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL UNIQUE REFERENCES commerce_payments(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    license_product_id TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    encrypted_license_key TEXT,
    encryption_iv TEXT,
    encryption_auth_tag TEXT,
    download_url TEXT,
    email_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commerce_audit_log (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT REFERENCES commerce_payments(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commerce_payments_customer_email_idx
    ON commerce_payments (customer_email);

CREATE INDEX IF NOT EXISTS commerce_deliveries_customer_email_idx
    ON commerce_deliveries (customer_email);

CREATE INDEX IF NOT EXISTS commerce_audit_log_payment_id_idx
    ON commerce_audit_log (payment_id);

SELECT pg_advisory_unlock(76020041);
