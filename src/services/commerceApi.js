const commerceBaseUrl = import.meta.env.VITE_COMMERCE_API_BASE || "/commerce";

async function requestCommerce(path, options = {}) {
    const token = globalThis.localStorage?.getItem("auroraJwt");
    const response = await fetch(`${commerceBaseUrl}${path}`, {
        headers: {
            "content-type": "application/json",
            accept: "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        },
        ...options
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data?.message || `Commerce request failed with status ${response.status}`);
    }

    return data;
}

export async function createPayPalSubscription({ productId, customer }) {
    return requestCommerce("/paypal/subscriptions", {
        method: "POST",
        body: JSON.stringify({ productId, customer })
    });
}

export async function getPayPalSubscriptionStatus(subscriptionId) {
    return requestCommerce(`/paypal/subscriptions/${encodeURIComponent(subscriptionId)}/status`);
}

export async function cancelPayPalSubscription(subscriptionId) {
    return requestCommerce(`/paypal/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
        method: "POST"
    });
}

export async function getCustomer() {
    return requestCommerce("/customer");
}

export async function getCustomerDownloads() {
    return requestCommerce("/customer/downloads");
}

export async function createDownloadToken(productId) {
    return requestCommerce(`/customer/downloads/${encodeURIComponent(productId)}/token`, {
        method: "POST"
    });
}

export async function registerCustomer(payload) {
    return requestCommerce("/identity/register", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

export async function loginCustomer(payload) {
    return requestCommerce("/identity/login", {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

export async function verifyEmail(token) {
    return requestCommerce("/identity/verify-email", {
        method: "POST",
        body: JSON.stringify({ token })
    });
}

export async function forgotPassword(email) {
    return requestCommerce("/identity/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
    });
}

export async function resetPassword({ token, password }) {
    return requestCommerce("/identity/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password })
    });
}
