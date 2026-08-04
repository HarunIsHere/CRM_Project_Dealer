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
  STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE,
  STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
  StaffEnrollmentRecoveryCodeError,
  acknowledgeStaffEnrollmentRecoveryCodeSet,
  generateStaffEnrollmentRecoveryCodeSet,
  validateEnrollmentRecoveryCodeAckReplayEnvelope,
  validateEnrollmentRecoveryCodeGenerationReplayBody
} from "./enrollment-recovery-code-sets.js";

const ID_32 = /^[0-9a-f]{32}$/;

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

function assertPost(request) {
  if (request.method !== "POST") {
    protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
  }
}

function requireSetId(value) {
  const setId = String(value ?? "");
  if (!ID_32.test(setId)) {
    protocolError(
      "invalid_or_expired_recovery_code_set",
      400,
      "The recovery-code set is invalid or expired."
    );
  }
  return setId;
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
  if (error instanceof StaffEnrollmentRecoveryCodeError) {
    return identityError(
      request,
      env,
      error.code,
      error.message,
      error.status,
      undefined,
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

function withEnrollmentCookies(request, env, envelope, status = 200) {
  const replay = validateEnrollmentRecoveryCodeAckReplayEnvelope(envelope);
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
    && left.every((value, index) => value === right[index]);
}

async function resolveRetiredAcknowledgementReplaySession(
  env,
  rawSessionToken,
  setId,
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
  const hashPredicates = acceptedHashes.map(() => (
    "(source.token_hash_version = ? AND source.token_hash = ?)"
  )).join(" OR ");
  const hashBindings = acceptedHashes.flatMap((entry) => [
    entry.tokenHashVersion,
    entry.tokenHash
  ]);
  const publicBody = envelope.public_body;
  const row = await env.DB.prepare(`
    SELECT
      source.*,
      account.auth_version AS current_auth_version,
      account.enrollment_deadline_at AS current_enrollment_deadline_at,
      target.acknowledged_at AS target_acknowledged_at,
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
      next.expires_at AS next_expires_at
    FROM auth_sessions source
    JOIN auth_recovery_code_sets target
      ON target.generating_session_id = source.id
     AND target.auth_account_id = source.auth_account_id
     AND target.account_realm = source.realm
    JOIN auth_sessions next
      ON next.id = source.rotated_to_session_id
     AND next.auth_account_id = source.auth_account_id
     AND next.realm = source.realm
     AND next.rotated_from_session_id = source.id
    JOIN auth_accounts account
      ON account.id = source.auth_account_id
     AND account.realm = source.realm
    JOIN admin_users profile
      ON profile.auth_account_id = account.id
    WHERE (${hashPredicates})
      AND source.realm = 'staff'
      AND source.scope = 'staff_enrollment'
      AND source.session_transport = 'cookie'
      AND source.client_platform = 'admin_web'
      AND source.csrf_token_hash IS NOT NULL
      AND source.revoked_at IS NOT NULL
      AND source.revocation_reason = 'enrollment_recovery_codes_activated'
      AND source.rotated_to_session_id = ?
      AND target.id = ?
      AND target.status = 'active'
      AND target.acknowledged_at IS NOT NULL
      AND target.activated_at IS NOT NULL
      AND target.expected_auth_version = source.issued_auth_version
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
      AND json_extract(next.authorization_context_json, '$.stage') = 'email_verified'
      AND json_extract(
        next.authorization_context_json,
        '$.recovery_codes_acknowledged'
      ) = 1
    LIMIT 1
  `).bind(
    ...hashBindings,
    publicBody.session.id,
    setId,
    publicBody.session.id,
    nowDate.toISOString(),
    nowDate.toISOString()
  ).first();
  if (!row) {
    throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
  }

  const matchedSourceHash = acceptedHashes.find((entry) => (
    entry.tokenHashVersion === Number(row.token_hash_version)
  ));
  const [sourceMatches, nextTokenHash, nextCsrfHash] = await Promise.all([
    matchedSourceHash
      ? constantTimeEqual(matchedSourceHash.tokenHash, row.token_hash)
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
  const storedMethods = parseStringArray(row.next_auth_methods_json);
  const expectedCookieAge = Math.floor(
    (Date.parse(row.next_expires_at) - Date.parse(row.target_acknowledged_at))
      / 1000
  );
  if (
    !sourceMatches
    || !nextTokenMatches
    || !nextCsrfMatches
    || Number(row.next_issued_auth_version) !== Number(row.current_auth_version)
    || row.next_session_id !== publicBody.session.id
    || row.next_scope !== publicBody.session.scope
    || row.next_session_transport !== publicBody.session.transport
    || row.next_client_platform !== "admin_web"
    || row.next_expires_at !== publicBody.session.expires_at
    || row.target_acknowledged_at
      !== publicBody.recovery_code_set.acknowledged_at
    || row.current_enrollment_deadline_at !== publicBody.enrollment.deadline_at
    || Number(row.next_assurance_level)
      !== Number(publicBody.session.assurance.level)
    || !storedMethods
    || !sameStringArray(storedMethods, publicBody.session.assurance.methods)
    || row.next_authenticated_at
      !== publicBody.session.assurance.authenticated_at
    || (row.next_strong_authenticated_at ?? null)
      !== (publicBody.session.assurance.strong_authenticated_at ?? null)
    || expectedCookieAge !== envelope.cookie_max_age_seconds
  ) {
    throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
  }
  return row;
}

export async function handleStaffEnrollmentRecoveryCodeSetGeneration(
  request,
  env,
  { now = new Date() } = {}
) {
  const context = createIdentityRequestContext(request);
  let reservation = null;
  try {
    assertPost(request);
    assertBootstrapEnabled(env);
    assertAllowedBrowserMutationOrigin(request, env);
    const body = await readIdentityJson(request, {
      allowedFields: [],
      requiredFields: []
    });
    const authentication = readScopedCookieAuthentication(
      request,
      "staff_enrollment"
    );
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
    const hashConfig = idempotencyHashConfig(env);
    const idempotencyContext = await createIdempotencyContext(request, {
      realm: "staff",
      routeTemplate: STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
      body,
      subjectScope:
        `staff-enrollment:${session.id}:recovery-code-generation`,
      hashKeyVersion: hashConfig.version,
      hashKeyMaterial: hashConfig.key
    });
    const idempotency = handleIdempotencyOutcome(
      await reserveIdempotencyKey(env, idempotencyContext, {
        secretBearing: true,
        now
      })
    );
    if (idempotency.outcome === "replay") {
      const replay = validateEnrollmentRecoveryCodeGenerationReplayBody(
        idempotency.response.body
      );
      if (idempotency.response.status !== 201) {
        throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
      }
      return identityResponse(
        request,
        env,
        replay,
        idempotency.response.status,
        replay.request_id
      );
    }
    reservation = idempotency.reservation;
    const generated = await generateStaffEnrollmentRecoveryCodeSet(env, {
      session,
      reservation,
      requestId: context.requestId,
      now
    });
    reservation = null;
    return identityResponse(
      request,
      env,
      generated.body,
      201,
      context.requestId
    );
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

export async function handleStaffEnrollmentRecoveryCodeSetAcknowledgement(
  request,
  env,
  { setId: rawSetId, now = new Date() } = {}
) {
  const context = createIdentityRequestContext(request);
  let reservation = null;
  try {
    assertPost(request);
    assertBootstrapEnabled(env);
    assertAllowedBrowserMutationOrigin(request, env);
    const setId = requireSetId(rawSetId);
    const body = await readIdentityJson(request, {
      allowedFields: [],
      requiredFields: []
    });
    const authentication = readScopedCookieAuthentication(
      request,
      "staff_enrollment"
    );
    const hashConfig = idempotencyHashConfig(env);
    // The concrete path parameter is included in both the subject scope and
    // canonical request payload so a key can never cross recovery-code sets.
    const idempotencyContext = await createIdempotencyContext(request, {
      realm: "staff",
      routeTemplate: STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE,
      body: { ...body, set_id: setId },
      subjectScope:
        `staff-enrollment-token:${authentication.sessionToken}:recovery-code-set:${setId}`,
      hashKeyVersion: hashConfig.version,
      hashKeyMaterial: hashConfig.key
    });
    const idempotency = await reserveIdempotencyKey(env, idempotencyContext, {
      secretBearing: true,
      now
    });

    // A successful acknowledgement revokes the source session. Therefore the
    // completed encrypted response must be discovered before the ordinary
    // canonical-session resolver is allowed to reject that retired cookie.
    if (idempotency.outcome === "replay") {
      const envelope = validateEnrollmentRecoveryCodeAckReplayEnvelope(
        idempotency.response.body
      );
      if (
        idempotency.response.status !== 200
        || envelope.public_body.recovery_code_set.id !== setId
      ) {
        throw new IdempotencyError("E_IDEMPOTENCY_REPLAY_INVALID");
      }
      const sourceSession = await resolveRetiredAcknowledgementReplaySession(
        env,
        authentication.sessionToken,
        setId,
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
    handleIdempotencyOutcome(idempotency);
    reservation = idempotency.reservation;
    const acknowledged = await acknowledgeStaffEnrollmentRecoveryCodeSet(env, {
      session,
      setId,
      reservation,
      requestId: context.requestId,
      now
    });
    reservation = null;
    return withEnrollmentCookies(request, env, acknowledged.envelope, 200);
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
