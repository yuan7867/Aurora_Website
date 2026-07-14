import { getDownloadLink } from "../dispatchers/downloadDispatcher.js";
import { sendLicenseEmail } from "../dispatchers/emailDispatcher.js";
import { dispatchLicenseRequest } from "../dispatchers/productDispatcher.js";
import { getCommerceProduct } from "../products.js";
import { hasProcessedPayment, savePurchase } from "../storage/customerStore.js";
import { createActivationForCustomer } from "./identityService.js";

export async function completePurchase({ productId, customer, paypal }) {
    const product = getCommerceProduct(productId);
    const paymentId = paypal.captureId || paypal.orderId || paypal.eventId;

    if (!paymentId) {
        throw new Error("PayPal payment id is required.");
    }

    if (await hasProcessedPayment(paymentId)) {
        return {
            status: "already_processed",
            product
        };
    }

    const license = await dispatchLicenseRequest(product.licenseProductId, {
        paypal,
        customer,
        productId: product.licenseProductId
    });
    const downloadLink = getDownloadLink(product.licenseProductId);
    const emailResult = await sendLicenseEmail({
        customer,
        productId: product.licenseProductId,
        license,
        downloadLink
    });
    const customerRecord = await savePurchase({
        customer,
        product,
        paypal: {
            ...paypal,
            paymentId
        },
        license,
        downloadLink,
        emailResult
    });
    const activatedCustomer = await createActivationForCustomer(customerRecord);

    return {
        status: "completed",
        customer: activatedCustomer,
        product,
        license,
        downloadLink,
        email: emailResult
    };
}
