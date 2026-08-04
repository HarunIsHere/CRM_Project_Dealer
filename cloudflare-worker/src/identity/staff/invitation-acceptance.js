import { parseVersionedChallengeTokenHash } from "../challenge-token.js";
import { createOpaqueId } from "../crypto.js";
import { prepareIdempotencyCompletion } from "../idempotency.js";
import { maskEmailAddress } from "../email/normalization.js";
import { createSessionHashesForIssuance } from "../session-keyring.js";

const ACCOUNT_ENROLLMENT_LIFETIME_MS = 72 * 60 * 60 * 1000;
const ENROLLMENT_SESSION_LIFETIME_SECONDS = 30 * 60;
const SUPPORTED_LOCALES = new Set(["en", "de", "tr", "ar", "ru"]);

export const BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS = Object.freeze([
  "GET /api/v1/admin/auth/enrollment",
  "POST /api/v1/admin/auth/enrollment/logout",
  "PUT /api/v1/admin/auth/enrollment/password",
  "POST /api/v1/admin/auth/enrollment/passkeys/registration/options",
  "POST /api/v1/admin/auth/enrollment/passkeys/registration/complete",
  "POST /api/v1/admin/auth/enrollment/recovery-code-sets",
  "POST /api/v1/admin/auth/enrollment/recovery-code-sets/{set_id}/acknowledge",
  "POST /api/v1/admin/auth/enrollment/complete"
]);

