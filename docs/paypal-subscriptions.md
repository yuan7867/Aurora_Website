# PayPal Subscription Provisioning

Aurora sells four recurring PayPal plans:

- Aurora MT5 AI Trader Monthly: USD 19.90, `MONTH/1`
- Aurora MT5 AI Trader Yearly: USD 199.00, `YEAR/1`
- Aurora XAU Trader Monthly: USD 19.90, `MONTH/1`
- Aurora XAU Trader Yearly: USD 199.00, `YEAR/1`

Plan configuration:

- no trial
- no setup fee
- auto bill outstanding enabled
- payment failure threshold `2`
- infinite regular tenure
- plan status `ACTIVE`

Use PayPal Catalog Products API and Billing Plans API to create one PayPal
Product for MT5 and one PayPal Product for XAU, then two Plans under each
Product.

Required environment variables after provisioning:

```bash
PAYPAL_MT5_MONTHLY_PLAN_ID=
PAYPAL_MT5_YEARLY_PLAN_ID=
PAYPAL_XAU_MONTHLY_PLAN_ID=
PAYPAL_XAU_YEARLY_PLAN_ID=
```

These variables must be passed into the `aurora-commerce-api` container through
Docker Compose. Leave them empty while `MT5_SALES_ENABLED=false` and
`XAU_SALES_ENABLED=false`; startup must still succeed.

Provisioning safety:

- Default to Sandbox.
- Production provisioning must require explicit `--production --confirm`.
- Use `PayPal-Request-Id` for idempotent creation.
- Do not write Client Secret, access tokens, or Production Plan IDs into source
  files or logs.
- Do not update production `.env` automatically.

Commerce uses server-side SKU to Plan ID mapping. Browser-provided Plan IDs,
prices, durations, or license product IDs are ignored.

After `PAYMENT.SALE.COMPLETED`, Commerce dispatches by product:

- MT5 subscriptions call the internal `mt5-license-api` lifecycle endpoints.
- XAU subscriptions call the internal `xau-license-api` lifecycle endpoints.

Both products reuse the same Commerce encrypted delivery, ACK, payment
finalization, email, and recovery state machine. Public sales remain disabled
until the corresponding `MT5_SALES_ENABLED` or `XAU_SALES_ENABLED` switch is
explicitly set to `true`.

## Required Webhook Events

Configure the Aurora Commerce webhook to receive these PayPal events:

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`

Rules:

- `BILLING.SUBSCRIPTION.ACTIVATED` records status only and must not issue a
  License.
- Only `PAYMENT.SALE.COMPLETED` can trigger first License activation or renewal.
- `PAYMENT.SALE.REFUNDED` and `PAYMENT.SALE.REVERSED` move the subscription into
  suspended/manual review handling.

## CLI Usage

Dry-run Sandbox preview:

```bash
npm run paypal:provision
```

Create Sandbox Products and Plans:

```bash
npm run paypal:provision -- --confirm
```

Create Production Products and Plans only after final approval:

```bash
npm run paypal:provision -- --production --confirm
```

The CLI prints the four Plan ID environment variable assignments. It does not
write `.env`, Client Secret, access tokens, or authorization headers to files or
logs. Do not repeatedly run Production provisioning unless you intentionally
want a new set of PayPal Products and Plans.
