import { createOpaqueId, hashOpaqueToken } from "../crypto.js";
import {
  createAcceptedChallengeTokenHashes,
  createMagicLinkToken,
  createVersionedChallengeTokenHash
} from "../challenge-token.js";
import { identityError, identityResponse } from "../http.js";
import {
  createIdentityRequestContext,
  IdentityProtocolError,
  readIdentityJson
} from "../protocol.js";
import { resolveCanonicalSession } from "../repository.js";
import { prepareEncryptedOutboxInsert } from "../email/outbox-repository.js";
import { createSessionHashesForIssuance } from "../session-keyring.js";
import {
  readScopedCookieAuthentication,
  serializeScopedAuthCookieClears,
  serializeScopedAuthCookies,
  validateRequestedSessionTransport,
  verifyScopedCookieCsrf
} from "../transport.js";

export const STAFF_RECOVERY_START_ROUTE =
  "/api/v1/admin/auth/recovery/start";
export const STAFF_RECOVERY_VERIFY_ROUTE =
  "/api/v1/admin/auth/recovery/verify";
export const STAFF_RECOVERY_PASSWORD_ROUTE =
  "/api/v1/admin/auth/recovery/password";
export const STAFF_RECOVERY_LOGOUT_ROUTE =
  "/api/v1/admin/auth/recovery/logout";

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;
const SESSION_LIFETIME_SECONDS = 30 * 60;
const USERNAME = /^[A-Za-z0-9._-]{1,120}$/;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const MANUAL_CODE = /^[0-9]{8}$/;

function protocolError(code, status, message) {
  throw new IdentityProtocolError(code, status, message);
}

function requireDatabase(env) {
  if (
    !env?.DB
    || typeof env.DB.prepare !== "function"
    || typeof env.DB.batch !== "function"
  ) {
    protocolError(
      "temporarily_unavailable",
      503,
      "Identity persistence is unavailable."
    );
  }
  return env.DB;
}

function isoTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    protocolError(
      "temporarily_unavailable",
      503,
      "Identity timekeeping is unavailable."
    );
  }
  return date.toISOString();
}

function positiveVersion(value, code = "temporarily_unavailable") {
  const text = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(text)) {
    protocolError(code, 503, "Identity key configuration is unavailable.");
  }
  return Number(text);
}

function challengeCodeConfig(env) {
  const version = positiveVersion(
    env?.CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION
  );
  const key = String(env?.[`CRM_AUTH_CHALLENGE_HMAC_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    protocolError(
      "temporarily_unavailable",
      503,
      "Identity key configuration is unavailable."
    );
  }
  return { version, key };
}

function activeFingerprintVersion(env) {
  return positiveVersion(
    env?.CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION ?? "1"
  );
}

function normalizedLocale(value) {
  const primary = String(value ?? "en").trim().toLowerCase().split("-")[0];
  return ["en", "de", "tr", "ar", "ru"].includes(primary) ? primary : "en";
}

function publicOrigin(env) {
  const value = String(env?.CRM_AUTH_PUBLIC_ORIGIN ?? "https://crm.ayartuerk.me");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    protocolError(
      "temporarily_unavailable",
      503,
      "The public identity origin is unavailable."
    );
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    protocolError(
      "temporarily_unavailable",
      503,
      "The public identity origin is unavailable."
    );
  }
  return parsed.origin;
}

function createManualCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
  return String(value).padStart(8, "0");
}

function createOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createManualCodeVerifier(env, accountId, challengeId, manualCode) {
  const config = challengeCodeConfig(env);
  return {
    verifierKeyVersion: config.version,
    codeVerifier: await hashOpaqueToken(
      [
        "crm-staff-recovery-code-v1",
        `key-v${config.version}`,
        accountId,
        challengeId,
        manualCode
      ].join("\u0000"),
      config.key
    )
  };
}

function legacyPasswordHash(env, password) {
  const secret = String(env?.ADMIN_JWT_SECRET ?? "fallback-secret");
  const source = `${secret}:${password}`;
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source)
  ).then((digest) => (
    Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  ));
}

function genericStartBody(requestId) {
  return {
    ok: true,
    request_id: requestId,
    accepted: true
  };
}

function passwordShape(password, confirmation) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    protocolError(
      "weak_password",
      400,
      "The new password must be between 8 and 128 characters."
    );
  }
  if (confirmation !== undefined && password !== confirmation) {
    protocolError(
      "password_mismatch",
      400,
      "The password confirmation does not match."
    );
  }
}

async function loadRecoverableStaffByUsername(database, username) {
  return database.prepare(`
    SELECT
      a.id AS auth_account_id,
      a.auth_version,
      a.locale,
      u.username,
      u.role,
      e.id AS email_address_id,
      e.display_email
    FROM admin_users u
    JOIN auth_accounts a
      ON a.id = u.auth_account_id
     AND a.realm = 'staff'
    JOIN auth_email_addresses e
      ON e.auth_account_id = a.id
     AND e.realm = 'staff'
    WHERE u.username = ?
      AND u.is_active = 1
      AND a.status = 'active'
      AND a.disabled_at IS NULL
      AND a.deleted_at IS NULL
      AND e.status = 'verified'
      AND e.is_primary = 1
      AND e.verified_at IS NOT NULL
      AND e.replaced_at IS NULL
    LIMIT 1
  `).bind(username).first();
}

async function invalidatePendingRecoveryState(database, accountId, nowAt) {
  await database.batch([
    database.prepare(`
      UPDATE auth_challenges
      SET status = 'invalidated',
          invalidated_at = ?,
          transition_id = COALESCE(transition_id, ?)
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND purpose = 'staff_recovery'
        AND status IN ('pending', 'verified')
    `).bind(nowAt, createOpaqueId(), accountId),
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?,
          revocation_reason = 'staff_recovery_restarted'
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND scope IN ('staff_recovery_email', 'staff_recovery_authorized')
        AND revoked_at IS NULL
    `).bind(nowAt, accountId)
  ]);
}

