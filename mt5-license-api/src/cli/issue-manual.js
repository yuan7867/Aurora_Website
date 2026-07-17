import { loadConfig } from "../config.js";
import { PRODUCT_ID } from "../constants.js";
import { createLogger } from "../logger.js";
import { generateLicenseKey, hmacLicenseKey } from "../security.js";
import { PostgresStore } from "../store/postgresStore.js";

function parseArgs(argv) {
  const allowed = new Set(["--permanent", "--confirm", "--email", "--name", "--dry-run"]);
  const rejected = new Set([
    "--paypal-sale-id",
    "--paypal-subscription-id",
    "--paypal-event-id",
    "--sale-id",
    "--subscription-id",
    "--event-id",
    "--payment-id",
    "--capture-id",
    "--order-id"
  ]);
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item.startsWith("--")) {
      if (rejected.has(item)) {
        throw new Error("Payment identifiers are not allowed for manual permanent licenses.");
      }
      if (!allowed.has(item)) {
        throw new Error("Unknown argument rejected.");
      }
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        args.set(item, true);
      } else {
        args.set(item, next);
        index += 1;
      }
    }
  }
  return args;
}

const logger = createLogger();
let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (!args.has("--permanent") || !args.has("--confirm")) {
  console.error("Manual permanent licenses require --permanent --confirm. Default mode is dry-run.");
  process.exit(1);
}

if (args.has("--dry-run")) {
  console.log(JSON.stringify({
    status: "dry_run",
    purpose: "owner_or_friend_only_not_for_sale",
    wouldIssue: true
  }, null, 2));
  process.exit(0);
}

async function main() {
  const config = loadConfig();
  const store = new PostgresStore({ databaseUrl: config.databaseUrl });
  const rawLicenseKey = generateLicenseKey();
  try {
    const license = await store.issueManualPermanent({
      productId: PRODUCT_ID,
      customerEmail: String(args.get("--email") || "").trim().toLowerCase(),
      customerName: String(args.get("--name") || "").trim(),
      licenseKeyHash: hmacLicenseKey(rawLicenseKey, config.licenseKeyPepper)
    });
    console.log(JSON.stringify({
      status: "issued_manual_permanent",
      purpose: "owner_or_friend_only_not_for_sale",
      licenseKey: rawLicenseKey,
      licenseId: String(license.id),
      productId: PRODUCT_ID,
      plan: "permanent"
    }, null, 2));
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  logger.error("manual permanent issue failed", { code: error.code || error.message });
  process.exit(1);
});
