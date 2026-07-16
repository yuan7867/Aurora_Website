import http from "node:http";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { PostgresStore } from "./store/postgresStore.js";

const logger = createLogger();
const config = loadConfig();
const store = new PostgresStore({ databaseUrl: config.databaseUrl });

await store.migrate();

const server = http.createServer(createApp({ config, store, logger }));

server.listen(config.port, () => {
  logger.info(`xau license api listening on port ${config.port}`);
});

async function shutdown(signal) {
  logger.info(`received ${signal}, shutting down`);
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
