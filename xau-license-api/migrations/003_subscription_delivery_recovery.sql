CREATE TABLE IF NOT EXISTS xau_pending_license_deliveries (
    id BIGSERIAL PRIMARY KEY,
    license_id BIGINT NOT NULL REFERENCES xau_licenses(id) ON DELETE CASCADE,
    paypal_sale_id TEXT NOT NULL UNIQUE,
    paypal_subscription_id TEXT NOT NULL,
    encrypted_license_key TEXT,
    encryption_iv TEXT,
    encryption_auth_tag TEXT,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS xau_pending_license_deliveries_subscription_idx
    ON xau_pending_license_deliveries (paypal_subscription_id);
