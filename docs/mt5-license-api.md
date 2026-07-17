# Aurora MT5 Subscription License API

Phase M1 creates a standalone production license API for `AURORA-MT5-AI`. It is intentionally separate from Website, Commerce, Docker, Nginx, XAU License API, and all trading code.

## Architecture

Commerce verifies PayPal subscription webhooks and calls this internal API with a bearer token. The MT5 License API owns MT5 license issuance, renewal, lifecycle status, account binding, and client validation. The API stores license hashes only. Raw license keys are returned only during first activation, or recovered before delivery ACK from encrypted pending delivery storage.

Public sales are limited to:

- `aurora-mt5-monthly`, monthly, USD 19.90
- `aurora-mt5-yearly`, yearly, USD 199.00

The product ID is always `AURORA-MT5-AI`.

## Environment Variables

Values are deployment secrets and must not be committed or logged.

- `DATABASE_URL`: PostgreSQL connection string.
- `MT5_LICENSE_INTERNAL_TOKEN`: internal bearer token used by Commerce.
- `MT5_LICENSE_KEY_PEPPER`: HMAC pepper for license key hashing.
- `MT5_LICENSE_RECOVERY_ENCRYPTION_KEY`: encryption secret for pending delivery recovery ciphertext.
- `PORT`: optional HTTP port.

## Endpoints

### `GET /health`

Returns basic process health without checking secrets or database content.

Response:

```json
{ "status": "ok" }
```

### `GET /ready`

Returns ready only after migrations complete and a read/write database check succeeds.

Ready:

```json
{ "status": "ready" }
```

Not ready:

```json
{ "status": "not_ready" }
```

### `POST /api/v1/subscriptions/activate`

Internal Commerce endpoint. Requires `Authorization: Bearer <internal-token>`.

Request:

```json
{
  "productId": "AURORA-MT5-AI",
  "sku": "aurora-mt5-monthly",
  "plan": "monthly",
  "customer": {
    "email": "customer@example.com",
    "name": "Customer"
  },
  "paypal": {
    "subscriptionId": "I-...",
    "planId": "P-...",
    "saleId": "PAYID-...",
    "eventId": "WH-...",
    "amount": "19.90",
    "currency": "USD",
    "status": "COMPLETED",
    "paidAt": "2026-07-17T00:00:00.000Z",
    "periodStart": "2026-07-17T00:00:00.000Z",
    "periodEnd": "2026-08-16T00:00:00.000Z"
  }
}
```

First successful response includes the raw key once:

```json
{
  "status": "activated",
  "licenseKey": "AURORA-MT5-XXXX-XXXX-XXXX-XXXX",
  "licenseId": "1",
  "subscriptionId": "I-...",
  "productId": "AURORA-MT5-AI",
  "sku": "aurora-mt5-monthly",
  "plan": "monthly",
  "expiresAt": "2026-08-16T00:00:00.000Z",
  "alreadyProcessed": false
}
```

Replay response does not include the raw key:

```json
{
  "status": "activated",
  "licenseId": "1",
  "subscriptionId": "I-...",
  "plan": "monthly",
  "expiresAt": "2026-08-16T00:00:00.000Z",
  "alreadyProcessed": true,
  "licenseKeyReadable": false
}
```

### `POST /api/v1/subscriptions/renew`

Internal Commerce endpoint. Requires the same bearer token. It renews an existing subscription license only. It never generates a new license key.

Replay of the same sale is idempotent and does not extend the period twice.

### `POST /api/v1/subscriptions/status`

Internal Commerce endpoint. Requires the same bearer token.

Supported statuses:

- `ACTIVE`
- `PAYMENT_FAILED`
- `CANCELLED`
- `SUSPENDED`
- `EXPIRED`
- `REFUNDED`
- `REVERSED`

Status updates are idempotent by event ID and write audit records.

### `POST /api/v1/subscriptions/delivery/ack`

