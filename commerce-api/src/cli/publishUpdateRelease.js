import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { putR2Object } from "../clients/r2Client.js";

const PRODUCTS = {
    mt5: {
        releasePrefix: "releases/aurora-mt5-ai-trader",
        manifestKey: "updates/mt5/version.json"
    },
    xau: {
        releasePrefix: "releases/aurora-xau-trader",
        manifestKey: "updates/xau/version.json"
    }
};

let releaseManifest = {};

async function loadReleaseManifest() {
    const manifestPath = process.env.RELEASE_MANIFEST || "";
    if (!manifestPath || process.env.PRODUCT) {
        return;
    }

    releaseManifest = JSON.parse(await readFile(manifestPath, "utf8"));
}

function env(name, fallback = "") {
    const manifestKey = name.toLowerCase();
    return process.env[name] || releaseManifest[manifestKey] || releaseManifest[name] || fallback;
}

function required(name) {
    const value = env(name).trim();
    if (!value) {
        throw new Error(`${name} is required.`);
    }
    return value;
}

function releaseNotes() {
    return env("RELEASE_NOTES")
        .split(/\r?\n|;/)
        .map((item) => item.trim())
        .filter(Boolean);
}

async function main() {
    await loadReleaseManifest();

    const product = required("PRODUCT").toLowerCase();
    const config = PRODUCTS[product];

    if (!config) {
        throw new Error("PRODUCT must be mt5 or xau.");
    }

    const artifactPath = required("ARTIFACT_PATH");
    const artifact = await readFile(artifactPath);
    const filename = env("RELEASE_FILENAME", basename(artifactPath));
    const version = required("VERSION");
    const objectKey = `${config.releasePrefix}/${version}/${filename}`;
    const sha256 = createHash("sha256").update(artifact).digest("hex").toUpperCase();
    const manifest = {
        product,
        version,
        minimum_version: env("MINIMUM_VERSION", version),
        force_update: env("FORCE_UPDATE", "false").toLowerCase() === "true",
        release_date: env("RELEASE_DATE", new Date().toISOString().slice(0, 10)),
        sha256,
        object_key: objectKey,
        filename,
        release_notes: releaseNotes()
    };

    await putR2Object({
        objectKey,
        body: artifact,
        contentType: "application/vnd.microsoft.portable-executable"
    });
    await putR2Object({
        objectKey: config.manifestKey,
        body: `${JSON.stringify(manifest, null, 2)}\n`,
        contentType: "application/json"
    });

    console.log(`Aurora update release published: ${product} ${version}`);
    console.log(`Artifact: ${objectKey}`);
    console.log(`Manifest: ${config.manifestKey}`);
    console.log(`SHA256: ${sha256}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
