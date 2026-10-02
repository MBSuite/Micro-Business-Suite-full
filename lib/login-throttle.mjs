export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export class LoginThrottle {
  /** @type {Map<string, { count: number; resetAt: number; lockedUntil: number }>} */
  attempts = new Map();

  /** @param {() => number} [now] */
  constructor(now = Date.now) {
    this.now = now;
  }

  /** @param {string} key */
  isAllowed(key) {
    const timestamp = this.now();
    const entry = this.attempts.get(key);
    if (!entry) return true;
    if (entry.lockedUntil > timestamp) return false;
    if (entry.resetAt <= timestamp) {
      this.attempts.delete(key);
      return true;
    }
    return entry.count < LOGIN_MAX_ATTEMPTS;
  }

  /** @param {string} key */
  recordFailure(key) {
    const timestamp = this.now();
    const previous = this.attempts.get(key);
    const entry =
      !previous || previous.resetAt <= timestamp
        ? { count: 0, resetAt: timestamp + LOGIN_WINDOW_MS, lockedUntil: 0 }
        : previous;

    entry.count += 1;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      entry.lockedUntil = timestamp + LOGIN_LOCK_MS;
      entry.count = 0;
      entry.resetAt = timestamp + LOGIN_WINDOW_MS;
    }

    this.attempts.set(key, entry);
    if (this.attempts.size > 10000) this.attempts.clear();
  }

  /** @param {string} key */
  clear(key) {
    this.attempts.delete(key);
  }
}