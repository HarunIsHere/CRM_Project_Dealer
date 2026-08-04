import { constantTimeEqual } from "../crypto.js";
import { maskEmailAddress } from "../email/normalization.js";
import { createAcceptedSessionTokenHashes } from "../session-keyring.js";
import { BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS } from "./invitation-acceptance.js";

export const STAFF_ENROLLMENT_STATUS_ROUTE =
  "/api/v1/admin/auth/enrollment";
export const STAFF_ENROLLMENT_LOGOUT_ROUTE =
  "/api/v1/admin/auth/enrollment/logout";
export const STAFF_ENROLLMENT_STATUS_ACTION =
  `GET ${STAFF_ENROLLMENT_STATUS_ROUTE}`;
export const STAFF_ENROLLMENT_LOGOUT_ACTION =
  `POST ${STAFF_ENROLLMENT_LOGOUT_ROUTE}`;

const ID_32 = /^[0-9a-f]{32}$/;
const USERNAME = /^[A-Za-z0-9._-]{1,120}$/;
const OWNER_RECEIPT = /^[A-Za-z0-9._:-]{16,120}$/;
const SUPPORTED_LOCALES = new Set(["en", "de", "tr", "ar", "ru"]);

export class StaffEnrollmentSessionError extends Error {
  constructor(code, status = 401) {
    super(
      code === "unauthorized"
        ? "A valid enrollment session is required."
        : "Staff enrollment session processing is temporarily unavailable."
    );
    this.name = "StaffEnrollmentSessionError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 503) {
  throw new StaffEnrollmentSessionError(code, status);
}

function unauthorized() {
  fail("unauthorized", 401);
}

function requireDatabase(env) {
  if (
    !env?.DB
    || typeof env.DB.prepare !== "function"
  ) {
    fail("temporarily_unavailable");
  }
  return env.DB;
}

function isoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail("temporarily_unavailable");
  return date.toISOString();
}

function bootstrapConfiguration(env) {
  const ownerReceipt = String(env?.CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT ?? "").trim();
  const superadminUsername = String(env?.SUPERADMIN_USERNAME ?? "").trim();
  const adminUsername = String(env?.ADMIN_USERNAME ?? "").trim();
  if (
    !OWNER_RECEIPT.test(ownerReceipt)
    || !USERNAME.test(superadminUsername)
    || !USERNAME.test(adminUsername)
    || superadminUsername.toLowerCase() === adminUsername.toLowerCase()
  ) {
    fail("temporarily_unavailable");
  }
  return Object.freeze({ ownerReceipt, superadminUsername, adminUsername });
}

function parseAuthorizationContext(value) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function exactAllowedActions(value) {
  if (
    !Array.isArray(value)
    || value.length !== BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS.length
    || value.some((entry) => typeof entry !== "string" || entry === "")
    || new Set(value).size !== value.length
  ) {
    return false;
  }
  const allowed = new Set(value);
  return BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS.every((action) => (
    allowed.has(action)
  ));
}

function contextAllows(row, action) {
  const context = parseAuthorizationContext(row.authorization_context_json);
  if (
    !context
    || context.source !== "staff_invitation"
    || context.stage !== "email_verified"
    || context.invitation_id !== row.invitation_id
    || context.challenge_id !== row.challenge_id
    || !exactAllowedActions(context.allowed_actions)
    || !context.allowed_actions.includes(action)
  ) {
    unauthorized();
  }
  return context;
}

function sessionReferenceMatches(reference, row) {
  return Boolean(
    reference
    && reference.id === row.session_id
    && reference.auth_account_id === row.auth_account_id
    && Number(reference.token_hash_version) === Number(row.token_hash_version)
    && reference.token_hash === row.token_hash
  );
}

