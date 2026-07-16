import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./constants.js";

export class RateLimiter {
  constructor({ max = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.items = new Map();
  }

  allow(key) {
    const now = Date.now();
    const current = this.items.get(key) || { count: 0, resetAt: now + this.windowMs };

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + this.windowMs;
    }

    current.count += 1;
    this.items.set(key, current);
    return current.count <= this.max;
  }
}
