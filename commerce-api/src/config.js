import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataDir = join(dirname(fileURLToPath(import.meta.url)), "../data");

export const config = {
    port: Number(process.env.PORT || 8080),
    paypalEnvironment: process.env.PAYPAL_ENVIRONMENT || "production",
    paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || "",
    jwtSecret: process.env.JWT_SECRET || "CHANGE_ME_LOCAL_JWT_SECRET",
    websiteBaseUrl: process.env.WEBSITE_BASE_URL || "http://localhost:5173",
    mt5LicenseApiUrl: process.env.MT5_LICENSE_API_URL || "",
    mt5LicenseApiToken: process.env.MT5_LICENSE_API_TOKEN || "",
    xauLicenseApiUrl: process.env.XAU_LICENSE_API_URL || "",
    xauLicenseApiToken: process.env.XAU_LICENSE_API_TOKEN || "",
    downloadBaseUrl: process.env.DOWNLOAD_BASE_URL || "",
    mt5DownloadUrl: process.env.MT5_DOWNLOAD_URL || "",
    xauDownloadUrl: process.env.XAU_DOWNLOAD_URL || "",
    emailApiUrl: process.env.EMAIL_API_URL || "",
    emailApiToken: process.env.EMAIL_API_TOKEN || "",
    supportEmail: process.env.SUPPORT_EMAIL || "support@aurorahy.com",
    dataDir: process.env.COMMERCE_DATA_DIR || defaultDataDir
};

export function getPayPalBaseUrl() {
    return config.paypalEnvironment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}
