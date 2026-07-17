import assert from "node:assert/strict";
import test from "node:test";

import {
  bearerToken,
  constantTimeEquals,
  decryptRecoveryLicenseKey,
  encryptRecoveryLicenseKey,
  hmacLicenseKey
} from "../src/security.js";

test("security accepts correct bearer token and rejects wrong same-length token", () => {
  assert.equal(constantTimeEquals("correct-token", "correct-token"), true);
  assert.equal(constantTimeEquals("wrongxx-token", "correct-token"), false);
});

test("security rejects token length mismatch, empty token, and missing authorization", () => {
  assert.equal(constantTimeEquals("short", "correct-token"), false);
  assert.equal(constantTimeEquals("", "correct-token"), false);
  assert.equal(bearerToken({}), "");
});

test("license HMAC is stable and pepper-specific", () => {
  const first = hmacLicenseKey("AURORA-MT5-TEST", "pepper-one");
  const second = hmacLicenseKey("AURORA-MT5-TEST", "pepper-one");
  const third = hmacLicenseKey("AURORA-MT5-TEST", "pepper-two");
  assert.equal(first, second);
  assert.notEqual(first, third);
});

test("recovery encryption decrypts with the correct key and rejects tampering", () => {
  const config = {
    recoveryEncryptionKey: "recovery-secret",
    licenseKeyPepper: "pepper"
  };
  const encrypted = encryptRecoveryLicenseKey("AURORA-MT5-KEY", config);
  assert.equal(decryptRecoveryLicenseKey(encrypted, config), "AURORA-MT5-KEY");

  assert.throws(() => decryptRecoveryLicenseKey({
    ...encrypted,
    encryptedLicenseKey: Buffer.from("tampered").toString("base64")
  }, config));
  assert.throws(() => decryptRecoveryLicenseKey({
    ...encrypted,
    encryptionAuthTag: Buffer.from("tampered-auth-tag").toString("base64")
  }, config));
  assert.throws(() => decryptRecoveryLicenseKey(encrypted, {
    recoveryEncryptionKey: "wrong-secret",
    licenseKeyPepper: "pepper"
  }));
});
