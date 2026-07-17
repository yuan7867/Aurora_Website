import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { config } from "../config.js";
import { sendIdentityEmail } from "../dispatchers/emailDispatcher.js";
import {
    consumeCustomerToken,
    createCustomerIfMissing,
    createCustomerToken,
    getCustomer,
    hasActiveCustomerToken,
    normalizeEmail,
    saveCustomer
} from "../storage/customerStore.js";

const tokenTtlMs = 1000 * 60 * 60 * 24;
const jwtTtlSeconds = 60 * 60 * 24 * 7;

function assertPassword(password) {
    if (String(password || "").length < 8) {
        const error = new Error("Password must be at least 8 characters.");
        error.statusCode = 400;
        throw error;
    }
}

const rateLimits = new Map();

function assertRateLimit(key, limit, windowMs) {
    const now = Date.now();
    const existing = rateLimits.get(key) || [];
    const recent = existing.filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= limit) {
        const error = new Error("Too many requests. Please try again later.");
        error.statusCode = 429;
        throw error;
    }

    recent.push(now);
    rateLimits.set(key, recent);
}

function base64url(input) {
    return Buffer.from(input).toString("base64url");
}

function sign(value) {
    return createHmac("sha256", config.jwtSecret).update(value).digest("base64url");
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
    if (!passwordHash) {
        return false;
    }

    const [salt, storedHash] = passwordHash.split(":");
    const hash = scryptSync(password, salt, 64);
    const stored = Buffer.from(storedHash, "hex");
    return stored.length === hash.length && timingSafeEqual(stored, hash);
}

function createToken() {
    return randomBytes(32).toString("base64url");
}

function sanitizeCustomer(customer) {
    if (!customer) {
        return null;
    }

    const {
        passwordHash: _passwordHash,
        activationToken: _activationToken,
        activationExpiresAt: _activationExpiresAt,
        resetToken: _resetToken,
        resetExpiresAt: _resetExpiresAt,
        ...safeCustomer
    } = customer;
    return safeCustomer;
}

export function createJwt(customer) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(JSON.stringify({
        sub: customer.email,
        email: customer.email,
        name: customer.name,
        iat: issuedAt,
        pwd: Math.floor(new Date(customer.passwordChangedAt || Date.now()).getTime() / 1000),
        exp: issuedAt + jwtTtlSeconds
    }));
    const unsigned = `${header}.${payload}`;
    return `${unsigned}.${sign(unsigned)}`;
}

export function verifyJwt(token) {
    if (!token) {
        throw new Error("JWT is required.");
    }

    const [header, payload, signature] = token.split(".");
    const unsigned = `${header}.${payload}`;

    if (sign(unsigned) !== signature) {
        throw new Error("Invalid JWT signature.");
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (data.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("JWT expired.");
    }

    return data;
}

export async function registerCustomer({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    assertRateLimit(`register:${normalizedEmail}`, 5, 60 * 60 * 1000);
    assertPassword(password);

    if (!normalizedEmail) {
        const error = new Error("Customer email is required.");
        error.statusCode = 400;
        throw error;
    }

    const existing = await getCustomer(normalizedEmail);

    if (existing?.passwordHash) {
        throw new Error("Customer already exists.");
    }

    const customer = await createCustomerIfMissing({
        email: normalizedEmail,
        name: name || existing?.name || "Aurora Customer",
        passwordHash: hashPassword(password),
        status: "verification_required",
        emailVerified: false,
        products: existing?.products || [],
        licenses: existing?.licenses || [],
        downloads: existing?.downloads || [],
        orders: existing?.orders || []
    });
    const activationToken = createToken();
    await createCustomerToken({
        email: customer.email,
        purpose: "email_verification",
        token: activationToken,
        expiresAt: new Date(Date.now() + tokenTtlMs).toISOString()
    });

    await sendIdentityEmail({
        customer,
        type: "email-verification",
        token: activationToken
    });

    return sanitizeCustomer(customer);
}

export async function loginCustomer({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    assertRateLimit(`login:${normalizedEmail}`, 10, 15 * 60 * 1000);
    const customer = await getCustomer(normalizedEmail);

    if (!customer || !verifyPassword(password, customer.passwordHash)) {
        throw new Error("Invalid email or password.");
    }

    if (customer.status === "disabled" || customer.disabledAt) {
        throw new Error("Customer account is disabled.");
    }

    if (!customer.emailVerified) {
        throw new Error("Email verification required.");
    }

    return {
        token: createJwt(customer),
        customer: sanitizeCustomer(customer)
    };
}

export async function verifyCustomerEmail(token) {
    const consumed = await consumeCustomerToken({
        token,
        purposes: ["email_verification"]
    });
    const customer = consumed?.customer;

    if (!customer) {
        throw new Error("Activation token is invalid or expired.");
    }

    const saved = await saveCustomer({
        ...customer,
        status: "active",
        emailVerified: true
    });

    return {
        token: createJwt(saved),
        customer: sanitizeCustomer(saved)
    };
}

export async function requestPasswordReset(email) {
    const normalizedEmail = normalizeEmail(email);
    assertRateLimit(`forgot:${normalizedEmail}`, 5, 60 * 60 * 1000);
    const customer = await getCustomer(normalizedEmail);

    if (!customer) {
        return { status: "ok" };
    }

    const resetToken = createToken();
    await createCustomerToken({
        email: customer.email,
        purpose: "password_reset",
        token: resetToken,
        expiresAt: new Date(Date.now() + tokenTtlMs).toISOString()
    });

    await sendIdentityEmail({
        customer,
        type: "password-reset",
        token: resetToken
    });

    return { status: "ok" };
}

export async function resetPassword({ token, password }) {
    assertPassword(password);

    const consumed = await consumeCustomerToken({
        token,
        purposes: ["password_reset", "activation"]
    });
    const customer = consumed?.customer;

    if (!customer) {
        throw new Error("Reset token is invalid or expired.");
    }

    const saved = await saveCustomer({
        ...customer,
        passwordHash: hashPassword(password),
        status: "active",
        emailVerified: true,
        resetToken: null,
        resetExpiresAt: null
    });

    return {
        token: createJwt(saved),
        customer: sanitizeCustomer(saved)
    };
}

export async function getAuthenticatedCustomer(authHeader) {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
    const payload = verifyJwt(token);
    const customer = await getCustomer(payload.email);

    if (!customer) {
        throw new Error("Customer session not found.");
    }
    if (customer.status === "disabled" || customer.disabledAt) {
        throw new Error("Customer account is disabled.");
    }
    const tokenPasswordTime = Number(payload.pwd || payload.iat || 0);
    const currentPasswordTime = Math.floor(new Date(customer.passwordChangedAt || 0).getTime() / 1000);
    if (currentPasswordTime > tokenPasswordTime) {
        throw new Error("Customer session expired after password change.");
    }

    return sanitizeCustomer(customer);
}

export async function createActivationForCustomer(customer) {
    if (customer.passwordHash && customer.emailVerified) {
        return customer;
    }
    if (await hasActiveCustomerToken({ email: customer.email, purpose: "activation" })) {
        return customer;
    }

    const activationToken = createToken();
    const expiresAt = new Date(Date.now() + tokenTtlMs).toISOString();
    const saved = await saveCustomer({
        ...customer,
        status: "activation_required",
        emailVerified: false
    });
    await createCustomerToken({
        email: saved.email,
        purpose: "activation",
        token: activationToken,
        expiresAt
    });

    await sendIdentityEmail({
        customer: saved,
        type: "activation",
        token: activationToken
    });

    return saved;
}
