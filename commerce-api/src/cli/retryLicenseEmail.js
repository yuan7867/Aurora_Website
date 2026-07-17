import { fileURLToPath } from "node:url";

import { deliverLicenseEmail } from "../services/emailDeliveryService.js";

function readArg(name, argv = process.argv) {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] || "" : "";
}

function hasFlag(name, argv = process.argv) {
    return argv.includes(name);
}

function usage() {
    console.log([
        "Usage:",
        "  npm run email:retry -- --delivery-id ID",
        "  npm run email:retry -- --delivery-id ID --confirm",
        "",
        "Default mode is dry-run and performs zero writes and zero HTTP calls."
    ].join("\n"));
}

export async function run(argv = process.argv) {
    const deliveryId = readArg("--delivery-id", argv);
    const confirm = hasFlag("--confirm", argv);

    if (!deliveryId) {
        usage();
        return 1;
    }

    const result = await deliverLicenseEmail({
        deliveryId,
        dryRun: !confirm
    });

    console.log(JSON.stringify({
        mode: confirm ? "confirmed" : "dry-run",
        ...result
    }, null, 2));
    return result.status === "failed" ? 2 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = await run();
}
