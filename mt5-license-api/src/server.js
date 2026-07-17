import http from "node:http";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { PostgresStore } from "./store/postgresStore.js";

const logger = createLogger();

async function main() {
  const config = loadConfig();
  const store = new PostgresStore({ databaseUrl: config.databaseUrl });
  await store.migrate();
  const server = http.createServer(createApp({ config, store, logger }));
  server.listen(config.port, () => {
    logger.info("mt5 license api listening", { port: config.port });
  });
}

main().catch((error) => {
  logger.error("mt5 license api failed to start", { code: error.code || error.message });
  process.exit(1);
});