function count(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function expectedUsername(configuration, role) {
  if (role === "superadmin") return configuration.superadminUsername;
  if (role === "admin") return configuration.adminUsername;
  return null;
}

function validateBootstrapRow(
  configuration,
  row,
  action,
  { requireActiveProfile = true } = {}
) {
  if (
    !row
    || !ID_32.test(String(row.session_id ?? ""))
    || !ID_32.test(String(row.auth_account_id ?? ""))
    || row.account_realm !== "staff"
    || row.scope !== "staff_enrollment"
    || row.session_transport !== "cookie"
    || row.client_platform !== "admin_web"
    || row.invited_by_account_id !== null
    || row.invited_by_realm !== null
    || row.invited_by_actor_ref !== configuration.ownerReceipt
    || (requireActiveProfile && Number(row.is_active) !== 1)
    || Number(row.is_protected) !== 1
    || row.username !== expectedUsername(configuration, row.role)
    || !SUPPORTED_LOCALES.has(row.locale)
    || count(row.active_password_count) < 0
    || count(row.active_passkey_count) < 0
    || count(row.acknowledged_recovery_code_set_count) < 0
  ) {
    unauthorized();
  }
  return contextAllows(row, action);
}

async function loadStatusRow(database, session, configuration, nowAt) {
  if (!ID_32.test(String(session?.id ?? ""))) unauthorized();
  return database.prepare(`
    SELECT
      s.id AS session_id,
      s.auth_account_id,
      s.token_hash,
      s.token_hash_version,
      s.scope,
      s.authorization_context_json,
      s.session_transport,
      s.client_platform,
      s.expires_at AS session_expires_at,
      a.realm AS account_realm,
      a.status AS account_status,
      a.auth_version,
      a.enrollment_state,
      a.enrollment_deadline_at,
      a.disabled_reason,
      a.disabled_at,
      a.deleted_at,
      a.locale,
      u.username,
      u.role,
      u.is_active,
      u.is_protected,
      i.id AS invitation_id,
      i.invited_by_account_id,
      i.invited_by_realm,
      i.invited_by_actor_ref,
      c.id AS challenge_id,
      e.normalized_email,
      (
        SELECT COUNT(*)
        FROM auth_password_credentials p
        WHERE p.auth_account_id = a.id AND p.revoked_at IS NULL
      ) AS active_password_count,
      (
        SELECT COUNT(*)
        FROM auth_passkey_credentials p
        WHERE p.auth_account_id = a.id
          AND p.realm = 'staff'
          AND p.revoked_at IS NULL
      ) AS active_passkey_count,
      (
        SELECT COUNT(*)
        FROM auth_recovery_code_sets r
        WHERE r.auth_account_id = a.id
          AND r.account_realm = 'staff'
          AND r.status = 'active'
          AND r.acknowledged_at IS NOT NULL
          AND r.activated_at IS NOT NULL
      ) AS acknowledged_recovery_code_set_count
    FROM auth_sessions s
    JOIN auth_accounts a
      ON a.id = s.auth_account_id AND a.realm = s.realm
    JOIN admin_users u
      ON u.auth_account_id = a.id
    JOIN auth_staff_invitations i
      ON i.id = json_extract(s.authorization_context_json, '$.invitation_id')
     AND i.auth_account_id = a.id
     AND i.admin_user_id = u.id
    JOIN auth_challenges c
      ON c.id = json_extract(s.authorization_context_json, '$.challenge_id')
     AND c.id = i.challenge_id
     AND c.auth_account_id = a.id
     AND c.realm = 'staff'
    JOIN auth_email_addresses e
      ON e.id = i.email_address_id
     AND e.auth_account_id = a.id
     AND e.realm = 'staff'
    WHERE s.id = ?
      AND s.realm = 'staff'
      AND s.scope = 'staff_enrollment'
      AND s.session_transport = 'cookie'
      AND s.client_platform = 'admin_web'
      AND s.csrf_token_hash IS NOT NULL
      AND s.revoked_at IS NULL
      AND s.rotated_to_session_id IS NULL
      AND datetime(s.expires_at) > datetime(?)
      AND s.issued_auth_version = a.auth_version
      AND a.status = 'pending'
      AND a.enrollment_state = 'in_progress'
      AND a.enrollment_deadline_at IS NOT NULL
      AND datetime(a.enrollment_deadline_at) > datetime(?)
      AND a.disabled_reason IS NULL
      AND a.disabled_at IS NULL
      AND a.deleted_at IS NULL
      AND u.is_active = 1
      AND u.is_protected = 1
      AND (
        (u.role = 'superadmin' AND u.username = ?)
        OR (u.role = 'admin' AND u.username = ?)
      )
      AND i.status = 'accepted'
      AND i.accepted_at IS NOT NULL
      AND i.invited_by_account_id IS NULL
      AND i.invited_by_realm IS NULL
      AND i.invited_by_actor_ref = ?
      AND c.purpose = 'staff_invitation'
      AND c.status = 'consumed'
      AND c.consumed_at IS NOT NULL
      AND e.status = 'verified'
      AND e.is_primary = 1
      AND e.verified_at IS NOT NULL
      AND e.replaced_at IS NULL
      AND e.revoked_at IS NULL
      AND e.deleted_at IS NULL
    LIMIT 1
  `).bind(
    session.id,
    nowAt,
    nowAt,
    configuration.superadminUsername,
    configuration.adminUsername,
    configuration.ownerReceipt
  ).first();
}

export async function getProtectedBootstrapEnrollmentStatus(
  env,
  { session, now = new Date() }
) {
  const database = requireDatabase(env);
  const configuration = bootstrapConfiguration(env);
  const nowAt = isoTimestamp(now);
  const row = await loadStatusRow(database, session, configuration, nowAt);
  if (!row || !sessionReferenceMatches(session, row)) unauthorized();
  const context = validateBootstrapRow(
    configuration,
    row,
    STAFF_ENROLLMENT_STATUS_ACTION
  );
  const emailVerified = true;
  const passwordSet = count(row.active_password_count) > 0;
  const passkeyRegistered = count(row.active_passkey_count) > 0;
  const recoveryCodesAcknowledged = (
    count(row.acknowledged_recovery_code_set_count) > 0
  );

  return Object.freeze({
    staff: Object.freeze({
      username: row.username,
      role: row.role,
      email_masked: maskEmailAddress(row.normalized_email),
      locale: row.locale
    }),
    enrollment: Object.freeze({
      stage: context.stage,
      email_verified: emailVerified,
      password_set: passwordSet,
      passkey_registered: passkeyRegistered,
      recovery_codes_acknowledged: recoveryCodesAcknowledged,
      deadline_at: row.enrollment_deadline_at
    }),
    session: Object.freeze({
      scope: "staff_enrollment",
      expires_at: row.session_expires_at
    })
  });
}

function tokenPredicates(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 5) {
    fail("temporarily_unavailable");
  }
  return values.map(() => "(s.token_hash_version = ? AND s.token_hash = ?)").join(" OR ");
}

