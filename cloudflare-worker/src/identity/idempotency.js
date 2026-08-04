import { createOpaqueId } from "./crypto.js";
import {
  canonicalIdentityOperation,
  hashCanonicalIdentityRequest,
  readIdempotencyKey
} from "./protocol.js";

const HEX_64 = /^[0-9a-f]{64}$/;
const ID_32 = /^[0-9a-f]{32}$/;
const REALMS = new Set(["customer", "staff"]);
const MAX_SECRET_RESPONSE_TTL_SECONDS = 10 * 60;
const MAX_RECEIPT_TTL_SECONDS = 24 * 60 * 60;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toHex(bytes) {
  return Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new IdempotencyError("E_IDEMPOTENCY_INPUT_INVALID");
  }
  return date.toISOString();
}

function changedRows(result) {
  return Number(result?.meta?.changes ?? 0);
}

export class IdempotencyError extends Error {
  constructor(code) {
    super("Identity idempotency persistence failed.");
    this.name = "IdempotencyError";
    this.code = code;
  }
}

function requireDatabase(env) {
  if (
    !env?.DB
    || typeof env.DB.prepare !== "function"
    || typeof env.DB.batch !== "function"
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_DATABASE_UNAVAILABLE");
  }
  return env.DB;
}

async function hmacHex(keyMaterial, namespace, value) {
  const keyText = String(keyMaterial ?? "");
  if (keyText.length < 32 || keyText.length > 1024) {
    throw new IdempotencyError("E_IDEMPOTENCY_HASH_KEY_INVALID");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyText),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(`${namespace}\u0000${value}`)
  );
  return toHex(new Uint8Array(signature));
}

export async function createIdempotencyContext(
  request,
  {
    realm,
    routeTemplate,
    body,
    subjectScope,
    hashKeyVersion,
    hashKeyMaterial
  }
) {
  const normalizedRealm = String(realm ?? "");
  const scope = String(subjectScope ?? "");
  const version = positiveInteger(hashKeyVersion);
  if (
    !REALMS.has(normalizedRealm)
    || !scope
    || scope.length > 512
    || !version
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_INPUT_INVALID");
  }

  const rawKey = readIdempotencyKey(request);
  const operation = canonicalIdentityOperation(request.method, routeTemplate);
  const canonicalRequestDigest = await hashCanonicalIdentityRequest(
    request.method,
    routeTemplate,
    body
  );
  const [subjectScopeHash, keyHash, requestHash] = await Promise.all([
    hmacHex(hashKeyMaterial, "identity-idempotency-subject", scope),
    hmacHex(hashKeyMaterial, "identity-idempotency-key", rawKey),
    hmacHex(
      hashKeyMaterial,
      "identity-idempotency-request",
      canonicalRequestDigest
    )
  ]);

  return Object.freeze({
    realm: normalizedRealm,
    operation,
    hashKeyVersion: version,
    subjectScopeHash,
    keyHash,
    requestHash
  });
}

export function getActiveIdempotencyResponseKeyVersion(env) {
  const version = positiveInteger(
    env?.CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION
  );
  if (!version) {
    throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_KEY_VERSION_NOT_CONFIGURED");
  }
  return version;
}

function decodeBase64Key(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_KEY_INVALID");
  try {
    const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.byteLength !== 32) {
      throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_KEY_INVALID");
    }
    return bytes;
  } catch (error) {
    if (error instanceof IdempotencyError) throw error;
    throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_KEY_INVALID");
  }
}

function responseKeyMaterial(env, version) {
  return decodeBase64Key(env?.[`CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V${version}`]);
}

async function importResponseKey(env, version, usage) {
  return crypto.subtle.importKey(
    "raw",
    responseKeyMaterial(env, version),
    { name: "AES-GCM" },
    false,
    [usage]
  );
}

