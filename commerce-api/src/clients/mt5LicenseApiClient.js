import { config } from "../config.js";
import { postJson } from "../utils/http.js";

export async function requestMt5License(payload) {
    return postJson(config.mt5LicenseApiUrl, payload, config.mt5LicenseApiToken);
}
