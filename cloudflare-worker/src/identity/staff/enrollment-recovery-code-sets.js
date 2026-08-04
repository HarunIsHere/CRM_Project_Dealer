import { createOpaqueId } from "../crypto.js";
import { prepareIdempotencyCompletion } from "../idempotency.js";
import {
  createRecoveryCodeSet,
  createRecoveryCodeVerifier
} from "../recovery-codes.js";
import { createSessionHashesForIssuance } from "../session-keyring.js";

export const STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE =
  "/api/v1/admin/auth/enrollment/recovery-code-sets";
export const STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE =
  "/api/v1/admin/auth/enrollment/recovery-code-sets/{set_id}/acknowledge";

const ACKNOWLEDGEMENT_LIFETIME_MS = 10 * 60 * 1000;
const ID_32 = /^[0-9a-f]{32}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const FORMATTED_RECOVERY_CODE =
  /^(?:[0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/;

export class StaffEnrollmentRecoveryCodeError extends Error {
  constructor(code, status = 400) {
    super(
      code === "invalid_or_expired_recovery_code_set"
        ? "The recovery-code set is invalid or expired."
        : code === "unauthorized"
          ? "A valid enrollment session is required."
          : "Staff enrollment recovery-code processing is temporarily unavailable."
    );
    this.name = "StaffEnrollmentRecoveryCodeError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 503) {
  throw new StaffEnrollmentRecoveryCodeError(code, status);
}

function requireDatabase(env) {
  if (
    !env?.DB
    || typeof env.DB.prepare !== "function"
    || typeof env.DB.batch !== "function"
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

function parseJsonObject(value) {
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
    if (
      !Array.isArray(parsed)
      || parsed.some((entry) => typeof entry !== "string" || entry === "")
      || new Set(parsed).size !== parsed.length
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function requireRequestId(value) {
  const requestId = String(value ?? "");
  if (!ID_32.test(requestId)) fail("temporarily_unavailable");
  return requestId;
}

function requireSetId(value) {
  const setId = String(value ?? "");
  if (!ID_32.test(setId)) {
    fail("invalid_or_expired_recovery_code_set", 400);
  }
  return setId;
}

function assertReservation(reservation, operation, nowAt) {
  if (
    !reservation
    || !ID_32.test(String(reservation.id ?? ""))
    || reservation.realm !== "staff"
    || reservation.operation !== `POST ${operation}`
    || !HEX_64.test(String(reservation.requestHash ?? ""))
    || !Number.isFinite(Date.parse(String(reservation.expiresAt ?? "")))
    || Date.parse(reservation.expiresAt) <= Date.parse(nowAt)
  ) {
    fail("idempotency_required", 400);
  }
}

function createOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

async function loadEnrollmentSession(database, sessionReference, action, nowAt) {
  if (!ID_32.test(String(sessionReference?.id ?? ""))) {
    fail("unauthorized", 401);
  }
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
      a.locale,
      u.id AS admin_user_id,
      u.role,
      i.id AS invitation_id,
      e.id AS email_address_id,
      (
        SELECT COUNT(*) FROM auth_password_credentials p
        WHERE p.auth_account_id = a.id AND p.revoked_at IS NULL
      ) AS active_password_count,
      (
        SELECT COUNT(*) FROM auth_passkey_credentials p
        WHERE p.auth_account_id = a.id
          AND p.realm = 'staff'
          AND p.revoked_at IS NULL
      ) AS active_passkey_count
    FROM auth_sessions s
    JOIN auth_accounts a
      ON a.id = s.auth_account_id AND a.realm = s.realm
    JOIN admin_users u
      ON u.auth_account_id = a.id
    JOIN auth_staff_invitations i
      ON i.id = json_extract(s.authorization_context_json, '$.invitation_id')
     AND i.auth_account_id = a.id
     AND i.admin_user_id = u.id
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
      AND i.status = 'accepted'
      AND i.accepted_at IS NOT NULL
      AND e.status = 'verified'
      AND e.is_primary = 1
      AND e.verified_at IS NOT NULL
      AND json_extract(s.authorization_context_json, '$.stage') = 'email_verified'
      AND EXISTS (
        SELECT 1
        FROM json_each(s.authorization_context_json, '$.allowed_actions')
        WHERE type = 'text' AND value = ?
      )
    LIMIT 1
  `).bind(sessionReference.id, nowAt, nowAt, action).first();

  if (!row || !sessionReferenceMatches(sessionReference, row)) {
    fail("unauthorized", 401);
  }
  const authorizationContext = parseJsonObject(row.authorization_context_json);
  const allowedActions = authorizationContext?.allowed_actions;
  const authMethods = parseStringArray(row.auth_methods_json);
  if (
    authorizationContext?.stage !== "email_verified"
    || !Array.isArray(allowedActions)
    || allowedActions.some((entry) => typeof entry !== "string" || entry === "")
    || new Set(allowedActions).size !== allowedActions.length
    || !allowedActions.includes(action)
    || authorizationContext.invitation_id !== row.invitation_id
    || !authMethods
  ) {
    fail("unauthorized", 401);
  }
  return Object.freeze({
    ...row,
    auth_version: Number(row.auth_version),
    issued_auth_version: Number(row.issued_auth_version),
    active_password_count: Number(row.active_password_count),
    active_passkey_count: Number(row.active_passkey_count),
    authorization_context: authorizationContext,
    allowed_actions: Object.freeze([...allowedActions]),
    auth_methods: Object.freeze([...authMethods])
  });
}

function generationResponse(requestId, setId, expiresAt, codes) {
  return Object.freeze({
    ok: true,
    request_id: requestId,
    recovery_code_set: Object.freeze({
      id: setId,
      expires_at: expiresAt,
      acknowledgement_required: true
    }),
    codes: Object.freeze([...codes])
  });
}

export function validateEnrollmentRecoveryCodeGenerationReplayBody(value) {
  const codes = value?.codes;
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || value.ok !== true
    || !ID_32.test(String(value.request_id ?? ""))
    || !ID_32.test(String(value.recovery_code_set?.id ?? ""))
    || !Number.isFinite(Date.parse(String(
      value.recovery_code_set?.expires_at ?? ""
    )))
    || value.recovery_code_set?.acknowledgement_required !== true
    || !Array.isArray(codes)
    || codes.length !== 10
    || codes.some((code) => !FORMATTED_RECOVERY_CODE.test(String(code ?? "")))
    || new Set(codes).size !== codes.length
  ) {
    fail("temporarily_unavailable");
  }
  return value;
}

export async function generateStaffEnrollmentRecoveryCodeSet(
  env,
  { session, reservation, requestId, now = new Date() }
) {
  const database = requireDatabase(env);
  const nowAt = isoTimestamp(now);
  const normalizedRequestId = requireRequestId(requestId);
  assertReservation(
    reservation,
    STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    nowAt
  );
  const current = await loadEnrollmentSession(
    database,
    session,
    `POST ${STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE}`,
    nowAt
  );
  const setId = createOpaqueId();
  const setTransitionId = createOpaqueId();
  const eventId = createOpaqueId();
  const acknowledgementExpiresAt = new Date(
    Date.parse(nowAt) + ACKNOWLEDGEMENT_LIFETIME_MS
  ).toISOString();
  const codes = createRecoveryCodeSet(10);
  const verifiers = await Promise.all(codes.map((code, index) => (
    createRecoveryCodeVerifier(env, code, {
      accountId: current.auth_account_id,
      codeSetId: setId,
      position: index + 1
    })
  )));
  const publicBody = generationResponse(
    normalizedRequestId,
    setId,
    acknowledgementExpiresAt,
    codes
  );
  const idempotencyCompletion = await prepareIdempotencyCompletion(
    env,
    reservation,
    {
      status: 201,
      body: publicBody,
      resourceType: "auth_recovery_code_set",
      resourceId: setId,
      completedAt: nowAt
    }
  );

  const eligibility = `
    s.id = ?
    AND s.auth_account_id = ?
    AND s.realm = 'staff'
    AND s.scope = 'staff_enrollment'
    AND s.session_transport = 'cookie'
    AND s.client_platform = 'admin_web'
    AND s.revoked_at IS NULL
    AND s.rotated_to_session_id IS NULL
    AND datetime(s.expires_at) > datetime(?)
    AND s.issued_auth_version = ?
    AND a.id = s.auth_account_id
    AND a.realm = 'staff'
    AND a.auth_version = ?
    AND a.status IN ('pending', 'active')
    AND a.enrollment_state = 'in_progress'
    AND datetime(a.enrollment_deadline_at) > datetime(?)
    AND a.disabled_reason IS NULL
    AND a.deleted_at IS NULL
    AND u.auth_account_id = a.id
    AND u.id = ?
    AND u.is_active = 1
    AND i.id = ?
    AND i.auth_account_id = a.id
    AND i.admin_user_id = u.id
    AND i.status = 'accepted'
    AND i.accepted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth_email_addresses e
      WHERE e.id = i.email_address_id
        AND e.auth_account_id = a.id
        AND e.realm = 'staff'
        AND e.status = 'verified'
        AND e.is_primary = 1
        AND e.verified_at IS NOT NULL
    )
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
    current.session_id,
    current.auth_account_id,
    nowAt,
    current.auth_version,
    current.auth_version,
    nowAt,
    current.admin_user_id,
    current.invitation_id,
    `POST ${STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE}`,
    reservation.id,
    reservation.operation,
    reservation.requestHash,
    nowAt
  ];
  const statements = [
    database.prepare(`
      UPDATE auth_recovery_codes
      SET revoked_at = ?
      WHERE auth_account_id = ?
        AND account_realm = 'staff'
        AND code_set_id IN (
          SELECT id FROM auth_recovery_code_sets
          WHERE auth_account_id = ? AND status = 'generated'
        )
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM auth_sessions s
          JOIN auth_accounts a ON a.id = s.auth_account_id
          JOIN admin_users u ON u.auth_account_id = a.id
          JOIN auth_staff_invitations i ON i.auth_account_id = a.id
          JOIN auth_idempotency_keys k ON k.id = ?
          WHERE ${eligibility}
        )
    `).bind(
      nowAt,
      current.auth_account_id,
      current.auth_account_id,
      reservation.id,
      ...eligibilityBindings
    ),
    database.prepare(`
      UPDATE auth_recovery_code_sets
      SET status = 'revoked', revoked_at = ?
      WHERE auth_account_id = ?
        AND account_realm = 'staff'
        AND status = 'generated'
        AND EXISTS (
          SELECT 1
          FROM auth_sessions s
          JOIN auth_accounts a ON a.id = s.auth_account_id
          JOIN admin_users u ON u.auth_account_id = a.id
          JOIN auth_staff_invitations i ON i.auth_account_id = a.id
          JOIN auth_idempotency_keys k ON k.id = ?
          WHERE ${eligibility}
        )
    `).bind(
      nowAt,
      current.auth_account_id,
      reservation.id,
      ...eligibilityBindings
    ),
    database.prepare(`
      INSERT INTO auth_recovery_code_sets (
        id, auth_account_id, account_realm, generating_session_id,
        expected_auth_version, status, code_count, created_at,
        acknowledgement_expires_at, created_transition_id
      )
      SELECT ?, a.id, 'staff', s.id, a.auth_version, 'generated', 10, ?, ?, ?
      FROM auth_sessions s
      JOIN auth_accounts a ON a.id = s.auth_account_id
      JOIN admin_users u ON u.auth_account_id = a.id
      JOIN auth_staff_invitations i ON i.auth_account_id = a.id
      JOIN auth_idempotency_keys k ON k.id = ?
      WHERE ${eligibility}
    `).bind(
      setId,
      nowAt,
      acknowledgementExpiresAt,
      setTransitionId,
      reservation.id,
      ...eligibilityBindings
    ),
    ...verifiers.map((verifier, index) => database.prepare(`
      INSERT INTO auth_recovery_codes (
        id, auth_account_id, account_realm, code_set_id, code_position,
        verifier, verifier_key_version, created_at
      )
      SELECT ?, r.auth_account_id, 'staff', r.id, ?, ?, ?, ?
      FROM auth_recovery_code_sets r
      WHERE r.id = ?
        AND r.auth_account_id = ?
        AND r.generating_session_id = ?
        AND r.expected_auth_version = ?
        AND r.status = 'generated'
        AND r.created_transition_id = ?
    `).bind(
      createOpaqueId(),
      index + 1,
      verifier.verifier,
      verifier.version,
      nowAt,
      setId,
      current.auth_account_id,
      current.session_id,
      current.auth_version,
      setTransitionId
    )),
    idempotencyCompletion.statement,
    database.prepare(`
      INSERT INTO auth_security_events (
        id, event_type, outcome, subject_account_id, actor_account_id,
        actor_role, correlation_id, fingerprint_key_version, metadata_json,
        occurred_at
      ) VALUES (
        ?, 'staff.enrollment.recovery_codes_generated', 'success', ?, ?, ?,
        (
          SELECT ?
          FROM auth_recovery_code_sets r
          JOIN auth_idempotency_keys k ON k.id = ?
          WHERE r.id = ?
            AND r.auth_account_id = ?
            AND r.generating_session_id = ?
            AND r.expected_auth_version = ?
            AND r.status = 'generated'
            AND r.code_count = 10
            AND r.acknowledgement_expires_at = ?
            AND (SELECT COUNT(*) FROM auth_recovery_codes c
                 WHERE c.code_set_id = r.id AND c.auth_account_id = r.auth_account_id) = 10
            AND NOT EXISTS (
              SELECT 1 FROM auth_recovery_code_sets other
              WHERE other.auth_account_id = r.auth_account_id
                AND other.status = 'generated'
                AND other.id <> r.id
            )
            AND k.status = 'completed'
            AND k.request_hash = ?
            AND k.resource_type = 'auth_recovery_code_set'
            AND k.resource_id = r.id
        ),
        1, ?, ?
      )
    `).bind(
      eventId,
      current.auth_account_id,
      current.auth_account_id,
      current.role,
      normalizedRequestId,
      reservation.id,
      setId,
      current.auth_account_id,
      current.session_id,
      current.auth_version,
      acknowledgementExpiresAt,
      reservation.requestHash,
      JSON.stringify({ recovery_code_set_id: setId, enrollment: true }),
      nowAt
    )
  ];

  try {
    await database.batch(statements);
  } catch {
    fail("temporarily_unavailable");
  }
  return Object.freeze({ body: publicBody, setId });
}

function acknowledgementEnvelope(
  publicBody,
  sessionToken,
  csrfToken,
  cookieMaxAgeSeconds
) {
  return Object.freeze({
    version: 1,
    public_body: publicBody,
    cookie_session_token: sessionToken,
    cookie_csrf_token: csrfToken,
    cookie_max_age_seconds: cookieMaxAgeSeconds
  });
}

export function validateEnrollmentRecoveryCodeAckReplayEnvelope(value) {
  const publicBody = value?.public_body;
  const session = publicBody?.session;
  const codeSet = publicBody?.recovery_code_set;
  const enrollment = publicBody?.enrollment;
  if (
    !value
    || typeof value !== "object"
    || value.version !== 1
    || !OPAQUE_TOKEN.test(String(value.cookie_session_token ?? ""))
    || !OPAQUE_TOKEN.test(String(value.cookie_csrf_token ?? ""))
    || !Number.isSafeInteger(value.cookie_max_age_seconds)
    || value.cookie_max_age_seconds < 1
    || value.cookie_max_age_seconds > 30 * 60
    || publicBody?.ok !== true
    || !ID_32.test(String(publicBody?.request_id ?? ""))
    || !ID_32.test(String(codeSet?.id ?? ""))
    || codeSet?.status !== "active"
    || !Number.isFinite(Date.parse(String(codeSet?.acknowledged_at ?? "")))
    || enrollment?.stage !== "email_verified"
    || enrollment?.email_verified !== true
    || typeof enrollment?.password_set !== "boolean"
    || typeof enrollment?.passkey_registered !== "boolean"
    || enrollment?.recovery_codes_acknowledged !== true
    || !Number.isFinite(Date.parse(String(enrollment?.deadline_at ?? "")))
    || !ID_32.test(String(session?.id ?? ""))
    || session?.scope !== "staff_enrollment"
    || session?.transport !== "cookie"
    || !Number.isFinite(Date.parse(String(session?.expires_at ?? "")))
    || session?.csrf_token !== value.cookie_csrf_token
    || !Number.isInteger(session?.assurance?.level)
    || session.assurance.level < 0
    || session.assurance.level > 2
    || !Array.isArray(session?.assurance?.methods)
    || session.assurance.methods.some((method) => (
      typeof method !== "string" || method === ""
    ))
    || new Set(session.assurance.methods).size !== session.assurance.methods.length
    || !Number.isFinite(Date.parse(String(
      session?.assurance?.authenticated_at ?? ""
    )))
    || (
      session?.assurance?.strong_authenticated_at !== null
      && session?.assurance?.strong_authenticated_at !== undefined
      && !Number.isFinite(Date.parse(String(
        session.assurance.strong_authenticated_at
      )))
    )
    || Object.hasOwn(session ?? {}, "access_token")
  ) {
    fail("temporarily_unavailable");
  }
  return value;
}

export async function acknowledgeStaffEnrollmentRecoveryCodeSet(
  env,
  { session, setId, reservation, requestId, now = new Date() }
) {
  const database = requireDatabase(env);
  const nowAt = isoTimestamp(now);
  const normalizedSetId = requireSetId(setId);
  const normalizedRequestId = requireRequestId(requestId);
  assertReservation(reservation, STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE, nowAt);
  const current = await loadEnrollmentSession(
    database,
    session,
    `POST ${STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE}`,
    nowAt
  );
  const codeSet = await database.prepare(`
    SELECT *
    FROM auth_recovery_code_sets
    WHERE id = ?
      AND auth_account_id = ?
      AND account_realm = 'staff'
      AND generating_session_id = ?
      AND expected_auth_version = ?
      AND status = 'generated'
      AND code_count = 10
      AND datetime(acknowledgement_expires_at) > datetime(?)
    LIMIT 1
  `).bind(
    normalizedSetId,
    current.auth_account_id,
    current.session_id,
    current.auth_version,
    nowAt
  ).first();
  if (!codeSet) fail("invalid_or_expired_recovery_code_set", 400);

  const nextAuthVersion = current.auth_version + 1;
  const accountTransitionId = createOpaqueId();
  const activationTransitionId = createOpaqueId();
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
    password_set: current.active_password_count > 0,
    passkey_registered: current.active_passkey_count > 0,
    recovery_codes_acknowledged: true,
    allowed_actions: current.allowed_actions
  });
  const publicBody = Object.freeze({
    ok: true,
    request_id: normalizedRequestId,
    recovery_code_set: Object.freeze({
      id: normalizedSetId,
      status: "active",
      acknowledged_at: nowAt
    }),
    enrollment: Object.freeze({
      stage: "email_verified",
      email_verified: true,
      password_set: current.active_password_count > 0,
      passkey_registered: current.active_passkey_count > 0,
      recovery_codes_acknowledged: true,
      deadline_at: current.enrollment_deadline_at
    }),
    session: Object.freeze({
      id: newSessionId,
      transport: "cookie",
      scope: "staff_enrollment",
      expires_at: newSessionExpiresAt,
      csrf_token: newCsrfToken,
      assurance: Object.freeze({
        level: Number(current.assurance_level),
        methods: current.auth_methods,
        authenticated_at: current.authenticated_at,
        strong_authenticated_at: current.strong_authenticated_at
      })
    })
  });
  const envelope = acknowledgementEnvelope(
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
      resourceType: "auth_recovery_code_set",
      resourceId: normalizedSetId,
      completedAt: nowAt
    }
  );

  const targetExists = `
    EXISTS (
      SELECT 1
      FROM auth_recovery_code_sets target
      JOIN auth_sessions source ON source.id = target.generating_session_id
      JOIN auth_accounts account ON account.id = target.auth_account_id
      JOIN admin_users profile ON profile.auth_account_id = account.id
      JOIN auth_staff_invitations invitation
        ON invitation.id = json_extract(source.authorization_context_json, '$.invitation_id')
       AND invitation.auth_account_id = account.id
       AND invitation.admin_user_id = profile.id
      JOIN auth_idempotency_keys key ON key.id = ?
      WHERE target.id = ?
        AND target.auth_account_id = ?
        AND target.account_realm = 'staff'
        AND target.generating_session_id = ?
        AND target.expected_auth_version = ?
        AND target.status = 'generated'
        AND target.code_count = 10
        AND datetime(target.acknowledgement_expires_at) > datetime(?)
        AND source.realm = 'staff'
        AND source.scope = 'staff_enrollment'
        AND source.session_transport = 'cookie'
        AND source.client_platform = 'admin_web'
        AND source.revoked_at IS NULL
        AND source.rotated_to_session_id IS NULL
        AND datetime(source.expires_at) > datetime(?)
        AND source.issued_auth_version = account.auth_version
        AND account.realm = 'staff'
        AND account.auth_version = ?
        AND account.status IN ('pending', 'active')
        AND account.enrollment_state = 'in_progress'
        AND datetime(account.enrollment_deadline_at) > datetime(?)
        AND account.disabled_reason IS NULL
        AND account.deleted_at IS NULL
        AND profile.id = ?
        AND profile.is_active = 1
        AND invitation.id = ?
        AND invitation.status = 'accepted'
        AND invitation.accepted_at IS NOT NULL
        AND json_extract(source.authorization_context_json, '$.stage') = 'email_verified'
        AND EXISTS (
          SELECT 1 FROM json_each(source.authorization_context_json, '$.allowed_actions')
          WHERE type = 'text' AND value = ?
        )
        AND key.realm = 'staff'
        AND key.operation = ?
        AND key.request_hash = ?
        AND key.status = 'in_progress'
        AND datetime(key.expires_at) > datetime(?)
    )
  `;
  const targetBindings = [
    reservation.id,
    normalizedSetId,
    current.auth_account_id,
    current.session_id,
    current.auth_version,
    nowAt,
    nowAt,
    current.auth_version,
    nowAt,
    current.admin_user_id,
    current.invitation_id,
    `POST ${STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE}`,
    reservation.operation,
    reservation.requestHash,
    nowAt
  ];
  const statements = [
    database.prepare(`
      UPDATE auth_recovery_codes
      SET revoked_at = ?
      WHERE auth_account_id = ?
        AND account_realm = 'staff'
        AND code_set_id IN (
          SELECT id FROM auth_recovery_code_sets
          WHERE auth_account_id = ? AND status = 'active' AND id <> ?
        )
        AND used_at IS NULL
        AND revoked_at IS NULL
        AND ${targetExists}
    `).bind(
      nowAt,
      current.auth_account_id,
      current.auth_account_id,
      normalizedSetId,
      ...targetBindings
    ),
    database.prepare(`
      UPDATE auth_recovery_code_sets
      SET status = 'revoked', revoked_at = ?
      WHERE auth_account_id = ?
        AND account_realm = 'staff'
        AND status = 'active'
        AND id <> ?
        AND ${targetExists}
    `).bind(
      nowAt,
      current.auth_account_id,
      normalizedSetId,
      ...targetBindings
    ),
    database.prepare(`
      UPDATE auth_recovery_code_sets
      SET status = 'active',
          acknowledged_at = ?,
          activated_at = ?,
          activation_transition_id = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND generating_session_id = ?
        AND expected_auth_version = ?
        AND status = 'generated'
        AND datetime(acknowledgement_expires_at) > datetime(?)
        AND ${targetExists}
    `).bind(
      nowAt,
      nowAt,
      activationTransitionId,
      normalizedSetId,
      current.auth_account_id,
      current.session_id,
      current.auth_version,
      nowAt,
      ...targetBindings
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
        AND datetime(enrollment_deadline_at) > datetime(?)
        AND disabled_reason IS NULL
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM auth_recovery_code_sets r
          WHERE r.id = ?
            AND r.auth_account_id = auth_accounts.id
            AND r.status = 'active'
            AND r.activation_transition_id = ?
            AND r.acknowledged_at = ?
        )
    `).bind(
      nextAuthVersion,
      nowAt,
      accountTransitionId,
      nowAt,
      current.auth_account_id,
      current.auth_version,
      nowAt,
      normalizedSetId,
      activationTransitionId,
      nowAt
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
      JOIN auth_recovery_code_sets r ON r.auth_account_id = a.id
      JOIN auth_idempotency_keys k ON k.id = ?
      WHERE a.id = ?
        AND a.realm = 'staff'
        AND a.auth_version = ?
        AND a.last_transition_id = ?
        AND s.id = ?
        AND s.realm = 'staff'
        AND s.scope = 'staff_enrollment'
        AND s.revoked_at IS NULL
        AND s.issued_auth_version = ?
        AND r.id = ?
        AND r.status = 'active'
        AND r.activation_transition_id = ?
        AND k.status = 'in_progress'
        AND k.request_hash = ?
    `).bind(
      newSessionId,
      sessionHashes.tokenHash,
      sessionHashes.tokenHashVersion,
      sessionTransitionId,
      nextAuthVersion,
      Number(current.assurance_level),
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
      current.session_id,
      current.auth_version,
      normalizedSetId,
      activationTransitionId,
      reservation.requestHash
    ),
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?,
          revocation_reason = 'enrollment_recovery_codes_activated',
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
      SET revoked_at = ?, revocation_reason = 'recovery_codes_activated'
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND id NOT IN (?, ?)
        AND revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM auth_sessions current
          WHERE current.id = ?
            AND current.auth_account_id = auth_sessions.auth_account_id
            AND current.issued_auth_version = ?
            AND current.revoked_at IS NULL
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
          SELECT 1 FROM auth_sessions current
          WHERE current.id = ?
            AND current.auth_account_id = auth_challenges.auth_account_id
            AND current.issued_auth_version = ?
            AND current.revoked_at IS NULL
        )
    `).bind(nowAt, current.auth_account_id, newSessionId, nextAuthVersion),
    idempotencyCompletion.statement,
    database.prepare(`
      INSERT INTO auth_security_events (
        id, event_type, outcome, subject_account_id, actor_account_id,
        actor_role, correlation_id, fingerprint_key_version, metadata_json,
        occurred_at
      ) VALUES (
        ?, 'staff.enrollment.recovery_codes_activated', 'success', ?, ?, ?,
        (
          SELECT ?
          FROM auth_accounts a
          JOIN auth_recovery_code_sets r ON r.auth_account_id = a.id
          JOIN auth_sessions next ON next.auth_account_id = a.id
          JOIN auth_sessions prior ON prior.id = next.rotated_from_session_id
          JOIN auth_idempotency_keys k ON k.id = ?
          WHERE a.id = ?
            AND a.auth_version = ?
            AND a.last_transition_id = ?
            AND r.id = ?
            AND r.status = 'active'
            AND r.activation_transition_id = ?
            AND next.id = ?
            AND next.issued_auth_version = ?
            AND next.revoked_at IS NULL
            AND prior.id = ?
            AND prior.revoked_at = ?
            AND prior.rotated_to_session_id = next.id
            AND prior.rotation_transition_id = ?
            AND (SELECT COUNT(*) FROM auth_sessions active
                 WHERE active.auth_account_id = a.id AND active.revoked_at IS NULL) = 1
            AND NOT EXISTS (
              SELECT 1 FROM auth_challenges c
              WHERE c.auth_account_id = a.id AND c.status IN ('pending', 'verified')
            )
            AND k.status = 'completed'
            AND k.request_hash = ?
            AND k.resource_type = 'auth_recovery_code_set'
            AND k.resource_id = r.id
        ),
        1, ?, ?
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
      normalizedSetId,
      activationTransitionId,
      newSessionId,
      nextAuthVersion,
      current.session_id,
      nowAt,
      rotationTransitionId,
      reservation.requestHash,
      JSON.stringify({ recovery_code_set_id: normalizedSetId, enrollment: true }),
      nowAt
    )
  ];

  try {
    await database.batch(statements);
  } catch {
    fail("invalid_or_expired_recovery_code_set", 400);
  }
  return Object.freeze({
    envelope,
    sessionId: newSessionId,
    sessionExpiresAt: newSessionExpiresAt
  });
}

export { ACKNOWLEDGEMENT_LIFETIME_MS };
