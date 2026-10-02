import test from "node:test";
import assert from "node:assert/strict";
import { LOGIN_WINDOW_MS, LoginThrottle } from "../lib/login-throttle.mjs";

test("expired failures do not count toward the next window", () => {
  let now = 0;
  const throttle = new LoginThrottle(() => now);
  const key = "127.0.0.1:user@example.test";

  for (let attempt = 0; attempt < 9; attempt += 1) {
    throttle.recordFailure(key);
  }

  now += LOGIN_WINDOW_MS;
  assert.equal(throttle.isAllowed(key), true);

  for (let attempt = 0; attempt < 9; attempt += 1) {
    throttle.recordFailure(key);
  }
  assert.equal(throttle.isAllowed(key), true);

  throttle.recordFailure(key);
  assert.equal(throttle.isAllowed(key), false);
});

test("successful login clears the failure count", () => {
  const throttle = new LoginThrottle(() => 0);
  const key = "127.0.0.1:user@example.test";

  for (let attempt = 0; attempt < 9; attempt += 1) {
    throttle.recordFailure(key);
  }
  throttle.clear(key);
  throttle.recordFailure(key);

  assert.equal(throttle.isAllowed(key), true);
});