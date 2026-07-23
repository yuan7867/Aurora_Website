import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
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

async function streamToString(body) {
    if (typeof body?.transformToString === "function") {
        return body.transformToString();
    }

    const chunks = [];
    for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
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

export async function getR2ObjectText({ objectKey } = {}) {
    assertR2Configured();

    if (!objectKey) {
        const error = new Error("R2 object key is required.");
        error.statusCode = 500;
        throw error;
    }

    try {
        const result = await createR2Client().send(new GetObjectCommand({
            Bucket: config.r2BucketName,
            Key: objectKey
        }));
        return streamToString(result.Body);
    } catch (error) {
        const wrapped = new Error("R2 object could not be read.");
        wrapped.code = "R2_OBJECT_READ_FAILED";
        wrapped.statusCode = error?.$metadata?.httpStatusCode === 404 || error?.name === "NoSuchKey" ? 404 : 502;
        throw wrapped;
    }
}

export async function putR2Object({ objectKey, body, contentType = "application/octet-stream" } = {}) {
    assertR2Configured();

    if (!objectKey) {
        const error = new Error("R2 object key is required.");
        error.statusCode = 500;
        throw error;
    }

    await createR2Client().send(new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: objectKey,
        Body: body,
        ContentType: contentType
    }));
}
