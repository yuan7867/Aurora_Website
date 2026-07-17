import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function runCli(args) {
  return spawnSync(process.execPath, ["src/cli/issue-manual.js", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "",
      MT5_LICENSE_INTERNAL_TOKEN: "",
      MT5_LICENSE_KEY_PEPPER: "",
      MT5_LICENSE_RECOVERY_ENCRYPTION_KEY: ""
    }
  });
}

test("manual permanent CLI rejects missing permanent flag before DB access", () => {
  const result = runCli(["--confirm"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--permanent --confirm/);
});

test("manual permanent CLI rejects missing confirm flag before DB access", () => {
  const result = runCli(["--permanent"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--permanent --confirm/);
});

test("manual permanent CLI rejects payment identifiers without printing values", () => {
  for (const arg of ["--paypal-sale-id", "--paypal-subscription-id", "--paypal-event-id", "--sale-id", "--subscription-id", "--event-id"]) {
    const result = runCli(["--permanent", "--confirm", arg, "SECRET-PAYMENT-ID"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Payment identifiers are not allowed/);
    assert.equal(result.stderr.includes("SECRET-PAYMENT-ID"), false);
  }
});

test("manual permanent CLI rejects unknown arguments fail-closed", () => {
  const result = runCli(["--permanent", "--confirm", "--unknown", "value"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown argument rejected/);
});

test("manual permanent CLI legal dry-run does not require DB secrets", () => {
  const result = runCli(["--permanent", "--confirm", "--dry-run"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /dry_run/);
});
