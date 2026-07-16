import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { commerceRouter } from "../src/router.js";

function makeJsonRequest({ method, url, body }) {
    const request = Readable.from([Buffer.from(JSON.stringify(body || {}))]);
    request.method = method;
    request.url = url;
    request.headers = {};
    return request;
}

function makeResponse() {
    const chunks = [];
    return {
        statusCode: 0,
        writeHead(statusCode) {
            this.statusCode = statusCode;
        },
        end(chunk) {
            if (chunk) {
                chunks.push(chunk);
            }
            this.body = chunks.join("");
        }
    };
}

test("official subscription SKUs cannot use legacy PayPal order checkout", async () => {
    for (const productId of ["aurora-mt5-monthly", "aurora-mt5-yearly", "aurora-xau-monthly", "aurora-xau-yearly"]) {
        const request = makeJsonRequest({
            method: "POST",
            url: "/paypal/orders",
            body: { productId }
        });
        const response = makeResponse();

        await commerceRouter(request, response);

        assert.equal(response.statusCode, 410);
        assert.equal(JSON.parse(response.body).code, "SUBSCRIPTION_REQUIRED");
    }
});
