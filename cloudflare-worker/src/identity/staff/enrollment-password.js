import { createOpaqueId } from "../crypto.js";
import { prepareIdempotencyCompletion } from "../idempotency.js";
import { createSessionHashesForIssuance } from "../session-keyring.js";
import { BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS } from "./invitation-acceptance.js";
import {
  StaffPasswordPolicyError,
  validateStaffPasswordPolicy
} from "./password-policy.js";
import {
  StaffPasswordProfileError,
  createCanonicalStaffPasswordVerifier
} from "./password-profile.js";

export const STAFF_ENROLLMENT_PASSWORD_ROUTE =
  "/api/v1/admin/auth/enrollment/password";
export const STAFF_ENROLLMENT_PASSWORD_ACTION =
  `PUT ${STAFF_ENROLLMENT_PASSWORD_ROUTE}`;

const ID_32 = /^[0-9a-f]{32}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const USERNAME = /^[A-Za-z0-9._-]{1,120}$/;
const OWNER_RECEIPT = /^[A-Za-z0-9._:-]{16,120}$/;
const PASSWORD_SENTINEL = "!canonical-auth-disabled!";

export class StaffEnrollmentPasswordError extends Error {
  constructor(code = "temporarily_unavailable", status = 503) {
    super(
      code === "unauthorized"
        ? "A valid enrollment session is required."
        : "Staff enrollment password processing is temporarily unavailable."
    );
    this.name = "StaffEnrollmentPasswordError";
    this.code = code;
    this.status = status;
  }
}

function fail(code = "temporarily_unavailable", status = 503) {
  throw new StaffEnrollmentPasswordError(code, status);
}

function requireDatabase(env) {
  if (
    !env?.DB
    || typeof env.DB.prepare !== "function"
    || typeof env.DB.batch !== "function"
  ) {
    fail();
  }
  return env.DB;
}

function isoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail();
  return date.toISOString();
}

function requireRequestId(value) {
  const requestId = String(value ?? "");
  if (!ID_32.test(requestId)) fail();
  return requestId;
}

function assertReservation(reservation, nowAt) {
  if (
    !reservation
    || !ID_32.test(String(reservation.id ?? ""))
    || reservation.realm !== "staff"
    || reservation.operation !== STAFF_ENROLLMENT_PASSWORD_ACTION
    || !HEX_64.test(String(reservation.requestHash ?? ""))
    || !Number.isFinite(Date.parse(String(reservation.expiresAt ?? "")))
    || Date.parse(reservation.expiresAt) <= Date.parse(nowAt)
  ) {
    fail("idempotency_required", 400);
  }
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
    fail();
  }
  return Object.freeze({ ownerReceipt, superadminUsername, adminUsername });
}

function parseObject(value) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseStringArray(value) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return Array.isArray(parsed)
      && parsed.every((entry) => typeof entry === "string" && entry !== "")
      && new Set(parsed).size === parsed.length
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
  const actions = new Set(value);
  return BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS.every((action) => (
    actions.has(action)
  ));
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

function expectedUsername(configuration, role) {
  if (role === "superadmin") return configuration.superadminUsername;
  if (role === "admin") return configuration.adminUsername;
  return null;
}

function count(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : -1;
}

