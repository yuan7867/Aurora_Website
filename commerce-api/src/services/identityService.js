import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { config } from "../config.js";
import { sendIdentityEmail } from "../dispatchers/emailDispatcher.js";
import { getCustomer, saveCustomer } from "../storage/customerStore.js";

const tokenTtlMs = 1000 * 60 * 60 * 24;
const jwtTtlSeconds = 60 * 60 * 24 * 7;

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function assertPassword(password) {
    if (String(password || "").length < 8) {
        const error = new Error("Password must be at least 8 characters.");
        error.statusCode = 400;
        throw error;
    }
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
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(JSON.stringify({
        sub: customer.email,
        email: customer.email,
        name: customer.name,
        exp: Math.floor(Date.now() / 1000) + jwtTtlSeconds
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

    const activationToken = createToken();
    const customer = await saveCustomer({
        ...(existing || {}),
        email: normalizedEmail,
        name: name || existing?.name || "Aurora Customer",
        passwordHash: hashPassword(password),
        status: "verification_required",
        emailVerified: false,
        activationToken,
        activationExpiresAt: new Date(Date.now() + tokenTtlMs).toISOString(),
        products: existing?.products || [],
        licenses: existing?.licenses || [],
        downloads: existing?.downloads || [],
        orders: existing?.orders || []
    });

    await sendIdentityEmail({
        customer,
        type: "email-verification",
        token: activationToken
    });

    return sanitizeCustomer(customer);
}

export async function loginCustomer({ email, password }) {
    const customer = await getCustomer(normalizeEmail(email));

    if (!customer || !verifyPassword(password, customer.passwordHash)) {
        throw new Error("Invalid email or password.");
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
    const customer = await findByToken("activationToken", token);

    if (!customer || new Date(customer.activationExpiresAt).getTime() < Date.now()) {
        throw new Error("Activation token is invalid or expired.");
    }

    const saved = await saveCustomer({
        ...customer,
        status: "active",
        emailVerified: true,
        activationToken: null,
        activationExpiresAt: null
    });

    return {
        token: createJwt(saved),
        customer: sanitizeCustomer(saved)
    };
}

export async function requestPasswordReset(email) {
    const customer = await getCustomer(normalizeEmail(email));

    if (!customer) {
        return { status: "ok" };
    }

    const resetToken = createToken();
    const saved = await saveCustomer({
        ...customer,
        resetToken,
        resetExpiresAt: new Date(Date.now() + tokenTtlMs).toISOString()
    });

    await sendIdentityEmail({
        customer: saved,
        type: "password-reset",
        token: resetToken
    });

    return { status: "ok" };
}

export async function resetPassword({ token, password }) {
    assertPassword(password);

    const customer = await findByToken("resetToken", token);

    if (!customer || new Date(customer.resetExpiresAt).getTime() < Date.now()) {
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

    return sanitizeCustomer(customer);
}

export async function createActivationForCustomer(customer) {
    if (customer.passwordHash && customer.emailVerified) {
        return customer;
    }

    const activationToken = createToken();
    const expiresAt = new Date(Date.now() + tokenTtlMs).toISOString();
    const saved = await saveCustomer({
        ...customer,
        status: "activation_required",
        emailVerified: false,
        activationToken,
        activationExpiresAt: expiresAt,
        resetToken: activationToken,
        resetExpiresAt: expiresAt
    });

    await sendIdentityEmail({
        customer: saved,
        type: "activation",
        token: activationToken
    });

    return saved;
}

async function findByToken(field, token) {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const file = join(config.dataDir, "customers.json");
    const store = JSON.parse(await readFile(file, "utf8"));
    return Object.values(store.customers || {}).find((customer) => customer[field] === token) || null;
}
