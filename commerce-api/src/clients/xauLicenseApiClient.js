import { config } from "../config.js";
import { postJson } from "../utils/http.js";

export async function requestXauLicense(payload) {
    return postJson(config.xauLicenseApiUrl, payload, config.xauLicenseApiToken);
}
