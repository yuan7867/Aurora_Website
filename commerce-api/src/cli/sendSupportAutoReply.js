import { stdin } from "node:process";

import { sendResendEmail } from "../dispatchers/emailDispatcher.js";

function readStdin() {
    return new Promise((resolve, reject) => {
        let data = "";
        stdin.setEncoding("utf8");
        stdin.on("data", (chunk) => {
            data += chunk;
        });
        stdin.on("end", () => resolve(data));
        stdin.on("error", reject);
    });
}

const input = JSON.parse(await readStdin());

const result = await sendResendEmail({
    idempotencyKey: input.idempotencyKey,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    from: process.env.SUPPORT_AUTO_REPLY_FROM || "Aurora HY Support <support@mail.aurorahy.com>",
    replyTo: process.env.SUPPORT_AUTO_REPLY_REPLY_TO || "support@aurorahy.com"
});

console.log(JSON.stringify({
    status: result.status,
    id: result.id || ""
}));
