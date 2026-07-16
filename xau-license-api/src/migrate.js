import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { PostgresStore } from "./store/postgresStore.js";

const logger = createLogger();
const config = loadConfig();
const store = new PostgresStore({ databaseUrl: config.databaseUrl });

try {
  await store.migrate();
  logger.info("migration complete");
} finally {
  await store.close();
}
