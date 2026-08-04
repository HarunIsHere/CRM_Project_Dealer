import {
  createMagicLinkToken,
  createVersionedChallengeTokenHash,
  readChallengeHmacKeyring
} from "../challenge-token.js";
import { createOpaqueId, hashOpaqueToken } from "../crypto.js";
import { maskEmailAddress, normalizeEmailAddress } from "../email/normalization.js";
import { prepareEncryptedOutboxInsert } from "../email/outbox-repository.js";

const MAINTENANCE_GATE = "execute";
const PASSWORD_SENTINEL = "!canonical-auth-disabled!";
const INVITATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SUPPORTED_LOCALES = new Set(["en", "de", "tr", "ar", "ru"]);
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const OWNER_RECEIPT_PATTERN = /^[A-Za-z0-9._:-]+$/;
const ACCOUNT_STATUSES = new Set(["pending", "active", "disabled"]);
const ENROLLMENT_STATES = new Set([
  "required", "in_progress", "complete", "expired"
]);
const EMAIL_STATUSES = new Set(["pending", "verified", "replaced", "revoked"]);
const INVITATION_STATUSES = new Set(["pending", "accepted", "revoked", "expired"]);
const CHALLENGE_STATUSES = new Set([
  "pending", "verified", "consumed", "invalidated", "expired"
]);
const OUTBOX_STATUSES = new Set([
  "pending", "leased", "retry", "sent", "failed", "expired", "cancelled"
]);

export class StaffBootstrapError extends Error {
  constructor(code) {
    super("Protected staff reconciliation could not be completed.");
    this.name = "StaffBootstrapError";
    this.code = code;
  }
}

function fail(code) {
  throw new StaffBootstrapError(code);
}

function requiredString(env, name, { secret = false } = {}) {
  const value = env?.[name];
  if (typeof value !== "string" || value.trim() === "") {
    fail(secret ? "E_STAFF_BOOTSTRAP_SECRET_MISSING" : "E_STAFF_BOOTSTRAP_CONFIG_MISSING");
  }
  return value.trim();
}

function readUsername(env, name) {
  const username = requiredString(env, name);
  if (username.length > 120 || !USERNAME_PATTERN.test(username)) {
    fail("E_STAFF_BOOTSTRAP_USERNAME_INVALID");
  }
  return { username, usernameNormalized: username.toLowerCase() };
}

function readLocale(env, name) {
  const locale = requiredString(env, name).toLowerCase();
  if (!SUPPORTED_LOCALES.has(locale)) {
    fail("E_STAFF_BOOTSTRAP_LOCALE_INVALID");
  }
  return locale;
}

function readEmail(env, name) {
  try {
    return normalizeEmailAddress(requiredString(env, name, { secret: true }));
  } catch (error) {
    if (error instanceof StaffBootstrapError) throw error;
    fail("E_STAFF_BOOTSTRAP_EMAIL_INVALID");
  }
}

function readPublicOrigin(env) {
  const configured = String(env?.CRM_AUTH_PUBLIC_ORIGIN ?? "").trim();
  const source = configured || "https://crm.ayartuerk.me";
  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    fail("E_STAFF_BOOTSTRAP_ORIGIN_INVALID");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
  ) {
    fail("E_STAFF_BOOTSTRAP_ORIGIN_INVALID");
  }

  const allowed = String(env?.CRM_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured && !allowed.includes(parsed.origin)) {
    fail("E_STAFF_BOOTSTRAP_ORIGIN_NOT_ALLOWED");
  }
  return parsed.origin;
}

function readChallengeTokenKey(env) {
  try {
    const keyring = readChallengeHmacKeyring(env);
    return { version: keyring.activeVersion };
  } catch {
    fail("E_STAFF_BOOTSTRAP_CHALLENGE_KEY_INVALID");
  }
}

function requireDatabase(env) {
  if (
    !env?.DB
    || typeof env.DB.prepare !== "function"
    || typeof env.DB.batch !== "function"
  ) {
    fail("E_STAFF_BOOTSTRAP_DATABASE_UNAVAILABLE");
  }
  return env.DB;
}

