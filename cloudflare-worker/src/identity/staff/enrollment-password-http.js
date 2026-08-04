import { getIdentityCapabilities } from "../config.js";
import { constantTimeEqual } from "../crypto.js";
import {
  IdempotencyError,
  createIdempotencyContext,
  releaseIdempotencyReservation,
  reserveIdempotencyKey
} from "../idempotency.js";
import { identityError, identityResponse } from "../http.js";
import {
  IdentityProtocolError,
  createIdentityRequestContext,
  readIdentityJson
} from "../protocol.js";
import { resolveCanonicalSession } from "../repository.js";
import {
  createAcceptedSessionTokenHashes,
  hashSessionSecretForVersion
} from "../session-keyring.js";
import {
  assertAllowedBrowserMutationOrigin,
  readScopedCookieAuthentication,
  serializeScopedAuthCookieClears,
  serializeScopedAuthCookies,
  verifyScopedCookieCsrf
} from "../transport.js";
import {
  STAFF_ENROLLMENT_PASSWORD_ROUTE,
  StaffEnrollmentPasswordError,
  StaffPasswordPolicyError,
  StaffPasswordProfileError,
  setProtectedBootstrapEnrollmentPassword,
  validateEnrollmentPasswordReplayEnvelope
} from "./enrollment-password.js";
import { createPwnedPasswordsChecker } from "./pwned-passwords.js";

function protocolError(code, status, message) {
  throw new IdentityProtocolError(code, status, message);
}

function assertBootstrapEnabled(env) {
  if (getIdentityCapabilities(env).staff_bootstrap_enrollment !== true) {
    protocolError(
      "feature_disabled",
      503,
      "This identity capability is not enabled."
    );
  }
}

function assertPut(request) {
  if (request.method !== "PUT") {
    protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
  }
}

function positiveVersion(value) {
  const source = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(source)) {
    throw new IdempotencyError("E_IDEMPOTENCY_HASH_KEY_INVALID");
  }
  return Number(source);
}

