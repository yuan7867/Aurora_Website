export async function readRawBody(request) {
    const chunks = [];

    for await (const chunk of request) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

export function parseJsonBody(rawBody) {
    if (!rawBody) {
        return {};
    }

    return JSON.parse(rawBody);
}

export async function readJsonBody(request) {
    const rawBody = await readRawBody(request);

    if (!rawBody) {
        return {};
    }

    return JSON.parse(rawBody);
}

export function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,paypal-auth-algo,paypal-cert-url,paypal-transmission-id,paypal-transmission-sig,paypal-transmission-time",
        "content-type": "application/json"
    });
    response.end(JSON.stringify(payload));
}

export async function postJson(url, payload, token) {
    if (!url) {
        throw new Error("Target API URL is not configured.");
    }

    const headers = {
        "content-type": "application/json",
        accept: "application/json"
    };

    if (token) {
        headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(data?.message || `Request failed with status ${response.status}`);
    }

    return data;
}
