import { loadConfig } from "../config.js";
import { PRODUCT_ID } from "../constants.js";
import { createLogger } from "../logger.js";
import { generateLicenseKey, hmacLicenseKey } from "../security.js";
import { PostgresStore } from "../store/postgresStore.js";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item.startsWith("--")) {
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
const args = parseArgs(process.argv.slice(2));

if (!args.has("--permanent") || !args.has("--confirm")) {
  console.error("Manual permanent licenses require --permanent --confirm. Default mode is dry-run.");
  process.exit(1);
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
