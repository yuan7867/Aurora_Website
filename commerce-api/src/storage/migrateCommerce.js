import { assertCommerceRuntimeConfigured } from "../config.js";
import { closeCommerceStore, migrateCommerceStore } from "./commerceStore.js";

try {
    assertCommerceRuntimeConfigured();
    await migrateCommerceStore();
    await closeCommerceStore();
} catch (error) {
    console.error(error.message);
    await closeCommerceStore().catch(() => {});
    process.exitCode = 1;
}
