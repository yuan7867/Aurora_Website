# Resend License Email Delivery

Aurora Commerce sends license emails only after the encrypted license has been durably stored in `commerce_deliveries`.

## State machine

1. Payment and license delivery finish independently.
2. `commerce_deliveries.email_status='email_pending'` is created with encrypted license material.
3. Email worker or retry CLI claims the delivery with a row lock and sets `email_status='sending'`.
4. License key is decrypted in memory only.
5. Resend is called with `Idempotency-Key: license-delivery/<commerce_delivery_id>`.
6. On success:
   - `email_status='sent'`
   - `resend_email_id` is saved
   - `email_sent_at` is saved
7. On retryable failure such as network, 429, or 5xx:
   - `email_status='retry_pending'`
   - a sanitized error summary is saved
8. On fail-closed errors such as 400, 401, or 403:
   - `email_status='failed'`
   - a sanitized error summary is saved

`commerce_payments.payment_status='COMPLETED'` remains unchanged if email delivery fails.

## Retry CLI

Dry-run performs zero writes and zero HTTP calls:

```bash
npm run email:retry -- --delivery-id 123
```

Confirmed retry:

```bash
npm run email:retry -- --delivery-id 123 --confirm
```

Already sent deliveries return `already_sent` and are never sent again, even outside the Resend 24-hour idempotency window.

## Resend environment

```text
EMAIL_API_URL=https://api.resend.com/emails
EMAIL_FROM=Aurora HY <license@mail.aurorahy.com>
EMAIL_API_TOKEN=<set only in VPS .env>
```

Do not set `Reply-To` until `support@aurorahy.com` is a real mailbox.
