import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { PostgresStore } from "./store/postgresStore.js";

const logger = createLogger();

async function main() {
  const config = loadConfig();
  const store = new PostgresStore({ databaseUrl: config.databaseUrl });
  try {
    await store.migrate();
    logger.info("mt5 license migrations complete");
  } finally {
    await store.close();
  }
}

main().catch((error) => {
  logger.error("mt5 license migration failed", { code: error.code || error.message });
  process.exit(1);
});
