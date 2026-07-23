import { createHmac, createHash } from "node:crypto";

import { config } from "../config.js";

function hmac(key, value, encoding) {
    return createHmac("sha256", key).update(value).digest(encoding);
}

function encodePath(value) {
    return String(value || "")
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}

function encodeQuery(value) {
    return encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function amzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function signingKey(secretAccessKey, stamp) {
    const dateKey = hmac(`AWS4${secretAccessKey}`, stamp);
    const regionKey = hmac(dateKey, "auto");
    const serviceKey = hmac(regionKey, "s3");
    return hmac(serviceKey, "aws4_request");
}

export function assertR2Configured() {
    if (!config.r2AccessKeyId || !config.r2SecretAccessKey || (!config.r2AccountId && !config.r2Endpoint)) {
        const error = new Error("Cloudflare R2 download storage is not configured.");
        error.code = "R2_NOT_CONFIGURED";
        error.statusCode = 503;
        throw error;
    }
}

export function createR2PresignedGetUrl({ objectKey, filename, expiresIn = config.r2PresignedUrlSeconds } = {}) {
    assertR2Configured();

    if (!objectKey) {
        const error = new Error("R2 object key is required.");
        error.statusCode = 500;
        throw error;
    }

    const now = new Date();
    const stamp = dateStamp(now);
    const timestamp = amzDate(now);
    const endpoint = (config.r2Endpoint || `https://${config.r2AccountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
    const endpointUrl = new URL(endpoint);
    const host = endpointUrl.host;
    const canonicalUri = `/${encodePath(config.r2BucketName)}/${encodePath(objectKey)}`;
    const credentialScope = `${stamp}/auto/s3/aws4_request`;
    const credential = `${config.r2AccessKeyId}/${credentialScope}`;
    const query = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": credential,
        "X-Amz-Date": timestamp,
        "X-Amz-Expires": Math.max(60, Math.min(Number(expiresIn) || 600, 600)),
        "X-Amz-SignedHeaders": "host",
        "response-content-disposition": `attachment; filename="${String(filename || objectKey.split("/").pop() || "Aurora-Download.exe").replace(/"/g, "")}"`
    };
    const canonicalQuery = Object.entries(query)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${encodeQuery(key)}=${encodeQuery(value)}`)
        .join("&");
    const canonicalRequest = [
        "GET",
        canonicalUri,
        canonicalQuery,
        `host:${host}`,
        "",
        "host",
        "UNSIGNED-PAYLOAD"
    ].join("\n");
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        timestamp,
        credentialScope,
        createHash("sha256").update(canonicalRequest).digest("hex")
    ].join("\n");
    const signature = hmac(signingKey(config.r2SecretAccessKey, stamp), stringToSign, "hex");

    return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
