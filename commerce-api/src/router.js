import { timingSafeEqual } from "node:crypto";

import { handlePayPalWebhook } from "./handlers/webhookHandler.js";
import { capturePayPalOrder, createPayPalOrder } from "./clients/paypalClient.js";
import { config } from "./config.js";
import { getCommerceProduct, isProductSalesEnabled } from "./products.js";
import { completePurchase, revealLicenseForCustomer } from "./services/purchaseService.js";
import {
    cancelOwnedSubscription,
    createSubscriptionCheckout,
    getSafeSubscriptionStatus
} from "./services/subscriptionService.js";
import {
    getAuthenticatedCustomer,
    loginCustomer,
    registerCustomer,
    requestPasswordReset,
    resetPassword,
    verifyCustomerEmail
} from "./services/identityService.js";
import {
    getHeartbeatData,
    getLiveTradingProductData,
    getPerformanceData,
    getStatusData,
    saveLiveTradingData
} from "./services/liveTradingService.js";
import { processSupportInboundEmail } from "./services/supportGatewayService.js";
import { parseJsonBody, readJsonBody, readRawBody, sendJson } from "./utils/http.js";

function getHeaders(request) {
    return Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value])
    );
}

function readCapture(capturePayload) {
    const purchaseUnit = capturePayload?.purchase_units?.[0] || {};
    const capture = purchaseUnit?.payments?.captures?.[0] || {};
    const productId = purchaseUnit.custom_id || capture.custom_id || "";
    const amount = capture?.amount || purchaseUnit?.amount || {};
    const customer = {
        email: capturePayload?.payer?.email_address || "",
        name: capturePayload?.payer?.name?.given_name
            ? `${capturePayload.payer.name.given_name} ${capturePayload.payer.name.surname || ""}`.trim()
            : "Aurora Customer"
    };

    return {
        productId,
        customer,
        paypal: {
            orderId: capturePayload.id,
            captureId: capture.id,
            status: capture.status || capturePayload.status || "",
            amount: amount.value || "",
            currency: amount.currency_code || "",
            customId: productId
        }
    };
}

function readBearerToken(request) {
    const authorization = request.headers.authorization || "";

    if (authorization.toLowerCase().startsWith("bearer ")) {
        return authorization.slice(7).trim();
    }

    return request.headers["x-aurora-token"] || "";
}

function assertCloudIngestAuthorized(request) {
    if (!config.auroraCloudIngestToken) {
        const error = new Error("Aurora Cloud ingest token is not configured.");
        error.statusCode = 503;
        throw error;
    }

    if (!constantTimeEquals(readBearerToken(request), config.auroraCloudIngestToken)) {
        const error = new Error("Aurora Cloud ingest request is unauthorized.");
        error.statusCode = 401;
        throw error;
    }
}

function assertSupportGatewayAuthorized(request) {
    if (!config.supportGatewayToken) {
        const error = new Error("Support Gateway token is not configured.");
        error.statusCode = 503;
        throw error;
    }

    if (!constantTimeEquals(readBearerToken(request), config.supportGatewayToken)) {
        const error = new Error("Support Gateway request is unauthorized.");
        error.statusCode = 401;
        throw error;
    }
}

