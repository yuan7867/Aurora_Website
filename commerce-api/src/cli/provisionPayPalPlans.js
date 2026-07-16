import { pathToFileURL } from "node:url";

const PAYPAL_PRODUCTS = [
    {
        key: "MT5",
        name: "Aurora MT5 AI Trader",
        productId: "AURORA-MT5-AI",
        plans: [
            {
                key: "MONTHLY",
                name: "Aurora MT5 AI Trader Monthly",
                envName: "PAYPAL_MT5_MONTHLY_PLAN_ID",
                price: "19.90",
                currency: "USD",
                intervalUnit: "MONTH"
            },
            {
                key: "YEARLY",
                name: "Aurora MT5 AI Trader Yearly",
                envName: "PAYPAL_MT5_YEARLY_PLAN_ID",
                price: "199.00",
                currency: "USD",
                intervalUnit: "YEAR"
            }
        ]
    },
    {
        key: "XAU",
        name: "Aurora XAU Trader",
        productId: "AURORA-XAU-AI",
        plans: [
            {
                key: "MONTHLY",
                name: "Aurora XAU Trader Monthly",
                envName: "PAYPAL_XAU_MONTHLY_PLAN_ID",
                price: "19.90",
                currency: "USD",
                intervalUnit: "MONTH"
            },
            {
                key: "YEARLY",
                name: "Aurora XAU Trader Yearly",
                envName: "PAYPAL_XAU_YEARLY_PLAN_ID",
                price: "199.00",
                currency: "USD",
                intervalUnit: "YEAR"
            }
        ]
    }
];

export function parseArgs(argv) {
    const flags = new Set(argv);
    const production = flags.has("--production");
    const confirm = flags.has("--confirm");

    if (production && !confirm) {
        const error = new Error("Production provisioning requires --production --confirm.");
        error.code = "PRODUCTION_CONFIRM_REQUIRED";
        throw error;
    }

    return {
        environment: production ? "production" : "sandbox",
        confirm,
        dryRun: !confirm
    };
}

export function getPayPalBaseUrl(environment) {
    return environment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}

export function getProvisioningCatalog() {
    return PAYPAL_PRODUCTS.map((product) => ({
        ...product,
        plans: product.plans.map((plan) => ({ ...plan }))
    }));
}

export function buildProductPayload(product) {
    return {
        name: product.name,
        type: "DIGITAL",
        category: "SOFTWARE",
        description: `${product.name} subscription product.`
    };
}

export function buildPlanPayload({ product, plan, paypalProductId }) {
    return {
        product_id: paypalProductId,
        name: plan.name,
        status: "ACTIVE",
        billing_cycles: [
            {
                frequency: {
                    interval_unit: plan.intervalUnit,
                    interval_count: 1
                },
                tenure_type: "REGULAR",
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                    fixed_price: {
                        value: plan.price,
                        currency_code: plan.currency
                    }
                }
            }
        ],
        payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee: {
                value: "0",
                currency_code: plan.currency
            },
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 2
        },
        taxes: {
            percentage: "0",
            inclusive: false
        },
        description: `${product.name} ${plan.intervalUnit.toLowerCase()} recurring subscription.`
    };
}

function assertCredentials(env) {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
        throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required.");
    }
}

async function requestJson({ url, method = "GET", token, body, requestId }) {
    const headers = {
        accept: "application/json"
    };

    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    if (body) {
        headers["content-type"] = "application/json";
    }
    if (requestId) {
        headers["paypal-request-id"] = requestId;
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(data?.message || `PayPal API failed with status ${response.status}`);
    }

    return data;
}

async function getAccessToken({ baseUrl, env }) {
    assertCredentials(env);

    const credentials = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            authorization: `Basic ${credentials}`,
            "content-type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error_description || "PayPal authentication failed.");
    }

    return data.access_token;
}

export async function provisionPayPalPlans({ options, env = process.env, log = console.log }) {
    const catalog = getProvisioningCatalog();
    const baseUrl = getPayPalBaseUrl(options.environment);

    log(`Environment: ${options.environment}`);
    log("Products and recurring plans:");
    for (const product of catalog) {
        log(`- ${product.name} (${product.productId})`);
        for (const plan of product.plans) {
            log(`  - ${plan.name}: ${plan.currency} ${plan.price}, ${plan.intervalUnit}/1, auto-renew`);
        }
    }

    if (options.dryRun) {
        log("Dry run only. Re-run with --confirm to create Sandbox plans.");
        return {
            dryRun: true,
            environment: options.environment,
            products: catalog
        };
    }

    const token = await getAccessToken({ baseUrl, env });
    const mapping = {};

    for (const product of catalog) {
        const paypalProduct = await requestJson({
            url: `${baseUrl}/v1/catalogs/products`,
            method: "POST",
            token,
            requestId: `aurora-${options.environment}-${product.productId}`,
            body: buildProductPayload(product)
        });

        for (const plan of product.plans) {
            const paypalPlan = await requestJson({
                url: `${baseUrl}/v1/billing/plans`,
                method: "POST",
                token,
                requestId: `aurora-${options.environment}-${product.productId}-${plan.key}`,
                body: buildPlanPayload({
                    product,
                    plan,
                    paypalProductId: paypalProduct.id
                })
            });
            mapping[plan.envName] = paypalPlan.id;
        }
    }

    log("Provisioning complete. Copy these values into the correct environment file manually:");
    for (const [name, value] of Object.entries(mapping)) {
        log(`${name}=${value}`);
    }

    return {
        dryRun: false,
        environment: options.environment,
        mapping
    };
}

async function main() {
    try {
        const options = parseArgs(process.argv.slice(2));
        await provisionPayPalPlans({ options });
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
