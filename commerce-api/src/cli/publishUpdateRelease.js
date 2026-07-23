import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { createR2PresignedGetUrl, putR2Object } from "../clients/r2Client.js";

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
const cliArgs = {};

function parseArgs(argv) {
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];

        if (!value.startsWith("--")) {
            continue;
        }

        const [rawKey, inlineValue] = value.slice(2).split("=");
        const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

        if (inlineValue !== undefined) {
            cliArgs[key] = inlineValue;
        } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
            cliArgs[key] = argv[index + 1];
            index += 1;
        } else {
            cliArgs[key] = "true";
        }
    }
}

async function loadReleaseManifest() {
    const manifestPath = process.env.RELEASE_MANIFEST || "";
    if (!manifestPath || process.env.PRODUCT) {
        return;
    }

    releaseManifest = JSON.parse(await readFile(manifestPath, "utf8"));
}

function env(name, fallback = "") {
    const manifestKey = name.toLowerCase();
    const cliKey = manifestKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    return cliArgs[cliKey] || process.env[name] || releaseManifest[manifestKey] || releaseManifest[name] || fallback;
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

async function verifySignedUrl(manifest) {
    const url = await createR2PresignedGetUrl({
        objectKey: manifest.object_key,
        filename: manifest.filename
    });
    const response = await fetch(url, {
        headers: {
            Range: "bytes=0-0"
        }
    });

    if (!response.ok && response.status !== 206) {
        throw new Error(`Signed URL verification failed with HTTP ${response.status}.`);
    }

    return {
        status: response.status,
        expiresIn: 600
    };
}

async function verifyApi(product, version) {
    const apiBaseUrl = env("API_BASE_URL").replace(/\/+$/, "");
    if (!apiBaseUrl) {
        return null;
    }

    const response = await fetch(`${apiBaseUrl}/api/update/latest/${product}`);
    if (!response.ok) {
        throw new Error(`Update API verification failed with HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (data.version !== version) {
        throw new Error(`Update API returned ${data.version}, expected ${version}.`);
    }

    return data.version;
}

async function main() {
    parseArgs(process.argv.slice(2));
    await loadReleaseManifest();

    const product = required("PRODUCT").toLowerCase();
    const config = PRODUCTS[product];

    if (!config) {
        throw new Error("PRODUCT must be mt5 or xau.");
    }

    const artifactPath = env("FILE") || required("ARTIFACT_PATH");
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
    const signedUrlCheck = await verifySignedUrl(manifest);
    const apiVersion = await verifyApi(product, version);

    console.log(`Aurora update release published: ${product} ${version}`);
    console.log(`Artifact: ${objectKey}`);
    console.log(`Manifest: ${config.manifestKey}`);
    console.log(`SHA256: ${sha256}`);
    console.log(`Signed URL: PASS HTTP ${signedUrlCheck.status}`);
    if (apiVersion) {
        console.log(`Update API: PASS ${apiVersion}`);
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