export function readEnvironmentStaffBootstrapConfig(env) {
  if (String(env?.CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE ?? "") !== MAINTENANCE_GATE) {
    fail("E_STAFF_BOOTSTRAP_MAINTENANCE_DISABLED");
  }

  const superadmin = readUsername(env, "SUPERADMIN_USERNAME");
  const admin = readUsername(env, "ADMIN_USERNAME");
  if (superadmin.usernameNormalized === admin.usernameNormalized) {
    fail("E_STAFF_BOOTSTRAP_USERNAME_COLLISION");
  }

  const superadminEmail = readEmail(env, "CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL");
  const adminEmail = readEmail(env, "CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL");
  if (superadminEmail.normalizedEmail === adminEmail.normalizedEmail) {
    fail("E_STAFF_BOOTSTRAP_EMAIL_COLLISION");
  }

  const ownerReceipt = requiredString(env, "CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT", {
    secret: true
  });
  if (
    ownerReceipt.length < 16
    || ownerReceipt.length > 120
    || !OWNER_RECEIPT_PATTERN.test(ownerReceipt)
  ) {
    fail("E_STAFF_BOOTSTRAP_OWNER_RECEIPT_INVALID");
  }

  const fingerprintKey = requiredString(env, "CRM_AUTH_FINGERPRINT_KEY_V1", {
    secret: true
  });
  if (fingerprintKey.length < 32) {
    fail("E_STAFF_BOOTSTRAP_FINGERPRINT_KEY_INVALID");
  }
  const challengeToken = readChallengeTokenKey(env);

  const targets = [
    {
      ...superadmin,
      role: "superadmin",
      locale: readLocale(env, "CRM_AUTH_BOOTSTRAP_SUPERADMIN_LOCALE"),
      ...superadminEmail
    },
    {
      ...admin,
      role: "admin",
      locale: readLocale(env, "CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE"),
      ...adminEmail
    }
  ];

  return Object.freeze({
    ownerReceipt,
    fingerprintKey,
    challengeTokenKeyVersion: challengeToken.version,
    publicOrigin: readPublicOrigin(env),
    targets: Object.freeze(targets.map((target) => Object.freeze(target)))
  });
}

function asRows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function loadTargetState(database, target, ownerReceipt) {
  return database.prepare(`
    /* staff-bootstrap-state-v1 */
    SELECT
      u.id AS admin_user_id,
      u.username,
      u.username_normalized,
      u.password_hash,
      u.role,
      u.is_active,
      u.is_protected,
      u.auth_account_id,
      a.realm AS account_realm,
      a.status AS account_status,
      a.enrollment_state,
      a.enrollment_deadline_at,
      a.locale AS account_locale,
      e.id AS email_address_id,
      e.normalized_email,
      e.status AS email_status,
      e.is_primary AS email_is_primary,
      i.id AS invitation_id,
      i.status AS invitation_status,
      i.invited_by_actor_ref,
      c.id AS challenge_id,
      c.purpose AS challenge_purpose,
      c.status AS challenge_status,
      c.locale AS challenge_locale,
      o.id AS outbox_id,
      o.template_key AS outbox_template_key,
      o.status AS outbox_status,
      o.locale AS outbox_locale,
      (
        SELECT COUNT(*)
        FROM auth_email_addresses ec
        WHERE ec.auth_account_id = a.id
          AND ec.realm = 'staff'
          AND ec.normalized_email = ?
      ) AS email_match_count,
      (
        SELECT COUNT(*)
        FROM auth_staff_invitations ic
        JOIN auth_email_addresses ie ON ie.id = ic.email_address_id
        WHERE ic.auth_account_id = a.id
          AND ic.invited_by_actor_ref = ?
          AND ie.normalized_email = ?
      ) AS invitation_match_count,
      (
        SELECT COUNT(*)
        FROM auth_email_outbox oc
        WHERE oc.challenge_id = i.challenge_id
          AND oc.template_key = 'auth.staff.invitation.v1'
      ) AS outbox_match_count,
      (
        SELECT COUNT(*)
        FROM auth_security_events sc
        WHERE sc.subject_account_id = a.id
          AND sc.event_type = 'staff.bootstrap.reconciliation.created'
          AND sc.actor_role = 'owner'
      ) AS security_event_count,
      (
        SELECT COUNT(*)
        FROM auth_password_credentials pc
        WHERE pc.auth_account_id = a.id
          AND pc.revoked_at IS NULL
      ) AS password_credential_count
    FROM admin_users u
    LEFT JOIN auth_accounts a ON a.id = u.auth_account_id
    LEFT JOIN auth_email_addresses e ON e.id = (
      SELECT e2.id
      FROM auth_email_addresses e2
      WHERE e2.auth_account_id = a.id
        AND e2.realm = 'staff'
        AND e2.normalized_email = ?
      ORDER BY e2.created_at, e2.id
      LIMIT 1
    )
    LEFT JOIN auth_staff_invitations i ON i.id = (
      SELECT i2.id
      FROM auth_staff_invitations i2
      JOIN auth_email_addresses e3 ON e3.id = i2.email_address_id
      WHERE i2.auth_account_id = a.id
        AND i2.invited_by_actor_ref = ?
        AND e3.normalized_email = ?
      ORDER BY i2.created_at, i2.id
      LIMIT 1
    )
    LEFT JOIN auth_challenges c ON c.id = i.challenge_id
    LEFT JOIN auth_email_outbox o ON o.id = (
      SELECT o2.id
      FROM auth_email_outbox o2
      WHERE o2.challenge_id = i.challenge_id
        AND o2.template_key = 'auth.staff.invitation.v1'
      ORDER BY o2.created_at, o2.id
      LIMIT 1
    )
    WHERE lower(trim(u.username)) = ?
    LIMIT 1
  `).bind(
    target.normalizedEmail,
    ownerReceipt,
    target.normalizedEmail,
    target.normalizedEmail,
    ownerReceipt,
    target.normalizedEmail,
    target.usernameNormalized
  ).first();
}

