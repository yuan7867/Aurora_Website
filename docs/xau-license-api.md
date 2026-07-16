# Aurora XAU License API

This document describes the production License API for `AURORA-XAU-AI` only.
It does not cover Aurora MT5 AI Trader, trading strategy, order entry, exit,
risk, martingale, or learning logic.

## API Contract

### Issue License

`POST /api/v1/licenses/issue`

This endpoint is an internal Docker-network API for Aurora Commerce only. It is
not exposed by the public Nginx configuration.

Headers:

- `Authorization: Bearer ${LICENSE_API_INTERNAL_TOKEN}`
- `Content-Type: application/json`

Body:

```json
{
  "productId": "AURORA-XAU-AI",
  "sku": "aurora-xau-monthly",
  "plan": "monthly",
  "customer": {
    "email": "customer@example.com",
    "name": "Customer Name"
  },
  "paypal": {
    "orderId": "PayPal order id",
    "captureId": "PayPal capture id",
    "eventId": "PayPal event id or empty",
    "status": "Completed"
  },
  "idempotencyKey": "PayPal capture id"
}
```

Rules:

- `productId` must be `AURORA-XAU-AI`.
- `monthly` must use `aurora-xau-monthly`.
- `yearly` must use `aurora-xau-yearly`.
- `paypal.status` must be `Completed`.
- `idempotencyKey` must equal non-empty `paypal.captureId`.
- Public/Website API cannot issue `permanent`.
- The same `captureId` returns the same License record.
- Idempotent retries do not return the raw License key again.
- Conflicting payload for an existing `captureId` returns `409`.

First successful response:

```json
{
  "status": "issued",
  "licenseKey": "AURORA-XXXX-XXXX-XXXX-XXXX",
  "productId": "AURORA-XAU-AI",
  "sku": "aurora-xau-monthly",
  "plan": "monthly",
  "expiresAt": "UTC ISO timestamp",
  "alreadyIssued": false
}
```

Idempotent retry response:

```json
{
  "status": "issued",
  "productId": "AURORA-XAU-AI",
  "sku": "aurora-xau-monthly",
  "plan": "monthly",
  "expiresAt": "UTC ISO timestamp",
  "alreadyIssued": true,
  "licenseKeyReadable": false
}
```

### XAU Bot License Validation

`POST /api/xau-bot/license`

This endpoint is compatible with the current `mt5_xau_long_martingale.py`
payload. The bot does not need to change.

Production Nginx exposes this route publicly as `/api/xau-bot/license` and
proxies it to the internal `xau-license-api` container.

Success:

```json
{
  "valid": true,
  "plan": "monthly",
  "expires_at": "UTC ISO timestamp",
  "subscription_status": "ACTIVE",
  "grace_until": "",
  "support": {}
}
```

Failure:

```json
{
  "valid": false,
  "reason": "license_not_found"
}
```

Failure reasons:

- `license_not_found`
- `license_disabled`
- `license_expired`
- `account_not_allowed`
- `subscription_payment_failed`
- `subscription_cancelled`
- `subscription_suspended`

Business validation failures remain HTTP `200` for bot compatibility.
Malformed JSON or invalid request bodies return `400`.
Oversized request bodies return `413`.

### Activate Subscription

`POST /api/v1/subscriptions/activate`

Headers:

- `Authorization: Bearer ${LICENSE_API_INTERNAL_TOKEN}`
- `Content-Type: application/json`

This endpoint is called after the first successful PayPal subscription payment.
It issues one License for one PayPal subscription. The raw License key is
returned only on the first successful activation response.

Body:

```json
{
  "productId": "AURORA-XAU-AI",
  "sku": "aurora-xau-monthly",
  "plan": "monthly",
  "customer": {
    "email": "customer@example.com",
    "name": "Customer Name"
  },
  "paypal": {
    "subscriptionId": "PayPal subscription id",
    "planId": "PayPal plan id",
    "saleId": "PayPal sale id",
    "eventId": "PayPal event id",
    "status": "ACTIVE",
    "amount": "19.90",
    "currency": "USD",
    "paidAt": "UTC ISO timestamp",
    "periodStart": "UTC ISO timestamp",
    "periodEnd": "UTC ISO timestamp"
  },
  "idempotencyKey": "PayPal sale id"
}
```

