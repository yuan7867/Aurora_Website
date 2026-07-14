export const commerceProducts = {
    "aurora-monthly": {
        productId: "aurora-monthly",
        licenseProductId: "AURORA-MT5-AI",
        name: "Aurora Monthly",
        price: "19.90",
        currency: "USD",
        downloadKey: "MT5"
    },
    "aurora-yearly": {
        productId: "aurora-yearly",
        licenseProductId: "AURORA-MT5-AI",
        name: "Aurora Yearly",
        price: "199.00",
        currency: "USD",
        downloadKey: "MT5"
    },
    "aurora-mt5-ai": {
        productId: "aurora-mt5-ai",
        licenseProductId: "AURORA-MT5-AI",
        name: "Aurora MT5 AI Trader",
        price: "499.00",
        currency: "USD",
        downloadKey: "MT5"
    },
    "aurora-xau-trader": {
        productId: "aurora-xau-trader",
        licenseProductId: "AURORA-XAU-AI",
        name: "Aurora XAU Trader",
        price: "899.00",
        currency: "USD",
        downloadKey: "XAU"
    }
};

export function getCommerceProduct(productId) {
    const product = commerceProducts[productId];

    if (!product) {
        throw new Error(`Unsupported commerce product: ${productId || "unknown"}`);
    }

    return product;
}
