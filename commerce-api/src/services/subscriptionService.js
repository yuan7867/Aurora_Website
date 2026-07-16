import { cancelPayPalSubscription, createPayPalSubscription, getPayPalSubscription } from "../clients/paypalClient.js";
import { activateXauSubscription, renewXauSubscription, updateXauSubscriptionStatus } from "../clients/xauLicenseApiClient.js";
import { config } from "../config.js";
import { getDownloadLink } from "../dispatchers/downloadDispatcher.js";
import { sendLicenseEmail } from "../dispatchers/emailDispatcher.js";
import {
    assertProductSubscriptionAvailable,
    getCommerceProduct,
    getPayPalPlanId,
    getProductByPayPalPlanId
} from "../products.js";
import {
    finishSubscriptionEvent,
    getDeliveryForCustomer,
    getSubscriptionForCustomer,
    claimPayment,
    claimSubscriptionEvent,
    recordSubscriptionCreated,
    hasSubscriptionPayment,
    recordSubscriptionPayment,
    saveDelivery,
    upsertSubscriptionFromPayPal
} from "../storage/commerceStore.js";
import { savePurchase } from "../storage/customerStore.js";
import { encryptLicenseKey } from "../utils/licenseCrypto.js";
import { createActivationForCustomer, getAuthenticatedCustomer } from "./identityService.js";

function readApprovalUrl(subscription) {
    return subscription.links?.find((link) => link.rel === "approve")?.href || null;
}

function extractSubscriptionId(resource) {
    return resource?.billing_agreement_id
        || resource?.subscription_id
        || resource?.id
        || "";
}

function extractSaleId(resource) {
    return resource?.id || resource?.sale_id || "";
}

function extractAmount(resource) {
    const amount = resource?.amount || resource?.billing_agreement_id?.amount || {};
    return {
        value: amount.total || amount.value || "",
        currency: amount.currency || amount.currency_code || ""
    };
}

function extractCustomer(details, fallback = {}) {
    return {
        email: details?.subscriber?.email_address || fallback.email || "",
        name: details?.subscriber?.name?.given_name || fallback.name || "Aurora Customer"
    };
}

function getNextBillingTime(details) {
    return details?.billing_info?.next_billing_time || null;
}

function assertPayPalDetailsMatchProduct({ product, details, amount }) {
    const planId = getPayPalPlanId(product, config);

    if (details.plan_id !== planId) {
        const error = new Error("PayPal subscription plan does not match Aurora catalog.");
        error.code = "PAYPAL_PLAN_MISMATCH";
        error.statusCode = 400;
        throw error;
    }

    if (details.custom_id && details.custom_id !== product.productId) {
        const error = new Error("PayPal subscription SKU does not match Aurora catalog.");
        error.code = "PAYPAL_SKU_MISMATCH";
        error.statusCode = 400;
        throw error;
    }

    if (amount?.value && String(amount.value) !== product.price) {
        const error = new Error("PayPal subscription payment amount does not match Aurora catalog.");
        error.code = "PAYPAL_AMOUNT_MISMATCH";
        error.statusCode = 400;
        throw error;
    }

    if (amount?.currency && amount.currency !== product.currency) {
        const error = new Error("PayPal subscription payment currency does not match Aurora catalog.");
        error.code = "PAYPAL_CURRENCY_MISMATCH";
        error.statusCode = 400;
        throw error;
    }
}

function assertXauProduct(product) {
    if (product.productFamily !== "XAU") {
        const error = new Error("MT5 subscription lifecycle is not available yet.");
        error.code = "MT5_SUBSCRIPTION_NOT_AVAILABLE";
        error.statusCode = 503;
        throw error;
    }
}

function extractLicenseKey(license) {
    return license?.licenseKey
        || license?.license_key
        || license?.key
        || license?.data?.licenseKey
        || "";
}

