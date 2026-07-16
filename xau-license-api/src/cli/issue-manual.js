import { PLAN_RULES, PRODUCT_ID } from "../constants.js";
import { loadConfig } from "../config.js";
import { generateLicenseKey, hmacLicenseKey, normalizeEmail } from "../security.js";
import { PostgresStore } from "../store/postgresStore.js";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--confirm") {
      result.confirm = true;
      continue;
    }
    if (item.startsWith("--")) {
      result[item.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

function usage() {
  return [
    "Usage:",
    "  npm run license:issue-manual -- --plan monthly --email customer@example.com --name \"Customer\" --confirm",
    "  npm run license:issue-manual -- --plan yearly --email customer@example.com --name \"Customer\" --confirm",
    "  npm run license:issue-manual -- --plan permanent --email owner@example.com --name \"Owner\" --confirm",
    "",
    "Permanent licenses are server-owner manual licenses only and are not public sale SKUs."
  ].join("\n");
}

const args = parseArgs(process.argv.slice(2));
const plan = String(args.plan || "").trim();
const email = normalizeEmail(args.email);
const name = String(args.name || "").trim();

if (!["monthly", "yearly", "permanent"].includes(plan) || !email || !args.confirm) {
  console.error(usage());
  process.exit(1);
}

const config = loadConfig();
const store = new PostgresStore({ databaseUrl: config.databaseUrl });

try {
  await store.migrate();
  const rawLicenseKey = generateLicenseKey(plan === "permanent" ? "PERM" : "AURORA");
  const rule = PLAN_RULES[plan] || {};
  const license = await store.issueManual({
    productId: PRODUCT_ID,
    sku: rule.sku || null,
    plan,
    days: rule.days || 0,
    customerEmail: email,
    customerName: name,
    licenseKeyHash: hmacLicenseKey(rawLicenseKey, config.licenseKeyPepper)
  });

  console.log("Manual license issued. This raw license key is shown once only.");
  console.log(`License Key: ${rawLicenseKey}`);
  console.log(`Plan: ${license.plan}`);
  console.log(`Expires At: ${license.expiresAt ? new Date(license.expiresAt).toISOString() : "Never"}`);
} finally {
  await store.close();
}