async function loadBootstrapState(database, config) {
  return Promise.all(
    config.targets.map((target) => loadTargetState(database, target, config.ownerReceipt))
  );
}

function count(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : -1;
}

function isReconciledState(row, target) {
  return Boolean(
    row
    && row.username === target.username
    && row.username_normalized === target.usernameNormalized
    && row.password_hash === PASSWORD_SENTINEL
    && row.role === target.role
    && Number(row.is_protected) === 1
    && row.auth_account_id
    && row.account_realm === "staff"
    && ACCOUNT_STATUSES.has(row.account_status)
    && ENROLLMENT_STATES.has(row.enrollment_state)
    && SUPPORTED_LOCALES.has(row.account_locale)
    && row.email_address_id
    && row.normalized_email === target.normalizedEmail
    && EMAIL_STATUSES.has(row.email_status)
    && count(row.email_match_count) === 1
    && row.invitation_id
    && INVITATION_STATUSES.has(row.invitation_status)
    && row.invited_by_actor_ref
    && row.challenge_id
    && row.challenge_purpose === "staff_invitation"
    && CHALLENGE_STATUSES.has(row.challenge_status)
    && SUPPORTED_LOCALES.has(row.challenge_locale)
    && row.outbox_id
    && row.outbox_template_key === "auth.staff.invitation.v1"
    && OUTBOX_STATUSES.has(row.outbox_status)
    && SUPPORTED_LOCALES.has(row.outbox_locale)
    && count(row.invitation_match_count) === 1
    && count(row.outbox_match_count) >= 1
    && count(row.security_event_count) >= 1
  );
}

function isFreshState(row, target, ownerReceipt) {
  return Boolean(
    isReconciledState(row, target)
    && Number(row.is_active) === 1
    && row.account_status === "pending"
    && row.enrollment_state === "required"
    && row.enrollment_deadline_at === null
    && row.account_locale === target.locale
    && row.email_status === "pending"
    && Number(row.email_is_primary) === 0
    && row.invitation_status === "pending"
    && row.invited_by_actor_ref === ownerReceipt
    && row.challenge_status === "pending"
    && row.challenge_locale === target.locale
    && row.outbox_status === "pending"
    && row.outbox_locale === target.locale
    && count(row.password_credential_count) === 0
  );
}

