import { createAcceptedChallengeTokenHashes, isMagicLinkToken } from "../challenge-token.js";
import { getIdentityCapabilities } from "../config.js";
import { hashOpaqueToken } from "../crypto.js";
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
  readIdempotencyKey,
  readIdentityJson
} from "../protocol.js";
import { RateLimitError, consumeFixedWindowRateLimit } from "../rate-limit.js";
import {
  assertAllowedBrowserMutationOrigin,
  serializeScopedAuthCookieClears,
  serializeScopedAuthCookies,
  validateRequestedSessionTransport
} from "../transport.js";
import {
  StaffInvitationError,
  acceptProtectedBootstrapInvitation,
  previewProtectedBootstrapInvitation,
  validateInvitationReplayEnvelope
} from "./invitation-acceptance.js";

export const BOOTSTRAP_INVITATION_ACCEPT_ROUTE =
  "/api/v1/admin/auth/invitations/accept";
export const BOOTSTRAP_INVITATION_PREVIEW_ROUTE =
  "/api/v1/admin/auth/invitations/preview";

const APP_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/;
const BOOTSTRAP_FINGERPRINT_KEY_VERSION = 1;

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

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length
    && keys.every((key, index) => key === wanted[index]);
}

function validateClient(value) {
  if (
    !plainObject(value)
    || !exactKeys(value, ["platform", "app_version"])
    || value.platform !== "admin_web"
    || !APP_VERSION.test(String(value.app_version ?? ""))
  ) {
    protocolError("invalid_request", 400, "The request shape is invalid.");
  }
  return { platform: value.platform, appVersion: value.app_version };
}

function validateToken(value) {
  if (!isMagicLinkToken(value)) {
    throw new StaffInvitationError("invalid_or_expired_invitation", 400);
  }
  return String(value);
}

function positiveVersion(value) {
  const source = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(source)) {
    throw new IdempotencyError("E_IDEMPOTENCY_HASH_KEY_INVALID");
  }
  return Number(source);
}

