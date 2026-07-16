# Aurora XAU License API

This document describes the production License API for `AURORA-XAU-AI` only.
It does not cover Aurora MT5 AI Trader, trading strategy, order entry, exit,
risk, martingale, or learning logic.

## API Contract

### Issue License

`POST /api/v1/licenses/issue`

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

Success:

```json
{
  "valid": true,
  "plan": "monthly",
  "expires_at": "UTC ISO timestamp",
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

Business validation failures remain HTTP `200` for bot compatibility.
Malformed JSON or invalid request bodies return `400`.
Oversized request bodies return `413`.

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

Run:

```bash
npm run migrate
```

The migration creates:

- `xau_licenses`
- `xau_license_bindings`
- `xau_license_audit_log`

Important constraints:

- `xau_licenses.license_key_hash` is unique.
- `xau_licenses.paypal_capture_id` is unique for automatic PayPal issuance.
- `xau_license_bindings_one_active` allows one active binding per license.

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

Website Phase C must call:

- `POST /api/v1/licenses/issue`

Website Phase C must send:

- `productId: AURORA-XAU-AI`
- matching `sku`
- matching `plan`
- normalized customer details
- PayPal `orderId`
- PayPal `captureId`
- PayPal `eventId`
- `paypal.status: Completed`
- `idempotencyKey` equal to PayPal `captureId`

Website Phase C must not request or expose permanent XAU licenses.
