import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataDir = join(dirname(fileURLToPath(import.meta.url)), "../data");

export const config = {
    port: Number(process.env.PORT || 8080),
    paypalEnvironment: process.env.PAYPAL_ENVIRONMENT || "production",
    paypalClientId: process.env.PAYPAL_CLIENT_ID || "",
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || "",
    paypalPlanIds: {
        "aurora-mt5-monthly": process.env.PAYPAL_MT5_MONTHLY_PLAN_ID || "",
        "aurora-mt5-yearly": process.env.PAYPAL_MT5_YEARLY_PLAN_ID || "",
        "aurora-xau-monthly": process.env.PAYPAL_XAU_MONTHLY_PLAN_ID || "",
        "aurora-xau-yearly": process.env.PAYPAL_XAU_YEARLY_PLAN_ID || ""
    },
    databaseUrl: process.env.DATABASE_URL || "",
    jwtSecret: process.env.JWT_SECRET || "CHANGE_ME_LOCAL_JWT_SECRET",
    websiteBaseUrl: process.env.WEBSITE_BASE_URL || "http://localhost:5173",
    mt5LicenseApiUrl: process.env.MT5_LICENSE_API_URL || "",
    mt5LicenseApiToken: process.env.MT5_LICENSE_API_TOKEN || "",
    xauLicenseApiUrl: process.env.XAU_LICENSE_API_URL || "",
    xauLicenseApiToken: process.env.XAU_LICENSE_API_TOKEN || "",
    downloadBaseUrl: process.env.DOWNLOAD_BASE_URL || "",
    mt5DownloadUrl: process.env.MT5_DOWNLOAD_URL || "",
    xauDownloadUrl: process.env.XAU_DOWNLOAD_URL || "",
    r2AccountId: process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || "",
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
    r2BucketName: process.env.R2_BUCKET || process.env.CLOUDFLARE_R2_BUCKET_NAME || "aurora-downloads",
    r2Endpoint: process.env.R2_ENDPOINT || process.env.CLOUDFLARE_R2_ENDPOINT || "",
    mt5R2ObjectKey: process.env.MT5_R2_OBJECT_KEY || "releases/aurora-mt5-ai-trader/Aurora_MT5_AI_Trader_2.4.0.exe",
    xauR2ObjectKey: process.env.XAU_R2_OBJECT_KEY || "releases/aurora-xau-trader/Aurora_XAU_Trader_1.0.0.exe",
    mt5ReleaseSha256: process.env.MT5_RELEASE_SHA256 || "TBD_UPLOAD_RELEASE_AND_SET_SHA256",
    xauReleaseSha256: process.env.XAU_RELEASE_SHA256 || "TBD_UPLOAD_RELEASE_AND_SET_SHA256",
    downloadTokenTtlMinutes: Number(process.env.DOWNLOAD_TOKEN_TTL_MINUTES || 10),
    r2PresignedUrlSeconds: Number(process.env.R2_PRESIGNED_URL_SECONDS || 600),
    emailApiUrl: process.env.EMAIL_API_URL || "",
    emailApiToken: process.env.EMAIL_API_TOKEN || "",
    emailFrom: process.env.EMAIL_FROM || "Aurora HY <license@mail.aurorahy.com>",
    supportEmail: process.env.SUPPORT_EMAIL || "support@aurorahy.com",
    supportGatewayToken: process.env.SUPPORT_GATEWAY_TOKEN || "",
    supportAutoReplyFrom: process.env.SUPPORT_AUTO_REPLY_FROM || "Aurora HY Support <support@mail.aurorahy.com>",
    supportAutoReplyReplyTo: process.env.SUPPORT_AUTO_REPLY_REPLY_TO || "support@aurorahy.com",
    auroraCloudIngestToken: process.env.AURORA_CLOUD_INGEST_TOKEN || "",
    licenseDeliveryEncryptionKey: process.env.LICENSE_DELIVERY_ENCRYPTION_KEY || "",
    mt5SalesEnabled: process.env.MT5_SALES_ENABLED === "true",
    xauSalesEnabled: process.env.XAU_SALES_ENABLED === "true",
    dataDir: process.env.COMMERCE_DATA_DIR || defaultDataDir
};

export function assertCommerceRuntimeConfigured() {
    if (!config.databaseUrl) {
        throw new Error("DATABASE_URL is required.");
    }
    if (!config.licenseDeliveryEncryptionKey) {
        throw new Error("LICENSE_DELIVERY_ENCRYPTION_KEY is required.");
    }
}

export function getPayPalBaseUrl() {
    return config.paypalEnvironment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}
