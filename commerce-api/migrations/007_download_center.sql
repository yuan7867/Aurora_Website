SELECT pg_advisory_lock(76020047);

CREATE TABLE IF NOT EXISTS commerce_download_tokens (
    id BIGSERIAL PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    customer_email TEXT NOT NULL,
    product_id TEXT NOT NULL,
    license_product_id TEXT NOT NULL,
    version TEXT NOT NULL,
    r2_object_key TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    consumed_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT commerce_download_tokens_product CHECK (license_product_id IN ('AURORA-MT5-AI', 'AURORA-XAU-AI'))
);

CREATE TABLE IF NOT EXISTS commerce_download_history (
    id BIGSERIAL PRIMARY KEY,
    customer_email TEXT NOT NULL,
    product_id TEXT NOT NULL,
    license_product_id TEXT NOT NULL,
    version TEXT NOT NULL,
    token_hash TEXT,
    license_status TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    result TEXT NOT NULL CHECK (result IN ('issued', 'downloaded', 'expired', 'already_used', 'not_found', 'forbidden', 'r2_error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commerce_download_tokens_customer_idx
    ON commerce_download_tokens (customer_email, license_product_id);

CREATE INDEX IF NOT EXISTS commerce_download_tokens_available_idx
    ON commerce_download_tokens (token_hash, expires_at)
    WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS commerce_download_history_customer_idx
    ON commerce_download_history (customer_email, license_product_id, created_at DESC);

SELECT pg_advisory_unlock(76020047);