Rules:

- `monthly` must use `aurora-xau-monthly`, amount `19.90`, currency `USD`.
- `yearly` must use `aurora-xau-yearly`, amount `199.00`, currency `USD`.
- `idempotencyKey` must equal `paypal.saleId`.
- One `paypal.subscriptionId` maps to one License.
- Replaying the same `saleId` returns the existing License record without the
  raw License key.
- Conflicting `saleId` or `subscriptionId` payloads return `409`.
- Permanent licenses are rejected by this API.

### Renew Subscription

`POST /api/v1/subscriptions/renew`

Headers:

- `Authorization: Bearer ${LICENSE_API_INTERNAL_TOKEN}`
- `Content-Type: application/json`

The request shape matches subscription activation. Renewal finds the existing
License by `paypal.subscriptionId` and extends that same License. It never
generates a new raw License key.

Rules:

- `paypal.saleId` is the payment idempotency key.
- The same `saleId` is processed once.
- `periodEnd` must move forward and must not shorten the existing paid-through
  period.
- `subscriptionId`, `sku`, `plan`, and `planId` must match the original License.
- Amount and currency must match the locked plan.
- Successful renewal clears payment-failed grace and restores `ACTIVE`.

Response:

```json
{
  "status": "renewed",
  "licenseId": "1",
  "subscriptionId": "PayPal subscription id",
  "plan": "monthly",
  "expiresAt": "UTC ISO timestamp",
  "alreadyProcessed": false
}
```

### Subscription Status

`POST /api/v1/subscriptions/status`

Headers:

- `Authorization: Bearer ${LICENSE_API_INTERNAL_TOKEN}`
- `Content-Type: application/json`

Body:

```json
{
  "productId": "AURORA-XAU-AI",
  "paypal": {
    "subscriptionId": "PayPal subscription id",
    "eventId": "PayPal event id",
    "status": "PAYMENT_FAILED",
    "eventTime": "UTC ISO timestamp",
    "reason": ""
  }
}
```

Supported statuses:

- `CANCELLED`
- `SUSPENDED`
- `EXPIRED`
- `PAYMENT_FAILED`
- `REFUNDED`
- `REVERSED`

Status rules:

- `CANCELLED` records cancellation and keeps the License valid until
  `current_period_end`.
- `PAYMENT_FAILED` sets `grace_until = eventTime + 72 hours`.
- `SUSPENDED` does not generate a new key and follows paid-through/grace rules
  unless manual review is required.
- `EXPIRED` makes validation fail after expiry.
- `REFUNDED` and `REVERSED` immediately set the subscription to suspended manual
  review and bot validation returns `subscription_suspended`.
- `eventId` is idempotent.
- Older out-of-order events do not overwrite newer subscription state.

### Health Checks

`GET /health`

Returns process liveness only:

```json
{ "status": "ok" }
```

`GET /ready`

Returns `200` only after migrations are complete and the database is read/write
available:

```json
{ "status": "ready" }
```

Neither endpoint returns database URLs, tokens, or other configuration values.

## Environment Variables

- `PORT`
- `DATABASE_URL`
- `LICENSE_KEY_PEPPER`
- `LICENSE_API_INTERNAL_TOKEN`
- `NODE_ENV`

## Migration

Migration SQL is stored inside this service:

- `xau-license-api/migrations/001_init.sql`
- `xau-license-api/migrations/002_subscription_lifecycle.sql`

Migration execution uses a stable PostgreSQL advisory lock owned by the XAU
License API migration path. Multiple service instances may start at the same
time; one instance runs the migration while the others wait on the same lock.
The lock is released in `finally`, and a failed migration keeps `/ready` in a
not-ready state.

Run:

```bash
npm run migrate
```

The migration creates:

- `xau_licenses`
- `xau_license_bindings`
- `xau_license_audit_log`
- `xau_subscription_payments`
- `xau_subscription_events`

Important constraints:

