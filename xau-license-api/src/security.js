import crypto from "node:crypto";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function hmacLicenseKey(licenseKey, pepper) {
  return crypto
    .createHmac("sha256", pepper)
    .update(String(licenseKey || ""), "utf8")
    .digest("hex");
}

export function generateLicenseKey(prefix = "AURORA") {
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

export function sanitizeForLog(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const blocked = new Set([
    "authorization",
    "license_key",
    "licenseKey",
    "token",
    "secret",
    "rawBody",
    "paypalRaw"
  ]);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      blocked.has(key) ? "[redacted]" : sanitizeForLog(item)
    ])
  );
}
