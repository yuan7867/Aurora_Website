import { conflict } from "../../src/errors.js";
import { GRACE_HOURS, PRODUCT_ID } from "../../src/constants.js";

let nextId = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function samePayment(existing, request) {
  return existing.paypalSaleId === request.paypalSaleId
    && existing.paypalSubscriptionId === request.paypalSubscriptionId
    && existing.amount === request.amount
    && existing.currency === request.currency
    && new Date(existing.periodStart).toISOString() === new Date(request.periodStart).toISOString()
    && new Date(existing.periodEnd).toISOString() === new Date(request.periodEnd).toISOString();
}

export class InMemoryStore {
  constructor() {
    this.migrationComplete = true;
    this.licenses = [];
    this.payments = [];
    this.events = [];
    this.pendingDeliveries = [];
    this.audit = [];
    this.failPing = false;
  }

  async pingReadWrite() {
    if (this.failPing) {
      throw new Error("db unavailable");
    }
    return true;
  }

  async activateSubscription(request) {
    const existingPayment = this.payments.find((payment) => payment.paypalSaleId === request.paypalSaleId);
    if (existingPayment) {
      if (!samePayment(existingPayment, request)) {
        throw conflict("subscription_payment_conflict", "saleId belongs to a different payload.");
      }
      return { alreadyProcessed: true, license: clone(this.licenses.find((license) => license.id === existingPayment.licenseId)) };
    }
    if (this.licenses.some((license) => license.paypalSubscriptionId === request.paypalSubscriptionId)) {
      throw conflict("subscription_already_activated", "subscriptionId already has a license.");
    }
    const license = {
      id: nextId++,
      licenseKeyHash: request.licenseKeyHash,
      productId: request.productId,
      sku: request.sku,
      plan: request.plan,
      status: "active",
      customerEmail: request.customerEmail,
      customerName: request.customerName,
      issuedBy: "api",
      expiresAt: request.periodEnd,
      paypalSubscriptionId: request.paypalSubscriptionId,
      paypalPlanId: request.paypalPlanId,
      subscriptionStatus: "ACTIVE",
      currentPeriodStart: request.periodStart,
      currentPeriodEnd: request.periodEnd,
      graceUntil: "",
      lastSuccessfulSaleId: request.paypalSaleId
    };
    this.licenses.push(license);
    this.payments.push({ ...request, licenseId: license.id });
    this.pendingDeliveries.push({
      licenseId: license.id,
      paypalSaleId: request.paypalSaleId,
      paypalSubscriptionId: request.paypalSubscriptionId,
      ...request.recovery,
      acknowledgedAt: ""
    });
    this.audit.push({ licenseId: license.id, action: "subscription_activate" });
    return { alreadyProcessed: false, license: clone(license) };
  }

  async recoverSubscriptionLicenseKey({ paypalSaleId, paypalSubscriptionId }) {
    const record = this.pendingDeliveries.find((delivery) => delivery.paypalSaleId === paypalSaleId && delivery.paypalSubscriptionId === paypalSubscriptionId);
    if (!record || record.acknowledgedAt || !record.encryptedLicenseKey) {
      return null;
    }
    return clone({
      licenseId: record.licenseId,
      paypalSubscriptionId: record.paypalSubscriptionId,
      encryptedLicenseKey: record.encryptedLicenseKey,
      encryptionIv: record.encryptionIv,
      encryptionAuthTag: record.encryptionAuthTag
    });
  }

  async acknowledgeSubscriptionDelivery({ paypalSaleId, paypalSubscriptionId }) {
    const record = this.pendingDeliveries.find((delivery) => delivery.paypalSaleId === paypalSaleId && delivery.paypalSubscriptionId === paypalSubscriptionId);
    if (!record) {
      return { acknowledged: false };
    }
    record.acknowledgedAt = record.acknowledgedAt || new Date().toISOString();
    record.encryptedLicenseKey = "";
    record.encryptionIv = "";
    record.encryptionAuthTag = "";
    this.audit.push({ licenseId: record.licenseId, action: "subscription_delivery_ack" });
    return { acknowledged: true };
  }

