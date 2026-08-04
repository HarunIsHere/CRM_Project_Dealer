import { createOpaqueId } from "../crypto.js";
import { encryptOutboxPayload } from "./outbox-crypto.js";
import { getIdentityEmailTemplatePolicy } from "./policy.js";

const OUTBOX_ID_PATTERN = /^[0-9a-f]{32}$/;
const TERMINAL_STATUSES = new Set(["failed", "expired", "cancelled"]);
const REALMS = new Set(["customer", "staff"]);
const LOCALES = new Set(["en", "de", "tr", "ar", "ru"]);

export class OutboxRepositoryError extends Error {
  constructor(code) {
    super("Authentication email outbox persistence failed.");
    this.name = "OutboxRepositoryError";
    this.code = code;
  }
}

function requireDatabase(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    throw new OutboxRepositoryError("E_OUTBOX_DATABASE_UNAVAILABLE");
  }
  return env.DB;
}

function validOutboxId(value) {
  return OUTBOX_ID_PATTERN.test(String(value ?? ""));
}

function isoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new OutboxRepositoryError("E_OUTBOX_TIMESTAMP_INVALID");
  }
  return date.toISOString();
}

function changedRows(result) {
  return Number(result?.meta?.changes ?? 0);
}

function safeLimit(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 25;
  return Math.min(parsed, 100);
}

function metadataField(metadata, snakeName, camelName) {
  return metadata?.[snakeName] ?? metadata?.[camelName] ?? null;
}

export async function prepareEncryptedOutboxInsert(env, metadata, payload) {
  const database = requireDatabase(env);
  const suppliedId = metadataField(metadata, "id", "outboxId");
  const outboxId = suppliedId === null ? createOpaqueId() : String(suppliedId);
  const challengeId = metadataField(metadata, "challenge_id", "challengeId");
  const securityEventId = metadataField(
    metadata,
    "security_event_id",
    "securityEventId"
  );
  const emailAddressId = String(
    metadataField(metadata, "email_address_id", "emailAddressId") ?? ""
  );
  const authAccountId = String(
    metadataField(metadata, "auth_account_id", "authAccountId") ?? ""
  );
  const realm = String(metadataField(metadata, "realm", "realm") ?? "");
  const templateKey = String(
    metadataField(metadata, "template_key", "templateKey") ?? ""
  );
  const suppliedChallengePurpose = metadataField(
    metadata,
    "challenge_purpose",
    "challengePurpose"
  );
  const challengePurpose = suppliedChallengePurpose === null
    ? null
    : String(suppliedChallengePurpose);
  const locale = String(metadataField(metadata, "locale", "locale") ?? "");
  const dedupeKey = String(
    metadataField(metadata, "dedupe_key", "dedupeKey") ?? ""
  );
  const availableAt = isoTimestamp(
    metadataField(metadata, "available_at", "availableAt") ?? new Date()
  );
  const expiresAt = isoTimestamp(
    metadataField(metadata, "expires_at", "expiresAt")
  );
  const maxAttempts = Number(
    metadataField(metadata, "max_attempts", "maxAttempts") ?? 5
  );
  const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);

  if (
    !validOutboxId(outboxId)
    || !validOutboxId(emailAddressId)
    || !validOutboxId(authAccountId)
    || !REALMS.has(realm)
    || !LOCALES.has(locale)
    || !templatePolicy
    || templatePolicy.realm !== realm
    || !dedupeKey
    || dedupeKey.length > 240
    || !Number.isSafeInteger(maxAttempts)
    || maxAttempts < 1
    || maxAttempts > 20
    || new Date(expiresAt).getTime() <= new Date(availableAt).getTime()
  ) {
    throw new OutboxRepositoryError("E_OUTBOX_INSERT_METADATA_INVALID");
  }

  const hasChallenge = challengeId !== null && challengeId !== undefined;
  const hasSecurityEvent = securityEventId !== null && securityEventId !== undefined;
  if (
    hasChallenge === hasSecurityEvent
    || (hasChallenge && !validOutboxId(challengeId))
    || (hasSecurityEvent && !validOutboxId(securityEventId))
  ) {
    throw new OutboxRepositoryError("E_OUTBOX_INSERT_PARENT_INVALID");
  }
  if (
    (hasChallenge && (
      templatePolicy.kind !== "challenge"
      || challengePurpose !== templatePolicy.challengePurpose
    ))
    || (hasSecurityEvent && (
      templatePolicy.kind !== "notification"
      || challengePurpose !== null
    ))
  ) {
    throw new OutboxRepositoryError("E_OUTBOX_INSERT_TEMPLATE_POLICY_INVALID");
  }

  const encryptionContext = {
    id: outboxId,
    challenge_id: hasChallenge ? String(challengeId) : null,
    security_event_id: hasSecurityEvent ? String(securityEventId) : null,
    email_address_id: emailAddressId,
    auth_account_id: authAccountId,
    realm,
    template_key: templateKey,
    locale,
    dedupe_key: dedupeKey,
    expires_at: expiresAt
  };
  const encrypted = await encryptOutboxPayload(env, encryptionContext, payload);
  const statement = database.prepare(`
    INSERT INTO auth_email_outbox (
      id,
      challenge_id,
      security_event_id,
      email_address_id,
      auth_account_id,
      realm,
      template_key,
      locale,
      payload_ciphertext,
      payload_iv,
      encryption_key_version,
      dedupe_key,
      status,
      attempt_count,
      max_attempts,
      available_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
  `).bind(
    outboxId,
    hasChallenge ? String(challengeId) : null,
    hasSecurityEvent ? String(securityEventId) : null,
    emailAddressId,
    authAccountId,
    realm,
    templateKey,
    locale,
    encrypted.payloadCiphertext,
    encrypted.payloadIv,
    encrypted.encryptionKeyVersion,
    dedupeKey,
    maxAttempts,
    availableAt,
    expiresAt
  );

  return {
    outboxId,
    statement,
    encryptionKeyVersion: encrypted.encryptionKeyVersion
  };
}

