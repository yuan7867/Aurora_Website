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
        downloadProduct: "MT5"
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
        downloadProduct: "MT5"
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
        downloadProduct: "XAU"
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
        downloadProduct: "XAU"
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
