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

## CLI

Dry-run for the known Sandbox subscription:

```bash
npm run subscription:reconcile -- --subscription-id I-SV5VRU57MYYA --sale-id 9JB75028DP386330K --event-id manual-I-SV5VRU57MYYA
```

Confirmed reconciliation requires explicit confirmation:

```bash
npm run subscription:reconcile -- --subscription-id I-SV5VRU57MYYA --sale-id 9JB75028DP386330K --event-id manual-I-SV5VRU57MYYA --confirm
```

The CLI does not charge PayPal and does not create a second license. It reuses the normal subscription sale processing path.
