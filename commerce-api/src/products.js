export const commerceProducts = {
    "aurora-mt5-monthly": {
        productId: "aurora-mt5-monthly",
        name: "Aurora MT5 AI Trader Monthly",
        price: "19.90",
        currency: "USD",
        licenseProductId: "AURORA-MT5-AI",
        plan: "monthly",
        durationDays: 30,
        productFamily: "MT5",
        downloadProduct: "MT5",
        billingCycle: "MONTH",
        paymentMode: "subscription"
    },
    "aurora-mt5-yearly": {
        productId: "aurora-mt5-yearly",
        name: "Aurora MT5 AI Trader Yearly",
        price: "199.00",
        currency: "USD",
        licenseProductId: "AURORA-MT5-AI",
        plan: "yearly",
        durationDays: 365,
        productFamily: "MT5",
        downloadProduct: "MT5",
        billingCycle: "YEAR",
        paymentMode: "subscription"
    },
    "aurora-xau-monthly": {
        productId: "aurora-xau-monthly",
        name: "XAU Martingale Monthly",
        price: "19.90",
        currency: "USD",
        licenseProductId: "AURORA-XAU-AI",
        plan: "monthly",
        durationDays: 30,
        productFamily: "XAU",
        downloadProduct: "XAU",
        billingCycle: "MONTH",
        paymentMode: "subscription"
    },
    "aurora-xau-yearly": {
        productId: "aurora-xau-yearly",
        name: "XAU Martingale Yearly",
        price: "199.00",
        currency: "USD",
        licenseProductId: "AURORA-XAU-AI",
        plan: "yearly",
        durationDays: 365,
        productFamily: "XAU",
        downloadProduct: "XAU",
        billingCycle: "YEAR",
        paymentMode: "subscription"
    }
};

const retiredProductIds = new Set([
    "aurora-monthly",
    "aurora-yearly",
    "aurora-mt5-ai",
    "aurora-xau-trader"
]);

export function getCommerceProduct(productId) {
    const normalizedProductId = String(productId || "").trim();
    const product = commerceProducts[normalizedProductId];

    if (product) {
        return product;
    }

    if (retiredProductIds.has(normalizedProductId)) {
        const error = new Error(`Retired product is not available: ${normalizedProductId}`);
        error.code = "PRODUCT_NOT_AVAILABLE";
        error.statusCode = 503;
        throw error;
    }

    throw new Error(`Unsupported commerce product: ${normalizedProductId || "unknown"}`);
}

export function isProductSalesEnabled(product, config) {
    if (product.productFamily === "MT5") {
        return config.mt5SalesEnabled;
    }

    if (product.productFamily === "XAU") {
        return config.xauSalesEnabled;
    }

    return false;
}

export function getPayPalPlanId(product, config) {
    return config.paypalPlanIds?.[product.productId] || "";
}

export function assertProductSubscriptionAvailable(product, config) {
    if (!isProductSalesEnabled(product, config)) {
        const error = new Error("This Aurora product is temporarily unavailable.");
        error.code = "PRODUCT_NOT_AVAILABLE";
        error.statusCode = 503;
        throw error;
    }

    if (!getPayPalPlanId(product, config)) {
        const error = new Error("PayPal subscription plan is not configured for this product.");
        error.code = "PAYPAL_PLAN_NOT_CONFIGURED";
        error.statusCode = 503;
        throw error;
    }
}

export function getProductByPayPalPlanId(planId, config) {
    const entry = Object.entries(config.paypalPlanIds || {}).find(([, value]) => value && value === planId);
    return entry ? getCommerceProduct(entry[0]) : null;
}