function safeResult(outcome, rows, config) {
  return Object.freeze({
    outcome,
    account_count: config.targets.length,
    accounts: Object.freeze(config.targets.map((target, index) => Object.freeze({
      role: target.role,
      locale: rows[index]?.account_locale ?? target.locale,
      email_masked: maskEmailAddress(target.normalizedEmail),
      enrollment_state: rows[index]?.enrollment_state ?? "required"
    })))
  });
}

async function findEmailConflicts(database, config) {
  const result = await database.prepare(`
    /* staff-bootstrap-email-conflicts-v1 */
    SELECT id
    FROM auth_email_addresses
    WHERE realm = 'staff'
      AND normalized_email IN (?, ?)
      AND status IN ('pending', 'verified')
    LIMIT 3
  `).bind(
    config.targets[0].normalizedEmail,
    config.targets[1].normalizedEmail
  ).all();
  return asRows(result);
}

async function buildTargetStatements(env, config, target, now) {
  const database = env.DB;
  const accountId = createOpaqueId();
  const emailAddressId = createOpaqueId();
  const challengeId = createOpaqueId();
  const invitationId = createOpaqueId();
  const securityEventId = createOpaqueId();
  const correlationId = createOpaqueId();
  const rawToken = createMagicLinkToken();
  const challengeToken = await createVersionedChallengeTokenHash(
    env,
    rawToken,
    "staff-invitation"
  );
  if (challengeToken.version !== config.challengeTokenKeyVersion) {
    fail("E_STAFF_BOOTSTRAP_CHALLENGE_KEY_CHANGED");
  }
  const destinationFingerprint = await hashOpaqueToken(
    `destination:staff:v1:${target.normalizedEmail}`,
    config.fingerprintKey
  );
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString();
  const resendNotBefore = new Date(now.getTime() + RESEND_COOLDOWN_MS).toISOString();
  const nowAt = now.toISOString();
  const actionUrl = `${config.publicOrigin}/auth/admin/invitation#token=${rawToken}`;

  const accountInsert = database.prepare(`
    INSERT INTO auth_accounts (
      id, webauthn_user_handle, realm, status, auth_version,
      enrollment_state, last_transition_id,
      locale, created_at, updated_at
    )
    SELECT ?, ?, 'staff', 'pending', 1, 'required', ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM admin_users WHERE lower(trim(username)) = ?
    )
      AND NOT EXISTS (
        SELECT 1
        FROM auth_email_addresses
        WHERE realm = 'staff'
          AND normalized_email = ?
          AND status IN ('pending', 'verified')
      )
  `).bind(
    accountId,
    createOpaqueId(),
    createOpaqueId(),
    target.locale,
    nowAt,
    nowAt,
    target.usernameNormalized,
    target.normalizedEmail
  );

  const profileInsert = database.prepare(`
    INSERT INTO admin_users (
      username, password_hash, role, is_active, created_at,
      auth_account_id, username_normalized, is_protected
    ) VALUES (?, ?, ?, 1, ?, ?, ?, 1)
  `).bind(
    target.username,
    PASSWORD_SENTINEL,
    target.role,
    nowAt,
    accountId,
    target.usernameNormalized
  );

  const emailInsert = database.prepare(`
    INSERT INTO auth_email_addresses (
      id, auth_account_id, realm, normalized_email, normalization_version,
      display_email, status, is_primary, created_at, updated_at
    ) VALUES (?, ?, 'staff', ?, ?, ?, 'pending', 0, ?, ?)
  `).bind(
    emailAddressId,
    accountId,
    target.normalizedEmail,
    target.normalizationVersion,
    target.displayEmail,
    nowAt,
    nowAt
  );

  const challengeInsert = database.prepare(`
    INSERT INTO auth_challenges (
      id, auth_account_id, realm, email_address_id, expected_auth_version,
      purpose, status, verification_method, required_proof_policy,
      token_hash, fingerprint_key_version, destination_fingerprint,
      redirect_path, locale, correlation_id, max_attempts, failed_attempts,
      resend_not_before, expires_at, created_at
    ) VALUES (
      ?, ?, 'staff', ?, 1, 'staff_invitation', 'pending', 'magic_link',
      'single', ?, 1, ?, '/admin', ?, ?, 5, 0, ?, ?, ?
    )
  `).bind(
    challengeId,
    accountId,
    emailAddressId,
    challengeToken.tokenHash,
    destinationFingerprint,
    target.locale,
    correlationId,
    resendNotBefore,
    expiresAt,
    nowAt
  );

  const invitationInsert = database.prepare(`
    INSERT INTO auth_staff_invitations (
      id, auth_account_id, account_realm, admin_user_id, email_address_id,
      challenge_id, invited_by_account_id, invited_by_realm,
      invited_by_actor_ref, status, resend_count, expires_at,
      created_at, updated_at
    ) VALUES (
      ?, ?, 'staff',
      (SELECT id FROM admin_users WHERE auth_account_id = ?),
      ?, ?, NULL, NULL, ?, 'pending', 0, ?, ?, ?
    )
  `).bind(
    invitationId,
    accountId,
    accountId,
    emailAddressId,
    challengeId,
    config.ownerReceipt,
    expiresAt,
    nowAt,
    nowAt
  );

  const securityEventInsert = database.prepare(`
    INSERT INTO auth_security_events (
      id, event_type, outcome, subject_account_id, actor_account_id,
      actor_role, correlation_id, fingerprint_key_version,
      request_ip_hash, request_user_agent_hash, request_device_hash,
      metadata_json, occurred_at
    ) VALUES (
      ?, 'staff.bootstrap.reconciliation.created', 'accepted', ?, NULL,
      'owner', ?, 1, NULL, NULL, NULL, ?, ?
    )
  `).bind(
    securityEventId,
    accountId,
    correlationId,
    JSON.stringify({
      bootstrap_version: 1,
      owner_actor_ref: config.ownerReceipt,
      protected: true
    }),
    nowAt
  );

  const outbox = await prepareEncryptedOutboxInsert(
    env,
    {
      challengeId,
      emailAddressId,
      authAccountId: accountId,
      realm: "staff",
      templateKey: "auth.staff.invitation.v1",
      challengePurpose: "staff_invitation",
      locale: target.locale,
      dedupeKey: `staff-invitation:${challengeId}`,
      maxAttempts: 5,
      availableAt: nowAt,
      expiresAt
    },
    {
      username: target.username,
      role: target.role,
      action_url: actionUrl,
      expires_at: expiresAt
    }
  );

  return [
    accountInsert,
    profileInsert,
    emailInsert,
    challengeInsert,
    invitationInsert,
    securityEventInsert,
    outbox.statement
  ];
}