function field(value, snakeName, camelName) {
  return value?.[snakeName] ?? value?.[camelName];
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function normalizedPersistenceContext(value) {
  const context = {
    id: String(field(value, "id", "id") ?? ""),
    realm: String(field(value, "realm", "realm") ?? ""),
    operation: String(field(value, "operation", "operation") ?? ""),
    hashKeyVersion: Number(field(value, "hash_key_version", "hashKeyVersion")),
    subjectScopeHash: String(
      field(value, "subject_scope_hash", "subjectScopeHash") ?? ""
    ),
    keyHash: String(field(value, "key_hash", "keyHash") ?? ""),
    requestHash: String(field(value, "request_hash", "requestHash") ?? ""),
    expiresAt: String(field(value, "expires_at", "expiresAt") ?? "")
  };
  let canonicalOperation = null;
  const separator = context.operation.indexOf(" ");
  try {
    if (separator > 0) {
      canonicalOperation = canonicalIdentityOperation(
        context.operation.slice(0, separator),
        context.operation.slice(separator + 1)
      );
    }
  } catch {
    canonicalOperation = null;
  }
  if (
    !ID_32.test(context.id)
    || !REALMS.has(context.realm)
    || context.operation !== canonicalOperation
    || !positiveInteger(context.hashKeyVersion)
    || !HEX_64.test(context.subjectScopeHash)
    || !HEX_64.test(context.keyHash)
    || !HEX_64.test(context.requestHash)
    || !Number.isFinite(new Date(context.expiresAt).getTime())
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_CONTEXT_INVALID");
  }
  return context;
}

function responseAssociatedData(context, responseStatus, responseKeyVersion) {
  return textEncoder.encode(JSON.stringify([
    "crm-identity-idempotency-response-v1",
    context.id,
    context.realm,
    context.operation,
    context.hashKeyVersion,
    context.subjectScopeHash,
    context.keyHash,
    context.requestHash,
    context.expiresAt,
    responseStatus,
    responseKeyVersion
  ]));
}

function requireResponseBody(body) {
  if (
    !body
    || typeof body !== "object"
    || Array.isArray(body)
    || (Object.getPrototypeOf(body) !== Object.prototype
      && Object.getPrototypeOf(body) !== null)
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_INVALID");
  }
  try {
    return textEncoder.encode(JSON.stringify(body));
  } catch {
    throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_INVALID");
  }
}

async function encryptResponse(env, value, responseStatus, body) {
  const context = normalizedPersistenceContext(value);
  const status = Number(responseStatus);
  if (!Number.isSafeInteger(status) || status < 200 || status > 599) {
    throw new IdempotencyError("E_IDEMPOTENCY_RESPONSE_INVALID");
  }
  const responseKeyVersion = getActiveIdempotencyResponseKeyVersion(env);
  const key = await importResponseKey(env, responseKeyVersion, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: responseAssociatedData(
        context,
        status,
        responseKeyVersion
      ),
      tagLength: 128
    },
    key,
    requireResponseBody(body)
  );
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
    responseKeyVersion
  };
}

export async function decryptCompletedIdempotencyResponse(env, row) {
  const context = normalizedPersistenceContext(row);
  const status = Number(row?.response_status);
  const responseKeyVersion = positiveInteger(row?.response_key_version);
  const ciphertext = asBytes(row?.response_payload_ciphertext);
  const iv = asBytes(row?.response_payload_iv);
  if (
    row?.status !== "completed"
    || !Number.isSafeInteger(status)
    || status < 200
    || status > 599
    || !responseKeyVersion
    || ciphertext === null
    || iv === null
    || iv.byteLength !== 12
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
  }

  try {
    const key = await importResponseKey(env, responseKeyVersion, "decrypt");
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: responseAssociatedData(
          context,
          status,
          responseKeyVersion
        ),
        tagLength: 128
      },
      key,
      ciphertext
    );
    const body = JSON.parse(textDecoder.decode(plaintext));
    requireResponseBody(body);
    return Object.freeze({ status, body });
  } catch (error) {
    if (error instanceof IdempotencyError) throw error;
    throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_DECRYPTION_FAILED");
  }
}

function reservationLifetime(secretBearing, ttlSeconds) {
  const maximum = secretBearing
    ? MAX_SECRET_RESPONSE_TTL_SECONDS
    : MAX_RECEIPT_TTL_SECONDS;
  const ttl = ttlSeconds === undefined ? maximum : positiveInteger(ttlSeconds);
  if (!ttl || ttl > maximum) {
    throw new IdempotencyError("E_IDEMPOTENCY_TTL_INVALID");
  }
  return ttl;
}

function validateContext(value) {
  const context = {
    realm: String(value?.realm ?? ""),
    operation: String(value?.operation ?? ""),
    hashKeyVersion: Number(value?.hashKeyVersion),
    subjectScopeHash: String(value?.subjectScopeHash ?? ""),
    keyHash: String(value?.keyHash ?? ""),
    requestHash: String(value?.requestHash ?? "")
  };
  const separator = context.operation.indexOf(" ");
  let canonicalOperation = null;
  try {
    if (separator > 0) {
      canonicalOperation = canonicalIdentityOperation(
        context.operation.slice(0, separator),
        context.operation.slice(separator + 1)
      );
    }
  } catch {
    canonicalOperation = null;
  }
  if (
    !REALMS.has(context.realm)
    || separator <= 0
    || context.operation !== canonicalOperation
    || !positiveInteger(context.hashKeyVersion)
    || !HEX_64.test(context.subjectScopeHash)
    || !HEX_64.test(context.keyHash)
    || !HEX_64.test(context.requestHash)
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_CONTEXT_INVALID");
  }
  return context;
}

