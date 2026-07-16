import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

process.env.LICENSE_DELIVERY_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const { decryptLicenseKey, encryptLicenseKey } = await import("../src/utils/licenseCrypto.js");

test("license keys are encrypted with AES-256-GCM and not stored as plaintext", () => {
    const licenseKey = "AURORA-XAU-SECRET-LICENSE";
    const encrypted = encryptLicenseKey(licenseKey);

    assert.notEqual(encrypted.encryptedLicenseKey, licenseKey);
    assert.equal(decryptLicenseKey(encrypted), licenseKey);
});

test("tampered license ciphertext is rejected", () => {
    const encrypted = encryptLicenseKey("AURORA-MT5-SECRET-LICENSE");
    encrypted.encryptionAuthTag = Buffer.alloc(16).toString("base64");

    assert.throws(() => decryptLicenseKey(encrypted));
});
