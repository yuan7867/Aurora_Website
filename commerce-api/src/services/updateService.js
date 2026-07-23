import { config } from "../config.js";
import { createR2PresignedGetUrl, getR2ObjectText } from "../clients/r2Client.js";

const PRODUCTS = {
    mt5: {
        product: "mt5",
        manifestKey: () => config.mt5UpdateManifestKey,
        defaultFilename: "Aurora_MT5_AI_Trader.exe"
    },
    xau: {
        product: "xau",
        manifestKey: () => config.xauUpdateManifestKey,
        defaultFilename: "Aurora_XAU_Trader.exe"
    }
};

function normalizeProduct(product) {
    return String(product || "").trim().toLowerCase();
}

function asString(value, field) {
    const text = String(value || "").trim();
    if (!text) {
        const error = new Error(`Update manifest missing ${field}.`);
        error.statusCode = 502;
        throw error;
    }
    return text;
}

function asBoolean(value) {
    return value === true || String(value).toLowerCase() === "true";
}

function asNotes(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function parseUpdateManifest(product, manifest) {
    const productConfig = PRODUCTS[product];
    const objectKey = asString(manifest.object_key || manifest.objectKey || manifest.r2_object_key, "object_key");

    return {
        product,
        version: asString(manifest.version, "version"),
        minimum_version: asString(manifest.minimum_version || manifest.minimumVersion, "minimum_version"),
        force_update: asBoolean(manifest.force_update || manifest.forceUpdate),
        release_date: asString(manifest.release_date || manifest.releaseDate, "release_date"),
        sha256: asString(manifest.sha256, "sha256").toUpperCase(),
        object_key: objectKey,
        filename: String(manifest.filename || objectKey.split("/").pop() || productConfig.defaultFilename),
        release_notes: asNotes(manifest.release_notes || manifest.releaseNotes)
    };
}

export async function getLatestUpdate(productInput) {
    const product = normalizeProduct(productInput);
    const productConfig = PRODUCTS[product];

    if (!productConfig) {
        const error = new Error("Update product is not supported.");
        error.code = "UPDATE_PRODUCT_NOT_FOUND";
        error.statusCode = 404;
        throw error;
    }

    const manifestText = await getR2ObjectText({
        objectKey: productConfig.manifestKey()
    });
    const manifest = parseUpdateManifest(product, JSON.parse(manifestText));
    const downloadUrl = await createR2PresignedGetUrl({
        objectKey: manifest.object_key,
        filename: manifest.filename
    });

    return {
        product: manifest.product,
        version: manifest.version,
        minimum_version: manifest.minimum_version,
        force_update: manifest.force_update,
        release_date: manifest.release_date,
        sha256: manifest.sha256,
        download_url: downloadUrl,
        release_notes: manifest.release_notes
    };
}
