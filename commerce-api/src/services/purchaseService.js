import { getDownloadLink } from "../dispatchers/downloadDispatcher.js";
import { sendLicenseEmail } from "../dispatchers/emailDispatcher.js";
import { dispatchLicenseRequest } from "../dispatchers/productDispatcher.js";
import { getCommerceProduct } from "../products.js";
import { claimPayment, getDeliveryForCustomer, markManualRecovery, saveDelivery } from "../storage/commerceStore.js";
import { savePurchase } from "../storage/customerStore.js";
import { decryptLicenseKey, encryptLicenseKey } from "../utils/licenseCrypto.js";
import { createActivationForCustomer } from "./identityService.js";

function normalizeStatus(status) {
    return String(status || "").trim().toUpperCase();
}

function assertCaptureCompleted(paypal) {
    if (!paypal?.captureId) {
        const error = new Error("PayPal capture id is required.");
        error.code = "CAPTURE_ID_REQUIRED";
        error.statusCode = 400;
        throw error;
    }

    if (normalizeStatus(paypal.status) !== "COMPLETED") {
        const error = new Error("PayPal capture is not completed.");
        error.code = "PAYPAL_CAPTURE_NOT_COMPLETED";
        error.statusCode = 409;
        throw error;
    }
}

function assertCaptureMatchesProduct(product, paypal) {
    if (paypal.currency && paypal.currency !== product.currency) {
        const error = new Error("PayPal capture currency does not match product catalog.");
        error.code = "PAYPAL_CURRENCY_MISMATCH";
        error.statusCode = 400;
        throw error;
    }

    if (paypal.amount && String(paypal.amount) !== product.price) {
        const error = new Error("PayPal capture amount does not match product catalog.");
        error.code = "PAYPAL_AMOUNT_MISMATCH";
        error.statusCode = 400;
        throw error;
    }

    if (paypal.customId && paypal.customId !== product.productId) {
        const error = new Error("PayPal capture product does not match checkout product.");
        error.code = "PAYPAL_SKU_MISMATCH";
        error.statusCode = 400;
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

function buildCustomerLicenseStatus(deliveryStatus) {
    return {
        status: deliveryStatus === "delivered" ? "Issued" : "Pending",
        deliveryStatus
    };
}

export async function completePurchase({ productId, customer, paypal }) {
    const product = getCommerceProduct(productId);

    assertCaptureCompleted(paypal);
    assertCaptureMatchesProduct(product, paypal);

    const claimed = await claimPayment({
        product,
        customer,
        paypal: {
            ...paypal,
            status: "COMPLETED"
        }
    });

    if (claimed.status === "delivered" && claimed.delivery?.encryptedLicenseKey) {
        const customerRecord = await savePurchase({
            customer,
            product,
            paypal: {
                ...paypal,
                paymentId: paypal.captureId,
                status: "COMPLETED"
            },
            license: buildCustomerLicenseStatus("delivered"),
            downloadLink: claimed.delivery.downloadUrl,
            emailResult: {
                status: claimed.delivery.emailStatus || "already_sent"
            }
        });
        const activatedCustomer = await createActivationForCustomer(customerRecord);

        return {
            status: "already_processed",
            customer: activatedCustomer,
            product,
            license: {
                status: "issued",
                alreadyIssued: true
            },
            downloadLink: claimed.delivery.downloadUrl
        };
    }

    if (claimed.status && claimed.status !== "claimed") {
        return {
            status: "manual_recovery",
            product,
            reason: `Payment ${paypal.captureId} is already in ${claimed.status} state.`
        };
    }

    const license = await dispatchLicenseRequest(product, {
        paypal: {
            ...paypal,
            status: "COMPLETED"
        },
        customer
    });
    const licenseKey = extractLicenseKey(license);

    if (license?.alreadyIssued && !licenseKey) {
        const existingDelivery = await getDeliveryForCustomer({
            email: customer.email,
            productId: product.productId
        });

        if (existingDelivery?.encryptedLicenseKey) {
            return {
                status: "already_processed",
                product,
                license: {
                    status: "issued",
                    alreadyIssued: true
                },
                downloadLink: existingDelivery.downloadUrl
            };
        }

        await markManualRecovery(claimed.payment.id, "License API returned alreadyIssued without a recoverable delivery.");
        return {
            status: "manual_recovery",
            product,
            reason: "License was already issued but Commerce has no delivery record."
        };
    }

    if (!licenseKey) {
        await markManualRecovery(claimed.payment.id, "License API did not return a license key.");
        const error = new Error("License API did not return a license key.");
        error.statusCode = 502;
        throw error;
    }

    const downloadLink = getDownloadLink(product.licenseProductId);
    const encryptedLicense = encryptLicenseKey(licenseKey);
    const emailResult = await sendLicenseEmail({
        customer,
        productId: product.licenseProductId,
        license,
        downloadLink
    });
    const delivery = await saveDelivery({
        paymentId: claimed.payment.id,
        customerEmail: customer.email,
        product,
        encryptedLicense,
        downloadUrl: downloadLink,
        emailResult
    });
    const customerRecord = await savePurchase({
        customer,
        product,
        paypal: {
            ...paypal,
            paymentId: paypal.captureId,
            status: "COMPLETED"
        },
        license: buildCustomerLicenseStatus("delivered"),
        downloadLink,
        emailResult
    });
    const activatedCustomer = await createActivationForCustomer(customerRecord);

    return {
        status: "completed",
        customer: activatedCustomer,
        product,
        license: {
            status: "issued",
            alreadyIssued: Boolean(license?.alreadyIssued)
        },
        downloadLink,
        delivery: {
            id: delivery.id,
            emailStatus: delivery.emailStatus
        }
    };
}

export async function revealLicenseForCustomer({ email, productId }) {
    const delivery = await getDeliveryForCustomer({ email, productId });

    if (!delivery?.encryptedLicenseKey) {
        const error = new Error("License delivery was not found.");
        error.statusCode = 404;
        throw error;
    }

    return {
        productId,
        licenseProductId: delivery.licenseProductId,
        plan: delivery.plan,
        licenseKey: decryptLicenseKey(delivery),
        downloadUrl: delivery.downloadUrl
    };
}
