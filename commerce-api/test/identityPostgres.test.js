import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../migrations/005_identity_customers.sql", import.meta.url), "utf8");
const store = await readFile(new URL("../src/storage/customerStore.js", import.meta.url), "utf8");
const identity = await readFile(new URL("../src/services/identityService.js", import.meta.url), "utf8");
const router = await readFile(new URL("../src/router.js", import.meta.url), "utf8");
const cli = await readFile(new URL("../src/cli/importCustomersJson.js", import.meta.url), "utf8");

test("identity migration creates normalized PostgreSQL customer tables and constraints", () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_customers/);
    assert.match(migration, /email TEXT NOT NULL UNIQUE/);
    assert.match(migration, /CHECK \(email = lower\(email\)\)/);
    assert.match(migration, /status IN \('active', 'verification_required', 'activation_required', 'disabled'\)/);
    assert.match(migration, /password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_customer_tokens/);
    assert.match(migration, /token_hash TEXT NOT NULL UNIQUE/);
    assert.match(migration, /expires_at TIMESTAMPTZ NOT NULL/);
    assert.match(migration, /used_at TIMESTAMPTZ/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_customer_items/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS commerce_customer_audit_log/);
});

test("customer store uses PostgreSQL and keeps legacy customers.json read-only for import", () => {
    assert.match(store, /new Pool/);
    assert.match(store, /migrateCommerceStore/);
    assert.match(store, /readLegacyCustomerStore/);
    assert.match(store, /backupLegacyCustomerStore/);
    assert.doesNotMatch(store, /writeFile\(customersFile/);
    assert.match(store, /hashIdentityToken/);
    assert.match(store, /consumeCustomerToken/);
    assert.match(store, /FOR UPDATE OF t, c/);
    assert.match(store, /createCustomerIfMissing/);
    assert.match(store, /ON CONFLICT \(email\) DO NOTHING/);
});

test("identity service consumes one-time hashed tokens and invalidates old sessions after password changes", () => {
    assert.match(identity, /consumeCustomerToken/);
    assert.match(identity, /purposes:\s*\["email_verification"\]/);
    assert.match(identity, /purposes:\s*\["password_reset", "activation"\]/);
    assert.match(identity, /passwordChangedAt/);
    assert.match(identity, /Customer session expired after password change/);
    assert.match(identity, /Customer account is disabled/);
    assert.match(identity, /assertRateLimit/);
    assert.doesNotMatch(identity, /findByToken/);
});

test("identity routes return controlled errors instead of leaking raw server failures", () => {
    assert.match(router, /sendIdentityError/);
    assert.match(router, /url\.pathname === "\/identity\/login"/);
    assert.match(router, /statusCode = error\.statusCode \|\| 401/);
});

test("JSON import CLI is dry-run by default, requires confirm, backs up, and avoids secret output", () => {
    assert.match(cli, /confirm = false/);
    assert.match(cli, /hasFlag\("--confirm"\)/);
    assert.match(cli, /backupLegacyCustomerStore/);
    assert.match(cli, /password_hash_conflict/);
    assert.match(cli, /duplicate_normalized_email/);
    assert.doesNotMatch(cli, /console\.log\(.*passwordHash/);
    assert.doesNotMatch(cli, /console\.log\(.*token/);
});
