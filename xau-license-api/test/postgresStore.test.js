import assert from "node:assert/strict";
import test from "node:test";

import { PostgresStore } from "../src/store/postgresStore.js";

class AdvisoryLock {
  constructor() {
    this.locked = false;
    this.waiters = [];
    this.unlockCount = 0;
  }

  async acquire() {
    while (this.locked) {
      await new Promise((resolve) => this.waiters.push(resolve));
    }
    this.locked = true;
  }

  release() {
    this.unlockCount += 1;
    this.locked = false;
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }
}

class MigrationClient {
  constructor(lock, state, failMigration = false) {
    this.lock = lock;
    this.state = state;
    this.failMigration = failMigration;
    this.released = false;
  }

  async query(sql) {
    if (sql === "SELECT pg_advisory_lock($1)") {
      await this.lock.acquire();
      return { rows: [], rowCount: 0 };
    }
    if (sql === "SELECT pg_advisory_unlock($1)") {
      this.lock.release();
      return { rows: [], rowCount: 0 };
    }
    if (String(sql).includes("CREATE TABLE")) {
      this.state.activeMigrations += 1;
      this.state.maxActiveMigrations = Math.max(this.state.maxActiveMigrations, this.state.activeMigrations);
      this.state.migrationRuns += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      this.state.activeMigrations -= 1;
      if (this.failMigration) {
        throw new Error("migration failed");
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }

  release() {
    this.released = true;
  }
}

class MigrationPool {
  constructor({ failFirst = false } = {}) {
    this.lock = new AdvisoryLock();
    this.state = {
      activeMigrations: 0,
      maxActiveMigrations: 0,
      migrationRuns: 0
    };
    this.failFirst = failFirst;
    this.connectCount = 0;
  }

  async connect() {
    this.connectCount += 1;
    return new MigrationClient(this.lock, this.state, this.failFirst && this.connectCount === 1);
  }
}

function uniqueViolationClient({ activeBinding }) {
  return {
    queries: [],
    async query(sql) {
      this.queries.push(sql);
      if (String(sql).startsWith("INSERT INTO xau_license_bindings")) {
        const error = new Error("duplicate key");
        error.code = "23505";
        throw error;
      }
      if (String(sql).startsWith("SELECT * FROM xau_license_bindings")) {
        return {
          rowCount: activeBinding ? 1 : 0,
          rows: activeBinding ? [activeBinding] : []
        };
      }
      return { rowCount: 0, rows: [] };
    }
  };
}

test("concurrent migrations are serialized by advisory lock", async () => {
  const pool = new MigrationPool();
  const first = new PostgresStore({ pool });
  const second = new PostgresStore({ pool });

  await Promise.all([first.migrate(), second.migrate()]);

  assert.equal(pool.state.migrationRuns, 6);
  assert.equal(pool.state.maxActiveMigrations, 1);
  assert.equal(pool.lock.unlockCount, 2);
  assert.equal(first.migrationComplete, true);
  assert.equal(second.migrationComplete, true);
});

test("failed migration releases advisory lock and does not mark ready", async () => {
  const pool = new MigrationPool({ failFirst: true });
  const failing = new PostgresStore({ pool });
  const succeeding = new PostgresStore({ pool });

  await assert.rejects(() => failing.migrate(), /migration failed/);
  await succeeding.migrate();

  assert.equal(pool.lock.unlockCount, 2);
  assert.equal(failing.migrationComplete, false);
  assert.equal(succeeding.migrationComplete, true);
});

test("binding unique violation for same account becomes valid", async () => {
  const store = new PostgresStore({ pool: { async connect() { throw new Error("unused"); } } });
  const client = uniqueViolationClient({
    activeBinding: {
      account_login: 160092738,
      account_server: "Demo-Server"
    }
  });

  const result = await store.tryFirstBindWithClient(client, { id: 1 }, 160092738, "Demo-Server");

  assert.equal(result.valid, true);
  assert.equal(client.queries.includes("ROLLBACK TO SAVEPOINT xau_first_bind"), true);
});

test("binding unique violation for different account becomes account_not_allowed", async () => {
  const store = new PostgresStore({ pool: { async connect() { throw new Error("unused"); } } });
  const client = uniqueViolationClient({
    activeBinding: {
      account_login: 160092738,
      account_server: "Demo-Server"
    }
  });

  const result = await store.tryFirstBindWithClient(client, { id: 1 }, 999, "Other-Server");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "account_not_allowed");
});

test("binding non-unique database errors are not swallowed", async () => {
  const store = new PostgresStore({ pool: { async connect() { throw new Error("unused"); } } });
  const client = {
    async query(sql) {
      if (String(sql).startsWith("INSERT INTO xau_license_bindings")) {
        const error = new Error("database unavailable");
        error.code = "57P01";
        throw error;
      }
      return { rowCount: 0, rows: [] };
    }
  };

  await assert.rejects(
    () => store.tryFirstBindWithClient(client, { id: 1 }, 160092738, "Demo-Server"),
    /database unavailable/
  );
});