export async function createSubscriptionCheckout({ productId, customer }) {
    const product = getCommerceProduct(productId);
    assertProductSubscriptionAvailable(product, config);

    const planId = getPayPalPlanId(product, config);
    const subscription = await createPayPalSubscription({
        product,
        customer,
        planId
    });

    await recordSubscriptionCreated({
        product,
        customer,
        subscription,
        paypalPlanId: planId
    });

    return {
        status: "created",
        subscriptionId: subscription.id,
        approveUrl: readApprovalUrl(subscription),
        product: {
            productId: product.productId,
            name: product.name,
            plan: product.plan,
            price: product.price,
            currency: product.currency
        }
    };
}

export async function getSafeSubscriptionStatus(subscriptionId) {
    const details = await getPayPalSubscription(subscriptionId);

    return {
        subscriptionId: details.id,
        status: details.status,
        planId: details.plan_id,
        customId: details.custom_id,
        nextBillingTime: getNextBillingTime(details)
    };
}

async function saveInitialSubscriptionDelivery({ product, customer, paypal, license }) {
    const licenseKey = extractLicenseKey(license);

    if (!licenseKey && license?.alreadyProcessed) {
        const delivery = await getDeliveryForCustomer({ email: customer.email, productId: product.productId });
        return {
            status: "already_processed",
            delivery
        };
    }

    if (!licenseKey) {
        const error = new Error("XAU subscription activation did not return a license key.");
        error.statusCode = 502;
        throw error;
    }

    const downloadLink = getDownloadLink(product.licenseProductId);
    const emailResult = await sendLicenseEmail({
        customer,
        productId: product.licenseProductId,
        license,
        downloadLink
    });

    const paymentRecord = await claimPayment({
        product,
        customer,
        paypal: {
            captureId: paypal.saleId,
            orderId: paypal.subscriptionId,
            eventId: paypal.eventId,
            status: "COMPLETED"
        }
    });

    const delivery = await saveDelivery({
        paymentId: paymentRecord.payment.id,
        customerEmail: customer.email,
        product,
        encryptedLicense: encryptLicenseKey(licenseKey),
        downloadUrl: downloadLink,
        emailResult: emailResult?.status ? emailResult : { status: "email_pending" }
    });

    const customerRecord = await savePurchase({
        customer,
        product,
        paypal: {
            paymentId: paypal.saleId,
            captureId: paypal.saleId,
            orderId: paypal.subscriptionId,
            status: "COMPLETED"
        },
        license: {
            status: "Issued",
            deliveryStatus: "delivered"
        },
        downloadLink,
        emailResult
    });
    await createActivationForCustomer(customerRecord);

    return {
        status: "delivered",
        delivery
    };
}

export async function processSubscriptionSale({ event }) {
    const resource = event.resource || {};
    const subscriptionId = extractSubscriptionId(resource);
    const saleId = extractSaleId(resource);
    const amount = extractAmount(resource);

    if (!subscriptionId || !saleId) {
        const error = new Error("PayPal sale event is missing subscription or sale id.");
        error.statusCode = 400;
        throw error;
    }

    const details = await getPayPalSubscription(subscriptionId);
    const product = getProductByPayPalPlanId(details.plan_id, config);

    if (!product) {
        const error = new Error("PayPal subscription plan is not recognized by Aurora catalog.");
        error.code = "PAYPAL_PLAN_UNKNOWN";
        error.statusCode = 400;
        throw error;
    }

    assertPayPalDetailsMatchProduct({ product, details, amount });
    assertXauProduct(product);

    const alreadyPaid = await hasSubscriptionPayment(saleId);
    const customer = extractCustomer(details);
    const periodStart = resource.create_time || event.create_time || new Date().toISOString();
    const periodEnd = getNextBillingTime(details);

    const subscription = await upsertSubscriptionFromPayPal({
        product,
        customer,
        subscriptionId,
        paypalPlanId: details.plan_id,
        status: details.status || "ACTIVE",
        periodStart,
        periodEnd
    });

    if (alreadyPaid) {
        return {
            status: "already_processed",
            subscription
        };
    }

    const paypal = {
        subscriptionId,
        planId: details.plan_id,
        saleId,
        eventId: event.id,
        status: details.status || "ACTIVE",
        amount: amount.value,
        currency: amount.currency,
        paidAt: periodStart,
        periodStart,
        periodEnd
    };

    const existingDelivery = await getDeliveryForCustomer({ email: customer.email, productId: product.productId });

    if (existingDelivery?.encryptedLicenseKey) {
        const license = await renewXauSubscription({ product, customer, paypal });
        await recordSubscriptionPayment({
            saleId,
            subscriptionId,
            eventId: event.id,
            amount: amount.value,
            currency: amount.currency,
            paymentStatus: resource.state || resource.status || "COMPLETED",
            paidAt: resource.create_time || event.create_time || new Date().toISOString()
        });
        return {
            status: "renewed",
            subscription,
            license
        };
    }

    const license = await activateXauSubscription({ product, customer, paypal });
    const delivery = await saveInitialSubscriptionDelivery({ product, customer, paypal, license });
    await recordSubscriptionPayment({
        saleId,
        subscriptionId,
        eventId: event.id,
        amount: amount.value,
        currency: amount.currency,
        paymentStatus: resource.state || resource.status || "COMPLETED",
        paidAt: resource.create_time || event.create_time || new Date().toISOString()
    });

    return {
        status: "activated",
        subscription,
        delivery
    };
}

