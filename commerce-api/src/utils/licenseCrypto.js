import crypto from "node:crypto";

import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export function loadDeliveryKey(encodedKey) {
    const key = Buffer.from(String(encodedKey || process.env.LICENSE_DELIVERY_ENCRYPTION_KEY || config.licenseDeliveryEncryptionKey || ""), "base64");

    if (key.length !== KEY_BYTES) {
        throw new Error("LICENSE_DELIVERY_ENCRYPTION_KEY must be a 32-byte base64 value.");
    }

    return key;
}

export function encryptLicenseKey(licenseKey, encodedKey) {
    const key = loadDeliveryKey(encodedKey);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(String(licenseKey || ""), "utf8"),
        cipher.final()
    ]);

    return {
        encryptedLicenseKey: ciphertext.toString("base64"),
        encryptionIv: iv.toString("base64"),
        encryptionAuthTag: cipher.getAuthTag().toString("base64")
    };
}

export function decryptLicenseKey(record, encodedKey) {
    const key = loadDeliveryKey(encodedKey);
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(record.encryptionIv, "base64")
    );
    decipher.setAuthTag(Buffer.from(record.encryptionAuthTag, "base64"));

    return Buffer.concat([
        decipher.update(Buffer.from(record.encryptedLicenseKey, "base64")),
        decipher.final()
    ]).toString("utf8");
}