function idempotencyHashConfig(env) {
  const version = positiveVersion(
    env?.CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION
  );
  const key = String(env?.[`CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    throw new IdempotencyError("E_IDEMPOTENCY_HASH_KEY_INVALID");
  }
  return { version, key };
}

function requireEnrollmentSession(session) {
  if (
    !session
    || session.realm !== "staff"
    || session.scope !== "staff_enrollment"
    || session.session_transport !== "cookie"
    || session.client_platform !== "admin_web"
  ) {
    protocolError(
      "unauthorized",
      401,
      "A valid enrollment session is required."
    );
  }
  return session;
}

function handleIdempotencyOutcome(idempotency) {
  if (idempotency.outcome === "reused") {
    protocolError(
      "idempotency_key_reused",
      409,
      "The Idempotency-Key was already used for a different request."
    );
  }
  if (idempotency.outcome === "in_progress") {
    protocolError(
      "request_in_progress",
      409,
      "The request is already in progress."
    );
  }
  return idempotency;
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

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

async function resolveRetiredPasswordReplaySession(
  env,
  rawSessionToken,
  envelope,
  now
) {
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    throw new IdempotencyError("E_IDEMPOTENCY_DATABASE_UNAVAILABLE");
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) {
    throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
  }
  const acceptedHashes = await createAcceptedSessionTokenHashes(
    env,
    rawSessionToken
  );
  const predicates = acceptedHashes.map(() => (
    "(source.token_hash_version = ? AND source.token_hash = ?)"
  )).join(" OR ");
  const bindings = acceptedHashes.flatMap((entry) => [
    entry.tokenHashVersion,
    entry.tokenHash
  ]);
  const body = envelope.public_body;
  const row = await env.DB.prepare(`
    SELECT
      source.*,
      account.auth_version AS current_auth_version,
      account.enrollment_deadline_at AS current_enrollment_deadline_at,
      account.legacy_sessions_revoked_before,
      account.legacy_login_disabled_at,
      profile.password_hash AS legacy_password_hash,
      credential.id AS credential_id,
      credential.algorithm AS credential_algorithm,
      credential.algorithm_version AS credential_algorithm_version,
      credential.needs_upgrade AS credential_needs_upgrade,
      next.id AS next_session_id,
      next.token_hash AS next_token_hash,
      next.token_hash_version AS next_token_hash_version,
      next.csrf_token_hash AS next_csrf_token_hash,
      next.issued_auth_version AS next_issued_auth_version,
      next.scope AS next_scope,
      next.session_transport AS next_session_transport,
      next.client_platform AS next_client_platform,
      next.assurance_level AS next_assurance_level,
      next.auth_methods_json AS next_auth_methods_json,
      next.authenticated_at AS next_authenticated_at,
      next.strong_authenticated_at AS next_strong_authenticated_at,
      next.expires_at AS next_expires_at,
      json_extract(next.authorization_context_json, '$.stage') AS next_stage,
      json_extract(next.authorization_context_json, '$.email_verified')
        AS next_email_verified,
      json_extract(next.authorization_context_json, '$.password_set')
        AS next_password_set,
      json_extract(next.authorization_context_json, '$.passkey_registered')
        AS next_passkey_registered,
      json_extract(
        next.authorization_context_json,
        '$.recovery_codes_acknowledged'
      ) AS next_recovery_codes_acknowledged,
      (
        SELECT COUNT(*) FROM auth_passkey_credentials p
        WHERE p.auth_account_id = account.id
          AND p.realm = 'staff'
          AND p.revoked_at IS NULL
      ) AS active_passkey_count,
      (
        SELECT COUNT(*) FROM auth_recovery_code_sets r
        WHERE r.auth_account_id = account.id
          AND r.account_realm = 'staff'
          AND r.status = 'active'
          AND r.acknowledged_at IS NOT NULL
          AND r.activated_at IS NOT NULL
      ) AS acknowledged_recovery_code_set_count,
      (
        SELECT COUNT(*) FROM auth_sessions active
        WHERE active.auth_account_id = account.id
          AND active.realm = 'staff'
          AND active.revoked_at IS NULL
      ) AS active_session_count,
      (
        SELECT COUNT(*) FROM auth_challenges challenge
        WHERE challenge.auth_account_id = account.id
          AND challenge.realm = 'staff'
          AND challenge.status IN ('pending', 'verified')
      ) AS active_challenge_count
    FROM auth_sessions source
    JOIN auth_accounts account
      ON account.id = source.auth_account_id AND account.realm = source.realm
    JOIN admin_users profile
      ON profile.auth_account_id = account.id
    JOIN auth_password_credentials credential
      ON credential.auth_account_id = account.id
     AND credential.account_realm = 'staff'
     AND credential.revoked_at IS NULL
    JOIN auth_sessions next
      ON next.id = source.rotated_to_session_id
     AND next.auth_account_id = source.auth_account_id
     AND next.realm = source.realm
     AND next.rotated_from_session_id = source.id
    WHERE (${predicates})
      AND source.realm = 'staff'
      AND source.scope = 'staff_enrollment'
      AND source.session_transport = 'cookie'
      AND source.client_platform = 'admin_web'
      AND source.csrf_token_hash IS NOT NULL
      AND source.revoked_at IS NOT NULL
      AND source.revocation_reason = 'enrollment_password_set'
      AND source.rotated_to_session_id = ?
      AND next.id = ?
      AND next.scope = 'staff_enrollment'
      AND next.session_transport = 'cookie'
      AND next.client_platform = 'admin_web'
      AND next.csrf_token_hash IS NOT NULL
      AND next.revoked_at IS NULL
      AND datetime(next.expires_at) > datetime(?)
      AND next.issued_auth_version = account.auth_version
      AND account.status IN ('pending', 'active')
      AND account.enrollment_state = 'in_progress'
      AND datetime(account.enrollment_deadline_at) > datetime(?)
      AND account.disabled_reason IS NULL
      AND account.disabled_at IS NULL
      AND account.deleted_at IS NULL
      AND profile.is_active = 1
      AND profile.is_protected = 1
      AND profile.password_hash = '!canonical-auth-disabled!'
      AND credential.algorithm = 'argon2id_phc_v1'
      AND credential.algorithm_version = 1
      AND credential.needs_upgrade = 0
    LIMIT 1
  `).bind(
    ...bindings,
    body.session.id,
    body.session.id,
    nowDate.toISOString(),
    nowDate.toISOString()
  ).first();
  if (!row) throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");

  const matchedSource = acceptedHashes.find((entry) => (
    entry.tokenHashVersion === Number(row.token_hash_version)
  ));
  const [sourceMatches, nextTokenHash, nextCsrfHash] = await Promise.all([
    matchedSource
      ? constantTimeEqual(matchedSource.tokenHash, row.token_hash)
      : Promise.resolve(false),
    hashSessionSecretForVersion(
      env,
      envelope.cookie_session_token,
      row.next_token_hash_version
    ),
    hashSessionSecretForVersion(
      env,
      envelope.cookie_csrf_token,
      row.next_token_hash_version
    )
  ]);
  const [nextTokenMatches, nextCsrfMatches] = await Promise.all([
    constantTimeEqual(nextTokenHash, row.next_token_hash),
    constantTimeEqual(nextCsrfHash, row.next_csrf_token_hash)
  ]);
  const methods = parseStringArray(row.next_auth_methods_json);
  const expectedCookieAge = Math.floor(
    (Date.parse(row.next_expires_at) - Date.parse(row.revoked_at)) / 1000
  );
  const passkeyRegistered = Number(row.active_passkey_count) > 0;
  const recoveryCodesAcknowledged = (
    Number(row.acknowledged_recovery_code_set_count) > 0
  );
  if (
    !sourceMatches
    || !nextTokenMatches
    || !nextCsrfMatches
    || Number(row.next_issued_auth_version) !== Number(row.current_auth_version)
    || row.next_session_id !== body.session.id
    || row.next_scope !== body.session.scope
    || row.next_session_transport !== body.session.transport
    || row.next_client_platform !== "admin_web"
    || row.next_expires_at !== body.session.expires_at
    || row.current_enrollment_deadline_at !== body.enrollment.deadline_at
    || row.legacy_sessions_revoked_before !== row.revoked_at
    || row.next_stage !== body.enrollment.stage
    || Number(row.next_email_verified) !== 1
    || Number(row.next_password_set) !== 1
    || Boolean(Number(row.next_passkey_registered)) !== passkeyRegistered
    || Boolean(Number(row.next_recovery_codes_acknowledged))
      !== recoveryCodesAcknowledged
    || body.enrollment.passkey_registered !== passkeyRegistered
    || body.enrollment.recovery_codes_acknowledged
      !== recoveryCodesAcknowledged
    || Number(row.next_assurance_level) !== Number(body.session.assurance.level)
    || !methods
    || !sameStringArray(methods, body.session.assurance.methods)
    || row.next_authenticated_at !== body.session.assurance.authenticated_at
    || (row.next_strong_authenticated_at ?? null)
      !== (body.session.assurance.strong_authenticated_at ?? null)
    || Number(row.active_session_count) !== 1
    || Number(row.active_challenge_count) !== 0
    || expectedCookieAge !== envelope.cookie_max_age_seconds
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
  }
  return row;
}

function withEnrollmentCookies(request, env, envelope, status = 200) {
  const replay = validateEnrollmentPasswordReplayEnvelope(envelope);
  const response = identityResponse(
    request,
    env,
    replay.public_body,
    status,
    replay.public_body.request_id
  );
  const headers = new Headers(response.headers);
  for (const cookie of [
    ...serializeScopedAuthCookieClears("staff_enrollment"),
    ...serializeScopedAuthCookies("staff_enrollment", {
      sessionToken: replay.cookie_session_token,
      csrfToken: replay.cookie_csrf_token,
      maxAgeSeconds: replay.cookie_max_age_seconds
    })
  ]) {
    headers.append("set-cookie", cookie);
  }
  return new Response(response.body, { status: response.status, headers });
}

function errorResponse(request, env, error, requestId) {
  if (
    error instanceof IdentityProtocolError
    || error instanceof StaffEnrollmentPasswordError
    || error instanceof StaffPasswordPolicyError
    || error instanceof StaffPasswordProfileError
  ) {
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
    "The identity service is temporarily unavailable.",
    503,
    undefined,
    requestId
  );
}

async function releaseReservation(env, reservation) {
  if (!reservation) return;
  await releaseIdempotencyReservation(env, reservation);
}

export async function handleProtectedBootstrapEnrollmentPassword(
  request,
  env,
  {
    now = new Date(),
    deriveArgon2id,
    isKnownCompromisedOrCommon
  } = {}
) {
  const context = createIdentityRequestContext(request);
  let reservation = null;
  try {
    assertPut(request);
    assertBootstrapEnabled(env);
    assertAllowedBrowserMutationOrigin(request, env);
    const body = await readIdentityJson(request, {
      allowedFields: ["new_password"],
      requiredFields: ["new_password"]
    });
    const authentication = readScopedCookieAuthentication(
      request,
      "staff_enrollment"
    );
    const hashConfig = idempotencyHashConfig(env);
    const idempotencyContext = await createIdempotencyContext(request, {
      realm: "staff",
      routeTemplate: STAFF_ENROLLMENT_PASSWORD_ROUTE,
      body,
      subjectScope: `staff-enrollment-token:${authentication.sessionToken}:password`,
      hashKeyVersion: hashConfig.version,
      hashKeyMaterial: hashConfig.key
    });
    const idempotency = await reserveIdempotencyKey(env, idempotencyContext, {
      secretBearing: true,
      now
    });
    if (idempotency.outcome === "reserved") {
      reservation = idempotency.reservation;
    }

    // Success retires the source cookie. Resolve the encrypted completed
    // response and prove its source/target rotation before ordinary session
    // resolution is allowed to reject that retired cookie.
    if (idempotency.outcome === "replay") {
      const envelope = validateEnrollmentPasswordReplayEnvelope(
        idempotency.response.body
      );
      if (idempotency.response.status !== 200) {
        throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
      }
      const sourceSession = await resolveRetiredPasswordReplaySession(
        env,
        authentication.sessionToken,
        envelope,
        now
      );
      await verifyScopedCookieCsrf(
        request,
        env,
        sourceSession,
        "staff_enrollment"
      );
      return withEnrollmentCookies(
        request,
        env,
        envelope,
        idempotency.response.status
      );
    }

    handleIdempotencyOutcome(idempotency);

    const session = requireEnrollmentSession(await resolveCanonicalSession(
      env,
      authentication.sessionToken,
      "staff",
      { now }
    ));
    await verifyScopedCookieCsrf(
      request,
      env,
      session,
      "staff_enrollment"
    );
    const checker = typeof isKnownCompromisedOrCommon === "function"
      ? isKnownCompromisedOrCommon
      : createPwnedPasswordsChecker();
    const changed = await setProtectedBootstrapEnrollmentPassword(env, {
      session,
      reservation,
      requestId: context.requestId,
      newPassword: body.new_password,
      deriveArgon2id,
      isKnownCompromisedOrCommon: checker,
      now
    });
    reservation = null;
    return withEnrollmentCookies(request, env, changed.envelope, 200);
  } catch (error) {
    try {
      await releaseReservation(env, reservation);
    } catch {
      return errorResponse(
        request,
        env,
        new IdempotencyError("E_IDEMPOTENCY_PERSISTENCE_FAILED"),
        context.requestId
      );
    }
    return errorResponse(request, env, error, context.requestId);
  }
}

export { resolveRetiredPasswordReplaySession };
