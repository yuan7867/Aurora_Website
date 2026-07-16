import { conflict } from "../../src/errors.js";

function sameIssue(existing, request) {
  return existing.productId === request.productId
    && existing.sku === request.sku
    && existing.plan === request.plan
    && existing.customerEmail === request.customerEmail
    && (existing.paypalOrderId || "") === (request.paypalOrderId || "")
    && existing.paypalCaptureId === request.paypalCaptureId
    && (existing.paypalEventId || "") === (request.paypalEventId || "");
}

export class InMemoryStore {
  constructor() {
    this.migrationComplete = true;
    this.licenses = [];
    this.audit = [];
    this.nextId = 1;
  }

  async pingReadWrite() {
    return true;
  }

  async issueLicense(request) {
    const existing = this.licenses.find((item) => item.paypalCaptureId === request.paypalCaptureId);
    if (existing) {
      if (!sameIssue(existing, request)) {
        throw conflict("payment_payload_conflict", "Existing captureId belongs to a different payload.");
      }
      return { alreadyIssued: true, license: existing };
    }

    if (this.licenses.some((item) => item.licenseKeyHash === request.licenseKeyHash)) {
      throw conflict("unique_constraint_conflict", "Duplicate license key hash.");
    }

    const license = {
      id: this.nextId,
      licenseKeyHash: request.licenseKeyHash,
      productId: request.productId,
      sku: request.sku,
      plan: request.plan,
      status: "active",
      customerEmail: request.customerEmail,
      customerName: request.customerName,
      paypalOrderId: request.paypalOrderId,
      paypalCaptureId: request.paypalCaptureId,
      paypalEventId: request.paypalEventId,
      expiresAt: new Date(Date.now() + request.days * 24 * 60 * 60 * 1000).toISOString(),
      binding: null
    };
    this.nextId += 1;
    this.licenses.push(license);
    this.audit.push({ licenseId: license.id, action: "issue" });
    return { alreadyIssued: false, license };
  }

  async issueManual(request) {
    const license = {
      id: this.nextId,
      licenseKeyHash: request.licenseKeyHash,
      productId: request.productId,
      sku: request.sku,
      plan: request.plan,
      status: "active",
      customerEmail: request.customerEmail,
      customerName: request.customerName,
      expiresAt: request.days ? new Date(Date.now() + request.days * 24 * 60 * 60 * 1000).toISOString() : null,
      binding: null
    };
    this.nextId += 1;
    this.licenses.push(license);
    this.audit.push({ licenseId: license.id, action: "manual_issue" });
    return license;
  }

  async verifyLicense({ licenseKeyHash, accountLogin, accountServer }) {
    const license = this.licenses.find((item) => item.licenseKeyHash === licenseKeyHash);
    if (!license) {
      return { valid: false, reason: "license_not_found" };
    }
    if (license.status !== "active") {
      return { valid: false, reason: "license_disabled", license };
    }
    if (license.expiresAt && new Date(license.expiresAt).getTime() <= Date.now()) {
      return { valid: false, reason: "license_expired", license };
    }
    if (!license.binding) {
      license.binding = { accountLogin, accountServer };
      this.audit.push({ licenseId: license.id, action: "first_bind" });
    } else if (license.binding.accountLogin !== accountLogin || license.binding.accountServer !== accountServer) {
      return { valid: false, reason: "account_not_allowed", license };
    }
    license.lastSeenAt = new Date().toISOString();
    return { valid: true, reason: "ok", license };
  }

  activeBindingCount(licenseKeyHash) {
    const license = this.licenses.find((item) => item.licenseKeyHash === licenseKeyHash);
    return license?.binding ? 1 : 0;
  }
}
