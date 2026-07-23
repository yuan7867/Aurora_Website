import { randomBytes } from "node:crypto";

import { config } from "../config.js";
import { createR2PresignedGetUrl } from "../clients/r2Client.js";
import {
    consumeDownloadToken,
    getDownloadEntitlements,
    getDownloadHistory,
    hashDownloadToken,
    recordDownloadHistory,
    saveDownloadToken
} from "../storage/downloadStore.js";

export function getDownloadProducts() {
    return [
        {
            id: "AURORA-MT5-AI",
            licenseProductId: "AURORA-MT5-AI",
            slug: "aurora-mt5-ai",
            name: "Aurora MT5 AI Trader",
            status: "ACTIVE",
            version: "2.4.0",
            released: "2026-07-23",
            sha256: config.mt5ReleaseSha256,
            r2ObjectKey: config.mt5R2ObjectKey,
            filename: "Aurora_MT5_AI_Trader_2.4.0.exe",
            releaseNotes: {
                version: "2.4.0",
                releaseDate: "2026-07-23",
                changes: [
                    "Commercial license delivery integration.",
                    "Aurora Cloud ready customer download flow."
                ],
                bugFixes: [
                    "Improved production packaging and customer access stability."
                ]
            },
            installationGuide: [
                "Download the latest Aurora MT5 AI Trader installer.",
                "Run the installer on Windows 11.",
                "Open MetaTrader 5 and follow the Aurora activation prompt.",
                "Use the license connected to your Aurora customer account."
            ]
        },
        {
            id: "AURORA-XAU-AI",
            licenseProductId: "AURORA-XAU-AI",
            slug: "aurora-xau-ai",
            name: "Aurora XAU Trader",
            status: "ACTIVE",
            version: "1.0.0",
            released: "2026-07-23",
            sha256: config.xauReleaseSha256,
            r2ObjectKey: config.xauR2ObjectKey,
            filename: "Aurora_XAU_Trader_1.0.0.exe",
            releaseNotes: {
                version: "1.0.0",
                releaseDate: "2026-07-23",
                changes: [
                    "Initial commercial release package.",
                    "Aurora Cloud ready customer download flow."
                ],
                bugFixes: [
                    "Production installer baseline."
                ]
            },
            installationGuide: [
                "Download the latest Aurora XAU Trader installer.",
                "Run the installer on Windows 11.",
                "Complete product activation using your Aurora customer license.",
                "Keep the installer checksum for support verification."
            ]
        }
    ];
}

function findProduct(productId) {
    const normalized = String(productId || "").trim().toUpperCase();
    const product = getDownloadProducts().find((item) => item.id === normalized || item.slug.toUpperCase() === normalized);

    if (!product) {
        const error = new Error("Download product is not available.");
        error.statusCode = 404;
        throw error;
    }

    return product;
}

function entitlementMap(entitlements) {
    return new Map(entitlements.map((item) => [item.licenseProductId, item]));
}

function isEntitlementActive(entitlement) {
    return entitlement?.licenseStatus === "ACTIVE";
}

function publicProduct(product, entitlement) {
    return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        status: isEntitlementActive(entitlement) ? product.status : "LOCKED",
        subscription: entitlement?.plan || "Not Active",
        currentVersion: product.version,
        released: product.released,
        license: isEntitlementActive(entitlement) ? "ACTIVE" : "INACTIVE",
        expires: entitlement?.expiresAt || null,
        sha256: product.sha256,
        releaseNotes: product.releaseNotes,
        installationGuide: product.installationGuide,
        canDownload: isEntitlementActive(entitlement)
    };
}

export async function getCustomerDownloadCenter(customer) {
    const entitlements = await getDownloadEntitlements(customer.email);
    const history = await getDownloadHistory(customer.email);
    const byProduct = entitlementMap(entitlements);

    return {
        products: getDownloadProducts().map((product) => publicProduct(product, byProduct.get(product.id))),
        history
    };
}

export async function createCustomerDownloadToken({ customer, productId }) {
    const product = findProduct(productId);
    const entitlements = entitlementMap(await getDownloadEntitlements(customer.email));
    const entitlement = entitlements.get(product.id);

    if (!isEntitlementActive(entitlement)) {
        await recordDownloadHistory({
            customerEmail: customer.email,
            product,
            licenseStatus: entitlement?.licenseStatus || "INACTIVE",
            result: "forbidden"
        });
        const error = new Error("An active license is required before downloading this product.");
        error.code = "DOWNLOAD_LICENSE_REQUIRED";
        error.statusCode = 403;
        throw error;
    }

    const token = randomBytes(32).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + Math.max(1, config.downloadTokenTtlMinutes) * 60 * 1000).toISOString();
    await saveDownloadToken({
        token,
        customerEmail: customer.email,
        product,
        expiresAt
    });
    await recordDownloadHistory({
        customerEmail: customer.email,
        product,
        tokenHash: hashDownloadToken(token),
        licenseStatus: "ACTIVE",
        result: "issued"
    });

    return {
        status: "created",
        productId: product.id,
        tokenUrl: `/commerce/downloads/token/${token}`,
        expiresAt
    };
}

export async function consumeCustomerDownloadToken({ token, ipAddress, userAgent }) {
    const consumed = await consumeDownloadToken({ token, ipAddress, userAgent });

    if (consumed.status !== "downloaded") {
        const error = new Error(
            consumed.status === "expired"
                ? "Download token expired."
                : consumed.status === "already_used"
                    ? "Download token was already used."
                    : "Download token was not found."
        );
        error.code = `DOWNLOAD_TOKEN_${consumed.status.toUpperCase()}`;
        error.statusCode = consumed.status === "not_found" ? 404 : 410;
        throw error;
    }

    const product = findProduct(consumed.token.licenseProductId);
    const url = await createR2PresignedGetUrl({
        objectKey: consumed.token.r2ObjectKey,
        filename: product.filename
    });

    return {
        status: "redirect",
        url
    };
}