function selectedRow(batchResult) {
  const rows = batchResult?.results;
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function reserveIdempotencyKey(
  env,
  contextValue,
  {
    secretBearing = false,
    ttlSeconds = undefined,
    now = new Date()
  } = {}
) {
  const database = requireDatabase(env);
  const context = validateContext(contextValue);
  const ttl = reservationLifetime(secretBearing === true, ttlSeconds);
  const createdAt = isoTimestamp(now);
  const expiresAt = new Date(new Date(createdAt).getTime() + ttl * 1000).toISOString();
  const id = createOpaqueId();

  let results;
  try {
    results = await database.batch([
      database.prepare(`
        DELETE FROM auth_idempotency_keys
        WHERE realm = ?
          AND operation = ?
          AND hash_key_version = ?
          AND subject_scope_hash = ?
          AND key_hash = ?
          AND datetime(expires_at) <= datetime(?)
      `).bind(
        context.realm,
        context.operation,
        context.hashKeyVersion,
        context.subjectScopeHash,
        context.keyHash,
        createdAt
      ),
      database.prepare(`
        INSERT OR IGNORE INTO auth_idempotency_keys (
          id,
          realm,
          operation,
          hash_key_version,
          subject_scope_hash,
          key_hash,
          request_hash,
          status,
          created_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?)
      `).bind(
        id,
        context.realm,
        context.operation,
        context.hashKeyVersion,
        context.subjectScopeHash,
        context.keyHash,
        context.requestHash,
        createdAt,
        expiresAt
      ),
      database.prepare(`
        SELECT *
        FROM auth_idempotency_keys
        WHERE realm = ?
          AND operation = ?
          AND hash_key_version = ?
          AND subject_scope_hash = ?
          AND key_hash = ?
        LIMIT 1
      `).bind(
        context.realm,
        context.operation,
        context.hashKeyVersion,
        context.subjectScopeHash,
        context.keyHash
      )
    ]);
  } catch {
    throw new IdempotencyError("E_IDEMPOTENCY_PERSISTENCE_FAILED");
  }

  const row = selectedRow(results?.[2]);
  if (!row) throw new IdempotencyError("E_IDEMPOTENCY_PERSISTENCE_FAILED");
  if (String(row.request_hash) !== context.requestHash) {
    return Object.freeze({ outcome: "reused" });
  }
  if (row.status === "completed") {
    const response = await decryptCompletedIdempotencyResponse(env, row);
    return Object.freeze({ outcome: "replay", response });
  }
  if (row.status !== "in_progress") {
    throw new IdempotencyError("E_IDEMPOTENCY_PERSISTENCE_FAILED");
  }
  if (String(row.id) !== id) {
    return Object.freeze({ outcome: "in_progress" });
  }

  const reservation = Object.freeze({
    id,
    ...context,
    expiresAt
  });
  return Object.freeze({ outcome: "reserved", reservation });
}

function normalizeResource(resourceType, resourceId) {
  const type = resourceType === undefined || resourceType === null
    ? null
    : String(resourceType);
  const id = resourceId === undefined || resourceId === null
    ? null
    : String(resourceId);
  if (
    (type === null) !== (id === null)
    || (type !== null && (
      !/^[a-z0-9._-]{1,80}$/.test(type)
      || id.length < 1
      || id.length > 160
    ))
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_RESOURCE_INVALID");
  }
  return { type, id };
}

export async function prepareIdempotencyCompletion(
  env,
  reservationValue,
  {
    status,
    body,
    resourceType = null,
    resourceId = null,
    completedAt = new Date()
  }
) {
  const database = requireDatabase(env);
  const reservation = normalizedPersistenceContext(reservationValue);
  const completed = isoTimestamp(completedAt);
  if (new Date(completed).getTime() >= new Date(reservation.expiresAt).getTime()) {
    throw new IdempotencyError("E_IDEMPOTENCY_RESERVATION_EXPIRED");
  }
  const resource = normalizeResource(resourceType, resourceId);
  const encrypted = await encryptResponse(env, reservation, status, body);
  const statement = database.prepare(`
    UPDATE auth_idempotency_keys
    SET status = 'completed',
        response_status = ?,
        response_payload_ciphertext = ?,
        response_payload_iv = ?,
        response_key_version = ?,
        resource_type = ?,
        resource_id = ?,
        completed_at = ?
    WHERE id = ?
      AND realm = ?
      AND operation = ?
      AND hash_key_version = ?
      AND subject_scope_hash = ?
      AND key_hash = ?
      AND request_hash = ?
      AND status = 'in_progress'
      AND datetime(expires_at) > datetime(?)
  `).bind(
    Number(status),
    encrypted.ciphertext,
    encrypted.iv,
    encrypted.responseKeyVersion,
    resource.type,
    resource.id,
    completed,
    reservation.id,
    reservation.realm,
    reservation.operation,
    reservation.hashKeyVersion,
    reservation.subjectScopeHash,
    reservation.keyHash,
    reservation.requestHash,
    completed
  );
  return Object.freeze({ statement, responseKeyVersion: encrypted.responseKeyVersion });
}

export async function completeIdempotencyKey(env, reservation, response) {
  const prepared = await prepareIdempotencyCompletion(env, reservation, response);
  const result = await prepared.statement.run();
  if (changedRows(result) !== 1) {
    throw new IdempotencyError("E_IDEMPOTENCY_COMPLETION_CONFLICT");
  }
  return true;
}

export async function releaseIdempotencyReservation(env, reservationValue) {
  const database = requireDatabase(env);
  const reservation = normalizedPersistenceContext(reservationValue);
  const result = await database.prepare(`
    DELETE FROM auth_idempotency_keys
    WHERE id = ?
      AND request_hash = ?
      AND status = 'in_progress'
  `).bind(reservation.id, reservation.requestHash).run();
  return changedRows(result) === 1;
}