  async renewSubscription(request) {
    const license = this.licenses.find((item) => item.paypalSubscriptionId === request.paypalSubscriptionId);
    if (!license) {
      throw conflict("subscription_not_found", "subscriptionId does not exist.");
    }
    if (license.productId !== request.productId || license.sku !== request.sku || license.plan !== request.plan || license.paypalPlanId !== request.paypalPlanId) {
      throw conflict("subscription_payload_conflict", "subscription payload does not match original license.");
    }
    const existingPayment = this.payments.find((payment) => payment.paypalSaleId === request.paypalSaleId);
    if (existingPayment) {
      if (!samePayment(existingPayment, request)) {
        throw conflict("subscription_payment_conflict", "saleId belongs to a different payload.");
      }
      return { alreadyProcessed: true, license: clone(license) };
    }
    if (new Date(request.periodEnd).getTime() <= new Date(license.currentPeriodEnd).getTime()) {
      throw conflict("period_not_forward", "periodEnd must move forward.");
    }
    this.payments.push({ ...request, licenseId: license.id });
    license.subscriptionStatus = "ACTIVE";
    license.currentPeriodStart = request.periodStart;
    license.currentPeriodEnd = request.periodEnd;
    license.expiresAt = request.periodEnd;
    license.graceUntil = "";
    license.lastSuccessfulSaleId = request.paypalSaleId;
    this.audit.push({ licenseId: license.id, action: "subscription_renew" });
    return { alreadyProcessed: false, license: clone(license) };
  }

  async updateSubscriptionStatus(request) {
    if (this.events.some((event) => event.paypalEventId === request.paypalEventId)) {
      return { alreadyProcessed: true, ignored: true };
    }
    const license = this.licenses.find((item) => item.paypalSubscriptionId === request.paypalSubscriptionId);
    if (!license) {
      throw conflict("subscription_not_found", "subscriptionId does not exist.");
    }
    this.events.push({ ...request });
    license.subscriptionStatus = request.status;
    if (request.status === "PAYMENT_FAILED") {
      license.graceUntil = new Date(new Date(request.eventTime).getTime() + GRACE_HOURS * 60 * 60 * 1000).toISOString();
    }
    if (request.status === "REFUNDED" || request.status === "REVERSED" || request.status === "SUSPENDED") {
      license.manualReviewReason = request.reason || request.status;
    }
    this.audit.push({ licenseId: license.id, action: "subscription_status" });
    return { alreadyProcessed: false, ignored: false, license: clone(license) };
  }

  async verifyLicense({ licenseKeyHash, accountLogin, accountServer }) {
    const license = this.licenses.find((item) => item.licenseKeyHash === licenseKeyHash);
    if (!license) {
      return { valid: false, reason: "license_not_found" };
    }
    const validity = this.subscriptionValidity(license, new Date());
    if (!validity.valid) {
      return { valid: false, reason: validity.reason, license: clone(license) };
    }
    if (license.status !== "active") {
      return { valid: false, reason: "license_disabled", license: clone(license) };
    }
    if (!license.binding) {
      license.binding = { accountLogin, accountServer };
      this.audit.push({ licenseId: license.id, action: "first_bind" });
    } else if (String(license.binding.accountLogin) !== String(accountLogin) || license.binding.accountServer !== accountServer) {
      return { valid: false, reason: "account_not_allowed", license: clone(license) };
    }
    return { valid: true, reason: "ok", license: clone(license) };
  }

  async issueManualPermanent(request) {
    const license = {
      id: nextId++,
      licenseKeyHash: request.licenseKeyHash,
      productId: PRODUCT_ID,
      sku: "manual-permanent",
      plan: "permanent",
      status: "active",
      customerEmail: request.customerEmail,
      customerName: request.customerName,
      issuedBy: "manual-cli",
      subscriptionStatus: "",
      expiresAt: ""
    };
    this.licenses.push(license);
    this.audit.push({ licenseId: license.id, action: "manual_permanent_issue" });
    return clone(license);
  }

  subscriptionValidity(license, now) {
    if (license.plan === "permanent" && !license.paypalSubscriptionId) {
      return { valid: true };
    }
    const status = license.subscriptionStatus || "ACTIVE";
    const paidThrough = license.currentPeriodEnd ? new Date(license.currentPeriodEnd) : null;
    const graceUntil = license.graceUntil ? new Date(license.graceUntil) : null;
    const paidValid = paidThrough && paidThrough.getTime() > now.getTime();
    const graceValid = graceUntil && graceUntil.getTime() > now.getTime();
    if (status === "ACTIVE") return paidValid ? { valid: true } : { valid: false, reason: "license_expired" };
    if (status === "PAYMENT_FAILED") return (paidValid || graceValid) ? { valid: true } : { valid: false, reason: "subscription_payment_failed" };
    if (status === "CANCELLED") return paidValid ? { valid: true } : { valid: false, reason: "subscription_cancelled" };
    if (status === "EXPIRED") return { valid: false, reason: "license_expired" };
    return { valid: false, reason: "subscription_suspended" };
  }
}
