# Aurora Identity PostgreSQL Migration

Aurora Commerce identity now stores customer accounts in the existing
`aurora-postgres` database. No second PostgreSQL service is required.

## What Changed

- `commerce_customers` stores normalized unique customer email, profile state,
  password hash, disabled state and password-change timestamp.
- `commerce_customer_tokens` stores one-time token hashes only. Raw verification,
  activation and reset tokens are sent by email and never stored.
- `commerce_customer_items` stores customer products, licenses, downloads and
  orders as structured customer records.
- `commerce_customer_audit_log` records safe identity actions without secrets.
- `customers.json` is retained as a read-only rollback/import backup.

## Production Migration Procedure

Run on the VPS only after pulling the committed release and backing up `/opt/aurora`.

1. Back up the current legacy customer file:

```bash
cp /opt/aurora/Aurora_Website/commerce-api/data/customers.json \
  /opt/aurora/Aurora_Website/commerce-api/data/customers.pre-pg-backup.json
```

2. Run database migrations through the Commerce startup command or manually:

```bash
docker compose run --rm aurora-commerce-api npm run migrate
```

3. Dry-run the JSON import:

```bash
docker compose run --rm aurora-commerce-api npm run identity:import-json
```

The dry-run reports counts only. It must not print password hashes, raw tokens,
JWT secrets, Resend API keys or customer private details.

4. If dry-run is clean, import:

```bash
docker compose run --rm aurora-commerce-api npm run identity:import-json -- --confirm
```

The import creates a timestamped `customers.backup.*.json` file before writing
to PostgreSQL. Re-running the import is idempotent unless a conflict is found.

5. Verify:

```sql
SELECT COUNT(*) FROM commerce_customers;
SELECT email, COUNT(*) FROM commerce_customers GROUP BY email HAVING COUNT(*) > 1;
SELECT status, COUNT(*) FROM commerce_customers GROUP BY status;
```

6. Restart Commerce only after verification:

```bash
docker compose up -d --build aurora-commerce-api
```

## Rollback

Do not delete `customers.json`.

If PostgreSQL identity verification fails before final acceptance:

1. Stop Commerce.
2. Restore the previously deployed code that used `customers.json`.
3. Keep the imported PostgreSQL rows for audit unless CTO explicitly approves a
   database cleanup.
4. Restart Commerce.

## Security Notes

- Passwords are stored as `scrypt` hashes only.
- Verification, activation and reset tokens are stored as SHA-256 hashes only.
- Tokens have `expires_at` and `used_at` and are consumed under row lock.
- Old JWT sessions are rejected after password changes.
- Disabled accounts cannot log in or access customer APIs.
- Forgot Password returns the same public response for existing and missing
  accounts.
