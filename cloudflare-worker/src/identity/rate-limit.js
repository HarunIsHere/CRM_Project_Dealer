import { createOpaqueId } from "./crypto.js";

const DIMENSIONS = new Set([
  "account",
  "identifier",
  "destination",
  "ip",
  "device",
  "system"
]);
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MAX_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const MAX_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export class RateLimitError extends Error {
  constructor(code) {
    super("Identity rate-limit persistence failed.");
    this.name = "RateLimitError";
    this.code = code;
  }
}

function positiveInteger(value, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : null;
}

function requireDatabase(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    throw new RateLimitError("E_RATE_LIMIT_DATABASE_UNAVAILABLE");
  }
  return env.DB;
}

function isoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new RateLimitError("E_RATE_LIMIT_INPUT_INVALID");
  }
  return date.toISOString();
}

export function fixedWindowBounds(now, windowSeconds) {
  const window = positiveInteger(windowSeconds, MAX_WINDOW_SECONDS);
  if (!window) throw new RateLimitError("E_RATE_LIMIT_INPUT_INVALID");
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) {
    throw new RateLimitError("E_RATE_LIMIT_INPUT_INVALID");
  }
  const windowMilliseconds = window * 1000;
  const startMilliseconds = Math.floor(
    nowDate.getTime() / windowMilliseconds
  ) * windowMilliseconds;
  return Object.freeze({
    startedAt: new Date(startMilliseconds).toISOString(),
    endsAt: new Date(startMilliseconds + windowMilliseconds).toISOString()
  });
}

export async function consumeFixedWindowRateLimit(
  env,
  {
    dimension,
    subjectKeyVersion,
    subjectHash,
    windowSeconds,
    maxRequests,
    retentionSeconds = windowSeconds,
    now = new Date()
  }
) {
  const database = requireDatabase(env);
  const normalizedDimension = String(dimension ?? "");
  const keyVersion = positiveInteger(subjectKeyVersion, Number.MAX_SAFE_INTEGER);
  const window = positiveInteger(windowSeconds, MAX_WINDOW_SECONDS);
  const limit = positiveInteger(maxRequests, 1_000_000);
  const retention = positiveInteger(retentionSeconds, MAX_RETENTION_SECONDS);
  const fingerprint = String(subjectHash ?? "");

  if (
    !DIMENSIONS.has(normalizedDimension)
    || !keyVersion
    || !window
    || !limit
    || !retention
    || !HASH_PATTERN.test(fingerprint)
  ) {
    throw new RateLimitError("E_RATE_LIMIT_INPUT_INVALID");
  }

  const currentAt = isoTimestamp(now);
  const bounds = fixedWindowBounds(currentAt, window);
  const expiresAt = new Date(
    new Date(bounds.endsAt).getTime() + retention * 1000
  ).toISOString();
  const bucketId = createOpaqueId();

  let row;
  try {
    row = await database.prepare(`
      INSERT INTO auth_rate_limit_buckets (
        id,
        dimension,
        subject_key_version,
        subject_hash,
        window_seconds,
        window_started_at,
        request_count,
        blocked_until,
        created_at,
        updated_at,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?)
      ON CONFLICT (
        dimension,
        subject_key_version,
        subject_hash,
        window_seconds,
        window_started_at
      ) DO UPDATE SET
        request_count = auth_rate_limit_buckets.request_count + 1,
        blocked_until = CASE
          WHEN auth_rate_limit_buckets.request_count + 1 > ?
          THEN ?
          ELSE auth_rate_limit_buckets.blocked_until
        END,
        updated_at = ?,
        expires_at = CASE
          WHEN datetime(auth_rate_limit_buckets.expires_at) > datetime(?)
          THEN auth_rate_limit_buckets.expires_at
          ELSE ?
        END
      RETURNING id, request_count, blocked_until, window_started_at, expires_at
    `).bind(
      bucketId,
      normalizedDimension,
      keyVersion,
      fingerprint,
      window,
      bounds.startedAt,
      currentAt,
      currentAt,
      expiresAt,
      limit,
      bounds.endsAt,
      currentAt,
      expiresAt,
      expiresAt
    ).first();
  } catch {
    throw new RateLimitError("E_RATE_LIMIT_PERSISTENCE_FAILED");
  }

  const requestCount = Number(row?.request_count);
  if (!row || !Number.isSafeInteger(requestCount) || requestCount < 1) {
    throw new RateLimitError("E_RATE_LIMIT_PERSISTENCE_FAILED");
  }

  const blockedUntil = row.blocked_until ? isoTimestamp(row.blocked_until) : null;
  const blocked = (
    requestCount > limit
    || (blockedUntil !== null && new Date(blockedUntil).getTime() > new Date(currentAt).getTime())
  );
  const retryAfterSeconds = blocked
    ? Math.max(1, Math.ceil(
      (new Date(blockedUntil || bounds.endsAt).getTime() - new Date(currentAt).getTime()) / 1000
    ))
    : 0;

  return Object.freeze({
    allowed: !blocked,
    blocked,
    requestCount,
    limit,
    retryAfterSeconds,
    windowStartedAt: bounds.startedAt,
    windowEndsAt: bounds.endsAt,
    bucketId: String(row.id)
  });
}

export { DIMENSIONS as RATE_LIMIT_DIMENSIONS };
