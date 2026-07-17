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
8. Commerce finalizes `commerce_payments.payment_status='COMPLETED'` and `delivery_status='delivered'`.
9. Commerce marks the webhook event processed.

Payment finalization is atomic and idempotent. It only changes `PENDING_DELIVERY` to `COMPLETED` when an encrypted Commerce delivery exists and the XAU ACK has already succeeded. `email_pending` is independent and does not block payment completion.

`BILLING.SUBSCRIPTION.ACTIVATED` only updates Commerce subscription status. XAU status sync is deferred until at least one subscription payment exists.

The first `PAYMENT.SALE.COMPLETED` for a PayPal subscription is decided from Commerce payment history, not from PayPal or Commerce subscription status. If `commerce_subscription_payments` has no `COMPLETED` payment for the `paypal_subscription_id`, Commerce calls XAU `/api/v1/subscriptions/activate`. Only later completed sales for the same subscription call `/api/v1/subscriptions/renew`.

Checkout `customer.email` is the license delivery email. PayPal subscriber or payer email can only fill an empty Commerce customer email and must not overwrite the Checkout value.

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

Plain `--confirm` is only allowed for `retryable_before_license_issue`. It re-verifies the PayPal sale and subscription first, then reprocesses the verified sale through the normal `PAYMENT.SALE.COMPLETED` path. Use `--customer-email` to correct the license delivery address before processing:

```bash
npm run subscription:reconcile -- --subscription-id I-2YX738G9J4AJ --sale-id SALE_ID --event-id EVENT_ID --customer-email customer@gmail.com --confirm
```

This path must call XAU activate for the first completed sale because there is no completed Commerce subscription payment history. It does not construct a fake sale, does not call renew, and remains idempotent on retry.

After a successful `retryable_before_license_issue` reconciliation, Commerce finalizes the original webhook event in one transaction. The event is marked `processed` and `last_error` is cleared only when:

- `commerce_payments.payment_status='COMPLETED'`
- `commerce_payments.delivery_status='delivered'`
- `commerce_deliveries.encrypted_license_key` exists
- XAU has the license and subscription payment
- XAU pending delivery has been ACKed or cleared

`retry_count` is not reset. The recovery writes a `subscription_webhook_recovered` audit record with only `eventId`, `subscriptionId`, `saleId`, and `classification`.

Legacy manual recovery requires both `--mark-manual-recovery` and `--confirm`:

```bash
npm run subscription:reconcile -- --subscription-id I-SV5VRU57MYYA --sale-id 9JB75028DP386330K --event-id manual-I-SV5VRU57MYYA --mark-manual-recovery --confirm
```

Manual recovery only creates or updates Commerce records as `manual_recovery`, creates a delivery placeholder with no encrypted license key, and outputs `customer_delivery_required=true`. It does not charge PayPal, does not create a second license, does not delete the existing XAU license, and does not accept a replacement raw key.
