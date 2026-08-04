import assert from "node:assert/strict";
import test from "node:test";

import { hashOpaqueToken } from "../../src/identity/crypto.js";
import {
  SessionKeyringError,
  createAcceptedSessionTokenHashes,
  createSessionHashesForIssuance,
  hashSessionSecretForVersion,
  readSessionHmacKeyring
} from "../../src/identity/session-keyring.js";

const SESSION_TOKEN = "session_token_1234567890_ABCDEFGHIJKLMN";
const CSRF_TOKEN = "csrf_token_1234567890_ABCDEFGHIJKLMNO";

function keyringEnv() {
  return {
    CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_SESSION_HMAC_KEY_V1: "r".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY_V2: "s".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY: "legacy-key-must-never-be-used".repeat(2)
  };
}

test("session issuance hashes with the active version and returns its persistence fields", async () => {
  const env = keyringEnv();
  const hashes = await createSessionHashesForIssuance(env, {
    sessionToken: SESSION_TOKEN,
    csrfToken: CSRF_TOKEN
  });

  assert.deepEqual(hashes, {
    tokenHash: await hashOpaqueToken(SESSION_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY_V2),
    tokenHashVersion: 2,
    csrfTokenHash: await hashOpaqueToken(CSRF_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY_V2)
  });
  assert.notEqual(
    hashes.tokenHash,
    await hashOpaqueToken(SESSION_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY)
  );
});

test("verification accepts exactly the active and explicitly retained key versions", async () => {
  const env = keyringEnv();
  const accepted = await createAcceptedSessionTokenHashes(env, SESSION_TOKEN);

  assert.deepEqual(accepted, [
    {
      tokenHashVersion: 2,
      tokenHash: await hashOpaqueToken(SESSION_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY_V2)
    },
    {
      tokenHashVersion: 1,
      tokenHash: await hashOpaqueToken(SESSION_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY_V1)
    }
  ]);
  assert.equal(
    await hashSessionSecretForVersion(env, CSRF_TOKEN, 1),
    await hashOpaqueToken(CSRF_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY_V1)
  );
  await assert.rejects(
    () => hashSessionSecretForVersion(env, CSRF_TOKEN, 3),
    (error) => error instanceof SessionKeyringError
      && error.code === "E_SESSION_HMAC_KEY_VERSION_UNKNOWN"
  );
});

test("session keyring configuration fails closed and ignores the legacy key", () => {
  assert.throws(
    () => readSessionHmacKeyring({
      CRM_AUTH_SESSION_HMAC_KEY: "l".repeat(64)
    }),
    (error) => error instanceof SessionKeyringError
      && error.code === "E_SESSION_HMAC_ACTIVE_VERSION_INVALID"
  );
  assert.throws(
    () => readSessionHmacKeyring({
      ...keyringEnv(),
      CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1,3"
    }),
    (error) => error instanceof SessionKeyringError
      && error.code === "E_SESSION_HMAC_KEY_INVALID"
  );
});

