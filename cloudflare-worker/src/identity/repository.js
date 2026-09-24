import { constantTimeEqual, createOpaqueId } from "./crypto.js";
import { createAcceptedSessionTokenHashes } from "./session-keyring.js";

function parseAuthorizationContext(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function deadlineAllows(deadline, nowMs) {
  if (deadline === null || deadline === undefined || deadline === "") return true;
  const deadlineMs = Date.parse(String(deadline));
  return Number.isFinite(deadlineMs) && deadlineMs > nowMs;
}

function profileAllows(row) {
  if (row.realm === "customer") {
    return row.customer_profile_id !== null
      && row.customer_profile_id !== undefined;
  }
  return row.realm === "staff"
    && row.staff_profile_id !== null
    && row.staff_profile_id !== undefined
    && Number(row.staff_profile_is_active) === 1
    && typeof row.role === "string"
    && row.role.length > 0;
}

function sessionStatusAllows(row, nowMs) {
  if (!profileAllows(row)) return false;

  if (row.realm === "customer") {
    return (
      row.account_status === "active"
      && ["customer_guest", "customer_verified"].includes(row.scope)
    );
  }

  if (row.realm !== "staff" || row.account_status === "deleted") return false;

  if (["staff_strong", "staff_password_limited"].includes(row.scope)) {
    if (row.account_status !== "active") return false;
    if (row.scope === "staff_strong") return true;
    return (
      ["required", "in_progress"].includes(row.enrollment_state)
      && deadlineAllows(row.enrollment_deadline_at, nowMs)
    );
  }

  if (["staff_recovery_email", "staff_recovery_authorized"].includes(row.scope)) {
    return row.account_status === "active";
  }

  if (row.scope === "staff_enrollment") {
    if (!deadlineAllows(row.enrollment_deadline_at, nowMs)) return false;
    if (row.account_status === "pending") {
      return Number(row.has_accepted_staff_invitation) === 1;
    }
    if (row.account_status === "active") {
      return ["required", "in_progress"].includes(row.enrollment_state);
    }
    // Disabled enrollment-expired authorization remains denied until the
    // contract fixes its context proof and profile-mirror exception exactly.
    return false;
  }

  // A disabled break-glass account also has an inactive mirrored staff
  // profile. It remains denied until that runbook exception is represented by
  // a closed authorization-context contract.
  return row.scope === "break_glass" && row.account_status === "active";
}

export async function resolveCanonicalSession(
  env,
  rawToken,
  realm,
  { now = new Date() } = {}
) {
  if (!env?.DB || !rawToken || !realm) return null;
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) return null;
  const nowIso = nowDate.toISOString();
  const acceptedHashes = await createAcceptedSessionTokenHashes(env, rawToken);
  const hashPredicates = acceptedHashes.map(() => (
    "(s.token_hash_version = ? AND s.token_hash = ?)"
  )).join(" OR ");
  const hashBindings = acceptedHashes.flatMap(({ tokenHashVersion, tokenHash }) => (
    [tokenHashVersion, tokenHash]
  ));
  const row = await env.DB.prepare(`
    SELECT
      s.*,
      a.status AS account_status,
      a.auth_version AS current_auth_version,
      a.enrollment_state,
      a.enrollment_deadline_at,
      a.disabled_reason,
      u.id AS staff_profile_id,
      u.role AS role,
      u.is_active AS staff_profile_is_active,
      c.id AS customer_profile_id,
      c.is_blocked AS customer_profile_is_blocked,
      CASE WHEN EXISTS (
        SELECT 1
        FROM auth_staff_invitations i
        WHERE i.auth_account_id = a.id
          AND i.admin_user_id = u.id
          AND i.status = 'accepted'
          AND i.accepted_at IS NOT NULL
      ) THEN 1 ELSE 0 END AS has_accepted_staff_invitation
    FROM auth_sessions s
    JOIN auth_accounts a ON a.id = s.auth_account_id
    LEFT JOIN admin_users u
      ON a.realm = 'staff'
     AND u.auth_account_id = a.id
    LEFT JOIN customers c
      ON a.realm = 'customer'
     AND c.auth_account_id = a.id
    WHERE (${hashPredicates})
      AND s.realm = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime(?)
    LIMIT 1
  `).bind(...hashBindings, realm, nowIso).first();

  if (!row) return null;
  if (row.realm !== realm) return null;
  const matchedHash = acceptedHashes.find(({ tokenHashVersion }) => (
    tokenHashVersion === Number(row.token_hash_version)
  ));
  if (
    !matchedHash
    || !await constantTimeEqual(matchedHash.tokenHash, row.token_hash)
  ) {
    return null;
  }
  if (Number(row.issued_auth_version) !== Number(row.current_auth_version)) {
    return null;
  }
  if (!sessionStatusAllows(row, nowMs)) return null;

  return {
    ...row,
    authorization_context: parseAuthorizationContext(
      row.authorization_context_json
    )
  };
}