function idempotencyHashConfig(env) {
  const version = positiveVersion(env?.CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION);
  const key = String(env?.[`CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    throw new IdempotencyError("E_IDEMPOTENCY_HASH_KEY_INVALID");
  }
  return { version, key };
}

function normalizedIpSubject(request) {
  const value = String(request.headers.get("cf-connecting-ip") ?? "missing").trim();
  return value.length >= 3
    && value.length <= 64
    && !/[\u0000-\u001f\u007f\s]/.test(value)
    ? value
    : "invalid";
}

function bootstrapFingerprintConfig(env) {
  const configuredVersion = String(
    env?.CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION
      ?? BOOTSTRAP_FINGERPRINT_KEY_VERSION
  ).trim();
  const fingerprintKey = String(
    env?.[`CRM_AUTH_FINGERPRINT_KEY_V${BOOTSTRAP_FINGERPRINT_KEY_VERSION}`]
      ?? ""
  );
  // Bootstrap contract v1 has no retained-key overlap evaluator. Fail closed
  // instead of silently resetting its abuse buckets during a key rotation.
  if (
    configuredVersion !== String(BOOTSTRAP_FINGERPRINT_KEY_VERSION)
    || fingerprintKey.length < 32
    || fingerprintKey.length > 1024
  ) {
    protocolError(
      "temporarily_unavailable",
      503,
      "Identity request protection is not configured."
    );
  }
  return {
    keyVersion: BOOTSTRAP_FINGERPRINT_KEY_VERSION,
    key: fingerprintKey
  };
}

async function consumePublicInvitationLimits(request, env, tokenHashes, now) {
  const fingerprint = bootstrapFingerprintConfig(env);
  const [ipHash, tokenSubjectHash] = await Promise.all([
    hashOpaqueToken(
      `rate-limit:staff-invitation:ip:${normalizedIpSubject(request)}`,
      fingerprint.key
    ),
    hashOpaqueToken(
      `rate-limit:staff-invitation:token:${tokenHashes.join("|")}`,
      fingerprint.key
    )
  ]);
  const ipLimit = await consumeFixedWindowRateLimit(env, {
    dimension: "ip",
    subjectKeyVersion: fingerprint.keyVersion,
    subjectHash: ipHash,
    windowSeconds: 60,
    maxRequests: 30,
    retentionSeconds: 3600,
    now
  });
  if (!ipLimit.allowed) {
    protocolError("rate_limited", 429, "Too many requests.");
  }
  const tokenLimit = await consumeFixedWindowRateLimit(env, {
    dimension: "identifier",
    subjectKeyVersion: fingerprint.keyVersion,
    subjectHash: tokenSubjectHash,
    windowSeconds: 60,
    maxRequests: 6,
    retentionSeconds: 3600,
    now
  });
  if (!tokenLimit.allowed) {
    throw new StaffInvitationError("invalid_or_expired_invitation", 400);
  }
}

function withEnrollmentCookies(request, env, envelope, status = 200) {
  const replay = validateInvitationReplayEnvelope(envelope);
  const cookies = [
    ...serializeScopedAuthCookieClears("staff_enrollment"),
    ...serializeScopedAuthCookieClears("staff_recovery"),
    ...serializeScopedAuthCookies("staff_enrollment", {
      sessionToken: replay.cookie_session_token,
      csrfToken: replay.cookie_csrf_token,
      maxAgeSeconds: replay.cookie_max_age_seconds
    })
  ];
  const response = identityResponse(
    request,
    env,
    replay.public_body,
    status,
    replay.public_body.request_id
  );
  const headers = new Headers(response.headers);
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, headers });
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
  if (error instanceof StaffInvitationError) {
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
  if (error instanceof IdempotencyError || error instanceof RateLimitError) {
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

export async function handleProtectedBootstrapInvitationPreview(
  request,
  env,
  { now = new Date() } = {}
) {
  const context = createIdentityRequestContext(request);
  try {
    assertPost(request);
    assertBootstrapEnabled(env);
    assertAllowedBrowserMutationOrigin(request, env);
    const body = await readIdentityJson(request, {
      allowedFields: ["token"],
      requiredFields: ["token"]
    });
    const token = validateToken(body.token);
    const tokenHashes = await createAcceptedChallengeTokenHashes(
      env,
      token,
      "staff-invitation"
    );
    await consumePublicInvitationLimits(request, env, tokenHashes, now);
    const invitation = await previewProtectedBootstrapInvitation(env, {
      tokenHashes,
      now
    });
    return identityResponse(
      request,
      env,
      { ok: true, request_id: context.requestId, invitation },
      200,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleProtectedBootstrapInvitationAccept(
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
    readIdempotencyKey(request);
    const body = await readIdentityJson(request, {
      allowedFields: ["token", "session_transport", "client"],
      requiredFields: ["token", "session_transport", "client"]
    });
    const token = validateToken(body.token);
    const client = validateClient(body.client);
    const transport = validateRequestedSessionTransport(request, {
      sessionTransport: body.session_transport,
      clientPlatform: client.platform,
      nativeBearerEnabled: false,
      env
    });
    const tokenHashes = await createAcceptedChallengeTokenHashes(
      env,
      token,
      "staff-invitation"
    );
    const hashConfig = idempotencyHashConfig(env);
    const idempotencyContext = await createIdempotencyContext(request, {
      realm: "staff",
      routeTemplate: BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
      body,
      subjectScope: `staff-invitation:${tokenHashes.join("|")}`,
      hashKeyVersion: hashConfig.version,
      hashKeyMaterial: hashConfig.key
    });
    const idempotency = await reserveIdempotencyKey(env, idempotencyContext, {
      secretBearing: true,
      now
    });
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
    if (idempotency.outcome === "replay") {
      return withEnrollmentCookies(
        request,
        env,
        idempotency.response.body,
        idempotency.response.status
      );
    }
    reservation = idempotency.reservation;

    await consumePublicInvitationLimits(request, env, tokenHashes, now);
    const accepted = await acceptProtectedBootstrapInvitation(env, {
      tokenHashes,
      reservation,
      requestId: context.requestId,
      clientPlatform: transport.clientPlatform,
      appVersion: client.appVersion,
      now
    });
    reservation = null;
    return withEnrollmentCookies(request, env, accepted.envelope, 200);
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
