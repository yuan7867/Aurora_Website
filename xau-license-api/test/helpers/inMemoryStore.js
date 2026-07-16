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
    this.payments = [];
    this.events = [];
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
      binding: null,
      paypalSubscriptionId: request.paypalSubscriptionId || null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      graceUntil: null,
      manualReviewReason: null
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
    const subscription = this.subscriptionValidity(license, new Date());
    if (!subscription.valid) {
      return { valid: false, reason: subscription.reason, license };
    }
    if (license.status !== "active") {
      return { valid: false, reason: "license_disabled", license };
    }
    if (!license.paypalSubscriptionId && license.expiresAt && new Date(license.expiresAt).getTime() <= Date.now()) {
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

  async activateSubscription(request) {
    const existingPayment = this.payments.find((item) => item.paypalSaleId === request.paypalSaleId);
    if (existingPayment) {
      if (
        existingPayment.paypalSubscriptionId !== request.paypalSubscriptionId
        || existingPayment.periodEnd !== request.periodEnd
      ) {
        throw Object.assign(new Error("subscription_payment_conflict"), { statusCode: 409, code: "subscription_payment_conflict" });
      }
      const license = this.licenses.find((item) => item.id === existingPayment.licenseId);
      return { alreadyProcessed: true, license };
    }
    if (this.licenses.some((item) => item.paypalSubscriptionId === request.paypalSubscriptionId)) {
      throw Object.assign(new Error("subscription_already_activated"), { statusCode: 409, code: "subscription_already_activated" });
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
      expiresAt: request.periodEnd,
      paypalSubscriptionId: request.paypalSubscriptionId,
      paypalPlanId: request.paypalPlanId,
      subscriptionStatus: "ACTIVE",
      currentPeriodStart: request.periodStart,
      currentPeriodEnd: request.periodEnd,
      graceUntil: null,
      manualReviewReason: null,
      binding: null
    };
    this.nextId += 1;
    this.licenses.push(license);
    this.payments.push({
      licenseId: license.id,
      paypalSaleId: request.paypalSaleId,
      paypalSubscriptionId: request.paypalSubscriptionId,
      periodEnd: request.periodEnd
    });
    this.audit.push({ licenseId: license.id, action: "subscription_activate" });
    return { alreadyProcessed: false, license };
  }

  async renewSubscription(request) {
    const license = this.licenses.find((item) => item.paypalSubscriptionId === request.paypalSubscriptionId);
    if (!license) {
      throw Object.assign(new Error("subscription_not_found"), { statusCode: 409, code: "subscription_not_found" });
    }
    if (license.sku !== request.sku || license.plan !== request.plan || license.paypalPlanId !== request.paypalPlanId) {
      throw Object.assign(new Error("subscription_payload_conflict"), { statusCode: 409, code: "subscription_payload_conflict" });
    }
    const existingPayment = this.payments.find((item) => item.paypalSaleId === request.paypalSaleId);
    if (existingPayment) {
      if (
        existingPayment.paypalSubscriptionId !== request.paypalSubscriptionId
        || existingPayment.periodEnd !== request.periodEnd
      ) {
        throw Object.assign(new Error("subscription_payment_conflict"), { statusCode: 409, code: "subscription_payment_conflict" });
      }
      return { alreadyProcessed: true, license };
    }
    if (new Date(request.periodEnd).getTime() <= new Date(license.currentPeriodEnd).getTime()) {
      throw Object.assign(new Error("period_not_forward"), { statusCode: 409, code: "period_not_forward" });
    }
    this.payments.push({
      licenseId: license.id,
      paypalSaleId: request.paypalSaleId,
      paypalSubscriptionId: request.paypalSubscriptionId,
      periodEnd: request.periodEnd
    });
    license.subscriptionStatus = "ACTIVE";
    license.currentPeriodStart = request.periodStart;
    license.currentPeriodEnd = request.periodEnd;
    license.expiresAt = request.periodEnd;
    license.graceUntil = null;
    this.audit.push({ licenseId: license.id, action: "subscription_renew" });
    return { alreadyProcessed: false, license };
  }

  async updateSubscriptionStatus(request) {
    if (this.events.some((item) => item.eventId === request.paypalEventId)) {
      return { alreadyProcessed: true, ignored: true };
    }
    const license = this.licenses.find((item) => item.paypalSubscriptionId === request.paypalSubscriptionId);
    if (!license) {
      throw Object.assign(new Error("subscription_not_found"), { statusCode: 409, code: "subscription_not_found" });
    }
    this.events.push({
      eventId: request.paypalEventId,
      status: request.status,
      eventTime: request.eventTime
    });
    const latest = license.latestSubscriptionEventAt ? new Date(license.latestSubscriptionEventAt).getTime() : 0;
    if (new Date(request.eventTime).getTime() < latest) {
      return { alreadyProcessed: false, ignored: true, license };
    }
    license.latestSubscriptionEventAt = request.eventTime;
    if (request.status === "PAYMENT_FAILED") {
      license.subscriptionStatus = "PAYMENT_FAILED";
      license.graceUntil = new Date(new Date(request.eventTime).getTime() + 72 * 60 * 60 * 1000).toISOString();
    } else if (request.status === "CANCELLED") {
      license.subscriptionStatus = "CANCELLED";
      license.cancelledAt = request.eventTime;
    } else if (request.status === "REFUNDED" || request.status === "REVERSED") {
      license.subscriptionStatus = "SUSPENDED";
      license.suspendedAt = request.eventTime;
      license.manualReviewReason = request.reason || request.status;
    } else {
      license.subscriptionStatus = request.status;
      if (request.status === "SUSPENDED") {
        license.manualReviewReason = request.reason || "SUSPENDED";
      }
    }
    this.audit.push({ licenseId: license.id, action: "subscription_status" });
    return { alreadyProcessed: false, ignored: false, license };
  }

  subscriptionValidity(license, now) {
    if (!license.paypalSubscriptionId || license.plan === "permanent") {
      return { valid: true };
    }
    const paidThrough = license.currentPeriodEnd ? new Date(license.currentPeriodEnd) : null;
    const graceUntil = license.graceUntil ? new Date(license.graceUntil) : null;
    const paidValid = paidThrough && paidThrough.getTime() > now.getTime();
    const graceValid = graceUntil && graceUntil.getTime() > now.getTime();
    if (license.subscriptionStatus === "ACTIVE") {
      return paidValid ? { valid: true } : { valid: false, reason: "license_expired" };
    }
    if (license.subscriptionStatus === "PAYMENT_FAILED") {
      return (paidValid || graceValid) ? { valid: true } : { valid: false, reason: "subscription_payment_failed" };
    }
    if (license.subscriptionStatus === "CANCELLED") {
      return paidValid ? { valid: true } : { valid: false, reason: "subscription_cancelled" };
    }
    if (license.subscriptionStatus === "EXPIRED") {
      return { valid: false, reason: "license_expired" };
    }
    if (license.subscriptionStatus === "SUSPENDED") {
      return license.manualReviewReason
        ? { valid: false, reason: "subscription_suspended" }
        : ((paidValid || graceValid) ? { valid: true } : { valid: false, reason: "subscription_suspended" });
    }
    return { valid: true };
  }
}