async function loadLogoutRow(database, acceptedHashes, configuration) {
  const bindings = acceptedHashes.flatMap(({ tokenHashVersion, tokenHash }) => (
    [tokenHashVersion, tokenHash]
  ));
  const result = await database.prepare(`
    SELECT
      s.id AS session_id,
      s.auth_account_id,
      s.realm,
      s.token_hash,
      s.token_hash_version,
      s.scope,
      s.authorization_context_json,
      s.session_transport,
      s.csrf_token_hash,
      s.client_platform,
      s.revoked_at,
      s.revocation_reason,
      u.username,
      u.role,
      u.is_active,
      u.is_protected,
      i.id AS invitation_id,
      i.invited_by_account_id,
      i.invited_by_realm,
      i.invited_by_actor_ref,
      c.id AS challenge_id,
      a.realm AS account_realm,
      a.locale,
      0 AS active_password_count,
      0 AS active_passkey_count,
      0 AS acknowledged_recovery_code_set_count
    FROM auth_sessions s
    JOIN auth_accounts a
      ON a.id = s.auth_account_id AND a.realm = s.realm
    JOIN admin_users u
      ON u.auth_account_id = a.id
    JOIN auth_staff_invitations i
      ON i.id = json_extract(s.authorization_context_json, '$.invitation_id')
     AND i.auth_account_id = a.id
     AND i.admin_user_id = u.id
    JOIN auth_challenges c
      ON c.id = json_extract(s.authorization_context_json, '$.challenge_id')
     AND c.id = i.challenge_id
     AND c.auth_account_id = a.id
     AND c.realm = 'staff'
    WHERE (${tokenPredicates(acceptedHashes)})
      AND s.realm = 'staff'
      AND s.scope = 'staff_enrollment'
      AND s.session_transport = 'cookie'
      AND s.client_platform = 'admin_web'
      AND s.csrf_token_hash IS NOT NULL
      AND u.is_protected = 1
      AND (
        (u.role = 'superadmin' AND u.username = ?)
        OR (u.role = 'admin' AND u.username = ?)
      )
      AND i.status = 'accepted'
      AND i.accepted_at IS NOT NULL
      AND i.invited_by_account_id IS NULL
      AND i.invited_by_realm IS NULL
      AND i.invited_by_actor_ref = ?
      AND c.purpose = 'staff_invitation'
      AND c.status = 'consumed'
      AND c.consumed_at IS NOT NULL
    LIMIT 2
  `).bind(
    ...bindings,
    configuration.superadminUsername,
    configuration.adminUsername,
    configuration.ownerReceipt
  ).all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  return rows.length === 1 ? rows[0] : null;
}

export async function resolveProtectedBootstrapEnrollmentForLogout(
  env,
  { rawSessionToken }
) {
  const database = requireDatabase(env);
  const configuration = bootstrapConfiguration(env);
  const acceptedHashes = await createAcceptedSessionTokenHashes(
    env,
    rawSessionToken
  );
  const row = await loadLogoutRow(database, acceptedHashes, configuration);
  if (!row) unauthorized();
  const matchingHash = acceptedHashes.find(({ tokenHashVersion }) => (
    Number(tokenHashVersion) === Number(row.token_hash_version)
  ));
  if (
    !matchingHash
    || !await constantTimeEqual(matchingHash.tokenHash, row.token_hash)
  ) {
    unauthorized();
  }
  validateBootstrapRow(
    configuration,
    row,
    STAFF_ENROLLMENT_LOGOUT_ACTION,
    { requireActiveProfile: false }
  );
  return Object.freeze({ ...row });
}

export async function revokeProtectedBootstrapEnrollmentSession(
  env,
  { session, now = new Date() }
) {
  const database = requireDatabase(env);
  const nowAt = isoTimestamp(now);
  if (
    !session
    || !ID_32.test(String(session.session_id ?? ""))
    || !ID_32.test(String(session.auth_account_id ?? ""))
  ) {
    unauthorized();
  }
  await database.prepare(`
    UPDATE auth_sessions
    SET revoked_at = ?, revocation_reason = 'enrollment_logout'
    WHERE id = ?
      AND auth_account_id = ?
      AND realm = 'staff'
      AND scope = 'staff_enrollment'
      AND token_hash_version = ?
      AND token_hash = ?
      AND revoked_at IS NULL
  `).bind(
    nowAt,
    session.session_id,
    session.auth_account_id,
    Number(session.token_hash_version),
    session.token_hash
  ).run();
  return Object.freeze({ loggedOut: true });
}
