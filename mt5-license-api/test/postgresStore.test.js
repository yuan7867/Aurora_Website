import assert from "node:assert/strict";
import test from "node:test";

import { MIGRATION_LOCK_KEY, PostgresStore } from "../src/store/postgresStore.js";

class FakeMigrationPool {
  constructor({ failSql = false, failUnlock = false } = {}) {
    this.failSql = failSql;
    this.failUnlock = failUnlock;
    this.activeLock = Promise.resolve();
    this.clients = [];
  }

  async connect() {
    const client = new FakeMigrationClient(this);
    this.clients.push(client);
    return client;
  }

  async end() {}
}

class FakeMigrationClient {
  constructor(pool) {
    this.pool = pool;
    this.queries = [];
    this.released = false;
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    if (sql.startsWith("SELECT pg_advisory_lock")) {
      const previous = this.pool.activeLock;
      let releaseLock;
      this.pool.activeLock = new Promise((resolve) => {
        releaseLock = resolve;
      });
      this.releaseLock = releaseLock;
      await previous;
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith("SELECT pg_advisory_unlock")) {
      if (this.pool.failUnlock) {
        throw new Error("unlock failed");
      }
      this.releaseLock?.();
      return { rowCount: 1, rows: [] };
    }
    if (this.pool.failSql && /CREATE TABLE|BEGIN;|COMMIT;/.test(sql)) {
      const error = new Error("migration sql failed");
      error.code = "42601";
      throw error;
    }
    return { rowCount: 0, rows: [] };
  }

  release() {
    this.released = true;
  }
}

test("migration advisory lock uses stable key on the same connection", async () => {
  const pool = new FakeMigrationPool();
  const store = new PostgresStore({ pool });
  await store.migrate();
  assert.equal(pool.clients.length, 1);
  const lock = pool.clients[0].queries.find((query) => query.sql.startsWith("SELECT pg_advisory_lock"));
  const unlock = pool.clients[0].queries.find((query) => query.sql.startsWith("SELECT pg_advisory_unlock"));
  assert.deepEqual(lock.params, [MIGRATION_LOCK_KEY]);
  assert.deepEqual(unlock.params, [MIGRATION_LOCK_KEY]);
  assert.equal(pool.clients[0].released, true);
  assert.equal(store.migrationComplete, true);
});

test("migration advisory lock serializes concurrent migrate calls and unlocks after success", async () => {
  const pool = new FakeMigrationPool();
  const first = new PostgresStore({ pool });
  const second = new PostgresStore({ pool });
  await Promise.all([first.migrate(), second.migrate()]);
  assert.equal(pool.clients.length, 2);
  assert.equal(pool.clients.every((client) => client.queries.some((query) => query.sql.startsWith("SELECT pg_advisory_unlock"))), true);
  assert.equal(first.migrationComplete, true);
  assert.equal(second.migrationComplete, true);
});

test("migration failure leaves store not ready and still unlocks", async () => {
  const pool = new FakeMigrationPool({ failSql: true });
  const store = new PostgresStore({ pool });
  await assert.rejects(() => store.migrate(), /migration sql failed/);
  assert.equal(store.migrationComplete, false);
  assert.equal(pool.clients[0].queries.some((query) => query.sql.startsWith("SELECT pg_advisory_unlock")), true);
  assert.equal(pool.clients[0].released, true);
});

test("migration unlock failure does not mask original migration error", async () => {
  const pool = new FakeMigrationPool({ failSql: true, failUnlock: true });
  const store = new PostgresStore({ pool });
  await assert.rejects(() => store.migrate(), /migration sql failed/);
  assert.equal(store.migrationComplete, false);
});

class ThrowingClient {
  constructor(error) {
    this.error = error;
    this.queries = [];
  }

  async query(sql) {
    this.queries.push(sql);
    if (sql === "BEGIN" || sql.startsWith("ROLLBACK") || sql.startsWith("SAVEPOINT") || sql.startsWith("RELEASE")) {
      return { rowCount: 0, rows: [] };
    }
    throw this.error;
  }

  release() {}
}

test("activateSubscription rethrows non-23505 database errors", async () => {
  const error = new Error("connection lost");
  error.code = "57P01";
  const client = new ThrowingClient(error);
  const store = new PostgresStore({ pool: { connect: async () => client } });
  await assert.rejects(() => store.activateSubscription({ paypalSaleId: "S", paypalSubscriptionId: "SUB" }), /connection lost/);
  assert.equal(client.queries.includes("ROLLBACK"), true);
});

test("first binding rethrows non-23505 database errors", async () => {
  const error = new Error("permission denied");
  error.code = "42501";
  const client = new ThrowingClient(error);
  const store = new PostgresStore({ pool: { connect: async () => client } });
  await assert.rejects(() => store.tryFirstBindWithClient(client, { id: 1 }, 1, "srv", ""), /permission denied/);
  assert.equal(client.queries.includes("ROLLBACK TO SAVEPOINT mt5_first_bind"), true);
});

test("ready direct check reports false after failed migration flag", async () => {
  const store = new PostgresStore({ pool: new FakeMigrationPool({ failSql: true }) });
  await assert.rejects(() => store.migrate(), /migration sql failed/);
  assert.equal(store.migrationComplete, false);
});