async function loadEnrollmentSession(database, session, configuration, nowAt) {
  if (!ID_32.test(String(session?.id ?? ""))) fail("unauthorized", 401);
  const row = await database.prepare(`
    SELECT
      s.id AS session_id,
      s.auth_account_id,
      s.token_hash,
      s.token_hash_version,
      s.created_transition_id,
      s.issued_auth_version,
      s.scope,
      s.assurance_level,
      s.auth_methods_json,
      s.authorization_context_json,
      s.session_transport,
      s.csrf_token_hash,
      s.client_platform,
      s.app_version,
      s.authenticated_at,
      s.strong_authenticated_at,
      s.expires_at AS session_expires_at,
      a.auth_version,
      a.status AS account_status,
      a.enrollment_state,
      a.enrollment_deadline_at,
      a.legacy_login_disabled_at,
      a.locale,
      u.id AS admin_user_id,
      u.username,
      u.password_hash AS legacy_password_hash,
      u.role,
      u.is_active,
      u.is_protected,
      i.id AS invitation_id,
      i.invited_by_account_id,
      i.invited_by_realm,
      i.invited_by_actor_ref,
      c.id AS invitation_challenge_id,
      e.id AS email_address_id,
      (
        SELECT COUNT(*) FROM auth_passkey_credentials p
        WHERE p.auth_account_id = a.id
          AND p.realm = 'staff'
          AND p.revoked_at IS NULL
      ) AS active_passkey_count,
      (
        SELECT COUNT(*) FROM auth_recovery_code_sets r
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
      AND a.status IN ('pending', 'active')
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
      AND json_extract(s.authorization_context_json, '$.stage') = 'email_verified'
      AND EXISTS (
        SELECT 1 FROM json_each(s.authorization_context_json, '$.allowed_actions')
        WHERE type = 'text' AND value = ?
      )
    LIMIT 1
  `).bind(
    session.id,
    nowAt,
    nowAt,
    configuration.superadminUsername,
    configuration.adminUsername,
    configuration.ownerReceipt,
    STAFF_ENROLLMENT_PASSWORD_ACTION
  ).first();

  if (!row || !sessionReferenceMatches(session, row)) {
    fail("unauthorized", 401);
  }
  const authorizationContext = parseObject(row.authorization_context_json);
  const authMethods = parseStringArray(row.auth_methods_json);
  if (
    !authorizationContext
    || authorizationContext.source !== "staff_invitation"
    || authorizationContext.stage !== "email_verified"
    || authorizationContext.invitation_id !== row.invitation_id
    || authorizationContext.challenge_id !== row.invitation_challenge_id
    || !exactAllowedActions(authorizationContext.allowed_actions)
    || !authorizationContext.allowed_actions.includes(
      STAFF_ENROLLMENT_PASSWORD_ACTION
    )
    || !authMethods
    || row.username !== expectedUsername(configuration, row.role)
    || count(row.active_passkey_count) < 0
    || count(row.acknowledged_recovery_code_set_count) < 0
  ) {
    fail("unauthorized", 401);
  }
  return Object.freeze({
    ...row,
    auth_version: Number(row.auth_version),
    issued_auth_version: Number(row.issued_auth_version),
    assurance_level: Number(row.assurance_level),
    active_passkey_count: count(row.active_passkey_count),
    acknowledged_recovery_code_set_count: count(
      row.acknowledged_recovery_code_set_count
    ),
    authorization_context: authorizationContext,
    allowed_actions: Object.freeze([...authorizationContext.allowed_actions]),
    auth_methods: Object.freeze([...authMethods])
  });
}

function createOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function replayEnvelope(publicBody, sessionToken, csrfToken, maxAgeSeconds) {
  return Object.freeze({
    version: 1,
    public_body: publicBody,
    cookie_session_token: sessionToken,
    cookie_csrf_token: csrfToken,
    cookie_max_age_seconds: maxAgeSeconds
  });
}

export function validateEnrollmentPasswordReplayEnvelope(value) {
  const body = value?.public_body;
  const enrollment = body?.enrollment;
  const session = body?.session;
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || value.version !== 1
    || !OPAQUE_TOKEN.test(String(value.cookie_session_token ?? ""))
    || !OPAQUE_TOKEN.test(String(value.cookie_csrf_token ?? ""))
    || !Number.isSafeInteger(value.cookie_max_age_seconds)
    || value.cookie_max_age_seconds < 1
    || !body
    || typeof body !== "object"
    || Array.isArray(body)
    || body.ok !== true
    || !ID_32.test(String(body.request_id ?? ""))
    || !enrollment
    || enrollment.stage !== "email_verified"
    || enrollment.email_verified !== true
    || enrollment.password_set !== true
    || typeof enrollment.passkey_registered !== "boolean"
    || typeof enrollment.recovery_codes_acknowledged !== "boolean"
    || !Number.isFinite(Date.parse(String(enrollment.deadline_at ?? "")))
    || !session
    || !ID_32.test(String(session.id ?? ""))
    || session.transport !== "cookie"
    || session.scope !== "staff_enrollment"
    || !Number.isFinite(Date.parse(String(session.expires_at ?? "")))
    || session.csrf_token !== value.cookie_csrf_token
    || Object.hasOwn(session, "access_token")
    || !Number.isSafeInteger(Number(session.assurance?.level))
    || !Array.isArray(session.assurance?.methods)
    || session.assurance.methods.some((entry) => (
      typeof entry !== "string" || entry === ""
    ))
    || !Number.isFinite(Date.parse(String(
      session.assurance?.authenticated_at ?? ""
    )))
  ) {
    fail();
  }
  return value;
}

