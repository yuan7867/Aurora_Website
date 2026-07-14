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

export async function createPayPalOrder({ productId, customer }) {
    return requestCommerce("/paypal/orders", {
        method: "POST",
        body: JSON.stringify({ productId, customer })
    });
}

export async function capturePayPalOrder(orderId) {
    return requestCommerce(`/paypal/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST"
    });
}

export async function getCustomer() {
    return requestCommerce("/customer");
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
