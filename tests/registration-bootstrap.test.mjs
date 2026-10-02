import test from "node:test";
import assert from "node:assert/strict";
import {
  isActiveStatus,
  normalizeStatus,
  resolveRegistrationAccess,
} from "../lib/registration-bootstrap.mjs";

test("isActiveStatus is case- and whitespace-insensitive", () => {
  for (const value of ["Active", "active", "ACTIVE", "  Active  "]) {
    assert.equal(isActiveStatus(value), true, `${JSON.stringify(value)} should be active`);
  }
});

test("isActiveStatus rejects non-active and missing statuses", () => {
  for (const value of ["Pending", "PENDING", "Inactive", "INACTIVE", "Suspended", "", null, undefined]) {
    assert.equal(isActiveStatus(value), false, `${JSON.stringify(value)} should not be active`);
  }
});

test("normalizeStatus lowercases and trims", () => {
  assert.equal(normalizeStatus(" ACTIVE "), "active");
  assert.equal(normalizeStatus(null), "");
});

test("first account bootstraps as active superadmin only on an empty installation", () => {
  assert.deepEqual(resolveRegistrationAccess(false), { role: "superadmin", status: "Active" });
  assert.deepEqual(resolveRegistrationAccess(true), { role: "user", status: "Pending" });
});
