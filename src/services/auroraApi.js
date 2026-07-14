import { auroraCloud, getCloudEndpoint } from "../config/auroraCloud.js";

export const CLOUD_STATUS = {
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
    SYNCING: "syncing",
    OFFLINE: "offline",
    READY: "ready"
};

let cloudState = {
    status: CLOUD_STATUS.READY,
    loading: false,
    error: null,
    lastSync: null
};

function wait(ms) {
    return new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });
}

function createApiError(message, details = {}) {
    const error = new Error(message);
    error.name = "AuroraCloudError";
    error.details = details;
    return error;
}

function setCloudState(nextState) {
    cloudState = {
        ...cloudState,
        ...nextState
    };
}

function normalizePayload(payload) {
    if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
        if (!payload.success) {
            throw createApiError(payload.error?.message || "Aurora Cloud request failed.", {
                error: payload.error ?? null
            });
        }

        return payload.data;
    }

    if (payload && typeof payload === "object" && "data" in payload) {
        return payload.data;
    }

    return payload;
}

async function fetchWithTimeout(url) {
    if (!auroraCloud.apiBaseUrl) {
        throw createApiError("Aurora Cloud API base URL is not configured.");
    }

    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), auroraCloud.timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: "application/json"
            }
        });
        const payload = await response.json();

        if (!response.ok) {
            throw createApiError("Aurora Cloud request failed.", {
                status: response.status,
                url
            });
        }

        return normalizePayload(payload);
    } catch (error) {
        if (error.name === "AbortError") {
            throw createApiError("Aurora Cloud request timed out.", {
                timeout: auroraCloud.timeout,
                url
            });
        }

        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }
}

async function requestCloud(endpointKey, params = {}) {
    const url = getCloudEndpoint(endpointKey, params);

    setCloudState({
        status: CLOUD_STATUS.SYNCING,
        loading: true,
        error: null
    });

    for (let attempt = 0; attempt <= auroraCloud.retryCount; attempt += 1) {
        try {
            const data = await fetchWithTimeout(url);
            setCloudState({
                status: CLOUD_STATUS.CONNECTED,
                loading: false,
                lastSync: new Date().toISOString()
            });
            return data;
        } catch (error) {
            const isLastAttempt = attempt === auroraCloud.retryCount;

            if (!isLastAttempt) {
                await wait(auroraCloud.retryDelay);
                continue;
            }

            setCloudState({
                status: globalThis.navigator?.onLine === false ? CLOUD_STATUS.OFFLINE : CLOUD_STATUS.DISCONNECTED,
                loading: false,
                error
            });

            throw error;
        }
    }

    throw createApiError("Aurora Cloud request failed after retry.");
}

export function getCloudStatus() {
    return {
        ...cloudState,
        error: cloudState.error
            ? {
                name: cloudState.error.name,
                message: cloudState.error.message,
                details: cloudState.error.details ?? null
            }
            : null
    };
}

export async function getHeartbeat() {
    return requestCloud("heartbeat");
}

export async function getStatus() {
    return requestCloud("status");
}

export async function getPerformance() {
    return requestCloud("performance");
}

export async function checkCloud() {
    const heartbeat = await getHeartbeat();

    return {
        cloudVersion: heartbeat.cloudVersion || heartbeat.cloud_version || null,
        apiStatus: heartbeat.apiStatus || heartbeat.api_status || heartbeat.status || CLOUD_STATUS.CONNECTED,
        lastSync: heartbeat.lastSync || heartbeat.last_sync || heartbeat.timestamp || null
    };
}

export async function getProducts() {
    return requestCloud("products");
}

export async function getProduct(productId) {
    return requestCloud("product", { productId });
}

export async function getReleases() {
    return requestCloud("releases");
}