async function loadPendingChallengeByToken(database, tokenHashes, nowAt) {
  if (!Array.isArray(tokenHashes) || tokenHashes.length === 0) return null;
  const placeholders = tokenHashes.map(() => "?").join(", ");
  return database.prepare(`
    SELECT
      c.id AS challenge_id,
      c.auth_account_id,
      c.email_address_id,
      c.expected_auth_version,
      c.locale,
      c.expires_at,
      c.verifier_key_version,
      c.code_verifier,
      u.username,
      u.role,
      e.display_email
    FROM auth_challenges c
    JOIN auth_accounts a
      ON a.id = c.auth_account_id
     AND a.realm = c.realm
    JOIN admin_users u
      ON u.auth_account_id = a.id
    JOIN auth_email_addresses e
      ON e.id = c.email_address_id
     AND e.auth_account_id = a.id
     AND e.realm = c.realm
    WHERE c.token_hash IN (${placeholders})
      AND c.realm = 'staff'
      AND c.purpose = 'staff_recovery'
      AND c.status = 'pending'
      AND datetime(c.expires_at) > datetime(?)
      AND a.status = 'active'
      AND e.status = 'verified'
      AND e.is_primary = 1
    ORDER BY c.created_at DESC
    LIMIT 1
  `).bind(...tokenHashes, nowAt).first();
}

