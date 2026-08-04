import assert from "node:assert/strict";
import test from "node:test";

import {
  RecoveryCodeError,
  createRecoveryCode,
  createRecoveryCodeSet,
  createRecoveryCodeVerifier,
  normalizeRecoveryCode,
  readRecoveryCodeHmacKeyring,
  verifyRecoveryCode
} from "../../src/identity/recovery-codes.js";

const ACCOUNT_ID = "a".repeat(32);
const SET_ID = "b".repeat(32);
const KEY_V1 = "recovery-code-hmac-key-v1-material-123456789";
const KEY_V2 = "recovery-code-hmac-key-v2-material-123456789";

function env(overrides = {}) {
  return {
    CRM_AUTH_RECOVERY_CODE_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_RECOVERY_CODE_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V1: KEY_V1,
    CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V2: KEY_V2,
    ...overrides
  };
}

test("generates ten unique 120-bit Crockford recovery codes by default", () => {
  const codes = createRecoveryCodeSet();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    assert.match(code, /^(?:[0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.equal(normalizeRecoveryCode(code).length, 24);
  }
});

test("normalization removes only hyphens and uppercases ASCII", () => {
  const code = "7k3m-9q2v-w4xt-6n8p-r5yd-h2cf";
  assert.equal(normalizeRecoveryCode(code), "7K3M9Q2VW4XT6N8PR5YDH2CF");
  assert.equal(normalizeRecoveryCode(code.replaceAll("-", "")), "7K3M9Q2VW4XT6N8PR5YDH2CF");
  for (const invalid of [
    "7K3M 9Q2V W4XT 6N8P R5YD H2CF",
    " 7K3M-9Q2V-W4XT-6N8P-R5YD-H2CF",
    "7K3M-9Q2V-W4XT-6N8P-R5YD-H2CO",
    "7K3M-9Q2V-W4XT-6N8P-R5YD-H2CÖ"
  ]) {
    assert.throws(() => normalizeRecoveryCode(invalid), RecoveryCodeError);
  }
});

test("verifiers are versioned, context-bound HMACs", async () => {
  const rawCode = createRecoveryCode();
  const first = await createRecoveryCodeVerifier(env(), rawCode, {
    accountId: ACCOUNT_ID,
    codeSetId: SET_ID,
    position: 1
  });
  const second = await createRecoveryCodeVerifier(env(), rawCode, {
    accountId: ACCOUNT_ID,
    codeSetId: SET_ID,
    position: 2
  });
  assert.equal(first.version, 2);
  assert.match(first.verifier, /^[0-9a-f]{64}$/);
  assert.notEqual(first.verifier, second.verifier);
  assert.equal(first.verifier.includes(normalizeRecoveryCode(rawCode)), false);
});

test("verification accepts the stored key version and rejects wrong proof or context", async () => {
  const rawCode = createRecoveryCode();
  const created = await createRecoveryCodeVerifier(env(), rawCode, {
    accountId: ACCOUNT_ID,
    codeSetId: SET_ID,
    position: 3
  });
  const row = {
    auth_account_id: ACCOUNT_ID,
    code_set_id: SET_ID,
    code_position: 3,
    verifier_key_version: created.version,
    verifier: created.verifier
  };
  assert.equal(await verifyRecoveryCode(env(), rawCode, row), true);
  assert.equal(await verifyRecoveryCode(env(), createRecoveryCode(), row), false);
  assert.equal(await verifyRecoveryCode(env(), rawCode, { ...row, code_position: 4 }), false);
});

test("retained key versions remain verifiable during rotation", async () => {
  const rawCode = createRecoveryCode();
  const oldEnv = env({
    CRM_AUTH_RECOVERY_CODE_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_RECOVERY_CODE_HMAC_RETAINED_KEY_VERSIONS: ""
  });
  const created = await createRecoveryCodeVerifier(oldEnv, rawCode, {
    accountId: ACCOUNT_ID,
    codeSetId: SET_ID,
    position: 5
  });
  assert.equal(created.version, 1);
  assert.equal(await verifyRecoveryCode(env(), rawCode, {
    auth_account_id: ACCOUNT_ID,
    codeSetId: SET_ID,
    position: 5,
    verifierKeyVersion: 1,
    verifier: created.verifier
  }), true);
});

test("invalid counts, contexts, and incomplete keyrings fail closed", async () => {
  assert.throws(() => createRecoveryCodeSet(0), RecoveryCodeError);
  assert.throws(() => createRecoveryCodeSet(21), RecoveryCodeError);
  assert.throws(
    () => readRecoveryCodeHmacKeyring(env({ CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V1: "short" })),
    RecoveryCodeError
  );
  await assert.rejects(
    createRecoveryCodeVerifier(env(), createRecoveryCode(), {
      accountId: "bad",
      codeSetId: SET_ID,
      position: 1
    }),
    RecoveryCodeError
  );
});
