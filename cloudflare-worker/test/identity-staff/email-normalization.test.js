import assert from "node:assert/strict";
import test from "node:test";

import {
  EmailNormalizationError,
  maskEmailAddress,
  normalizeEmailAddress
} from "../../src/identity/email/normalization.js";

test("normalization trims, NFC-normalizes, and case-folds lookup form", () => {
  assert.deepEqual(normalizeEmailAddress("  Éxample+Tag@MÜLLER.DE\n"), {
    displayEmail: "Éxample+Tag@MÜLLER.DE",
    normalizedEmail: "éxample+tag@xn--mller-kva.de",
    normalizationVersion: 1
  });

  assert.equal(
    normalizeEmailAddress("E\u0301xample@Example.COM").normalizedEmail,
    "éxample@example.com"
  );
});

test("normalization preserves dots and plus tags", () => {
  const left = normalizeEmailAddress("First.Last+alerts@example.com");
  const right = normalizeEmailAddress("FirstLast@example.com");
  assert.equal(left.normalizedEmail, "first.last+alerts@example.com");
  assert.equal(right.normalizedEmail, "firstlast@example.com");
  assert.notEqual(left.normalizedEmail, right.normalizedEmail);
});

test("masking never returns the full local part", () => {
  assert.equal(maskEmailAddress("Harun@example.com"), "h***@example.com");
  assert.equal(maskEmailAddress("x@example.com"), "x***@example.com");
});

test("invalid addresses fail with one safe error", () => {
  const invalid = [
    "",
    "missing-at.example.com",
    "a@@example.com",
    "@example.com",
    "a@",
    "a b@example.com",
    "a\u0000b@example.com",
    ".a@example.com",
    "a.@example.com",
    "a..b@example.com",
    "a\"b@example.com",
    "a@example..com",
    "a@example.com?redirect=evil.example",
    "a@example.com#evil",
    "a@example.com/evil",
    "a@-example.com",
    "a@example",
    "a@127.0.0.1",
    `${"a".repeat(65)}@example.com`,
    `a@${"b".repeat(64)}.com`,
    `a@${"b".repeat(250)}.com`
  ];

  for (const value of invalid) {
    assert.throws(
      () => normalizeEmailAddress(value),
      (error) => error instanceof EmailNormalizationError
        && error.code === "E_EMAIL_INVALID",
      value
    );
  }
});
