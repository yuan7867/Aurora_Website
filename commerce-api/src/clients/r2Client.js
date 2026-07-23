import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { config } from "../config.js";

function r2Endpoint() {
    return (config.r2Endpoint || `https://${config.r2AccountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
}

function safeFilename(filename, objectKey) {
    return String(filename || objectKey.split("/").pop() || "Aurora-Download.exe").replace(/["\r\n]/g, "");
}

function createR2Client() {
    return new S3Client({
        region: "auto",
        endpoint: r2Endpoint(),
        credentials: {
            accessKeyId: config.r2AccessKeyId,
            secretAccessKey: config.r2SecretAccessKey
        }
    });
}

export function assertR2Configured() {
    if (!config.r2AccessKeyId || !config.r2SecretAccessKey || !config.r2BucketName || (!config.r2AccountId && !config.r2Endpoint)) {
        const error = new Error("Cloudflare R2 download storage is not configured.");
        error.code = "R2_NOT_CONFIGURED";
        error.statusCode = 503;
        throw error;
    }
}

export async function createR2PresignedGetUrl({ objectKey, filename, expiresIn = config.r2PresignedUrlSeconds } = {}) {
    assertR2Configured();

    if (!objectKey) {
        const error = new Error("R2 object key is required.");
        error.statusCode = 500;
        throw error;
    }

    const command = new GetObjectCommand({
        Bucket: config.r2BucketName,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename="${safeFilename(filename, objectKey)}"`
    });

    return getSignedUrl(createR2Client(), command, {
        expiresIn: Math.max(60, Math.min(Number(expiresIn) || 600, 600))
    });
}
