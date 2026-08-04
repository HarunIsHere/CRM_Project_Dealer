import assert from "node:assert/strict";
import test from "node:test";

import {
  OutboxCryptoError,
  decryptOutboxPayload,
  encryptOutboxPayload,
  getActiveOutboxEncryptionKeyVersion
} from "../../src/identity/email/outbox-crypto.js";

function encodedKey(fill) {
  return Buffer.alloc(32, fill).toString("base64url");
}

function cryptoEnv(key = encodedKey(7)) {
  return {
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: key
  };
}

const outboxContext = Object.freeze({
  id: "11111111111111111111111111111111",
  challenge_id: "22222222222222222222222222222222",
  security_event_id: null,
  email_address_id: "33333333333333333333333333333333",
  auth_account_id: "44444444444444444444444444444444",
  realm: "staff",
  template_key: "staff_recovery",
  locale: "en",
  dedupe_key: "staff-recovery:challenge-1",
  expires_at: "2026-08-02T12:00:00.000Z"
});

const payload = Object.freeze({
  destination: "verified@example.com",
  variables: {
    actionUrl: "https://crm.ayartuerk.me/auth/admin/recovery?token=opaque",
    verificationCode: "123456"
  }
});

function encryptedRow(context, encrypted) {
  return {
    ...context,
    payload_ciphertext: encrypted.payloadCiphertext,
    payload_iv: encrypted.payloadIv,
    encryption_key_version: encrypted.encryptionKeyVersion
  };
}

test("active outbox key version must be a configured positive integer", () => {
  assert.equal(getActiveOutboxEncryptionKeyVersion(cryptoEnv()), 1);
  assert.throws(
    () => getActiveOutboxEncryptionKeyVersion({}),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_KEY_VERSION_NOT_CONFIGURED"
  );
  assert.throws(
    () => getActiveOutboxEncryptionKeyVersion({
      CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "0"
    }),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_KEY_VERSION_NOT_CONFIGURED"
  );
});

test("AES-GCM outbox payload encrypts and decrypts with authenticated context", async () => {
  const env = cryptoEnv();
  const encrypted = await encryptOutboxPayload(env, outboxContext, payload);

  assert.ok(encrypted.payloadCiphertext instanceof Uint8Array);
  assert.ok(encrypted.payloadIv instanceof Uint8Array);
  assert.equal(encrypted.payloadIv.byteLength, 12);
  assert.equal(encrypted.encryptionKeyVersion, 1);
  assert.doesNotMatch(Buffer.from(encrypted.payloadCiphertext).toString("utf8"), /123456/);

  const decrypted = await decryptOutboxPayload(
    env,
    encryptedRow(outboxContext, encrypted)
  );
  assert.deepEqual(decrypted, payload);
});

test("encrypting the same payload twice uses a fresh random IV", async () => {
  const env = cryptoEnv();
  const first = await encryptOutboxPayload(env, outboxContext, payload);
  const second = await encryptOutboxPayload(env, outboxContext, payload);

  assert.notDeepEqual(first.payloadIv, second.payloadIv);
  assert.notDeepEqual(first.payloadCiphertext, second.payloadCiphertext);
});

test("tampered ciphertext is rejected", async () => {
  const env = cryptoEnv();
  const encrypted = await encryptOutboxPayload(env, outboxContext, payload);
  const tampered = encrypted.payloadCiphertext.slice();
  tampered[0] ^= 0xff;

  await assert.rejects(
    () => decryptOutboxPayload(
      env,
      encryptedRow(outboxContext, { ...encrypted, payloadCiphertext: tampered })
    ),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_AUTHENTICATION_FAILED"
  );
});

test("a wrong encryption key is rejected", async () => {
  const encrypted = await encryptOutboxPayload(
    cryptoEnv(encodedKey(1)),
    outboxContext,
    payload
  );

  await assert.rejects(
    () => decryptOutboxPayload(
      cryptoEnv(encodedKey(2)),
      encryptedRow(outboxContext, encrypted)
    ),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_AUTHENTICATION_FAILED"
  );
});

test("changing authenticated outbox metadata invalidates the payload", async () => {
  const env = cryptoEnv();
  const encrypted = await encryptOutboxPayload(env, outboxContext, payload);
  const changedContext = {
    ...outboxContext,
    template_key: "customer_login"
  };

  await assert.rejects(
    () => decryptOutboxPayload(
      env,
      encryptedRow(changedContext, encrypted)
    ),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_AUTHENTICATION_FAILED"
  );
});

test("invalid key material and incomplete authenticated context fail closed", async () => {
  await assert.rejects(
    () => encryptOutboxPayload(
      cryptoEnv("not-a-32-byte-key"),
      outboxContext,
      payload
    ),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_KEY_INVALID"
  );

  await assert.rejects(
    () => encryptOutboxPayload(
      cryptoEnv(),
      { ...outboxContext, auth_account_id: "" },
      payload
    ),
    (error) => error instanceof OutboxCryptoError
      && error.code === "E_OUTBOX_CONTEXT_INVALID"
  );
});