export async function setProtectedBootstrapEnrollmentPassword(
  env,
  {
    session,
    reservation,
    requestId,
    newPassword,
    deriveArgon2id,
    isKnownCompromisedOrCommon,
    now = new Date()
  }
) {
  const database = requireDatabase(env);
  const configuration = bootstrapConfiguration(env);
  const nowAt = isoTimestamp(now);
  const normalizedRequestId = requireRequestId(requestId);
  assertReservation(reservation, nowAt);
  if (typeof deriveArgon2id !== "function") {
    throw new StaffPasswordProfileError();
  }
  await validateStaffPasswordPolicy(newPassword, {
    isKnownCompromisedOrCommon
  });
  const current = await loadEnrollmentSession(
    database,
    session,
    configuration,
    nowAt
  );
  const passwordRecord = await createCanonicalStaffPasswordVerifier(
    env,
    newPassword,
    { deriveArgon2id }
  );

  const nextAuthVersion = current.auth_version + 1;
  const credentialId = createOpaqueId();
  const credentialTransitionId = createOpaqueId();
  const credentialRevocationTransitionId = createOpaqueId();
  const accountTransitionId = createOpaqueId();
  const sessionTransitionId = createOpaqueId();
  const rotationTransitionId = createOpaqueId();
  const newSessionId = createOpaqueId();
  const newSessionToken = createOpaqueToken();
  const newCsrfToken = createOpaqueToken();
  const eventId = createOpaqueId();
  const newSessionExpiresAt = new Date(Math.min(
    Date.parse(current.session_expires_at),
    Date.parse(current.enrollment_deadline_at)
  )).toISOString();
  const cookieMaxAgeSeconds = Math.floor(
    (Date.parse(newSessionExpiresAt) - Date.parse(nowAt)) / 1000
  );
  if (cookieMaxAgeSeconds < 1) fail("unauthorized", 401);
  const sessionHashes = await createSessionHashesForIssuance(env, {
    sessionToken: newSessionToken,
    csrfToken: newCsrfToken
  });
  const authorizationContext = Object.freeze({
    ...current.authorization_context,
    stage: "email_verified",
    email_verified: true,
    password_set: true,
    passkey_registered: current.active_passkey_count > 0,
    recovery_codes_acknowledged:
      current.acknowledged_recovery_code_set_count > 0,
    allowed_actions: current.allowed_actions
  });
  const publicBody = Object.freeze({
    ok: true,
    request_id: normalizedRequestId,
    enrollment: Object.freeze({
      stage: "email_verified",
      email_verified: true,
      password_set: true,
      passkey_registered: current.active_passkey_count > 0,
      recovery_codes_acknowledged:
        current.acknowledged_recovery_code_set_count > 0,
      deadline_at: current.enrollment_deadline_at
    }),
    session: Object.freeze({
      id: newSessionId,
      transport: "cookie",
      scope: "staff_enrollment",
      expires_at: newSessionExpiresAt,
      csrf_token: newCsrfToken,
      assurance: Object.freeze({
        level: current.assurance_level,
        methods: current.auth_methods,
        authenticated_at: current.authenticated_at,
        strong_authenticated_at: current.strong_authenticated_at
      })
    })
  });
  const envelope = replayEnvelope(
    publicBody,
    newSessionToken,
    newCsrfToken,
    cookieMaxAgeSeconds
  );
  const idempotencyCompletion = await prepareIdempotencyCompletion(
    env,
    reservation,
    {
      status: 200,
      body: envelope,
      resourceType: "auth_password_credential",
      resourceId: credentialId,
      completedAt: nowAt
    }
  );

  const baseEligibility = `
    a.id = ?
    AND a.realm = 'staff'
    AND a.auth_version = ?
    AND a.status IN ('pending', 'active')
    AND a.enrollment_state = 'in_progress'
    AND a.enrollment_deadline_at = ?
    AND datetime(a.enrollment_deadline_at) > datetime(?)
    AND a.disabled_reason IS NULL
    AND a.disabled_at IS NULL
    AND a.deleted_at IS NULL
    AND s.id = ?
    AND s.auth_account_id = a.id
    AND s.realm = 'staff'
    AND s.scope = 'staff_enrollment'
    AND s.session_transport = 'cookie'
    AND s.client_platform = 'admin_web'
    AND s.csrf_token_hash IS NOT NULL
    AND s.issued_auth_version = ?
    AND s.revoked_at IS NULL
    AND s.rotated_to_session_id IS NULL
    AND datetime(s.expires_at) > datetime(?)
    AND u.id = ?
    AND u.auth_account_id = a.id
    AND u.is_active = 1
    AND u.is_protected = 1
    AND u.username = ?
    AND u.role = ?
    AND i.id = ?
    AND i.auth_account_id = a.id
    AND i.admin_user_id = u.id
    AND i.status = 'accepted'
    AND i.accepted_at IS NOT NULL
    AND i.invited_by_account_id IS NULL
    AND i.invited_by_realm IS NULL
    AND i.invited_by_actor_ref = ?
    AND e.id = ?
    AND e.auth_account_id = a.id
    AND e.realm = 'staff'
    AND e.status = 'verified'
    AND e.is_primary = 1
    AND e.verified_at IS NOT NULL
    AND e.replaced_at IS NULL
    AND e.revoked_at IS NULL
    AND e.deleted_at IS NULL
    AND json_extract(s.authorization_context_json, '$.stage') = 'email_verified'
    AND EXISTS (
      SELECT 1 FROM json_each(s.authorization_context_json, '$.allowed_actions')
      WHERE type = 'text' AND value = ?
    )
    AND k.id = ?
    AND k.realm = 'staff'
    AND k.operation = ?
    AND k.request_hash = ?
    AND k.status = 'in_progress'
    AND datetime(k.expires_at) > datetime(?)
  `;
  const eligibilityBindings = [
    current.auth_account_id,
    current.auth_version,
    current.enrollment_deadline_at,
    nowAt,
    current.session_id,
    current.auth_version,
    nowAt,
    current.admin_user_id,
    current.username,
    current.role,
    current.invitation_id,
    configuration.ownerReceipt,
    current.email_address_id,
    STAFF_ENROLLMENT_PASSWORD_ACTION,
    reservation.id,
    reservation.operation,
    reservation.requestHash,
    nowAt
  ];
  const eligibilityExists = `
    EXISTS (
      SELECT 1
      FROM auth_accounts a
      JOIN auth_sessions s ON s.auth_account_id = a.id
      JOIN admin_users u ON u.auth_account_id = a.id
      JOIN auth_staff_invitations i ON i.auth_account_id = a.id
      JOIN auth_email_addresses e ON e.id = i.email_address_id
      JOIN auth_idempotency_keys k ON k.id = ?
      WHERE ${baseEligibility}
    )
  `;
  const existsBindings = [reservation.id, ...eligibilityBindings];

  const statements = [
    database.prepare(`
      UPDATE auth_password_credentials
      SET revoked_at = ?,
          revocation_transition_id = ?,
          updated_at = ?
      WHERE auth_account_id = ?
        AND account_realm = 'staff'
        AND revoked_at IS NULL
        AND ${eligibilityExists}
    `).bind(
      nowAt,
      credentialRevocationTransitionId,
      nowAt,
      current.auth_account_id,
      ...existsBindings
    ),
    database.prepare(`
      INSERT INTO auth_password_credentials (
        id, auth_account_id, account_realm, verifier, algorithm,
        algorithm_version, parameters_json, pepper_key_version,
        needs_upgrade, created_at, updated_at, created_transition_id
      )
      SELECT ?, a.id, 'staff', ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM auth_accounts a
      JOIN auth_sessions s ON s.auth_account_id = a.id
      JOIN admin_users u ON u.auth_account_id = a.id
      JOIN auth_staff_invitations i ON i.auth_account_id = a.id
      JOIN auth_email_addresses e ON e.id = i.email_address_id
      JOIN auth_idempotency_keys k ON k.id = ?
      WHERE ${baseEligibility}
        AND NOT EXISTS (
          SELECT 1 FROM auth_password_credentials current_password
          WHERE current_password.auth_account_id = a.id
            AND current_password.revoked_at IS NULL
        )
    `).bind(
      credentialId,
      passwordRecord.verifier,
      passwordRecord.algorithm,
      passwordRecord.algorithmVersion,
      passwordRecord.parametersJson,
      passwordRecord.pepperKeyVersion,
      passwordRecord.needsUpgrade,
      nowAt,
      nowAt,
      credentialTransitionId,
      reservation.id,
      ...eligibilityBindings
    ),
    database.prepare(`
      UPDATE admin_users
      SET password_hash = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND is_active = 1
        AND is_protected = 1
        AND EXISTS (
          SELECT 1 FROM auth_password_credentials p
          WHERE p.id = ?
            AND p.auth_account_id = admin_users.auth_account_id
            AND p.algorithm = 'argon2id_phc_v1'
            AND p.revoked_at IS NULL
            AND p.created_transition_id = ?
        )
    `).bind(
      PASSWORD_SENTINEL,
      current.admin_user_id,
      current.auth_account_id,
      credentialId,
      credentialTransitionId
    ),
    database.prepare(`
      UPDATE auth_accounts
      SET auth_version = ?,
          legacy_sessions_revoked_before = ?,
          last_transition_id = ?,
          updated_at = ?
      WHERE id = ?
        AND realm = 'staff'
        AND auth_version = ?
        AND status IN ('pending', 'active')
        AND enrollment_state = 'in_progress'
        AND enrollment_deadline_at = ?
        AND datetime(enrollment_deadline_at) > datetime(?)
        AND disabled_reason IS NULL
        AND disabled_at IS NULL
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM admin_users u
          JOIN auth_password_credentials p ON p.auth_account_id = u.auth_account_id
          WHERE u.id = ?
            AND u.auth_account_id = auth_accounts.id
            AND u.password_hash = ?
            AND u.is_active = 1
            AND u.is_protected = 1
            AND p.id = ?
            AND p.algorithm = 'argon2id_phc_v1'
            AND p.revoked_at IS NULL
            AND p.created_transition_id = ?
        )
    `).bind(
      nextAuthVersion,
      nowAt,
      accountTransitionId,
      nowAt,
      current.auth_account_id,
      current.auth_version,
      current.enrollment_deadline_at,
      nowAt,
      current.admin_user_id,
      PASSWORD_SENTINEL,
      credentialId,
      credentialTransitionId
    ),
    database.prepare(`
      INSERT INTO auth_sessions (
        id, auth_account_id, realm, token_hash, token_hash_version,
        created_transition_id, issued_auth_version, scope, assurance_level,
        auth_methods_json, authorization_context_json, session_transport,
        csrf_token_hash, client_platform, app_version,
        rotated_from_session_id, authenticated_at, strong_authenticated_at,
        created_at, expires_at
      )
      SELECT ?, a.id, 'staff', ?, ?, ?, ?, 'staff_enrollment', ?, ?, ?,
             'cookie', ?, 'admin_web', ?, s.id, ?, ?, ?, ?
      FROM auth_accounts a
      JOIN auth_sessions s ON s.auth_account_id = a.id
      JOIN admin_users u ON u.auth_account_id = a.id
      JOIN auth_password_credentials p ON p.auth_account_id = a.id
      JOIN auth_idempotency_keys k ON k.id = ?
      WHERE a.id = ?
        AND a.realm = 'staff'
        AND a.auth_version = ?
        AND a.last_transition_id = ?
        AND a.enrollment_state = 'in_progress'
        AND a.enrollment_deadline_at = ?
        AND a.legacy_sessions_revoked_before = ?
        AND s.id = ?
        AND s.realm = 'staff'
        AND s.scope = 'staff_enrollment'
        AND s.session_transport = 'cookie'
        AND s.client_platform = 'admin_web'
        AND s.issued_auth_version = ?
        AND s.revoked_at IS NULL
        AND s.rotated_to_session_id IS NULL
        AND u.id = ?
        AND u.password_hash = ?
        AND p.id = ?
        AND p.algorithm = 'argon2id_phc_v1'
        AND p.revoked_at IS NULL
        AND p.created_transition_id = ?
        AND k.status = 'in_progress'
        AND k.request_hash = ?
    `).bind(
      newSessionId,
      sessionHashes.tokenHash,
      sessionHashes.tokenHashVersion,
      sessionTransitionId,
      nextAuthVersion,
      current.assurance_level,
      JSON.stringify(current.auth_methods),
      JSON.stringify(authorizationContext),
      sessionHashes.csrfTokenHash,
      current.app_version,
      current.authenticated_at,
      current.strong_authenticated_at,
      nowAt,
      newSessionExpiresAt,
      reservation.id,
      current.auth_account_id,
      nextAuthVersion,
      accountTransitionId,
      current.enrollment_deadline_at,
      nowAt,
      current.session_id,
      current.auth_version,
      current.admin_user_id,
      PASSWORD_SENTINEL,
      credentialId,
      credentialTransitionId,
      reservation.requestHash
    ),
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?,
          revocation_reason = 'enrollment_password_set',
          rotated_to_session_id = ?,
          rotation_transition_id = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND realm = 'staff'
        AND scope = 'staff_enrollment'
        AND issued_auth_version = ?
        AND revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM auth_sessions next
          WHERE next.id = ?
            AND next.rotated_from_session_id = auth_sessions.id
            AND next.issued_auth_version = ?
        )
    `).bind(
      nowAt,
      newSessionId,
      rotationTransitionId,
      current.session_id,
      current.auth_account_id,
      current.auth_version,
      newSessionId,
      nextAuthVersion
    ),
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?, revocation_reason = 'password_changed'
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND id NOT IN (?, ?)
        AND revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM auth_sessions next
          WHERE next.id = ?
            AND next.auth_account_id = auth_sessions.auth_account_id
            AND next.issued_auth_version = ?
            AND next.revoked_at IS NULL
        )
    `).bind(
      nowAt,
      current.auth_account_id,
      current.session_id,
      newSessionId,
      newSessionId,
      nextAuthVersion
    ),
    database.prepare(`
      UPDATE auth_challenges
      SET status = 'invalidated',
          invalidated_at = ?,
          transition_id = lower(hex(randomblob(16)))
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND status IN ('pending', 'verified')
        AND EXISTS (
          SELECT 1 FROM auth_sessions next
          WHERE next.id = ?
            AND next.auth_account_id = auth_challenges.auth_account_id
            AND next.issued_auth_version = ?
            AND next.revoked_at IS NULL
        )
    `).bind(
      nowAt,
      current.auth_account_id,
      newSessionId,
      nextAuthVersion
    ),
    idempotencyCompletion.statement,
    database.prepare(`
      INSERT INTO auth_security_events (
        id, event_type, outcome, subject_account_id, actor_account_id,
        actor_role, correlation_id, fingerprint_key_version,
        request_ip_hash, request_user_agent_hash, request_device_hash,
        metadata_json, occurred_at
      ) VALUES (
        ?, 'staff.enrollment.password_set', 'success', ?, ?, ?,
        (
          SELECT ?
          FROM auth_accounts a
          JOIN admin_users u ON u.auth_account_id = a.id
          JOIN auth_password_credentials p ON p.auth_account_id = a.id
          JOIN auth_sessions next ON next.auth_account_id = a.id
          JOIN auth_sessions source ON source.id = next.rotated_from_session_id
          JOIN auth_idempotency_keys k ON k.id = ?
          WHERE a.id = ?
            AND a.auth_version = ?
            AND a.last_transition_id = ?
            AND a.legacy_sessions_revoked_before = ?
            AND u.id = ?
            AND u.password_hash = ?
            AND p.id = ?
            AND p.algorithm = 'argon2id_phc_v1'
            AND p.revoked_at IS NULL
            AND next.id = ?
            AND next.issued_auth_version = ?
            AND next.revoked_at IS NULL
            AND source.id = ?
            AND source.revoked_at = ?
            AND source.revocation_reason = 'enrollment_password_set'
            AND source.rotated_to_session_id = next.id
            AND source.rotation_transition_id = ?
            AND (SELECT COUNT(*) FROM auth_sessions active
                 WHERE active.auth_account_id = a.id
                   AND active.revoked_at IS NULL) = 1
            AND NOT EXISTS (
              SELECT 1 FROM auth_challenges c
              WHERE c.auth_account_id = a.id
                AND c.status IN ('pending', 'verified')
            )
            AND k.status = 'completed'
            AND k.request_hash = ?
            AND k.resource_type = 'auth_password_credential'
            AND k.resource_id = p.id
        ),
        1, NULL, NULL, NULL, ?, ?
      )
    `).bind(
      eventId,
      current.auth_account_id,
      current.auth_account_id,
      current.role,
      normalizedRequestId,
      reservation.id,
      current.auth_account_id,
      nextAuthVersion,
      accountTransitionId,
      nowAt,
      current.admin_user_id,
      PASSWORD_SENTINEL,
      credentialId,
      newSessionId,
      nextAuthVersion,
      current.session_id,
      nowAt,
      rotationTransitionId,
      reservation.requestHash,
      JSON.stringify({
        enrollment: true,
        password_profile: passwordRecord.algorithm,
        password_profile_version: passwordRecord.algorithmVersion,
        legacy_login_disabled: current.legacy_login_disabled_at !== null
      }),
      nowAt
    )
  ];

  try {
    await database.batch(statements);
  } catch {
    fail();
  }
  return Object.freeze({
    envelope,
    credentialId,
    sessionId: newSessionId,
    sessionExpiresAt: newSessionExpiresAt
  });
}

export {
  PASSWORD_SENTINEL,
  StaffPasswordPolicyError,
  StaffPasswordProfileError
};
