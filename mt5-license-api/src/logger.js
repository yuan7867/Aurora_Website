export function createLogger(output = console) {
  function write(level, message, meta = {}) {
    const safeMeta = Object.fromEntries(
      Object.entries(meta).filter(([key]) => !/authorization|token|secret|license|pepper|payload/i.test(key))
    );
    output[level === "error" ? "error" : "log"](JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...safeMeta
    }));
  }
  return {
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta)
  };
}