/**
 * Maintenance-only, non-HTTP reconciliation for the two environment staff
 * principals. It deliberately has no Worker route, queue, or scheduled hook.
 */
export async function reconcileEnvironmentStaffAccounts(env, { now = new Date() } = {}) {
  const config = readEnvironmentStaffBootstrapConfig(env);
  const database = requireDatabase(env);
  const effectiveNow = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(effectiveNow.getTime())) {
    fail("E_STAFF_BOOTSTRAP_TIMESTAMP_INVALID");
  }

  const existing = await loadBootstrapState(database, config);
  if (existing.every((row, index) => isReconciledState(row, config.targets[index]))) {
    return safeResult("already_reconciled", existing, config);
  }
  if (existing.some(Boolean)) {
    fail("E_STAFF_BOOTSTRAP_EXISTING_STATE_CONFLICT");
  }

  if ((await findEmailConflicts(database, config)).length > 0) {
    fail("E_STAFF_BOOTSTRAP_EMAIL_IN_USE");
  }

  const statementGroups = await Promise.all(
    config.targets.map((target) => buildTargetStatements(env, config, target, effectiveNow))
  );
  try {
    await database.batch(statementGroups.flat());
  } catch {
    const racedState = await loadBootstrapState(database, config);
    if (racedState.every((row, index) => isReconciledState(row, config.targets[index]))) {
      return safeResult("already_reconciled", racedState, config);
    }
    fail("E_STAFF_BOOTSTRAP_WRITE_FAILED");
  }

  const created = await loadBootstrapState(database, config);
  if (!created.every((row, index) => (
    isFreshState(row, config.targets[index], config.ownerReceipt)
  ))) {
    fail("E_STAFF_BOOTSTRAP_POSTCONDITION_FAILED");
  }
  return safeResult("created", created, config);
}
