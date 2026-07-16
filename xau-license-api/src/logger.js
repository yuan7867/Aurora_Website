import { sanitizeForLog } from "./security.js";

export function createLogger(stream = console) {
  function write(level, message, meta) {
    const payload = meta === undefined ? "" : ` ${JSON.stringify(sanitizeForLog(meta))}`;
    stream[level === "error" ? "error" : "log"](`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${payload}`);
  }

  return {
    info(message, meta) {
      write("info", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    error(message, meta) {
      write("error", message, meta);
    }
  };
}