- `xau_licenses.license_key_hash` is unique.
- `xau_licenses.paypal_capture_id` is unique for automatic PayPal issuance.
- `xau_licenses.paypal_subscription_id` is unique when present.
- `xau_subscription_payments.paypal_sale_id` is unique.
- `xau_subscription_events.event_id` is unique.
- `xau_license_bindings_one_active` allows one active binding per license.

First bot binding runs inside a transaction. If concurrent inserts hit the
active-binding unique index, PostgreSQL unique violation is converted into a
stable bot-compatible response: the same account is accepted, a different
account receives `valid=false` with `reason=account_not_allowed`.

## Start And Stop

Install dependencies:

```bash
npm install
```

Start:

```bash
npm start
```

Stop the service with `SIGTERM` or `SIGINT`. The server closes HTTP traffic and
then closes the PostgreSQL pool.

## Manual Permanent License

Permanent licenses are only for server-owner manual issuance. They are not
public sale SKUs and must not be requested by PayPal or Website purchase flows.

Manual permanent issue:

```bash
npm run license:issue-manual -- --plan permanent --email owner@example.com --name "Owner" --confirm
```

Manual monthly/yearly test issue:

```bash
npm run license:issue-manual -- --plan monthly --email customer@example.com --name "Customer" --confirm
npm run license:issue-manual -- --plan yearly --email customer@example.com --name "Customer" --confirm
```

The raw License key is printed once in the terminal. The database stores only
the keyed HMAC hash.

## Revocation And Rebinding Design

Revocation should update `xau_licenses.status` from `active` to `disabled` and
write an audit row.

Rebinding should deactivate the existing row in `xau_license_bindings`, insert a
new binding after owner approval, and write an audit row.

No public HTTP endpoint for revocation or rebinding is exposed in Phase B.

## Subscription State Machine

`ACTIVE` validates while `current_period_end` is in the future.

`PAYMENT_FAILED` validates while either the paid-through period is still active
or the 72-hour `grace_until` period is active. After grace ends without a
successful renewal, validation returns `subscription_payment_failed`.

`CANCELLED` validates until `current_period_end`, then returns
`subscription_cancelled`.

`EXPIRED` returns `license_expired`.

`REFUNDED` and `REVERSED` move the subscription to suspended manual review and
return `subscription_suspended`.

Manual permanent CLI licenses do not use PayPal subscription fields and are not
affected by subscription status events.

## Backup And Recovery

Back up the existing PostgreSQL service data using the production PostgreSQL
backup process. The License API does not store production data in JSON files.

Restore requires:

- PostgreSQL data restore
- Matching `LICENSE_KEY_PEPPER`
- Running migrations after restore

Changing `LICENSE_KEY_PEPPER` invalidates stored License key hashes.

## Sensitive Data

The service does not store raw License keys. It stores only keyed HMAC hashes.

The service must not log:

- `Authorization`
- raw License keys
- PayPal raw payloads
- secrets or tokens

PayPal storage is limited to necessary fields:

- order id
- capture id
- event id
- customer email/name
- SKU and product information

## Phase C Website Integration Requirements

Website Phase C must add the public SKUs:

- `aurora-xau-monthly`
- `aurora-xau-yearly`

Website Phase C must create PayPal subscriptions for:

- XAU Monthly: USD `19.90`, monthly recurring, no free trial
- XAU Yearly: USD `199.00`, yearly recurring, no free trial

Website Phase C must call for first successful subscription payment:

- `POST /api/v1/subscriptions/activate`

Website Phase C must call for subsequent successful subscription payments:

- `POST /api/v1/subscriptions/renew`

Website Phase C must call for cancellation, suspension, expiry, payment failure,
refund, and reversal events:

- `POST /api/v1/subscriptions/status`

Website Phase C must send:

- `productId: AURORA-XAU-AI`
- matching `sku`
- matching `plan`
- normalized customer details
- PayPal `subscriptionId`
- PayPal `planId`
- PayPal `saleId`
- PayPal `eventId`
- PayPal amount and currency
- PayPal paid period start/end
- `idempotencyKey` equal to PayPal `saleId`

Website Phase C must not request or expose permanent XAU licenses.
