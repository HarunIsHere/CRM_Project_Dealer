import { getIdentityCapabilities } from "../config.js";
import { createOpaqueId, hashOpaqueToken } from "../crypto.js";
import {
  IdempotencyError,
  completeIdempotencyKey,
  createIdempotencyContext,
  releaseIdempotencyReservation,
  reserveIdempotencyKey
} from "../idempotency.js";
import {
  identityError,
  identityResponse,
  isIdentityOriginAllowed
} from "../http.js";
import {
  IdentityProtocolError,
  createIdentityRequestContext,
  readIdempotencyKey,
  readIdentityJson
} from "../protocol.js";
import { upsertCanonicalTelegramCustomer } from "../repository.js";
import {
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
  verifyTelegramMiniAppInitData
} from "./telegram-init-data.js";
import { createSessionHashesForIssuance } from "../session-keyring.js";

export const CUSTOMER_TELEGRAM_AUTH_ROUTE =
  "/api/v1/customer/auth/telegram";

const APP_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/;
const FINGERPRINT_VERSION = 1;
const SESSION_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

function protocolError(code, status, message) {
  throw new IdentityProtocolError(code, status, message);
}

function exactClient(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== "app_version,platform"
    || value.platform !== "telegram_mini_app"
    || !APP_VERSION.test(String(value.app_version ?? ""))
  ) {
    protocolError("invalid_request", 400, "The request shape is invalid.");
  }
  return { platform: value.platform, appVersion: value.app_version };
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

