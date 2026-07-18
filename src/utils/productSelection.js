export const commerceProducts = [
    {
        id: "aurora-mt5",
        name: "Aurora MT5 AI Trader",
        profile: "Professional AI Gold Trading Platform",
        summary: "Built for disciplined traders who value precision, capital protection and long-term consistency.",
        skuPrefix: "aurora-mt5"
    },
    {
        id: "aurora-xau",
        name: "Aurora XAU Trader",
        profile: "Advanced AI Gold Momentum Platform",
        summary: "Designed for experienced traders seeking faster execution, stronger momentum capture and higher trading flexibility.",
        skuPrefix: "aurora-xau"
    }
];

export const subscriptions = [
    {
        id: "monthly",
        name: "Monthly",
        price: "USD 19.90",
        note: "Flexible Monthly Access",
        billing: "Billed monthly"
    },
    {
        id: "yearly",
        name: "Yearly",
        price: "USD 199",
        note: "Best Value For Professionals",
        billing: "Yearly Save 17%"
    }
];

export const checkoutProducts = {
    "aurora-mt5-monthly": {
        name: "Aurora MT5 AI Trader",
        strategy: "Conservative Strategy",
        summary: "Disciplined MT5 execution for long-term traders.",
        subscription: "Monthly",
        price: "USD 19.90",
        license: "Monthly subscription",
        productId: "aurora-mt5",
        planId: "monthly"
    },
    "aurora-mt5-yearly": {
        name: "Aurora MT5 AI Trader",
        strategy: "Conservative Strategy",
        summary: "Disciplined MT5 execution for long-term traders.",
        subscription: "Yearly",
        price: "USD 199",
        license: "Yearly subscription. Save 17%",
        productId: "aurora-mt5",
        planId: "yearly"
    },
    "aurora-xau-monthly": {
        name: "Aurora XAU Trader",
        strategy: "Aggressive Strategy",
        summary: "Active XAU strategy for maximum opportunity.",
        subscription: "Monthly",
        price: "USD 19.90",
        license: "Monthly subscription",
        productId: "aurora-xau",
        planId: "monthly"
    },
    "aurora-xau-yearly": {
        name: "Aurora XAU Trader",
        strategy: "Aggressive Strategy",
        summary: "Active XAU strategy for maximum opportunity.",
        subscription: "Yearly",
        price: "USD 199",
        license: "Yearly subscription. Save 17%",
        productId: "aurora-xau",
        planId: "yearly"
    }
};

function readSalesFlag(value) {
    return String(value || "").toLowerCase() === "true";
}

export function getProductSalesEnabled(productId, env = import.meta.env || {}) {
    const normalizedProductId = normalizeProductId(productId);

    if (normalizedProductId === "aurora-mt5") {
        return readSalesFlag(env.VITE_MT5_SALES_ENABLED);
    }

    if (normalizedProductId === "aurora-xau") {
        return readSalesFlag(env.VITE_XAU_SALES_ENABLED);
    }

    return false;
}

export function normalizeProductId(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "mt5") {
        return "aurora-mt5";
    }

    if (normalized === "xau" || normalized === "xau-martingale") {
        return "aurora-xau";
    }

    return commerceProducts.some((product) => product.id === normalized) ? normalized : "";
}

export function normalizePlanId(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return subscriptions.some((subscription) => subscription.id === normalized) ? normalized : "yearly";
}

export function buildSku(productId, planId) {
    const normalizedProductId = normalizeProductId(productId);
    const normalizedPlanId = normalizePlanId(planId);
    const product = commerceProducts.find((item) => item.id === normalizedProductId);

    return product ? `${product.skuPrefix}-${normalizedPlanId}` : "";
}

export function readSelection(search) {
    const params = new URLSearchParams(search || "");
    const sku = params.get("sku");

    if (sku && checkoutProducts[sku]) {
        return {
            productId: checkoutProducts[sku].productId,
            planId: checkoutProducts[sku].planId,
            sku
        };
    }

    const productId = normalizeProductId(params.get("product"));
    const planId = normalizePlanId(params.get("plan"));

    return {
        productId,
        planId,
        sku: productId ? buildSku(productId, planId) : ""
    };
}

export function buildPricingHref(productId, planId = "yearly") {
    const normalizedProductId = normalizeProductId(productId);

    if (!normalizedProductId) {
        return "/pricing";
    }

    return `/pricing?product=${encodeURIComponent(normalizedProductId)}&plan=${encodeURIComponent(normalizePlanId(planId))}`;
}

export function buildCheckoutHref(productId, planId) {
    const sku = buildSku(productId, planId);

    if (!sku) {
        return "";
    }

    return `/checkout?product=${encodeURIComponent(normalizeProductId(productId))}&plan=${encodeURIComponent(normalizePlanId(planId))}&sku=${encodeURIComponent(sku)}`;
}

export function getCheckoutProduct(sku) {
    return checkoutProducts[sku] || null;
}

export function canCreatePayPalSubscription(sku, env = import.meta.env || {}) {
    const product = getCheckoutProduct(sku);
    return Boolean(product && getProductSalesEnabled(product.productId, env));
}
