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

## Storage

Payment and delivery idempotency use PostgreSQL:

- `commerce_payments`
- `commerce_deliveries`
- `commerce_audit_log`

`commerce_payments.paypal_capture_id` is unique. `commerce_deliveries.payment_id`
is unique. Customer JSON remains account profile storage only and must not be
used as production payment idempotency.

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
