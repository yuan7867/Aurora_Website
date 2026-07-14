# Aurora Commerce V3 Production Deployment Guide

## Production PayPal Secrets

On VPS `aurora-core-01`, open `/opt/aurora/.env` and fill these values from the Production PayPal App:

```env
PAYPAL_ENVIRONMENT=production
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
```

Do not commit real PayPal secrets to source control.

## Required Values

- `PAYPAL_CLIENT_ID`: Production PayPal REST App Client ID.
- `PAYPAL_CLIENT_SECRET`: Production PayPal REST App Secret.
- `PAYPAL_WEBHOOK_ID`: Production webhook ID from PayPal Developer Dashboard.
- `WEBSITE_BASE_URL=https://aurorahy.com`: Return and cancel URL base.

## Deploy

```bash
cd /opt/aurora
docker compose config
docker compose up -d --build aurora-commerce-api aurora-website aurora-nginx
docker compose ps
curl -fsS http://localhost/commerce/health
```

## PayPal Webhook URL

Configure this URL in the Production PayPal App:

```text
https://aurorahy.com/commerce/paypal/webhook
```

Commerce API verifies PayPal webhook signatures before processing payment events.
