# Subscription Delivery Recovery

Phase C2.5 makes PayPal subscription delivery cross-service safe.

## State machine

1. `PAYMENT.SALE.COMPLETED` is claimed in `commerce_subscription_events` as `processing`.
2. Commerce writes `commerce_payments.delivery_status='pending_delivery'`.
3. Commerce writes `commerce_subscription_payments.payment_status='pending_delivery'`.
4. Commerce calls XAU License API.
5. XAU returns the raw license key once and stores an encrypted pending recovery copy.
6. Commerce immediately encrypts and saves the license in `commerce_deliveries`.
7. Commerce ACKs XAU delivery; XAU deletes the encrypted pending recovery copy.
8. Commerce marks payment and event completed.

`BILLING.SUBSCRIPTION.ACTIVATED` only updates Commerce subscription status. XAU status sync is deferred until at least one subscription payment exists.

## Retry

`commerce_subscription_events.processing_status='failed'` may be claimed again. `processed` events remain idempotent and are not re-executed.

If XAU has already issued a license and Commerce did not save delivery, Commerce calls the internal recovery endpoint before ACK. If the key is no longer recoverable, Commerce marks the payment `manual_recovery` and does not show the delivery as completed.

## Reconciliation CLI

Dry-run for the known Sandbox subscription performs a real read-only audit against PayPal, Commerce PostgreSQL and XAU PostgreSQL:

```bash
npm run subscription:reconcile -- --subscription-id I-SV5VRU57MYYA --sale-id 9JB75028DP386330K --event-id manual-I-SV5VRU57MYYA
```

Classifications:

- `healthy_complete`: Commerce and XAU both have completed payment and encrypted delivery.
- `recoverable_pending_key`: XAU has an ACK-pending encrypted recovery key and Commerce has not saved delivery.
- `retryable_before_license_issue`: PayPal is completed, but XAU has not issued a license yet.
- `legacy_key_unrecoverable`: XAU has an existing license, no ACK-pending recovery key, and Commerce has no encrypted delivery.
- `inconsistent_manual_review`: State does not match an automated recovery path.
- `invalid_paypal_sale`: PayPal sale is missing or not completed.
- `subscription_mismatch`: PayPal sale, subscription, plan or SKU does not match the request.

Plain `--confirm` is fail-closed. It does not fabricate a webhook and never calls XAU activate or renew.

Legacy manual recovery requires both `--mark-manual-recovery` and `--confirm`:

```bash
npm run subscription:reconcile -- --subscription-id I-SV5VRU57MYYA --sale-id 9JB75028DP386330K --event-id manual-I-SV5VRU57MYYA --mark-manual-recovery --confirm
```

Manual recovery only creates or updates Commerce records as `manual_recovery`, creates a delivery placeholder with no encrypted license key, and outputs `customer_delivery_required=true`. It does not charge PayPal, does not create a second license, does not delete the existing XAU license, and does not accept a replacement raw key.