Internal Commerce endpoint. Requires the same bearer token. Commerce calls this after it has stored its encrypted delivery record. ACK clears the recovery ciphertext while retaining `acknowledged_at`.

### `POST /api/v1/subscriptions/delivery/recover`

Internal Commerce recovery endpoint. Requires the same bearer token. Before ACK, the same sale/subscription can recover the same raw license key from encrypted pending delivery storage. After ACK, raw key recovery is unavailable.

### `POST /api/v1/licenses/issue`

Compatibility endpoint retained for internal subscription activation only. It uses the same validation path as subscription activation and rejects permanent, lifetime, one-time, bundle, and XAU payloads.

### `POST /api/aurora-mt5-ai-trader/license`

MT5 client validation endpoint.

Request:

```json
{
  "license_key": "AURORA-MT5-XXXX-XXXX-XXXX-XXXX",
  "app": "Aurora_MT5_AI_Trader",
  "account_login": 160097919,
  "account_server": "STARTRADERFinancial-Demo",
  "machine_hint": "optional-machine-hint",
  "version": "1.0.0"
}
```

Success:

```json
{
  "valid": true,
  "plan": "monthly",
  "expires_at": "2026-08-16T00:00:00.000Z",
  "current_period_end": "2026-08-16T00:00:00.000Z",
  "subscription_status": "ACTIVE",
  "support": {}
}
```

Business failure returns HTTP 200:

```json
{
  "valid": false,
  "reason": "account_not_allowed",
  "code": "account_not_allowed"
}
```

## Lifecycle State Machine

- `ACTIVE`: valid while current paid-through period is active.
- `PAYMENT_FAILED`: valid while paid-through or 72-hour grace remains.
- `CANCELLED`: valid while paid-through remains, invalid after expiry.
- `SUSPENDED`: invalid immediately.
- `EXPIRED`: invalid immediately.
- `REFUNDED`: invalid immediately and marked for manual review.
- `REVERSED`: invalid immediately and marked for manual review.

History is never deleted. Status updates do not create new license keys.

## Stale Event Ordering Policy

Lifecycle status events are ordered with `latest_subscription_event_at` while the target license row is locked by `SELECT ... FOR UPDATE`.

- Newer `eventTime`: process and mutate lifecycle state.
- Older `eventTime`: ignore as stale, keep all license validity fields unchanged, and write `subscription_status_event_ignored` audit.
- Same `eventTime` and same event ID: idempotent replay.
- Same `eventTime` and different event ID: deterministic stale tie-break; the event is ignored instead of allowing uncertain overwrite.

Ignored stale events do not update `subscription_status`, paid-through period, grace, cancelled/suspended timestamps, or manual review reason. They do not change client validation results and audit detail excludes PayPal raw payload.

Only renewals move paid-through dates. `PAYMENT_FAILED` cannot overwrite a newer paid-through renewal. `CANCELLED` preserves paid-through. `SUSPENDED`, `REFUNDED`, and `REVERSED` stop validation immediately only when they are the newest lifecycle event. A stale `EXPIRED` cannot override a newer `ACTIVE`, and a stale `ACTIVE` cannot restore a newer terminal state.

## Recovery and ACK Protocol

Activation generates a raw key, stores only its HMAC hash in `mt5_licenses`, and stores an encrypted copy in `mt5_pending_license_deliveries`. Commerce can recover the raw key only before ACK. After ACK, the encrypted key, IV, and auth tag are cleared. ACK replay is idempotent.

## Concurrent Activate Behavior

Activate is guarded by unique PayPal sale and subscription constraints. PostgreSQL `23505` is handled by re-querying the existing payment/subscription and returning a stable business result:

- Same sale and same subscription replay: existing license metadata is returned without raw key.
- Different subscription using the same sale ID: stable conflict.
- Same subscription using a different first sale: stable conflict and no second license.