async function loadPendingChallengeByUsernameAndCode(
  env,
  database,
  username,
  manualCode,
  nowAt
) {
  const staff = await loadRecoverableStaffByUsername(database, username);
  if (!staff) return null;
  const current = await database.prepare(`
    SELECT id
    FROM auth_challenges
    WHERE auth_account_id = ?
      AND realm = 'staff'
      AND purpose = 'staff_recovery'
      AND status = 'pending'
      AND datetime(expires_at) > datetime(?)
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(staff.auth_account_id, nowAt).first();
  if (!current?.id) return null;
  const verifier = await createManualCodeVerifier(
    env,
    staff.auth_account_id,
    current.id,
    manualCode
  );
  return database.prepare(`
    SELECT
      c.id AS challenge_id,
      c.auth_account_id,
      c.email_address_id,
      c.expected_auth_version,
      c.locale,
      c.expires_at,
      u.username,
      u.role,
      e.display_email
    FROM auth_challenges c
    JOIN auth_accounts a
      ON a.id = c.auth_account_id
     AND a.realm = c.realm
    JOIN admin_users u
      ON u.auth_account_id = a.id
    JOIN auth_email_addresses e
      ON e.id = c.email_address_id
     AND e.auth_account_id = a.id
     AND e.realm = c.realm
    WHERE c.id = ?
      AND c.realm = 'staff'
      AND c.purpose = 'staff_recovery'
      AND c.status = 'pending'
      AND c.verifier_key_version = ?
      AND c.code_verifier = ?
      AND datetime(c.expires_at) > datetime(?)
      AND a.status = 'active'
      AND e.status = 'verified'
      AND e.is_primary = 1
    LIMIT 1
  `).bind(
    current.id,
    verifier.verifierKeyVersion,
    verifier.codeVerifier,
    nowAt
  ).first();
}

async function issueRecoverySession(
  env,
  database,
  challenge,
  { clientPlatform, appVersion, sessionTransport, nowAt }
) {
  const sessionId = createOpaqueId();
  const sessionToken = createOpaqueToken();
  const csrfToken = sessionTransport === "cookie" ? createOpaqueToken() : null;
  const sessionExpiresAt = new Date(
    new Date(nowAt).getTime() + SESSION_LIFETIME_SECONDS * 1000
  ).toISOString();
  const transitionId = createOpaqueId();
  const sessionHashes = await createSessionHashesForIssuance(env, {
    sessionToken,
    csrfToken
  });
  const authorizationContext = {
    source: "staff_recovery",
    challenge_id: challenge.challenge_id,
    stage: "email_verified",
    email_verified: true,
    password_set: false,
    allowed_actions: ["set_password"]
  };

  await database.batch([
    database.prepare(`
      UPDATE auth_challenges
      SET status = 'verified',
          verified_at = ?,
          transition_id = ?
      WHERE id = ?
        AND auth_account_id = ?
        AND realm = 'staff'
        AND purpose = 'staff_recovery'
        AND status = 'pending'
        AND expected_auth_version = ?
        AND datetime(expires_at) > datetime(?)
    `).bind(
      nowAt,
      transitionId,
      challenge.challenge_id,
      challenge.auth_account_id,
      Number(challenge.expected_auth_version),
      nowAt
    ),
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = ?,
          revocation_reason = 'staff_recovery_verified'
      WHERE auth_account_id = ?
        AND realm = 'staff'
        AND scope IN ('staff_recovery_email', 'staff_recovery_authorized')
        AND revoked_at IS NULL
    `).bind(nowAt, challenge.auth_account_id),
    database.prepare(`
      INSERT INTO auth_sessions (
        id, auth_account_id, realm, token_hash, token_hash_version,
        created_transition_id, issued_auth_version, scope, assurance_level,
        auth_methods_json, authorization_context_json, session_transport,
        csrf_token_hash, client_platform, app_version, authenticated_at,
        created_at, expires_at
      ) VALUES (?, ?, 'staff', ?, ?, ?, ?, 'staff_recovery_email', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      challenge.auth_account_id,
      sessionHashes.tokenHash,
      sessionHashes.tokenHashVersion,
      createOpaqueId(),
      Number(challenge.expected_auth_version),
      JSON.stringify(["email"]),
      JSON.stringify(authorizationContext),
      sessionTransport,
      sessionHashes.csrfTokenHash,
      clientPlatform,
      appVersion || null,
      nowAt,
      nowAt,
      sessionExpiresAt
    )
  ]);

  return {
    sessionId,
    sessionToken,
    csrfToken,
    sessionExpiresAt,
    body: {
      ok: true,
      recovery: {
        stage: "email_verified",
        email_verified: true,
        password_set: false
      },
      session: {
        id: sessionId,
        scope: "staff_recovery_email",
        transport: sessionTransport,
        expires_at: sessionExpiresAt,
        csrf_token: csrfToken
      }
    }
  };
}

function responseWithCookies(request, env, requestId, body, status, cookies = []) {
  const response = identityResponse(
    request,
    env,
    { ...body, request_id: requestId },
    status,
    requestId
  );
  for (const value of cookies) {
    response.headers.append("set-cookie", value);
  }
  return response;
}

function errorResponse(request, env, error, requestId) {
  if (error instanceof IdentityProtocolError) {
    return identityError(
      request,
      env,
      error.code,
      error.message,
      error.status,
      error.details,
      requestId
    );
  }
  return identityError(
    request,
    env,
    "temporarily_unavailable",
    "This identity capability is temporarily unavailable.",
    503,
    undefined,
    requestId
  );
}

export async function handleStaffRecoveryStart(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") {
      protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    }
    const body = await readIdentityJson(request, {
      allowedFields: ["username"],
      requiredFields: ["username"]
    });
    const username = String(body.username ?? "").trim();
    if (!USERNAME.test(username)) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }

    const database = requireDatabase(env);
    const staff = await loadRecoverableStaffByUsername(database, username);
    if (!staff) {
      return identityResponse(
        request,
        env,
        genericStartBody(context.requestId),
        202,
        context.requestId
      );
    }

    const nowAt = isoTimestamp();
    const expiresAt = new Date(
      new Date(nowAt).getTime() + CHALLENGE_LIFETIME_MS
    ).toISOString();
    const challengeId = createOpaqueId();
    const correlationId = createOpaqueId();
    const manualCode = createManualCode();
    const magicLinkToken = createMagicLinkToken();
    const [challengeToken, codeVerifier] = await Promise.all([
      createVersionedChallengeTokenHash(env, magicLinkToken, "staff_recovery"),
      createManualCodeVerifier(env, staff.auth_account_id, challengeId, manualCode)
    ]);
    const actionUrl = `${publicOrigin(env)}/auth/admin/recovery#token=${magicLinkToken}`;

    await invalidatePendingRecoveryState(database, staff.auth_account_id, nowAt);
    const outbox = await prepareEncryptedOutboxInsert(
      env,
      {
        challengeId,
        emailAddressId: staff.email_address_id,
        authAccountId: staff.auth_account_id,
        realm: "staff",
        templateKey: "auth.staff.recovery.start.v1",
        challengePurpose: "staff_recovery",
        locale: normalizedLocale(staff.locale),
        dedupeKey: `staff-recovery-start:${challengeId}`,
        maxAttempts: 5,
        availableAt: nowAt,
        expiresAt
      },
      {
        action_url: actionUrl,
        manual_code: manualCode,
        expires_at: expiresAt
      }
    );

    await database.batch([
      database.prepare(`
        INSERT INTO auth_challenges (
          id, auth_account_id, realm, email_address_id, expected_auth_version,
          purpose, status, verification_method, required_proof_policy,
          token_hash, code_verifier, verifier_key_version,
          fingerprint_key_version, locale, correlation_id, max_attempts,
          failed_attempts, expires_at, created_at
        ) VALUES (
          ?, ?, 'staff', ?, ?, 'staff_recovery', 'pending',
          'magic_link_or_email_code', 'single', ?, ?, ?, ?, ?, ?, 5, 0, ?, ?
        )
      `).bind(
        challengeId,
        staff.auth_account_id,
        staff.email_address_id,
        Number(staff.auth_version),
        challengeToken.tokenHash,
        codeVerifier.codeVerifier,
        codeVerifier.verifierKeyVersion,
        activeFingerprintVersion(env),
        normalizedLocale(staff.locale),
        correlationId,
        expiresAt,
        nowAt
      ),
      outbox.statement
    ]);

    return identityResponse(
      request,
      env,
      genericStartBody(context.requestId),
      202,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleStaffRecoveryVerify(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") {
      protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    }
    const body = await readIdentityJson(request, {
      allowedFields: [
        "token",
        "username",
        "manual_code",
        "session_transport",
        "client_platform",
        "app_version"
      ],
      requiredFields: ["session_transport", "client_platform"]
    });
    const sessionTransport = String(body.session_transport ?? "");
    const clientPlatform = String(body.client_platform ?? "");
    const appVersion = body.app_version === undefined ? null : String(body.app_version);
    validateRequestedSessionTransport(request, {
      sessionTransport,
      clientPlatform,
      nativeBearerEnabled: false,
      env
    });

    const token = body.token === undefined ? null : String(body.token).trim();
    const username = body.username === undefined ? null : String(body.username).trim();
    const manualCode = body.manual_code === undefined ? null : String(body.manual_code).trim();
    const usingToken = Boolean(token);
    const usingCode = Boolean(username || manualCode);
    if (usingToken === usingCode) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    if (usingToken && !OPAQUE_TOKEN.test(token)) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    if (usingCode && (!USERNAME.test(username) || !MANUAL_CODE.test(manualCode))) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }

    const database = requireDatabase(env);
    const nowAt = isoTimestamp();
    const challenge = usingToken
      ? await loadPendingChallengeByToken(
        database,
        await createAcceptedChallengeTokenHashes(env, token, "staff_recovery"),
        nowAt
      )
      : await loadPendingChallengeByUsernameAndCode(
        env,
        database,
        username,
        manualCode,
        nowAt
      );
    if (!challenge) {
      protocolError("unauthorized", 401, "A valid recovery challenge is required.");
    }

    const issued = await issueRecoverySession(env, database, challenge, {
      clientPlatform,
      appVersion,
      sessionTransport,
      nowAt
    });
    const cookies = sessionTransport === "cookie"
      ? serializeScopedAuthCookies("staff_recovery", {
        sessionToken: issued.sessionToken,
        csrfToken: issued.csrfToken,
        maxAgeSeconds: SESSION_LIFETIME_SECONDS
      })
      : [];
    return responseWithCookies(
      request,
      env,
      context.requestId,
      issued.body,
      200,
      cookies
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

async function loadRecoveryPasswordTarget(database, session, nowAt) {
  const challengeId = String(session?.authorization_context?.challenge_id ?? "");
  if (!/^[0-9a-f]{32}$/.test(challengeId)) {
    protocolError("unauthorized", 401, "A valid recovery session is required.");
  }
  const row = await database.prepare(`
    SELECT
      a.id AS auth_account_id,
      a.auth_version,
      a.locale,
      u.username,
      u.role,
      e.id AS email_address_id,
      c.id AS challenge_id
    FROM auth_accounts a
    JOIN admin_users u
      ON u.auth_account_id = a.id
    JOIN auth_email_addresses e
      ON e.auth_account_id = a.id
     AND e.realm = 'staff'
     AND e.status = 'verified'
     AND e.is_primary = 1
     AND e.replaced_at IS NULL
    JOIN auth_challenges c
      ON c.id = ?
     AND c.auth_account_id = a.id
     AND c.realm = 'staff'
    WHERE a.id = ?
      AND a.realm = 'staff'
      AND a.status = 'active'
      AND c.purpose = 'staff_recovery'
      AND c.status = 'verified'
      AND datetime(c.expires_at) > datetime(?)
    LIMIT 1
  `).bind(challengeId, session.auth_account_id, nowAt).first();
  if (!row) {
    protocolError("unauthorized", 401, "A valid recovery session is required.");
  }
  return row;
}

export async function handleStaffRecoveryPassword(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "PUT") {
      protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    }
    const authentication = readScopedCookieAuthentication(request, "staff_recovery");
    const session = await resolveCanonicalSession(
      env,
      authentication.sessionToken,
      "staff",
      { now: new Date() }
    );
    if (!session || session.scope !== "staff_recovery_email") {
      protocolError("unauthorized", 401, "A valid recovery session is required.");
    }
    await verifyScopedCookieCsrf(request, env, session, "staff_recovery");

    const body = await readIdentityJson(request, {
      allowedFields: ["new_password", "confirm_password"],
      requiredFields: ["new_password"]
    });
    const newPassword = String(body.new_password ?? "");
    const confirmPassword = body.confirm_password === undefined
      ? undefined
      : String(body.confirm_password ?? "");
    passwordShape(newPassword, confirmPassword);

    const database = requireDatabase(env);
    const nowAt = isoTimestamp();
    const target = await loadRecoveryPasswordTarget(database, session, nowAt);
    const passwordHash = await legacyPasswordHash(env, newPassword);
    const securityEventId = createOpaqueId();
    const passwordCredentialId = createOpaqueId();
    const passwordTransitionId = createOpaqueId();
    const challengeTransitionId = createOpaqueId();
    const outbox = await prepareEncryptedOutboxInsert(
      env,
      {
        securityEventId,
        emailAddressId: target.email_address_id,
        authAccountId: target.auth_account_id,
        realm: "staff",
        templateKey: "auth.staff.recovery.completed.v1",
        locale: normalizedLocale(target.locale),
        dedupeKey: `staff-recovery-completed:${securityEventId}`,
        maxAttempts: 5,
        availableAt: nowAt,
        expiresAt: new Date(new Date(nowAt).getTime() + CHALLENGE_LIFETIME_MS).toISOString()
      },
      {
        event_time: nowAt
      }
    );

    await database.batch([
      database.prepare(`
        UPDATE admin_users
        SET password_hash = ?
        WHERE auth_account_id = ?
          AND is_active = 1
      `).bind(passwordHash, target.auth_account_id),
      database.prepare(`
        UPDATE auth_password_credentials
        SET verifier = ?,
            algorithm = 'legacy_admin_sha256_v1',
            algorithm_version = 1,
            parameters_json = '{}',
            pepper_key_version = 0,
            needs_upgrade = 1,
            updated_at = ?
        WHERE auth_account_id = ?
          AND account_realm = 'staff'
          AND revoked_at IS NULL
      `).bind(passwordHash, nowAt, target.auth_account_id),
      database.prepare(`
        INSERT INTO auth_password_credentials (
          id, auth_account_id, account_realm, verifier, algorithm,
          algorithm_version, parameters_json, pepper_key_version,
          needs_upgrade, created_at, updated_at, created_transition_id
        )
        SELECT ?, ?, 'staff', ?, 'legacy_admin_sha256_v1', 1, '{}', 0, 1, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM auth_password_credentials
          WHERE auth_account_id = ?
            AND account_realm = 'staff'
            AND revoked_at IS NULL
        )
      `).bind(
        passwordCredentialId,
        target.auth_account_id,
        passwordHash,
        nowAt,
        nowAt,
        passwordTransitionId,
        target.auth_account_id
      ),
      database.prepare(`
        UPDATE auth_challenges
        SET status = 'consumed',
            consumed_at = ?,
            transition_id = ?
        WHERE id = ?
          AND auth_account_id = ?
          AND realm = 'staff'
          AND purpose = 'staff_recovery'
          AND status = 'verified'
      `).bind(
        nowAt,
        challengeTransitionId,
        target.challenge_id,
        target.auth_account_id
      ),
      database.prepare(`
        UPDATE auth_sessions
        SET revoked_at = ?,
            revocation_reason = 'staff_recovery_completed'
        WHERE auth_account_id = ?
          AND realm = 'staff'
          AND revoked_at IS NULL
      `).bind(nowAt, target.auth_account_id),
      database.prepare(`
        INSERT INTO auth_security_events (
          id, event_type, outcome, subject_account_id, actor_account_id,
          actor_role, correlation_id, fingerprint_key_version,
          request_ip_hash, request_user_agent_hash, request_device_hash,
          metadata_json, occurred_at
        ) VALUES (
          ?, 'staff.recovery.completed', 'success', ?, ?, ?,
          ?, ?, NULL, NULL, NULL, ?, ?
        )
      `).bind(
        securityEventId,
        target.auth_account_id,
        target.auth_account_id,
        target.role,
        context.requestId,
        activeFingerprintVersion(env),
        JSON.stringify({
          challenge_id: target.challenge_id,
          recovery_stage: "password_reset"
        }),
        nowAt
      ),
      outbox.statement
    ]);

    return responseWithCookies(
      request,
      env,
      context.requestId,
      {
        ok: true,
        password_changed: true,
        login_required: true
      },
      200,
      serializeScopedAuthCookieClears("staff_recovery")
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleStaffRecoveryLogout(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") {
      protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    }
    const authentication = readScopedCookieAuthentication(request, "staff_recovery");
    const session = await resolveCanonicalSession(
      env,
      authentication.sessionToken,
      "staff",
      { now: new Date() }
    );
    if (session) {
      await verifyScopedCookieCsrf(request, env, session, "staff_recovery");
      await requireDatabase(env).prepare(`
        UPDATE auth_sessions
        SET revoked_at = ?,
            revocation_reason = 'staff_recovery_logout'
        WHERE id = ?
          AND auth_account_id = ?
          AND realm = 'staff'
          AND revoked_at IS NULL
      `).bind(
        isoTimestamp(),
        session.id,
        session.auth_account_id
      ).run();
    }
    return responseWithCookies(
      request,
      env,
      context.requestId,
      { ok: true, logged_out: true },
      200,
      serializeScopedAuthCookieClears("staff_recovery")
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}