export async function appendSecurityEvent(env, event) {
  if (!env?.DB) throw new Error("D1 binding is unavailable");
  const id = createOpaqueId();
  await env.DB.prepare(`
    INSERT INTO auth_security_events (
      id,
      event_type,
      outcome,
      subject_account_id,
      actor_account_id,
      actor_role,
      correlation_id,
      fingerprint_key_version,
      request_ip_hash,
      request_user_agent_hash,
      request_device_hash,
      metadata_json,
      occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    event.event_type,
    event.outcome,
    event.subject_account_id || null,
    event.actor_account_id || null,
    event.actor_role || null,
    event.correlation_id,
    event.fingerprint_key_version,
    event.request_ip_hash || null,
    event.request_user_agent_hash || null,
    event.request_device_hash || null,
    JSON.stringify(event.metadata || {}),
    new Date().toISOString()
  ).run();
  return id;
}

const TELEGRAM_CUSTOMER_IDENTITY_PROVIDER = "telegram";
const TELEGRAM_CUSTOMER_LOCALES = new Set([
  "en",
  "de",
  "tr",
  "ar",
  "ru"
]);

function createTelegramIdentityError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeTelegramText(value, maximumLength = 255) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maximumLength) : null;
}

function normalizeTelegramCustomerInput(
  telegramUser,
  detectedLanguage
) {
  const providerSubject = String(telegramUser?.id ?? "").trim();

  if (!providerSubject || providerSubject.length > 255) {
    throw createTelegramIdentityError(
      "invalid_telegram_identity",
      "Telegram identity is missing or invalid"
    );
  }

  const requestedLanguage = String(
    detectedLanguage || "unknown"
  ).trim().toLowerCase();

  const language = TELEGRAM_CUSTOMER_LOCALES.has(requestedLanguage)
    ? requestedLanguage
    : "unknown";

  const locale = language === "unknown" ? "en" : language;
  const username = normalizeTelegramText(telegramUser?.username);
  const firstName = normalizeTelegramText(
    telegramUser?.first_name
  );
  const lastName = normalizeTelegramText(
    telegramUser?.last_name
  );
  const fullName = [firstName, lastName]
    .filter(Boolean)
    .join(" ") || null;

  return {
    providerSubject,
    username,
    fullName,
    language,
    locale,
    providerMetadataJson: JSON.stringify({
      username,
      first_name: firstName,
      last_name: lastName
    })
  };
}

async function findCanonicalTelegramCustomer(
  env,
  providerSubject
) {
  return env.DB.prepare(`
    SELECT
      c.*,
      x.id AS external_identity_id,
      x.auth_account_id AS external_auth_account_id,
      a.realm AS auth_account_realm,
      a.status AS auth_account_status
    FROM auth_external_identities x
    JOIN auth_accounts a
      ON a.id = x.auth_account_id
     AND a.realm = x.realm
    LEFT JOIN customers c
      ON c.auth_account_id = x.auth_account_id
    WHERE x.provider = ?
      AND x.provider_subject = ?
      AND x.revoked_at IS NULL
    LIMIT 1
  `).bind(
    TELEGRAM_CUSTOMER_IDENTITY_PROVIDER,
    providerSubject
  ).first();
}

async function findLegacyTelegramCustomer(
  env,
  providerSubject
) {
  return env.DB.prepare(`
    SELECT
      c.*,
      a.realm AS auth_account_realm,
      a.status AS auth_account_status
    FROM customers c
    LEFT JOIN auth_accounts a
      ON a.id = c.auth_account_id
    WHERE c.telegram_user_id = ?
    LIMIT 1
  `).bind(providerSubject).first();
}

async function findActiveTelegramIdentityForAccount(
  env,
  authAccountId
) {
  return env.DB.prepare(`
    SELECT
      id,
      provider_subject
    FROM auth_external_identities
    WHERE auth_account_id = ?
      AND provider = ?
      AND revoked_at IS NULL
    LIMIT 1
  `).bind(
    authAccountId,
    TELEGRAM_CUSTOMER_IDENTITY_PROVIDER
  ).first();
}

function assertUsableCanonicalTelegramMapping(
  canonical,
  legacy,
  providerSubject
) {
  if (
    !canonical ||
    !canonical.external_identity_id ||
    canonical.id === null ||
    canonical.id === undefined
  ) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Telegram identity has no canonical customer profile"
    );
  }

  if (
    canonical.auth_account_realm !== "customer" ||
    canonical.auth_account_status !== "active"
  ) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Telegram identity is not linked to an active customer account"
    );
  }

  if (
    canonical.auth_account_id !==
    canonical.external_auth_account_id
  ) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Telegram identity and customer profile disagree"
    );
  }

  if (String(canonical.telegram_user_id) !== providerSubject) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Telegram identity points to a different customer"
    );
  }

  if (
    legacy &&
    (
      Number(legacy.id) !== Number(canonical.id) ||
      legacy.auth_account_id !== canonical.auth_account_id
    )
  ) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Conflicting legacy and canonical Telegram mappings exist"
    );
  }
}

function assertUsableLegacyTelegramCustomer(legacy) {
  if (
    !legacy?.auth_account_id ||
    legacy.auth_account_realm !== "customer" ||
    legacy.auth_account_status !== "active"
  ) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Legacy Telegram customer has no active canonical account"
    );
  }
}

async function refreshCanonicalTelegramCustomer(
  env,
  canonical,
  input
) {
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE customers
      SET
        username = ?,
        full_name = ?,
        language = CASE
          WHEN ? = 'unknown'
            THEN COALESCE(language, 'unknown')
          ELSE ?
        END,
        preferred_language = CASE
          WHEN ? = 'unknown'
            THEN COALESCE(preferred_language, 'en')
          ELSE ?
        END,
        last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND auth_account_id = ?
    `).bind(
      input.username,
      input.fullName,
      input.language,
      input.language,
      input.language,
      input.locale,
      canonical.id,
      canonical.auth_account_id
    ),
    env.DB.prepare(`
      UPDATE auth_accounts
      SET
        locale = CASE
          WHEN ? = 'unknown' THEN locale
          ELSE ?
        END,
        updated_at = ?
      WHERE id = ?
        AND realm = 'customer'
        AND status = 'active'
    `).bind(
      input.language,
      input.locale,
      now,
      canonical.auth_account_id
    ),
    env.DB.prepare(`
      UPDATE auth_external_identities
      SET
        provider_metadata_json = ?,
        last_authenticated_at = ?,
        updated_at = ?
      WHERE id = ?
        AND revoked_at IS NULL
    `).bind(
      input.providerMetadataJson,
      now,
      now,
      canonical.external_identity_id
    )
  ]);

  const refreshed = await env.DB.prepare(`
    SELECT *
    FROM customers
    WHERE id = ?
      AND auth_account_id = ?
    LIMIT 1
  `).bind(
    canonical.id,
    canonical.auth_account_id
  ).first();

  if (!refreshed) {
    throw createTelegramIdentityError(
      "telegram_identity_conflict",
      "Canonical Telegram customer disappeared during refresh"
    );
  }

  return refreshed;
}

