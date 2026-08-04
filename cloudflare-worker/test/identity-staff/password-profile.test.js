import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_STAFF_PASSWORD_PROFILE,
  StaffPasswordProfileError,
  createCanonicalStaffPasswordVerifier,
  parseCanonicalStaffPasswordVerifier,
  prehashStaffPassword
} from "../../src/identity/staff/password-profile.js";

function environment(overrides = {}) {
  return {
    CRM_AUTH_PASSWORD_PEPPER_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_PASSWORD_PEPPER_KEY_V1: Buffer.alloc(32, 7).toString("base64url"),
    ...overrides
  };
}

async function expectUnavailable(action) {
  await assert.rejects(action, (error) => {
    assert.equal(error instanceof StaffPasswordProfileError, true);
    assert.equal(error.code, "temporarily_unavailable");
    assert.equal(error.status, 503);
    return true;
  });
}

test("canonical profile exactly matches the approved Argon2id contract", () => {
  assert.deepEqual(CANONICAL_STAFF_PASSWORD_PROFILE, {
    algorithm: "argon2id_phc_v1",
    algorithmVersion: 1,
    parameters: {
      memoryKiB: 19456,
      iterations: 2,
      parallelism: 1,
      saltBytes: 16,
      hashBytes: 32
    },
    pepperKeyVersion: 1,
    prehash: "HMAC-SHA-256",
    phcVersion: 19
  });
});

test("prehashes the exact unnormalized UTF-8 value with the selected pepper", async () => {
  const decomposed = "cafe\u0301 password phrase";
  const composed = "café password phrase";
  const left = await prehashStaffPassword(environment(), decomposed);
  const right = await prehashStaffPassword(environment(), composed);
  assert.equal(left.pepperVersion, 1);
  assert.equal(left.prehash.byteLength, 32);
  assert.notDeepEqual(left.prehash, right.prehash);
});

test("passes only 32 prehashed bytes and the exact profile to Argon2id", async () => {
  let received;
  const record = await createCanonicalStaffPasswordVerifier(
    environment(),
    "a sufficiently long password",
    {
      deriveArgon2id(input) {
        received = input;
        return new Uint8Array(32).fill(9);
      }
    }
  );

  assert.equal(received.password instanceof Uint8Array, true);
  assert.equal(received.password.byteLength, 32);
  assert.equal(received.salt.byteLength, 16);
  assert.deepEqual(
    {
      memoryKiB: received.memoryKiB,
      iterations: received.iterations,
      parallelism: received.parallelism,
      hashBytes: received.hashBytes
    },
    { memoryKiB: 19456, iterations: 2, parallelism: 1, hashBytes: 32 }
  );
  assert.equal(record.algorithm, "argon2id_phc_v1");
  assert.equal(record.algorithmVersion, 1);
  assert.equal(record.pepperKeyVersion, 1);
  assert.equal(record.needsUpgrade, 0);
  assert.equal(
    record.parametersJson,
    '{"memoryKiB":19456,"iterations":2,"parallelism":1,"saltBytes":16,"hashBytes":32}'
  );
  assert.match(record.verifier, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  const parsed = parseCanonicalStaffPasswordVerifier(record.verifier);
  assert.equal(parsed.salt.byteLength, 16);
  assert.deepEqual(parsed.hash, new Uint8Array(32).fill(9));
});

test("fails closed for missing keys, unsupported versions, engines, and output", async () => {
  await expectUnavailable(() => prehashStaffPassword({}, "a password"));
  await expectUnavailable(() => prehashStaffPassword(
    environment({ CRM_AUTH_PASSWORD_PEPPER_ACTIVE_KEY_VERSION: "2" }),
    "a password"
  ));
  await expectUnavailable(() => createCanonicalStaffPasswordVerifier(
    environment(),
    "a password",
    {}
  ));
  await expectUnavailable(() => createCanonicalStaffPasswordVerifier(
    environment(),
    "a password",
    { deriveArgon2id: () => new Uint8Array(31) }
  ));
});

test("rejects noncanonical or malformed PHC strings", () => {
  for (const value of [
    "",
    "$argon2i$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "$argon2id$v=19$m=19456,t=2,p=1$short$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$bad="
  ]) {
    assert.throws(() => parseCanonicalStaffPasswordVerifier(value), StaffPasswordProfileError);
  }
});