function constantTimeEquals(actual, expected) {
    const actualBuffer = Buffer.from(String(actual || ""), "utf8");
    const expectedBuffer = Buffer.from(String(expected || ""), "utf8");

    if (actualBuffer.length !== expectedBuffer.length) {
        timingSafeEqual(expectedBuffer, expectedBuffer);
        return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
}

function sendIdentityError(response, error) {
    sendJson(response, error.statusCode || 400, {
        status: "error",
        message: error.message
    });
}

async function sendCloudData(response, loader) {
    try {
        const data = await loader();
        sendJson(response, 200, {
            success: true,
            data
        });
    } catch (error) {
        sendJson(response, error.statusCode || 500, {
            success: false,
            error: {
                message: error.message
            }
        });
    }
}

export async function commerceRouter(request, response) {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "OPTIONS") {
        sendJson(response, 204, {});
        return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
            status: "ok",
            service: "aurora-commerce-api",
            supportGateway: "ready"
        });
        return;
    }

    if (request.method === "POST" && url.pathname === "/support/inbound") {
        try {
            assertSupportGatewayAuthorized(request);
            const payload = await readJsonBody(request);
            const result = await processSupportInboundEmail({
                payload
            });
            sendJson(response, 200, {
                status: "ok",
                supportGateway: result
            });
        } catch (error) {
            sendJson(response, error.statusCode || 500, {
                status: "error",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/heartbeat") {
        await sendCloudData(response, getHeartbeatData);
        return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/status") {
        await sendCloudData(response, getStatusData);
        return;
    }

    if (request.method === "GET" && url.pathname === "/api/v1/performance") {
        await sendCloudData(response, getPerformanceData);
        return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/v1/live/")) {
        const productId = decodeURIComponent(url.pathname.split("/").pop() || "");
        await sendCloudData(response, () => getLiveTradingProductData(productId));
        return;
    }

    if (request.method === "POST" && url.pathname === "/api/v1/mt5/battle-test") {
        try {
            assertCloudIngestAuthorized(request);
            const payload = await readJsonBody(request);
            const data = await saveLiveTradingData(payload, "mt5");
            sendJson(response, 200, {
                success: true,
                data
            });
        } catch (error) {
            sendJson(response, error.statusCode || 500, {
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        return;
    }

    if (
        request.method === "POST"
        && (url.pathname === "/api/v1/xau/battle-test" || url.pathname === "/api/v1/xau/live-snapshot")
    ) {
        try {
            assertCloudIngestAuthorized(request);
            const payload = await readJsonBody(request);
            const data = await saveLiveTradingData(payload, "xau");
            sendJson(response, 200, {
                success: true,
                data
            });
        } catch (error) {
            sendJson(response, error.statusCode || 500, {
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        return;
    }

    if (request.method === "GET" && url.pathname === "/customer") {
        try {
            const customer = await getAuthenticatedCustomer(request.headers.authorization);
            sendJson(response, 200, {
                status: "ok",
                customer
            });
        } catch (error) {
            sendJson(response, 401, {
                status: "unauthorized",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/customer/licenses/")) {
        try {
            const customer = await getAuthenticatedCustomer(request.headers.authorization);
            const productId = decodeURIComponent(url.pathname.split("/").pop() || "");
            const license = await revealLicenseForCustomer({
                email: customer.email,
                productId
            });
            sendJson(response, 200, {
                status: "ok",
                license
            });
        } catch (error) {
            sendJson(response, error.statusCode || 401, {
                status: "error",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/identity/register") {
        try {
            const payload = await readJsonBody(request);
            const customer = await registerCustomer(payload);
            sendJson(response, 200, {
                status: "verification_required",
                customer
            });
        } catch (error) {
            sendIdentityError(response, error);
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/identity/login") {
        try {
            const payload = await readJsonBody(request);
            const result = await loginCustomer(payload);
            sendJson(response, 200, {
                status: "ok",
                ...result
            });
        } catch (error) {
            error.statusCode = error.statusCode || 401;
            sendIdentityError(response, error);
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/identity/verify-email") {
        try {
            const payload = await readJsonBody(request);
            const result = await verifyCustomerEmail(payload.token);
            sendJson(response, 200, {
                status: "ok",
                ...result
            });
        } catch (error) {
            sendIdentityError(response, error);
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/identity/forgot-password") {
        try {
            const payload = await readJsonBody(request);
            const result = await requestPasswordReset(payload.email);
            sendJson(response, 200, result);
        } catch (error) {
            sendIdentityError(response, error);
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/identity/reset-password") {
        try {
            const payload = await readJsonBody(request);
            const result = await resetPassword(payload);
            sendJson(response, 200, {
                status: "ok",
                ...result
            });
        } catch (error) {
            sendIdentityError(response, error);
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/paypal/orders") {
        try {
            const payload = await readJsonBody(request);
            const product = getCommerceProduct(payload.productId);

            if (product.paymentMode === "subscription") {
                sendJson(response, 410, {
                    status: "disabled",
                    code: "SUBSCRIPTION_REQUIRED",
                    message: "This product requires PayPal subscription checkout."
                });
                return;
            }

            if (!isProductSalesEnabled(product, config)) {
                sendJson(response, 503, {
                    status: "unavailable",
                    code: "PRODUCT_NOT_AVAILABLE",
                    message: "This Aurora product is temporarily unavailable."
                });
                return;
            }

            const order = await createPayPalOrder({
                product,
                customer: payload.customer || {}
            });

            sendJson(response, 200, {
                status: "created",
                environment: config.paypalEnvironment,
                orderId: order.id,
                approveUrl: order.links?.find((link) => link.rel === "approve")?.href || null
            });
        } catch (error) {
            sendJson(response, error.statusCode || 400, {
                status: "error",
                code: error.code || "CHECKOUT_ERROR",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/paypal/subscriptions") {
        try {
            const payload = await readJsonBody(request);
            const result = await createSubscriptionCheckout({
                productId: payload.productId,
                customer: payload.customer || {}
            });
            sendJson(response, 200, result);
        } catch (error) {
            sendJson(response, error.statusCode || 400, {
                status: "error",
                code: error.code || "SUBSCRIPTION_ERROR",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/paypal/subscriptions/") && url.pathname.endsWith("/status")) {
        try {
            const [, , , subscriptionId] = url.pathname.split("/");
            const result = await getSafeSubscriptionStatus(subscriptionId);
            sendJson(response, 200, {
                status: "ok",
                subscription: result
            });
        } catch (error) {
            sendJson(response, error.statusCode || 400, {
                status: "error",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/paypal/subscriptions/") && url.pathname.endsWith("/cancel")) {
        try {
            const [, , , subscriptionId] = url.pathname.split("/");
            const result = await cancelOwnedSubscription({
                authorization: request.headers.authorization,
                subscriptionId
            });
            sendJson(response, 200, result);
        } catch (error) {
            sendJson(response, error.statusCode || 400, {
                status: "error",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "POST" && url.pathname.startsWith("/paypal/orders/") && url.pathname.endsWith("/capture")) {
        const [, , , orderId] = url.pathname.split("/");
        try {
            const capture = await capturePayPalOrder(orderId);
            const purchase = readCapture(capture);
            const result = await completePurchase(purchase);

            sendJson(response, 200, {
                status: result.status,
                capture,
                result
            });
        } catch (error) {
            sendJson(response, error.statusCode || 400, {
                status: "error",
                code: error.code || "CAPTURE_ERROR",
                message: error.message
            });
        }
        return;
    }

    if (request.method === "POST" && url.pathname === "/paypal/webhook") {
        try {
            const rawBody = await readRawBody(request);
            const payload = parseJsonBody(rawBody);
            const result = await handlePayPalWebhook({
                headers: getHeaders(request),
                rawBody,
                event: payload
            });
            sendJson(response, 200, result);
        } catch (error) {
            sendJson(response, 400, {
                status: "error",
                message: error.message
            });
        }
        return;
    }

    sendJson(response, 404, {
        status: "not_found"
    });
}
