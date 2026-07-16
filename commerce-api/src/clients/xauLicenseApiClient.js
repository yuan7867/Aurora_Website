import { config } from "../config.js";
import { postJson } from "../utils/http.js";

export async function requestXauLicense(payload) {
    const product = payload.product;
    const captureId = payload.paypal.captureId;

    return postJson(config.xauLicenseApiUrl, {
        productId: product.licenseProductId,
        sku: product.productId,
        plan: product.plan,
        customer: payload.customer,
        paypal: {
            orderId: payload.paypal.orderId || "",
            captureId,
            eventId: payload.paypal.eventId || "",
            status: "Completed"
        },
        idempotencyKey: captureId
    }, config.xauLicenseApiToken);
}