export class StaffInvitationError extends Error {
  constructor(code, status = 400) {
    const message = code === "invalid_or_expired_invitation"
      ? "The invitation is invalid or expired."
      : "Staff invitation processing is temporarily unavailable.";
    super(message);
    this.name = "StaffInvitationError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status = 503) {
  throw new StaffInvitationError(code, status);
}

function invalidInvitation() {
  fail("invalid_or_expired_invitation", 400);
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

function createOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function placeholders(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 5) {
    fail("temporarily_unavailable");
  }
  return values.map(() => "?").join(", ");
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function loadInvitation(database, tokenHashes) {
  const result = await database.prepare(`
    /* protected-bootstrap-invitation-by-token-v1 */
    SELECT
      c.id AS challenge_id,
      c.token_hash,
      c.status AS challenge_status,
      c.verification_method,
      c.required_proof_policy,
      c.expected_auth_version,
      c.locale AS challenge_locale,
      c.correlation_id,
      c.expires_at AS challenge_expires_at,
      i.id AS invitation_id,
      i.status AS invitation_status,
      i.invited_by_account_id,
      i.invited_by_realm,
      i.invited_by_actor_ref,
      i.expires_at AS invitation_expires_at,
      e.id AS email_address_id,
      e.normalized_email,
      e.status AS email_status,
      e.is_primary AS email_is_primary,
      a.id AS auth_account_id,
      a.realm AS account_realm,
      a.status AS account_status,
      a.auth_version,
      a.enrollment_state,
      a.enrollment_deadline_at,
      a.disabled_reason,
      a.disabled_at,
      a.deleted_at,
      a.locale AS account_locale,
      u.id AS admin_user_id,
      u.username,
      u.role,
      u.is_active,
      u.is_protected,
      (
        SELECT COUNT(*)
        FROM auth_password_credentials p
        WHERE p.auth_account_id = a.id AND p.revoked_at IS NULL
      ) AS active_password_count,
      (
        SELECT COUNT(*)
        FROM auth_passkey_credentials p
        WHERE p.auth_account_id = a.id AND p.realm = 'staff' AND p.revoked_at IS NULL
      ) AS active_passkey_count,
      (
        SELECT COUNT(*)
        FROM auth_recovery_code_sets r
        WHERE r.auth_account_id = a.id
          AND r.account_realm = 'staff'
          AND r.status IN ('generated', 'active')
      ) AS active_recovery_code_set_count
    FROM auth_challenges c
    JOIN auth_email_addresses e
      ON e.id = c.email_address_id
     AND e.auth_account_id = c.auth_account_id
     AND e.realm = c.realm
    JOIN auth_staff_invitations i
      ON i.challenge_id = c.id
     AND i.auth_account_id = c.auth_account_id
     AND i.email_address_id = c.email_address_id
    JOIN auth_accounts a
      ON a.id = c.auth_account_id
     AND a.realm = c.realm
    JOIN admin_users u
      ON u.id = i.admin_user_id
     AND u.auth_account_id = a.id
    WHERE c.realm = 'staff'
      AND c.purpose = 'staff_invitation'
      AND c.token_hash IN (${placeholders(tokenHashes)})
    LIMIT 2
  `).bind(...tokenHashes).all();
  const matches = rows(result);
  return matches.length === 1 ? matches[0] : null;
}

function count(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : -1;
}

function exactBootstrapUsername(env, row) {
  const expected = row.role === "superadmin"
    ? String(env?.SUPERADMIN_USERNAME ?? "").trim()
    : row.role === "admin"
      ? String(env?.ADMIN_USERNAME ?? "").trim()
      : "";
  return expected !== "" && row.username === expected;
}

function isEligible(env, row, tokenHashes, nowAt) {
  if (!row) return false;
  let parsedHash;
  try {
    parsedHash = parseVersionedChallengeTokenHash(row.token_hash);
  } catch {
    return false;
  }
  const nowMs = new Date(nowAt).getTime();
  const ownerReceipt = String(env?.CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT ?? "").trim();
  return Boolean(
    tokenHashes.includes(row.token_hash)
    && parsedHash.version >= 1
    && row.challenge_status === "pending"
    && row.verification_method === "magic_link"
    && row.required_proof_policy === "single"
    && Number(row.expected_auth_version) === Number(row.auth_version)
    && SUPPORTED_LOCALES.has(row.challenge_locale)
    && new Date(row.challenge_expires_at).getTime() > nowMs
    && row.invitation_status === "pending"
    && row.invited_by_account_id === null
    && row.invited_by_realm === null
    && ownerReceipt.length >= 16
    && row.invited_by_actor_ref === ownerReceipt
    && new Date(row.invitation_expires_at).getTime() > nowMs
    && row.email_status === "pending"
    && Number(row.email_is_primary) === 0
    && row.account_realm === "staff"
    && row.account_status === "pending"
    && row.enrollment_state === "required"
    && row.enrollment_deadline_at === null
    && row.disabled_reason === null
    && row.disabled_at === null
    && row.deleted_at === null
    && SUPPORTED_LOCALES.has(row.account_locale)
    && row.account_locale === row.challenge_locale
    && Number(row.is_active) === 1
    && Number(row.is_protected) === 1
    && exactBootstrapUsername(env, row)
    && count(row.active_password_count) === 0
    && count(row.active_passkey_count) === 0
    && count(row.active_recovery_code_set_count) === 0
  );
}

function maskedContext(row) {
  return Object.freeze({
    username: row.username,
    role: row.role,
    email_masked: maskEmailAddress(row.normalized_email),
    locale: row.account_locale,
    status: row.invitation_status,
    expires_at: row.invitation_expires_at
  });
}

export async function previewProtectedBootstrapInvitation(
  env,
  { tokenHashes, now = new Date() }
) {
  const database = requireDatabase(env);
  const nowAt = isoTimestamp(now);
  const invitation = await loadInvitation(database, tokenHashes);
  if (!isEligible(env, invitation, tokenHashes, nowAt)) invalidInvitation();
  return maskedContext(invitation);
}

function responseEnvelope(publicBody, sessionToken, csrfToken) {
  return Object.freeze({
    version: 1,
    public_body: publicBody,
    cookie_session_token: sessionToken,
    cookie_csrf_token: csrfToken,
    cookie_max_age_seconds: ENROLLMENT_SESSION_LIFETIME_SECONDS
  });
}

export function validateInvitationReplayEnvelope(value) {
  if (
    !value
    || typeof value !== "object"
    || value.version !== 1
    || !value.public_body
    || typeof value.public_body !== "object"
    || !/^[A-Za-z0-9_-]{43}$/.test(String(value.cookie_session_token ?? ""))
    || !/^[A-Za-z0-9_-]{43}$/.test(String(value.cookie_csrf_token ?? ""))
    || value.cookie_max_age_seconds !== ENROLLMENT_SESSION_LIFETIME_SECONDS
  ) {
    fail("temporarily_unavailable");
  }
  const body = value.public_body;
  if (
    body.ok !== true
    || !/^[0-9a-f]{32}$/.test(String(body.request_id ?? ""))
    || body.session?.scope !== "staff_enrollment"
    || body.session?.transport !== "cookie"
    || Object.hasOwn(body.session ?? {}, "access_token")
  ) {
    fail("temporarily_unavailable");
  }
  return value;
}

export async function acceptProtectedBootstrapInvitation(
  env,
  {
    tokenHashes,
    reservation,
    requestId,
    clientPlatform,
    appVersion,
    now = new Date()
  }
) {
  const database = requireDatabase(env);
  const nowAt = isoTimestamp(now);
  const invitation = await loadInvitation(database, tokenHashes);
  if (!isEligible(env, invitation, tokenHashes, nowAt)) invalidInvitation();

  const accountDeadlineAt = new Date(
    new Date(nowAt).getTime() + ACCOUNT_ENROLLMENT_LIFETIME_MS
  ).toISOString();
  const sessionExpiresAt = new Date(
    new Date(nowAt).getTime() + ENROLLMENT_SESSION_LIFETIME_SECONDS * 1000
  ).toISOString();
  const sessionId = createOpaqueId();
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const challengeTransitionId = createOpaqueId();
  const accountTransitionId = createOpaqueId();
  const sessionTransitionId = createOpaqueId();
  const securityEventId = createOpaqueId();
  const sessionHashes = await createSessionHashesForIssuance(env, {
    sessionToken,
    csrfToken
  });
  const authorizationContext = Object.freeze({
    source: "staff_invitation",
    invitation_id: invitation.invitation_id,
    challenge_id: invitation.challenge_id,
    stage: "email_verified",
    allowed_actions: BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS
  });
  const publicBody = Object.freeze({
    ok: true,
    request_id: requestId,
    invitation: Object.freeze({
      ...maskedContext(invitation),
      status: "accepted"
    }),
    enrollment: Object.freeze({
      stage: "email_verified",
      email_verified: true,
      password_set: false,
      passkey_registered: false,
      recovery_codes_acknowledged: false,
      deadline_at: accountDeadlineAt
    }),
    session: Object.freeze({
      id: sessionId,
      transport: "cookie",
      scope: "staff_enrollment",
      expires_at: sessionExpiresAt,
      csrf_token: csrfToken,
      assurance: Object.freeze({
        level: 1,
        methods: Object.freeze(["email"]),
        authenticated_at: nowAt,
        strong_authenticated_at: null
      })
    })
  });
  const envelope = responseEnvelope(publicBody, sessionToken, csrfToken);
  const idempotencyCompletion = await prepareIdempotencyCompletion(
    env,
    reservation,
    {
      status: 200,
      body: envelope,
      resourceType: "auth_session",
      resourceId: sessionId,
      completedAt: nowAt
    }
  );

  const statements = [
    database.prepare(`
      UPDATE auth_challenges
      SET status = 'consumed', consumed_at = ?, transition_id = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND email_address_id = ?
        AND realm = 'staff'
        AND purpose = 'staff_invitation'
        AND status = 'pending'
        AND token_hash = ?
        AND expected_auth_version = ?
        AND datetime(expires_at) > datetime(?)
        AND EXISTS (
          SELECT 1
          FROM auth_staff_invitations i
          JOIN admin_users u ON u.id = i.admin_user_id
          WHERE i.challenge_id = auth_challenges.id
            AND i.status = 'pending'
            AND i.invited_by_account_id IS NULL
            AND i.invited_by_realm IS NULL
            AND i.invited_by_actor_ref = ?
            AND datetime(i.expires_at) > datetime(?)
            AND u.is_protected = 1
        )
    `).bind(
      nowAt,
      challengeTransitionId,
      invitation.challenge_id,
      invitation.auth_account_id,
      invitation.email_address_id,
      invitation.token_hash,
      Number(invitation.auth_version),
      nowAt,
      invitation.invited_by_actor_ref,
      nowAt
    ),
    database.prepare(`
      UPDATE auth_email_addresses
      SET status = 'verified', is_primary = 1, verified_at = ?, updated_at = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND realm = 'staff'
        AND status = 'pending'
        AND is_primary = 0
        AND EXISTS (
          SELECT 1 FROM auth_challenges c
          WHERE c.id = ? AND c.transition_id = ? AND c.status = 'consumed'
        )
    `).bind(
      nowAt,
      nowAt,
      invitation.email_address_id,
      invitation.auth_account_id,
      invitation.challenge_id,
      challengeTransitionId
    ),
    database.prepare(`
      UPDATE auth_staff_invitations
      SET status = 'accepted', accepted_at = ?, updated_at = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND email_address_id = ?
        AND challenge_id = ?
        AND status = 'pending'
        AND datetime(expires_at) > datetime(?)
        AND EXISTS (
          SELECT 1 FROM auth_challenges c
          WHERE c.id = auth_staff_invitations.challenge_id
            AND c.transition_id = ?
            AND c.status = 'consumed'
        )
    `).bind(
      nowAt,
      nowAt,
      invitation.invitation_id,
      invitation.auth_account_id,
      invitation.email_address_id,
      invitation.challenge_id,
      nowAt,
      challengeTransitionId
    ),
    database.prepare(`
      UPDATE auth_accounts
      SET enrollment_state = 'in_progress',
          enrollment_deadline_at = ?,
          last_transition_id = ?,
          updated_at = ?
      WHERE id = ?
        AND realm = 'staff'
        AND status = 'pending'
        AND auth_version = ?
        AND enrollment_state = 'required'
        AND enrollment_deadline_at IS NULL
        AND disabled_reason IS NULL
        AND disabled_at IS NULL
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM admin_users u
          JOIN auth_staff_invitations i ON i.admin_user_id = u.id
          WHERE u.auth_account_id = auth_accounts.id
            AND u.is_active = 1
            AND u.is_protected = 1
            AND i.id = ?
            AND i.status = 'accepted'
        )
    `).bind(
      accountDeadlineAt,
      accountTransitionId,
      nowAt,
      invitation.auth_account_id,
      Number(invitation.auth_version),
      invitation.invitation_id
    ),
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?, revocation_reason = 'invitation_accepted'
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND scope IN (
          'staff_enrollment',
          'staff_recovery_email',
          'staff_recovery_authorized'
        )
        AND revoked_at IS NULL
    `).bind(nowAt, invitation.auth_account_id),
    idempotencyCompletion.statement,
    database.prepare(`
      INSERT INTO auth_sessions (
        id, auth_account_id, realm, token_hash, token_hash_version,
        created_transition_id, issued_auth_version, scope, assurance_level,
        auth_methods_json, authorization_context_json, session_transport,
        csrf_token_hash, client_platform, app_version, authenticated_at,
        created_at, expires_at
      ) VALUES (
        ?,
        (
          SELECT a.id
          FROM auth_accounts a
          JOIN admin_users u ON u.auth_account_id = a.id
          JOIN auth_staff_invitations i ON i.admin_user_id = u.id
          JOIN auth_challenges c ON c.id = i.challenge_id
          JOIN auth_email_addresses e ON e.id = i.email_address_id
          JOIN auth_idempotency_keys k ON k.id = ?
          WHERE a.id = ?
            AND a.realm = 'staff'
            AND a.status = 'pending'
            AND a.enrollment_state = 'in_progress'
            AND a.enrollment_deadline_at = ?
            AND a.last_transition_id = ?
            AND u.is_protected = 1
            AND i.id = ?
            AND i.status = 'accepted'
            AND i.accepted_at = ?
            AND c.id = ?
            AND c.status = 'consumed'
            AND c.transition_id = ?
            AND e.id = ?
            AND e.status = 'verified'
            AND e.is_primary = 1
            AND e.verified_at = ?
            AND k.status = 'completed'
            AND k.request_hash = ?
            AND k.resource_type = 'auth_session'
            AND k.resource_id = ?
        ),
        'staff', ?, ?, ?, ?, 'staff_enrollment', 1, ?, ?, 'cookie', ?,
        ?, ?, ?, ?, ?
      )
    `).bind(
      sessionId,
      reservation.id,
      invitation.auth_account_id,
      accountDeadlineAt,
      accountTransitionId,
      invitation.invitation_id,
      nowAt,
      invitation.challenge_id,
      challengeTransitionId,
      invitation.email_address_id,
      nowAt,
      reservation.requestHash,
      sessionId,
      sessionHashes.tokenHash,
      sessionHashes.tokenHashVersion,
      sessionTransitionId,
      Number(invitation.auth_version),
      JSON.stringify(["email"]),
      JSON.stringify(authorizationContext),
      sessionHashes.csrfTokenHash,
      clientPlatform,
      appVersion,
      nowAt,
      nowAt,
      sessionExpiresAt
    ),
    database.prepare(`
      INSERT INTO auth_security_events (
        id, event_type, outcome, subject_account_id, actor_account_id,
        actor_role, correlation_id, fingerprint_key_version,
        request_ip_hash, request_user_agent_hash, request_device_hash,
        metadata_json, occurred_at
      ) VALUES (
        ?, 'staff.invitation.accepted', 'success', ?, NULL,
        'email_proof', ?, 1, NULL, NULL, NULL, ?, ?
      )
    `).bind(
      securityEventId,
      invitation.auth_account_id,
      invitation.correlation_id,
      JSON.stringify({
        protected_bootstrap: true,
        invitation_id: invitation.invitation_id,
        locale: invitation.account_locale
      }),
      nowAt
    )
  ];

  try {
    await database.batch(statements);
  } catch {
    fail("invalid_or_expired_invitation", 400);
  }

  return Object.freeze({
    envelope,
    sessionId,
    sessionExpiresAt
  });
}

export {
  ACCOUNT_ENROLLMENT_LIFETIME_MS,
  ENROLLMENT_SESSION_LIFETIME_SECONDS
};
