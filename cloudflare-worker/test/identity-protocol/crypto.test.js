import assert from "node:assert/strict";
import test from "node:test";

import { constantTimeEqual } from "../../src/identity/crypto.js";

test("constant-time comparison accepts equal values", async () => {
  assert.equal(await constantTimeEqual("same-value", "same-value"), true);
  assert.equal(await constantTimeEqual("", ""), true);
});

test("constant-time comparison rejects same-length unequal values", async () => {
  assert.equal(await constantTimeEqual("same-value", "same-valuf"), false);
});

test("constant-time comparison rejects different-length values", async () => {
  assert.equal(await constantTimeEqual("short", "a much longer value"), false);
});

test("constant-time comparison stringifies inputs consistently", async () => {
  assert.equal(await constantTimeEqual(42, "42"), true);
  assert.equal(await constantTimeEqual(null, "null"), true);
  assert.equal(await constantTimeEqual(undefined, "undefined"), true);
});
