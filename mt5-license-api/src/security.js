import crypto from "node:crypto";

import { LICENSE_PREFIX } from "./constants.js";

export function generateLicenseKey(prefix = LICENSE_PREFIX) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(16);
  const groups = [];
  for (let group = 0; group < 4; group += 1) {
    let text = "";
    for (let index = 0; index < 4; index += 1) {
      text += alphabet[bytes[group * 4 + index] % alphabet.length];
    }
    groups.push(text);
  }
  return `${prefix}-${groups.join("-")}`;
}

export function hmacLicenseKey(licenseKey, pepper) {
  return crypto.createHmac("sha256", pepper).update(String(licenseKey || ""), "utf8").digest("hex");
}

export function hmacMachineHint(machineHint, pepper) {
  if (!machineHint) {
    return "";
  }
  return crypto.createHmac("sha256", pepper).update(String(machineHint), "utf8").digest("hex");
}

export function constantTimeEquals(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""), "utf8");
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  if (actualBuffer.length !== expectedBuffer.length) {
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function bearerToken(headers) {
  const authorization = headers.authorization || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return authorization.slice(7).trim();
}

export function recoveryKey(config) {
  return crypto.createHash("sha256").update(`${config.recoveryEncryptionKey}:${config.licenseKeyPepper}`, "utf8").digest();
}

export function encryptRecoveryLicenseKey(licenseKey, config) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", recoveryKey(config), iv);
  const encrypted = Buffer.concat([cipher.update(licenseKey, "utf8"), cipher.final()]);
  return {
    encryptedLicenseKey: encrypted.toString("base64"),
    encryptionIv: iv.toString("base64"),
    encryptionAuthTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptRecoveryLicenseKey(record, config) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", recoveryKey(config), Buffer.from(record.encryptionIv, "base64"));
  decipher.setAuthTag(Buffer.from(record.encryptionAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.encryptedLicenseKey, "base64")),
    decipher.final()
  ]).toString("utf8");
}