function isUniquenessConflict(error) {
  return /unique constraint|constraint failed|sqlite_constraint/i.test(
    String(error?.message || error || "")
  );
}

async function resolveTelegramIdentityRace(
  env,
  input,
  legacy,
  originalError
) {
  const winner = await findCanonicalTelegramCustomer(
    env,
    input.providerSubject
  );

  if (winner) {
    assertUsableCanonicalTelegramMapping(
      winner,
      legacy,
      input.providerSubject
    );

    return refreshCanonicalTelegramCustomer(
      env,
      winner,
      input
    );
  }

  if (legacy?.auth_account_id) {
    const occupied =
      await findActiveTelegramIdentityForAccount(
        env,
        legacy.auth_account_id
      );

    if (
      occupied &&
      occupied.provider_subject !== input.providerSubject
    ) {
      throw createTelegramIdentityError(
        "telegram_identity_conflict",
        "Customer account already has another Telegram identity"
      );
    }
  }

  throw originalError;
}

async function linkLegacyTelegramCustomer(
  env,
  legacy,
  input
) {
  assertUsableLegacyTelegramCustomer(legacy);

  const occupied = await findActiveTelegramIdentityForAccount(
    env,
    legacy.auth_account_id
  );

  if (occupied) {
    if (occupied.provider_subject !== input.providerSubject) {
      throw createTelegramIdentityError(
        "telegram_identity_conflict",
        "Customer account already has another Telegram identity"
      );
    }

    const canonical = await findCanonicalTelegramCustomer(
      env,
      input.providerSubject
    );

    assertUsableCanonicalTelegramMapping(
      canonical,
      legacy,
      input.providerSubject
    );

    return refreshCanonicalTelegramCustomer(
      env,
      canonical,
      input
    );
  }

  const now = new Date().toISOString();
  const externalIdentityId = createOpaqueId();
  const transitionId = createOpaqueId();

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO auth_external_identities (
          id,
          auth_account_id,
          realm,
          provider,
          provider_subject,
          verified_at,
          linked_at,
          last_authenticated_at,
          created_transition_id,
          provider_metadata_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'customer', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        externalIdentityId,
        legacy.auth_account_id,
        TELEGRAM_CUSTOMER_IDENTITY_PROVIDER,
        input.providerSubject,
        now,
        now,
        now,
        transitionId,
        input.providerMetadataJson,
        now,
        now
      )
    ]);
  } catch (error) {
    if (!isUniquenessConflict(error)) {
      throw error;
    }

    return resolveTelegramIdentityRace(
      env,
      input,
      legacy,
      error
    );
  }

  const canonical = await findCanonicalTelegramCustomer(
    env,
    input.providerSubject
  );

  assertUsableCanonicalTelegramMapping(
    canonical,
    legacy,
    input.providerSubject
  );

  return refreshCanonicalTelegramCustomer(
    env,
    canonical,
    input
  );
}

