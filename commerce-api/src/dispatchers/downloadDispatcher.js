import { config } from "../config.js";
import { normalizeProductId } from "./productDispatcher.js";

export function getDownloadLink(productId) {
    const normalizedProductId = normalizeProductId(productId);

    if (normalizedProductId.includes("XAU")) {
        return config.xauDownloadUrl || `${config.downloadBaseUrl}/xau`;
    }

    if (normalizedProductId.includes("MT5")) {
        return config.mt5DownloadUrl || `${config.downloadBaseUrl}/mt5`;
    }

    throw new Error(`Unsupported product for download dispatch: ${normalizedProductId || "unknown"}`);
}
