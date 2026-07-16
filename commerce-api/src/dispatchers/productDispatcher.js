import { requestMt5License } from "../clients/mt5LicenseApiClient.js";
import { requestXauLicense } from "../clients/xauLicenseApiClient.js";

const productRoutes = {
    "AURORA-MT5-AI": requestMt5License,
    "AURORA-XAU-AI": requestXauLicense
};

export function normalizeProductId(value) {
    return String(value || "").trim().toUpperCase();
}

export async function dispatchLicenseRequest(product, payload) {
    const normalizedProductId = normalizeProductId(product?.licenseProductId);
    const handler = productRoutes[normalizedProductId];

    if (!handler) {
        throw new Error(`Unsupported product for license dispatch: ${normalizedProductId || "unknown"}`);
    }

    return handler({
        ...payload,
        product,
        productId: normalizedProductId
    });
}