function fingerprintConfig(env) {
  const version = positiveVersion(
    env?.CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION ?? FINGERPRINT_VERSION
  );
  const key = String(env?.[`CRM_AUTH_FINGERPRINT_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    protocolError("temporarily_unavailable", 503, "Telegram authentication is unavailable.");
  }
  return { version, key };
}

function rawSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function mapCustomer(customer) {
  const language = customer.preferred_language || customer.language || "en";
  return {
    id: Number(customer.id),
    full_name: customer.full_name || "",
    username: customer.username || "",
    language,
    preferred_language: language,
    conversation_state: customer.conversation_state || null,
    created_at: customer.created_at || "",
    last_seen_at: customer.last_seen_at || ""
  };
}

async function issueCustomerSession(env, customer, client) {
  const account = await env.DB.prepare(`
    SELECT id, auth_version
    FROM auth_accounts
    WHERE id = ?
      AND realm = 'customer'
      AND status = 'active'
    LIMIT 1
  `).bind(customer.auth_account_id).first();
  if (!account) {
    protocolError("identity_conflict", 409, "The customer identity cannot be used.");
  }

  const token = rawSessionToken();
  const sessionId = createOpaqueId();
  const transitionId = createOpaqueId();
  const sessionHashes = await createSessionHashesForIssuance(env, {
    sessionToken: token
  });
  const nowAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + SESSION_LIFETIME_SECONDS * 1000
  ).toISOString();

  await env.DB.prepare(`
    INSERT INTO auth_sessions (
      id,
      auth_account_id,
      realm,
      token_hash,
      token_hash_version,
      created_transition_id,
      issued_auth_version,
      scope,
      assurance_level,
      auth_methods_json,
      authorization_context_json,
      session_transport,
      csrf_token_hash,
      client_platform,
      app_version,
      authenticated_at,
      created_at,
      expires_at,
      last_seen_at
    ) VALUES (
      ?, ?, 'customer', ?, ?, ?, ?, 'customer_verified', 1,
      '["telegram"]', '{}', 'bearer', NULL, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    sessionId,
    account.id,
    sessionHashes.tokenHash,
    sessionHashes.tokenHashVersion,
    transitionId,
    account.auth_version,
    client.platform,
    client.appVersion,
    nowAt,
    nowAt,
    expiresAt,
    nowAt
  ).run();

  return {
    id: sessionId,
    access_token: token,
    token_type: "Bearer",
    scope: "customer_verified",
    expires_at: expiresAt
  };
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
  if (error?.code === "invalid_telegram_authorization") {
    return identityError(
      request,
      env,
      "invalid_telegram_authorization",
      "Telegram authorization is invalid or expired.",
      401,
      undefined,
      requestId
    );
  }
  if (String(error?.code || "").startsWith("telegram_identity_")) {
    return identityError(
      request,
      env,
      "identity_conflict",
      "The Telegram identity cannot be linked automatically.",
      409,
      undefined,
      requestId
    );
  }
  return identityError(
    request,
    env,
    "temporarily_unavailable",
    "Telegram authentication is temporarily unavailable.",
    503,
    undefined,
    requestId
  );
}

function uniquenessConflict(error) {
  return /unique constraint|constraint failed|sqlite_constraint/i.test(
    String(error?.message || error || "")
  );
}

export async function handleCustomerTelegramAuthentication(request, env) {
  const context = createIdentityRequestContext(request);
  let reservation = null;
  let replayGuardId = null;

  try {
    if (request.method !== "POST") {
      protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    }
    if (getIdentityCapabilities(env).telegram_init_data_verification !== true) {
      protocolError("feature_disabled", 503, "This identity capability is not enabled.");
    }
    if (!isIdentityOriginAllowed(request, env)) {
      protocolError("origin_not_allowed", 403, "The request origin is not allowed.");
    }
    readIdempotencyKey(request);
    const body = await readIdentityJson(request, {
      allowedFields: ["init_data", "session_transport", "client"],
      requiredFields: ["init_data", "session_transport", "client"]
    });
    if (body.session_transport !== "bearer") {
      protocolError("invalid_request", 400, "The requested session transport is invalid.");
    }
    const client = exactClient(body.client);
    const verified = await verifyTelegramMiniAppInitData(
      body.init_data,
      env.TELEGRAM_BOT_TOKEN
    );

    const hashConfig = idempotencyHashConfig(env);
    const idempotencyContext = await createIdempotencyContext(request, {
      realm: "customer",
      routeTemplate: CUSTOMER_TELEGRAM_AUTH_ROUTE,
      body,
      subjectScope: `telegram:${verified.user.id}`,
      hashKeyVersion: hashConfig.version,
      hashKeyMaterial: hashConfig.key
    });
    const idempotency = await reserveIdempotencyKey(env, idempotencyContext, {
      secretBearing: true
    });
    if (idempotency.outcome === "reused") {
      protocolError("idempotency_key_reused", 409, "The Idempotency-Key was reused.");
    }
    if (idempotency.outcome === "in_progress") {
      protocolError("request_in_progress", 409, "The request is already in progress.");
    }
    if (idempotency.outcome === "replay") {
      return identityResponse(
        request,
        env,
        idempotency.response.body,
        idempotency.response.status,
        idempotency.response.body.request_id || context.requestId
      );
    }
    reservation = idempotency.reservation;

    const fingerprint = fingerprintConfig(env);
    const replayFingerprint = await hashOpaqueToken(
      verified.dataCheckString,
      fingerprint.key
    );
    replayGuardId = createOpaqueId();
    const replayExpiry = new Date(
      Date.now() + (TELEGRAM_INIT_DATA_MAX_AGE_SECONDS + 60) * 1000
    ).toISOString();
    try {
      await env.DB.prepare(`
        DELETE FROM auth_replay_guards
        WHERE datetime(expires_at) <= datetime('now')
      `).run();
      await env.DB.prepare(`
        INSERT INTO auth_replay_guards (
          id,
          namespace,
          fingerprint_key_version,
          fingerprint,
          expires_at
        ) VALUES (?, 'telegram_init_data', ?, ?, ?)
      `).bind(
        replayGuardId,
        fingerprint.version,
        replayFingerprint,
        replayExpiry
      ).run();
    } catch (error) {
      if (uniquenessConflict(error)) {
        const replayError = new Error("Telegram authorization was already used.");
        replayError.code = "invalid_telegram_authorization";
        throw replayError;
      }
      throw error;
    }

    const existing = await env.DB.prepare(`
      SELECT 1 AS present
      FROM auth_external_identities
      WHERE provider = 'telegram'
        AND provider_subject = ?
        AND revoked_at IS NULL
      LIMIT 1
    `).bind(verified.user.id).first();
    const customer = await upsertCanonicalTelegramCustomer(
      env,
      verified.user,
      verified.user.language_code || "unknown"
    );
    const session = await issueCustomerSession(env, customer, client);
    const status = existing ? 200 : 201;
    const responseBody = {
      ok: true,
      request_id: context.requestId,
      session,
      customer: mapCustomer(customer)
    };
    await completeIdempotencyKey(env, reservation, {
      status,
      body: responseBody,
      resourceType: "customer",
      resourceId: String(customer.id)
    });
    reservation = null;
    return identityResponse(
      request,
      env,
      responseBody,
      status,
      context.requestId
    );
  } catch (error) {
    if (reservation) {
      try {
        await releaseIdempotencyReservation(env, reservation);
      } catch {
        // Preserve the original generic service response.
      }
    }
    if (replayGuardId) {
      try {
        await env.DB.prepare(
          "DELETE FROM auth_replay_guards WHERE id = ?"
        ).bind(replayGuardId).run();
      } catch {
        // Expiry cleanup remains the fallback.
      }
    }
    return errorResponse(request, env, error, context.requestId);
  }
}
