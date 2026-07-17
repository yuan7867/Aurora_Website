# Aurora Commerce Delivery

Commerce delivery is keyed by the PayPal capture id. Browser capture and PayPal
webhook delivery both use the same `captureId`, and `PAYMENT.CAPTURE.COMPLETED`
is the only webhook event that can trigger license delivery.

`CHECKOUT.ORDER.APPROVED` is recorded as approved only. It must never issue a
license, send a delivery email, or unlock a download.

## Products

Public sale SKUs:

- `aurora-mt5-monthly` -> `AURORA-MT5-AI`, monthly, USD 19.90, 30 days
- `aurora-mt5-yearly` -> `AURORA-MT5-AI`, yearly, USD 199.00, 365 days
- `aurora-xau-monthly` -> `AURORA-XAU-AI`, monthly, USD 19.90, 30 days
- `aurora-xau-yearly` -> `AURORA-XAU-AI`, yearly, USD 199.00, 365 days

Retired SKUs are rejected and not mapped to a different product.

## PayPal Subscriptions

Official SKUs use PayPal recurring subscriptions, not one-time Order/Capture:

- `aurora-mt5-monthly` -> `PAYPAL_MT5_MONTHLY_PLAN_ID`
- `aurora-mt5-yearly` -> `PAYPAL_MT5_YEARLY_PLAN_ID`
- `aurora-xau-monthly` -> `PAYPAL_XAU_MONTHLY_PLAN_ID`
- `aurora-xau-yearly` -> `PAYPAL_XAU_YEARLY_PLAN_ID`

Plan IDs are read only on the server from environment variables. The browser
may send only the official SKU and customer contact fields. Missing Plan IDs
return `503` and must not fall back to one-time PayPal Orders.

Commerce receives all four PayPal Plan ID variables through
`aurora-commerce-api.environment` in `docker-compose.yml`. With both sales
switches set to `false`, empty Plan IDs do not block migration or startup.

`BILLING.SUBSCRIPTION.ACTIVATED` records subscription status only. License
activation and renewal are triggered only by verified `PAYMENT.SALE.COMPLETED`
webhooks after Commerce verifies the PayPal subscription details, Plan ID, SKU,
amount and currency.

Subscription lifecycle calls stay inside the Docker network. Commerce chooses a
product-specific adapter from the license product ID:

- `AURORA-MT5-AI` -> `mt5-license-api`
- `AURORA-XAU-AI` -> `xau-license-api`

Configured URLs must use Docker internal hosts, not public Cloudflare routes:

- `MT5_LICENSE_API_URL=http://mt5-license-api:8000`
- `XAU_LICENSE_API_URL=http://xau-license-api:8000/api/v1/licenses/issue`

The clients call these internal lifecycle paths:

- `POST /api/v1/subscriptions/activate`
- `POST /api/v1/subscriptions/renew`
- `POST /api/v1/subscriptions/status`
- `POST /api/v1/subscriptions/delivery/recover`
- `POST /api/v1/subscriptions/delivery/ack`

MT5 expects `paypal.status="COMPLETED"` for activate/renew. XAU expects
`paypal.status="ACTIVE"` for activate/renew. The two clients keep those
contracts isolated.

## Storage

Payment and delivery idempotency use PostgreSQL:

- `commerce_payments`
- `commerce_deliveries`
- `commerce_audit_log`

`commerce_payments.paypal_capture_id` is unique. `commerce_deliveries.payment_id`
is unique. Customer JSON remains account profile storage only and must not be
used as production payment idempotency.

The Commerce container runs `npm run migrate && exec npm start` at startup, so
PostgreSQL delivery tables must be created before the HTTP server starts.

## License Key Handling

Commerce encrypts delivered license keys with AES-256-GCM before persistence.
The required key is `LICENSE_DELIVERY_ENCRYPTION_KEY`, a 32-byte base64 value.
The database stores ciphertext, IV, and auth tag only. Customer JSON stores
delivery status and never stores plaintext license keys.

If XAU License API returns `alreadyIssued=true` without `licenseKey`, Commerce
uses its existing delivery record. If no delivery record exists, Commerce marks
the payment as `manual_recovery`.

## Sales Switches

`MT5_SALES_ENABLED=false` and `XAU_SALES_ENABLED=false` are the default
production-safe settings. Disabled products return `503 PRODUCT_NOT_AVAILABLE`
before a PayPal order is created.