export async function claimOutboxItem(
  env,
  outboxId,
  { now = new Date(), leaseSeconds = 120 } = {}
) {
  if (!validOutboxId(outboxId)) return null;
  const duration = Number(leaseSeconds);
  if (!Number.isSafeInteger(duration) || duration < 30 || duration > 900) {
    throw new OutboxRepositoryError("E_OUTBOX_LEASE_DURATION_INVALID");
  }

  const database = requireDatabase(env);
  const nowAt = isoTimestamp(now);
  const leaseId = createOpaqueId();
  const leaseExpiresAt = isoTimestamp(
    new Date(new Date(nowAt).getTime() + duration * 1000)
  );

  const result = await database.prepare(`
    UPDATE auth_email_outbox
    SET status = 'leased',
        lease_id = ?,
        lease_expires_at = ?,
        attempt_count = attempt_count + 1,
        updated_at = ?
    WHERE id = ?
      AND datetime(expires_at) > datetime(?)
      AND attempt_count < max_attempts
      AND (
        (
          status IN ('pending', 'retry')
          AND datetime(available_at) <= datetime(?)
        )
        OR (
          status = 'leased'
          AND datetime(lease_expires_at) <= datetime(?)
        )
      )
  `).bind(
    leaseId,
    leaseExpiresAt,
    nowAt,
    outboxId,
    nowAt,
    nowAt,
    nowAt
  ).run();

  if (changedRows(result) !== 1) return null;
  return { outboxId, leaseId, leaseExpiresAt };
}

export async function loadLeasedOutboxItem(env, outboxId, leaseId) {
  if (!validOutboxId(outboxId) || !validOutboxId(leaseId)) return null;
  const database = requireDatabase(env);
  return database.prepare(`
    SELECT
      o.*,
      e.display_email,
      e.status AS email_status,
      e.is_primary AS email_is_primary,
      c.id AS challenge_row_id,
      c.status AS challenge_status,
      c.purpose AS challenge_purpose,
      c.email_address_id AS challenge_email_address_id,
      c.auth_account_id AS challenge_auth_account_id,
      c.realm AS challenge_realm,
      c.expires_at AS challenge_expires_at,
      c.correlation_id AS challenge_correlation_id,
      s.id AS security_event_row_id,
      s.subject_account_id AS security_event_subject_account_id,
      s.correlation_id AS security_event_correlation_id
    FROM auth_email_outbox o
    JOIN auth_email_addresses e
      ON e.id = o.email_address_id
     AND e.auth_account_id = o.auth_account_id
     AND e.realm = o.realm
    LEFT JOIN auth_challenges c
      ON c.id = o.challenge_id
     AND c.email_address_id = o.email_address_id
     AND c.auth_account_id = o.auth_account_id
     AND c.realm = o.realm
    LEFT JOIN auth_security_events s
      ON s.id = o.security_event_id
     AND s.subject_account_id = o.auth_account_id
    WHERE o.id = ?
      AND o.status = 'leased'
      AND o.lease_id = ?
    LIMIT 1
  `).bind(outboxId, leaseId).first();
}

export async function markOutboxSent(
  env,
  outboxId,
  leaseId,
  { provider, messageId = null, now = new Date() }
) {
  const database = requireDatabase(env);
  const sentAt = isoTimestamp(now);
  const result = await database.prepare(`
    UPDATE auth_email_outbox
    SET status = 'sent',
        provider = ?,
        provider_message_id = ?,
        last_error_code = NULL,
        sent_at = ?,
        discarded_at = ?,
        payload_ciphertext = NULL,
        payload_iv = NULL,
        lease_id = NULL,
        lease_expires_at = NULL,
        updated_at = ?
    WHERE id = ?
      AND status = 'leased'
      AND lease_id = ?
  `).bind(
    String(provider ?? "unknown"),
    messageId ? String(messageId) : null,
    sentAt,
    sentAt,
    sentAt,
    outboxId,
    leaseId
  ).run();
  return changedRows(result) === 1;
}