export async function processSubscriptionStatusEvent({ event, status }) {
    const resource = event.resource || {};
    const subscriptionId = extractSubscriptionId(resource);

    if (!subscriptionId) {
        const error = new Error("PayPal subscription event is missing subscription id.");
        error.statusCode = 400;
        throw error;
    }

    const details = await getPayPalSubscription(subscriptionId);
    const product = getProductByPayPalPlanId(details.plan_id, config);

    if (!product) {
        const error = new Error("PayPal subscription plan is not recognized by Aurora catalog.");
        error.statusCode = 400;
        throw error;
    }

    if (product.productFamily === "XAU") {
        await updateXauSubscriptionStatus({
            product,
            paypal: {
                subscriptionId,
                eventId: event.id,
                status,
                eventTime: event.create_time || new Date().toISOString(),
                reason: resource.reason || ""
            }
        });
    }

    const customer = extractCustomer(details);
    return upsertSubscriptionFromPayPal({
        product,
        customer,
        subscriptionId,
        paypalPlanId: details.plan_id,
        status,
        periodEnd: getNextBillingTime(details)
    });
}

export async function cancelOwnedSubscription({ authorization, subscriptionId }) {
    const customer = await getAuthenticatedCustomer(authorization);
    const subscription = await getSubscriptionForCustomer({
        subscriptionId,
        email: customer.email
    });

    if (!subscription) {
        const error = new Error("Subscription was not found for this customer.");
        error.statusCode = 404;
        throw error;
    }

    await cancelPayPalSubscription(subscriptionId);
    await upsertSubscriptionFromPayPal({
        product: getCommerceProduct(subscription.sku),
        customer,
        subscriptionId,
        paypalPlanId: subscription.paypalPlanId,
        status: "cancel_pending",
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd
    });

    return {
        status: "cancel_pending",
        subscriptionId,
        accessUntil: subscription.currentPeriodEnd
    };
}

export async function markSubscriptionEvent({ event, handler }) {
    const resource = event.resource || {};
    const subscriptionId = extractSubscriptionId(resource);
    const claimed = await claimSubscriptionEvent({
        eventId: event.id,
        subscriptionId,
        eventType: event.event_type,
        occurredAt: event.create_time || null
    });

    if (!claimed) {
        return {
            status: "already_processed",
            eventType: event.event_type
        };
    }

    try {
        const result = await handler();
        await finishSubscriptionEvent({ eventId: event.id, status: "processed" });
        return result;
    } catch (error) {
        await finishSubscriptionEvent({ eventId: event.id, status: "failed" });
        throw error;
    }
}
