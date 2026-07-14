import { requestMt5License } from "../clients/mt5LicenseApiClient.js";
import { requestXauLicense } from "../clients/xauLicenseApiClient.js";

const productRoutes = {
    "AURORA-MT5-AI": requestMt5License,
    "AURORA-MT5": requestMt5License,
    MT5: requestMt5License,
    "AURORA-XAU-AI": requestXauLicense,
    "AURORA-XAU": requestXauLicense,
    XAU: requestXauLicense
};

export function normalizeProductId(value) {
    return String(value || "").trim().toUpperCase();
}

export async function dispatchLicenseRequest(productId, payload) {
    const normalizedProductId = normalizeProductId(productId);
    const handler = productRoutes[normalizedProductId];

    if (!handler) {
        throw new Error(`Unsupported product for license dispatch: ${normalizedProductId || "unknown"}`);
    }

    return handler({
        ...payload,
        productId: normalizedProductId
    });
}