Only `23505` unique conflicts are converted. Connection, serialization, syntax, permission, and other database errors roll back and are rethrown.

## Account Binding

The first successful validation atomically binds the license to `account_login` and `account_server`. Later validations must use the same account and server. Different account attempts return `valid: false` and `account_not_allowed`. The optional `machine_hint` is hashed only; high-sensitivity cleartext machine identity is not stored.

Concurrent first binding is safe. The first insert wins; if PostgreSQL returns `23505`, the API re-queries the actual active binding. Same account/server returns `valid: true`; different account/server returns HTTP 200 with `valid: false` and `account_not_allowed`. Non-`23505` errors are rethrown.

## Database Tables

- `mt5_licenses`
- `mt5_license_bindings`
- `mt5_license_audit_log`
- `mt5_subscription_payments`
- `mt5_subscription_events`
- `mt5_pending_license_deliveries`

All MT5 table names use the `mt5_` prefix and are independent from XAU tables.

## Migration

The API uses a PostgreSQL advisory migration lock. `/ready` reports not ready if migration has not completed or if a read/write check fails.

## Docker Integration Contract

Phase M1 does not modify Docker. A later phase may add a service that runs `npm ci`, `npm run migrate`, and `npm start` with the required environment variables.

## Commerce Integration Contract

Phase M1 does not modify Commerce. A later phase may add an MT5 subscription client that calls activate, renew, status, recovery, and ACK endpoints with the internal bearer token.

## Manual Permanent CLI

Manual permanent licenses are owner-only and friend-only. They are not part of the PayPal sales chain and are unavailable over HTTP.

Command shape:

```text
npm run license:issue-manual -- --permanent --confirm --email customer@example.com --name Customer
```

The CLI defaults to refusal unless both `--permanent` and `--confirm` are present. It returns the raw key once and stores only the hash.

The CLI rejects PayPal/payment identifiers and unknown arguments before database access or key generation. Rejected identifiers include `--paypal-sale-id`, `--paypal-subscription-id`, `--paypal-event-id`, `--sale-id`, `--subscription-id`, `--event-id`, `--payment-id`, `--capture-id`, and `--order-id`. `--dry-run` with `--permanent --confirm` performs no write and generates no key.

## Security

- License keys use at least `crypto.randomBytes(16)`.
- Stored license keys are HMAC-SHA256 hashes with a separate pepper.
- Bearer tokens use constant-time comparison.
- SQL must be parameterized.
- Request body size is limited.
- Public validation has rate limiting.
- Missing secrets fail fast.
- Logs must not include Authorization, internal token, raw license key, encryption key, pepper, PayPal raw payload, or secrets.

## Deployment Prerequisites

- PostgreSQL available.
- Required environment variables configured.
- Commerce integration completed in a later phase.
- Nginx/Docker route added in a later phase.
- `MT5_SALES_ENABLED` remains false until full sandbox validation passes.

## Sandbox Test Prerequisites

- PayPal sandbox plans configured.
- Commerce MT5 client added.
- Webhook verification configured.
- Delivery encryption and ACK wired.
- MT5 client points to the production validation endpoint.
- No permanent/lifetime/bundle/one-time public sales path enabled.

## Test Coverage Summary

Direct tests cover monthly/yearly activation, wrong product, invalid SKU, SKU/plan mismatch, invalid amount/currency, HTTP permanent rejection, raw key first response only, activate replay, concurrent activate, subscription duplicate, sale duplicate, renew without new key, renew replay, all lifecycle statuses, stale event ordering, same timestamp tie-break, recovery before/after ACK, ACK replay, first binding, same-account concurrent binding, different-account concurrent binding, advisory migration lock, migration failure readiness, bearer token boundaries, HMAC stability, recovery encryption tamper resistance, health/ready no leakage, manual CLI flag enforcement, manual CLI payment identifier rejection, and non-`23505` DB error rethrow.
