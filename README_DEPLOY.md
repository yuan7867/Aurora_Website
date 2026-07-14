# Aurora Core Deployment

Target server:

- Domain: `aurorahy.com`
- Server: `aurora-core-01`
- OS: Ubuntu 24.04 LTS
- Runtime: Docker + Docker Compose
- Install path: `/opt/aurora/`

## Deployment Scope

All services run in containers. Do not install application services directly on the host.

Services:

- `aurora-website`
- `aurora-dashboard`
- `aurora-commerce-api`
- `aurora-postgres`
- `aurora-nginx`

Commerce API handles PayPal webhook intake and dispatches to external MT5 / XAU License APIs. It does not generate licenses, bind machines, activate products or validate licenses. Those responsibilities remain with MT5 / XAU services.

Dashboard remains a reserved container until the production Dashboard image is available.

## Server Install

```bash
mkdir -p /opt/aurora
cd /opt/aurora
```

Copy the repository contents into `/opt/aurora/`, then review `.env`:

```bash
nano .env
```

Change:

```text
POSTGRES_PASSWORD=change-this-before-production
MT5_LICENSE_API_URL=
XAU_LICENSE_API_URL=
EMAIL_API_URL=
```

## Start

```bash
cd /opt/aurora
docker compose up -d --build
```

## Verify

```bash
docker ps
docker compose ps
curl -I http://localhost
```

## Stop

```bash
cd /opt/aurora
docker compose down
```

## Service URLs

Public:

- Website: `http://aurorahy.com`
- Dashboard: `http://aurorahy.com/dashboard/`
- Commerce API Health: `http://aurorahy.com/commerce/health`
- PayPal Webhook: `http://aurorahy.com/commerce/paypal/webhook`

Internal Docker network:

- Website: `http://aurora-website:8080`
- Dashboard: `http://aurora-dashboard:8080`
- Commerce API: `http://aurora-commerce-api:8080`
- PostgreSQL: `aurora-postgres:5432`

## Notes

- No host-level app installation.
- No business logic changes.
- No license generation logic.
- No machine binding logic.
- No activation or validation logic.
- All containers use `restart: always`.
- Cloudflare DNS must be active and pointing to the VPS before public domain verification.