async function createCanonicalTelegramCustomer(
  env,
  input
) {
  const now = new Date().toISOString();
  const authAccountId = createOpaqueId();
  const webauthnUserHandle = createOpaqueId();
  const accountTransitionId = createOpaqueId();
  const externalIdentityId = createOpaqueId();
  const identityTransitionId = createOpaqueId();

  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO auth_accounts (
          id,
          webauthn_user_handle,
          realm,
          status,
          auth_version,
          enrollment_state,
          last_transition_id,
          locale,
          created_at,
          updated_at
        )
        VALUES (
          ?,
          ?,
          'customer',
          'active',
          1,
          'not_required',
          ?,
          ?,
          ?,
          ?
        )
      `).bind(
        authAccountId,
        webauthnUserHandle,
        accountTransitionId,
        input.locale,
        now,
        now
      ),
      env.DB.prepare(`
        INSERT INTO customers (
          telegram_user_id,
          username,
          full_name,
          language,
          preferred_language,
          last_seen_at,
          created_at,
          auth_account_id
        )
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `).bind(
        input.providerSubject,
        input.username,
        input.fullName,
        input.language,
        input.locale,
        now,
        authAccountId
      ),
      env.DB.prepare(`
        INSERT INTO auth_external_identities (
          id,
          auth_account_id,
          realm,
          provider,
          provider_subject,
          verified_at,
          linked_at,
          last_authenticated_at,
          created_transition_id,
          provider_metadata_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, 'customer', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        externalIdentityId,
        authAccountId,
        TELEGRAM_CUSTOMER_IDENTITY_PROVIDER,
        input.providerSubject,
        now,
        now,
        now,
        identityTransitionId,
        input.providerMetadataJson,
        now,
        now
      )
    ]);
  } catch (error) {
    if (!isUniquenessConflict(error)) {
      throw error;
    }

    return resolveTelegramIdentityRace(
      env,
      input,
      null,
      error
    );
  }

  const canonical = await findCanonicalTelegramCustomer(
    env,
    input.providerSubject
  );

  assertUsableCanonicalTelegramMapping(
    canonical,
    null,
    input.providerSubject
  );

  return canonical;
}

export async function upsertCanonicalTelegramCustomer(
  env,
  telegramUser,
  detectedLanguage = "unknown"
) {
  const input = normalizeTelegramCustomerInput(
    telegramUser,
    detectedLanguage
  );

  const [canonical, legacy] = await Promise.all([
    findCanonicalTelegramCustomer(
      env,
      input.providerSubject
    ),
    findLegacyTelegramCustomer(
      env,
      input.providerSubject
    )
  ]);

  if (canonical) {
    assertUsableCanonicalTelegramMapping(
      canonical,
      legacy,
      input.providerSubject
    );

    return refreshCanonicalTelegramCustomer(
      env,
      canonical,
      input
    );
  }

  if (legacy) {
    return linkLegacyTelegramCustomer(
      env,
      legacy,
      input
    );
  }

  return createCanonicalTelegramCustomer(env, input);
}
