export const auroraCloud = {
    apiBaseUrl: import.meta.env.VITE_AURORA_CLOUD_API_BASE || import.meta.env.VITE_API_BASE_URL || "",
    environment: import.meta.env.MODE,
    version: "api/v1",
    timeout: 5000,
    retryCount: 2,
    retryDelay: 300,
    offlineMode: false,
    endpoints: {
        heartbeat: "/heartbeat",
        status: "/status",
        performance: "/performance",
        liveProduct: "/live/:productId",
        products: "/products",
        product: "/products/:productId",
        releases: "/releases"
    }
};

export function getCloudEndpoint(key, params = {}) {
    const endpoint = auroraCloud.endpoints[key];

    if (!endpoint) {
        throw new Error(`Unknown Aurora Cloud endpoint: ${key}`);
    }

    const resolvedEndpoint = Object.entries(params).reduce(
        (path, [paramKey, paramValue]) => path.replace(`:${paramKey}`, encodeURIComponent(paramValue)),
        endpoint
    );

    return `${auroraCloud.apiBaseUrl}/${auroraCloud.version}${resolvedEndpoint}`;
}
