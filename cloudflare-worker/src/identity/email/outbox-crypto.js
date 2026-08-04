const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const KEY_BYTES = 32;
const IV_BYTES = 12;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const AAD_VERSION = "crm-auth-email-outbox-v1";

export class OutboxCryptoError extends Error {
  constructor(code) {
    super("Authentication email payload cryptography failed.");
    this.name = "OutboxCryptoError";
    this.code = code;
  }
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getActiveOutboxEncryptionKeyVersion(env) {
  const version = positiveInteger(
    env?.CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION
  );
  if (!version) {
    throw new OutboxCryptoError("E_OUTBOX_KEY_VERSION_NOT_CONFIGURED");
  }
  return version;
}

function decodeBase64Key(value) {
  const source = String(value ?? "").trim();
  if (!source || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(source)) {
    throw new OutboxCryptoError("E_OUTBOX_KEY_INVALID");
  }

  const unpadded = source.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (unpadded.length % 4 === 1) {
    throw new OutboxCryptoError("E_OUTBOX_KEY_INVALID");
  }
  const normalized = unpadded.padEnd(
    unpadded.length + ((4 - (unpadded.length % 4)) % 4),
    "="
  );

  let decoded;
  try {
    decoded = globalThis.atob(normalized);
  } catch {
    throw new OutboxCryptoError("E_OUTBOX_KEY_INVALID");
  }

  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== KEY_BYTES) {
    throw new OutboxCryptoError("E_OUTBOX_KEY_INVALID");
  }
  return bytes;
}

function keyMaterial(env, version) {
  const keyName = `CRM_AUTH_EMAIL_OUTBOX_KEY_V${version}`;
  return decodeBase64Key(env?.[keyName]);
}

async function importAesKey(env, version, usage) {
  if (!globalThis.crypto?.subtle) {
    throw new OutboxCryptoError("E_OUTBOX_CRYPTO_UNAVAILABLE");
  }
  return globalThis.crypto.subtle.importKey(
    "raw",
    keyMaterial(env, version),
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

function readField(context, snakeName, camelName) {
  return context?.[snakeName] ?? context?.[camelName] ?? null;
}

function associatedData(context, encryptionKeyVersion) {
  const values = [
    AAD_VERSION,
    readField(context, "id", "outboxId"),
    readField(context, "challenge_id", "challengeId"),
    readField(context, "security_event_id", "securityEventId"),
    readField(context, "email_address_id", "emailAddressId"),
    readField(context, "auth_account_id", "authAccountId"),
    readField(context, "realm", "realm"),
    readField(context, "template_key", "templateKey"),
    readField(context, "locale", "locale"),
    readField(context, "dedupe_key", "dedupeKey"),
    readField(context, "expires_at", "expiresAt"),
    encryptionKeyVersion
  ].map((value) => value === null ? "" : String(value));

  if (
    !values[1]
    || (!values[2] && !values[3])
    || (values[2] && values[3])
    || values.slice(4, 11).some((value) => !value)
  ) {
    throw new OutboxCryptoError("E_OUTBOX_CONTEXT_INVALID");
  }

  return textEncoder.encode(JSON.stringify(values));
}

function asBytes(value, errorCode) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new OutboxCryptoError(errorCode);
}

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function encryptOutboxPayload(env, context, payload) {
  if (!plainObject(payload)) {
    throw new OutboxCryptoError("E_OUTBOX_PAYLOAD_INVALID");
  }

  const encryptionKeyVersion = getActiveOutboxEncryptionKeyVersion(env);
  let encodedPayload;
  try {
    encodedPayload = textEncoder.encode(JSON.stringify(payload));
  } catch {
    throw new OutboxCryptoError("E_OUTBOX_PAYLOAD_INVALID");
  }
  if (!encodedPayload.byteLength || encodedPayload.byteLength > MAX_PAYLOAD_BYTES) {
    throw new OutboxCryptoError("E_OUTBOX_PAYLOAD_INVALID");
  }

  const key = await importAesKey(env, encryptionKeyVersion, "encrypt");
  const payloadIv = new Uint8Array(IV_BYTES);
  globalThis.crypto.getRandomValues(payloadIv);
  const aad = associatedData(context, encryptionKeyVersion);

  try {
    const encrypted = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: payloadIv, additionalData: aad, tagLength: 128 },
      key,
      encodedPayload
    );
    return {
      payloadCiphertext: new Uint8Array(encrypted),
      payloadIv,
      encryptionKeyVersion
    };
  } catch (error) {
    if (error instanceof OutboxCryptoError) throw error;
    throw new OutboxCryptoError("E_OUTBOX_ENCRYPTION_FAILED");
  }
}

export async function decryptOutboxPayload(env, row) {
  const encryptionKeyVersion = positiveInteger(row?.encryption_key_version);
  if (!encryptionKeyVersion) {
    throw new OutboxCryptoError("E_OUTBOX_KEY_VERSION_INVALID");
  }

  const ciphertext = asBytes(
    row?.payload_ciphertext,
    "E_OUTBOX_CIPHERTEXT_INVALID"
  );
  const payloadIv = asBytes(row?.payload_iv, "E_OUTBOX_IV_INVALID");
  if (!ciphertext.byteLength || payloadIv.byteLength !== IV_BYTES) {
    throw new OutboxCryptoError("E_OUTBOX_CIPHERTEXT_INVALID");
  }

  const key = await importAesKey(env, encryptionKeyVersion, "decrypt");
  const aad = associatedData(row, encryptionKeyVersion);

  let plaintext;
  try {
    plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: payloadIv, additionalData: aad, tagLength: 128 },
      key,
      ciphertext
    );
  } catch {
    throw new OutboxCryptoError("E_OUTBOX_AUTHENTICATION_FAILED");
  }

  try {
    const payload = JSON.parse(textDecoder.decode(plaintext));
    if (!plainObject(payload)) {
      throw new Error("invalid payload shape");
    }
    return payload;
  } catch {
    throw new OutboxCryptoError("E_OUTBOX_PAYLOAD_INVALID");
  }
}
