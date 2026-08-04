import assert from "node:assert/strict";
import test from "node:test";

import {
  ChallengeTokenError,
  createAcceptedChallengeTokenHashes,
  createMagicLinkToken,
  createVersionedChallengeTokenHash,
  parseVersionedChallengeTokenHash,
  readChallengeHmacKeyring
} from "../../src/identity/challenge-token.js";

function env() {
  return {
    CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_CHALLENGE_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "a".repeat(64),
    CRM_AUTH_CHALLENGE_HMAC_KEY_V2: "b".repeat(64)
  };
}

test("magic-link tokens contain 256 bits encoded as 43 base64url characters", () => {
  const tokens = new Set(Array.from({ length: 20 }, () => createMagicLinkToken()));
  assert.equal(tokens.size, 20);
  for (const token of tokens) assert.match(token, /^[A-Za-z0-9_-]{43}$/);
});

test("challenge hashes embed the active key version and retain explicit old keys", async () => {
  const token = createMagicLinkToken();
  const active = await createVersionedChallengeTokenHash(
    env(),
    token,
    "staff-invitation"
  );
  assert.equal(active.version, 2);
  assert.match(active.tokenHash, /^v2:[0-9a-f]{64}$/);
  assert.deepEqual(parseVersionedChallengeTokenHash(active.tokenHash), {
    version: 2,
    digest: active.tokenHash.slice(3)
  });

  const accepted = await createAcceptedChallengeTokenHashes(
    env(),
    token,
    "staff-invitation"
  );
  assert.equal(accepted.length, 2);
  assert.match(accepted[0], /^v2:[0-9a-f]{64}$/);
  assert.match(accepted[1], /^v1:[0-9a-f]{64}$/);
});

test("challenge keyring fails closed for implicit, unknown, or oversized key sets", () => {
  assert.throws(
    () => readChallengeHmacKeyring({ CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "x".repeat(64) }),
    (error) => error instanceof ChallengeTokenError
      && error.code === "E_CHALLENGE_HMAC_ACTIVE_VERSION_INVALID"
  );
  assert.throws(
    () => readChallengeHmacKeyring({
      ...env(),
      CRM_AUTH_CHALLENGE_HMAC_RETAINED_KEY_VERSIONS: "1,3"
    }),
    (error) => error instanceof ChallengeTokenError
      && error.code === "E_CHALLENGE_HMAC_KEY_INVALID"
  );
  assert.throws(
    () => readChallengeHmacKeyring({
      CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "6",
      CRM_AUTH_CHALLENGE_HMAC_RETAINED_KEY_VERSIONS: "1,2,3,4,5",
      CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "x".repeat(64),
      CRM_AUTH_CHALLENGE_HMAC_KEY_V2: "x".repeat(64),
      CRM_AUTH_CHALLENGE_HMAC_KEY_V3: "x".repeat(64),
      CRM_AUTH_CHALLENGE_HMAC_KEY_V4: "x".repeat(64),
      CRM_AUTH_CHALLENGE_HMAC_KEY_V5: "x".repeat(64),
      CRM_AUTH_CHALLENGE_HMAC_KEY_V6: "x".repeat(64)
    }),
    (error) => error instanceof ChallengeTokenError
      && error.code === "E_CHALLENGE_HMAC_RETAINED_VERSIONS_INVALID"
  );
});

test("wrong token shapes and malformed stored hashes fail before lookup", async () => {
  await assert.rejects(
    () => createAcceptedChallengeTokenHashes(env(), "short", "staff-invitation"),
    (error) => error instanceof ChallengeTokenError
      && error.code === "E_CHALLENGE_TOKEN_INVALID"
  );
  assert.throws(
    () => parseVersionedChallengeTokenHash("unversioned-hash"),
    (error) => error instanceof ChallengeTokenError
      && error.code === "E_CHALLENGE_TOKEN_HASH_INVALID"
  );
});