export async function scheduleOutboxRetry(
  env,
  outboxId,
  leaseId,
  { provider = null, errorCode, availableAt, now = new Date() }
) {
  const database = requireDatabase(env);
  const updatedAt = isoTimestamp(now);
  const nextAttemptAt = isoTimestamp(availableAt);
  const result = await database.prepare(`
    UPDATE auth_email_outbox
    SET status = 'retry',
        provider = COALESCE(?, provider),
        last_error_code = ?,
        available_at = ?,
        lease_id = NULL,
        lease_expires_at = NULL,
        updated_at = ?
    WHERE id = ?
      AND status = 'leased'
      AND lease_id = ?
      AND attempt_count < max_attempts
      AND datetime(expires_at) > datetime(?)
  `).bind(
    provider ? String(provider) : null,
    String(errorCode ?? "E_EMAIL_DELIVERY_RETRY"),
    nextAttemptAt,
    updatedAt,
    outboxId,
    leaseId,
    updatedAt
  ).run();
  return changedRows(result) === 1;
}

export async function terminalizeOutboxItem(
  env,
  outboxId,
  leaseId,
  { status, provider = null, errorCode, now = new Date() }
) {
  if (!TERMINAL_STATUSES.has(status)) {
    throw new OutboxRepositoryError("E_OUTBOX_TERMINAL_STATUS_INVALID");
  }
  const database = requireDatabase(env);
  const discardedAt = isoTimestamp(now);
  const result = await database.prepare(`
    UPDATE auth_email_outbox
    SET status = ?,
        provider = COALESCE(?, provider),
        last_error_code = ?,
        discarded_at = ?,
        payload_ciphertext = NULL,
        payload_iv = NULL,
        lease_id = NULL,
        lease_expires_at = NULL,
        updated_at = ?
    WHERE id = ?
      AND status = 'leased'
      AND lease_id = ?
  `).bind(
    status,
    provider ? String(provider) : null,
    String(errorCode ?? "E_OUTBOX_TERMINAL"),
    discardedAt,
    discardedAt,
    outboxId,
    leaseId
  ).run();
  return changedRows(result) === 1;
}

export async function expireUndeliverableOutboxItems(env, now = new Date()) {
  const database = requireDatabase(env);
  if (typeof database.batch !== "function") {
    throw new OutboxRepositoryError("E_OUTBOX_BATCH_UNAVAILABLE");
  }
  const currentAt = isoTimestamp(now);
  const results = await database.batch([
    database.prepare(`
      UPDATE auth_email_outbox
      SET status = 'expired',
          last_error_code = COALESCE(last_error_code, 'E_OUTBOX_EXPIRED'),
          discarded_at = ?,
          payload_ciphertext = NULL,
          payload_iv = NULL,
          lease_id = NULL,
          lease_expires_at = NULL,
          updated_at = ?
      WHERE datetime(expires_at) <= datetime(?)
        AND (
          status IN ('pending', 'retry')
          OR (
            status = 'leased'
            AND datetime(lease_expires_at) <= datetime(?)
          )
        )
    `).bind(currentAt, currentAt, currentAt, currentAt),
    database.prepare(`
      UPDATE auth_email_outbox
      SET status = 'failed',
          last_error_code = COALESCE(last_error_code, 'E_OUTBOX_RETRY_EXHAUSTED'),
          discarded_at = ?,
          payload_ciphertext = NULL,
          payload_iv = NULL,
          lease_id = NULL,
          lease_expires_at = NULL,
          updated_at = ?
      WHERE attempt_count >= max_attempts
        AND (
          status IN ('pending', 'retry')
          OR (
            status = 'leased'
            AND datetime(lease_expires_at) <= datetime(?)
          )
        )
        AND datetime(expires_at) > datetime(?)
    `).bind(currentAt, currentAt, currentAt, currentAt)
  ]);

  return results.reduce(
    (total, result) => total + changedRows(result),
    0
  );
}

export async function listDueOutboxIds(
  env,
  { now = new Date(), limit = 25 } = {}
) {
  const database = requireDatabase(env);
  const currentAt = isoTimestamp(now);
  const result = await database.prepare(`
    SELECT id
    FROM auth_email_outbox
    WHERE datetime(expires_at) > datetime(?)
      AND attempt_count < max_attempts
      AND (
        (
          status IN ('pending', 'retry')
          AND datetime(available_at) <= datetime(?)
        )
        OR (
          status = 'leased'
          AND datetime(lease_expires_at) <= datetime(?)
        )
      )
    ORDER BY datetime(available_at), created_at, id
    LIMIT ?
  `).bind(currentAt, currentAt, currentAt, safeLimit(limit)).all();

  return (result?.results ?? [])
    .map((row) => String(row.id ?? ""))
    .filter(validOutboxId);
}
