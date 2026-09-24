import {
  constantTimeEqual,
  createOpaqueId,
  hashOpaqueToken
} from "../crypto.js";
import {
  createAcceptedChallengeTokenHashes,
  createMagicLinkToken,
  createVersionedChallengeTokenHash
} from "../challenge-token.js";
import { prepareEncryptedOutboxInsert } from "../email/outbox-repository.js";
import {
  maskEmailAddress,
  normalizeEmailAddress
} from "../email/normalization.js";
import {
  identityError,
  identityResponse,
  isIdentityOriginAllowed
} from "../http.js";
import {
  createIdentityRequestContext,
  IdentityProtocolError,
  readIdempotencyKey,
  readIdentityJson
} from "../protocol.js";
import { resolveCanonicalSession } from "../repository.js";
import { createSessionHashesForIssuance } from "../session-keyring.js";
import {
  readScopedSessionAuthentication,
  serializeScopedAuthCookieClears,
  serializeScopedAuthCookies,
  validateRequestedSessionTransport,
  verifyScopedSessionMutation
} from "../transport.js";

export const CUSTOMER_EMAIL_AUTH_START_ROUTE =
  "/api/v1/customer/auth/email/start";
export const CUSTOMER_EMAIL_AUTH_COMPLETE_ROUTE =
  "/api/v1/customer/auth/email/complete";
export const CUSTOMER_EMAIL_AUTH_CONFIRM_ROUTE =
  "/api/v1/customer/auth/email/confirm";
export const CUSTOMER_AUTH_SESSION_ROUTE =
  "/api/v1/customer/auth/session";
export const CUSTOMER_AUTH_LOGOUT_ROUTE =
  "/api/v1/customer/auth/logout";

const INITIATION_COOKIE = "__Host-crm_customer_auth_initiation";
const CHALLENGE_LIFETIME_SECONDS = 15 * 60;
const CONFIRMATION_LIFETIME_SECONDS = 5 * 60;
const SESSION_LIFETIME_SECONDS = 90 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CODE_PATTERN = /^[0-9]{8}$/;
const ID_PATTERN = /^[0-9a-f]{32}$/;
const APP_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/;
const RETURN_TARGETS = new Set(["home", "orders", "profile", "security"]);

function protocolError(code, status, message) {
  throw new IdentityProtocolError(code, status, message);
}

function requireDatabase(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function" || typeof env.DB.batch !== "function") {
    protocolError("temporarily_unavailable", 503, "Customer sign-in is temporarily unavailable.");
  }
  return env.DB;
}

function requireOrigin(request, env) {
  if (!isIdentityOriginAllowed(request, env)) {
    protocolError("origin_not_allowed", 403, "The request origin is not allowed.");
  }
}

function locale(value) {
  const primary = String(value || "en").trim().toLowerCase().split("-")[0];
  return ["en", "de", "tr", "ar", "ru"].includes(primary) ? primary : "en";
}

function publicOrigin(env) {
  const parsed = new URL(String(env?.CRM_AUTH_PUBLIC_ORIGIN || "https://crm.ayartuerk.me"));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    protocolError("temporarily_unavailable", 503, "The public identity origin is unavailable.");
  }
  return parsed.origin;
}

function positiveVersion(value) {
  const text = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(text)) {
    protocolError("temporarily_unavailable", 503, "Identity key configuration is unavailable.");
  }
  return Number(text);
}

function challengeCodeConfig(env) {
  const version = positiveVersion(env?.CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION);
  const key = String(env?.[`CRM_AUTH_CHALLENGE_HMAC_KEY_V${version}`] || "");
  if (key.length < 32 || key.length > 1024) {
    protocolError("temporarily_unavailable", 503, "Identity key configuration is unavailable.");
  }
  return { version, key };
}

function opaqueToken() {
  return createMagicLinkToken();
}

function manualCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
  return String(value).padStart(8, "0");
}

async function codeVerifier(env, accountId, challengeId, code) {
  const config = challengeCodeConfig(env);
  return {
    version: config.version,
    verifier: await hashOpaqueToken(
      ["crm-customer-login-code-v1", `key-v${config.version}`, accountId, challengeId, code].join("\u0000"),
      config.key
    )
  };
}

function exactCustomerClient(body, request, env) {
  const client = body?.client;
  if (
    !client
    || typeof client !== "object"
    || Array.isArray(client)
    || Object.keys(client).sort().join(",") !== "app_version,platform"
    || !["customer_web", "customer_android"].includes(client.platform)
    || !APP_VERSION.test(String(client.app_version || ""))
  ) {
    protocolError("invalid_request", 400, "The request shape is invalid.");
  }
  validateRequestedSessionTransport(request, {
    sessionTransport: body.session_transport,
    clientPlatform: client.platform,
    nativeBearerEnabled: client.platform === "customer_android"
      && String(env?.CRM_AUTH_CLIENT_READY_CUSTOMER_ANDROID || "").toLowerCase() === "true",
    env
  });
  return {
    platform: client.platform,
    appVersion: String(client.app_version),
    sessionTransport: body.session_transport
  };
}

function cookieValue(request, name) {
  const values = String(request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 && TOKEN_PATTERN.test(values[0]) ? values[0] : null;
}

function initiationCookie(value) {
  return `${INITIATION_COOKIE}=${value}; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=${CHALLENGE_LIFETIME_SECONDS}`;
}

function clearInitiationCookie() {
  return `${INITIATION_COOKIE}=; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

function responseWithCookies(request, env, requestId, body, status, cookies = []) {
  const response = identityResponse(
    request,
    env,
    { ...body, request_id: requestId },
    status,
    requestId
  );
  for (const value of cookies) response.headers.append("set-cookie", value);
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
    "Customer sign-in is temporarily unavailable.",
    503,
    undefined,
    requestId
  );
}

async function verifiedEmailAccount(database, normalizedEmail) {
  return database.prepare(`
    SELECT
      a.id AS auth_account_id,
      a.auth_version,
      a.locale,
      e.id AS email_address_id,
      e.display_email,
      e.normalized_email,
      c.id AS customer_id,
      c.full_name,
      c.username,
      c.preferred_language,
      c.language
    FROM auth_email_addresses e
    JOIN auth_accounts a
      ON a.id = e.auth_account_id
     AND a.realm = 'customer'
     AND a.status = 'active'
    JOIN customers c
      ON c.auth_account_id = a.id
     AND COALESCE(c.is_blocked, 0) = 0
    WHERE e.realm = 'customer'
      AND e.normalized_email = ?
      AND e.status = 'verified'
      AND e.verified_at IS NOT NULL
      AND e.replaced_at IS NULL
      AND e.revoked_at IS NULL
      AND e.deleted_at IS NULL
    LIMIT 1
  `).bind(normalizedEmail).first();
}

async function pendingEmailRegistration(database, normalizedEmail) {
  return database.prepare(`
    SELECT
      a.id AS auth_account_id,
      a.auth_version,
      a.locale,
      e.id AS email_address_id,
      e.display_email,
      e.normalized_email
    FROM auth_email_addresses e
    JOIN auth_accounts a
      ON a.id = e.auth_account_id
     AND a.realm = 'customer'
     AND a.status = 'pending'
    LEFT JOIN customers c ON c.auth_account_id = a.id
    WHERE e.realm = 'customer'
      AND e.normalized_email = ?
      AND e.status = 'pending'
      AND e.verified_at IS NULL
      AND e.replaced_at IS NULL
      AND e.revoked_at IS NULL
      AND e.deleted_at IS NULL
      AND c.id IS NULL
    ORDER BY e.created_at DESC
    LIMIT 1
  `).bind(normalizedEmail).first();
}

function mapCustomer(row) {
  const language = row.preferred_language || row.language || row.locale || "en";
  return {
    id: Number(row.customer_id),
    full_name: row.full_name || "",
    username: row.username || "",
    language,
    preferred_language: language,
    email: maskEmailAddress(row.display_email)
  };
}

async function issueSession(env, database, challenge, client, nowAt) {
  const sessionToken = opaqueToken();
  const csrfToken = client.sessionTransport === "cookie" ? opaqueToken() : null;
  const sessionId = createOpaqueId();
  const expiresAt = new Date(Date.parse(nowAt) + SESSION_LIFETIME_SECONDS * 1000).toISOString();
  const hashes = await createSessionHashesForIssuance(env, {
    sessionToken,
    ...(csrfToken ? { csrfToken } : {})
  });
  const registration = challenge.account_status === "pending"
    && challenge.email_status === "pending";
  if (registration) {
    const conflict = await verifiedEmailAccount(database, challenge.normalized_email);
    if (conflict && conflict.auth_account_id !== challenge.auth_account_id) {
      protocolError("email_in_use", 409, "This email is already connected to another customer account.");
    }
  }
  const consumed = await database.prepare(`
    UPDATE auth_challenges
    SET status = 'consumed', consumed_at = ?, transition_id = ?
    WHERE id = ? AND auth_account_id = ? AND realm = 'customer'
      AND purpose = 'customer_login' AND status IN ('pending', 'verified')
      AND expected_auth_version = ? AND datetime(expires_at) > datetime(?)
  `).bind(
    nowAt,
    createOpaqueId(),
    challenge.id,
    challenge.auth_account_id,
    Number(challenge.expected_auth_version),
    nowAt
  ).run();
  if (Number(consumed.meta?.changes || 0) !== 1) {
    protocolError("invalid_challenge", 401, "The sign-in request is invalid or expired.");
  }
  const statements = [];
  if (registration) {
    statements.push(
      database.prepare(`
        UPDATE auth_accounts
        SET status = 'active', updated_at = ?, last_transition_id = ?
        WHERE id = ? AND realm = 'customer' AND status = 'pending'
      `).bind(nowAt, createOpaqueId(), challenge.auth_account_id),
      database.prepare(`
        UPDATE auth_email_addresses
        SET status = 'verified', is_primary = 1, verified_at = ?, updated_at = ?
        WHERE id = ? AND auth_account_id = ? AND realm = 'customer'
          AND status = 'pending' AND verified_at IS NULL
      `).bind(nowAt, nowAt, challenge.email_address_id, challenge.auth_account_id),
      database.prepare(`
        INSERT INTO customers (
          telegram_user_id, full_name, language, preferred_language,
          last_seen_at, created_at, auth_account_id
        ) VALUES (?, NULL, ?, ?, ?, ?, ?)
      `).bind(
        `${client.platform === "customer_android" ? "app" : "web"}:${createOpaqueId()}`,
        challenge.locale || "en",
        challenge.locale || "en",
        nowAt,
        nowAt,
        challenge.auth_account_id
      )
    );
  }
  statements.push(database.prepare(`
    INSERT INTO auth_sessions (
      id, auth_account_id, realm, token_hash, token_hash_version,
      created_transition_id, issued_auth_version, scope, assurance_level,
      auth_methods_json, authorization_context_json, session_transport,
      csrf_token_hash, client_platform, app_version, authenticated_at,
      created_at, expires_at, last_seen_at
    ) VALUES (
      ?, ?, 'customer', ?, ?, ?, ?, 'customer_verified', 1,
      '["email"]', '{}', ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    sessionId,
    challenge.auth_account_id,
    hashes.tokenHash,
    hashes.tokenHashVersion,
    createOpaqueId(),
    Number(challenge.expected_auth_version),
    client.sessionTransport,
    hashes.csrfTokenHash || null,
    client.platform,
    client.appVersion,
    nowAt,
    nowAt,
    expiresAt,
    nowAt
  ));
  await database.batch(statements);
  const customer = await database.prepare(`
    SELECT c.id AS customer_id, c.full_name, c.username,
      c.preferred_language, c.language, a.locale, e.display_email
    FROM customers c
    JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer' AND a.status = 'active'
    JOIN auth_email_addresses e
      ON e.auth_account_id = a.id AND e.realm = 'customer'
     AND e.status = 'verified' AND e.is_primary = 1
     AND e.replaced_at IS NULL AND e.revoked_at IS NULL AND e.deleted_at IS NULL
    WHERE c.auth_account_id = ? AND COALESCE(c.is_blocked, 0) = 0
    LIMIT 1
  `).bind(challenge.auth_account_id).first();
  if (!customer) {
    protocolError("invalid_challenge", 401, "The sign-in request is invalid or expired.");
  }
  return {
    sessionToken,
    csrfToken,
    body: {
      ok: true,
      confirmation_required: false,
      session: {
        id: sessionId,
        scope: "customer_verified",
        transport: client.sessionTransport,
        expires_at: expiresAt,
        ...(csrfToken ? { csrf_token: csrfToken } : {}),
        ...(client.sessionTransport === "bearer" ? {
          access_token: sessionToken,
          token_type: "Bearer"
        } : {})
      },
      customer: mapCustomer(customer),
      return_to: challenge.redirect_path || "home"
    }
  };
}

async function challengeByToken(env, database, token, nowAt) {
  const hashes = await createAcceptedChallengeTokenHashes(env, token, "customer_login");
  return database.prepare(`
    SELECT c.*, a.auth_version, a.status AS account_status,
      e.status AS email_status, e.display_email, e.normalized_email,
      p.id AS customer_id, p.full_name, p.username,
      p.preferred_language, p.language
    FROM auth_challenges c
    JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer'
    JOIN auth_email_addresses e ON e.id = c.email_address_id
    LEFT JOIN customers p ON p.auth_account_id = a.id AND COALESCE(p.is_blocked, 0) = 0
    WHERE c.token_hash IN (${hashes.map(() => "?").join(", ")})
      AND c.realm = 'customer' AND c.purpose = 'customer_login'
      AND c.status = 'pending' AND datetime(c.expires_at) > datetime(?)
      AND (
        (a.status = 'active' AND e.status = 'verified' AND p.id IS NOT NULL)
        OR (a.status = 'pending' AND e.status = 'pending' AND p.id IS NULL)
      )
    ORDER BY c.created_at DESC LIMIT 1
  `).bind(...hashes, nowAt).first();
}

async function challengeByCode(env, database, attemptId, code, nowAt) {
  const challenge = await database.prepare(`
    SELECT c.*, a.auth_version, a.status AS account_status,
      e.status AS email_status, e.display_email, e.normalized_email,
      p.id AS customer_id, p.full_name, p.username,
      p.preferred_language, p.language
    FROM auth_challenges c
    JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer'
    JOIN auth_email_addresses e ON e.id = c.email_address_id
    LEFT JOIN customers p ON p.auth_account_id = a.id AND COALESCE(p.is_blocked, 0) = 0
    WHERE c.id = ? AND c.realm = 'customer' AND c.purpose = 'customer_login'
      AND c.status = 'pending' AND datetime(c.expires_at) > datetime(?)
      AND (
        (a.status = 'active' AND e.status = 'verified' AND p.id IS NOT NULL)
        OR (a.status = 'pending' AND e.status = 'pending' AND p.id IS NULL)
      )
    LIMIT 1
  `).bind(attemptId, nowAt).first();
  if (!challenge) return null;
  const verifier = await codeVerifier(env, challenge.auth_account_id, challenge.id, code);
  if (
    Number(challenge.verifier_key_version) !== verifier.version
    || !await constantTimeEqual(challenge.code_verifier, verifier.verifier)
  ) {
    const failed = Number(challenge.failed_attempts || 0) + 1;
    await database.prepare(`
      UPDATE auth_challenges
      SET failed_attempts = ?,
          status = CASE WHEN ? >= max_attempts THEN 'invalidated' ELSE status END,
          invalidated_at = CASE WHEN ? >= max_attempts THEN ? ELSE invalidated_at END,
          transition_id = CASE WHEN ? >= max_attempts THEN COALESCE(transition_id, ?) ELSE transition_id END
      WHERE id = ? AND status = 'pending'
    `).bind(failed, failed, failed, nowAt, failed, createOpaqueId(), challenge.id).run();
    return null;
  }
  return challenge;
}

async function initiationMatches(env, request, challenge, initiationNonce = null) {
  const raw = initiationNonce || cookieValue(request, INITIATION_COOKIE);
  if (!raw || !challenge.initiation_state_hash) return false;
  const hashes = await createAcceptedChallengeTokenHashes(env, raw, "customer_login");
  for (const value of hashes) {
    if (await constantTimeEqual(value, challenge.initiation_state_hash)) return true;
  }
  return false;
}

async function requireCustomerSession(request, env) {
  const authentication = readScopedSessionAuthentication(request, "customer");
  const session = await resolveCanonicalSession(env, authentication.sessionToken, "customer");
  if (
    !session
    || session.scope !== "customer_verified"
    || session.session_transport !== authentication.sessionTransport
  ) {
    protocolError("unauthorized", 401, "A valid customer session is required.");
  }
  return { authentication, session };
}

export async function handleCustomerEmailAuthStart(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    readIdempotencyKey(request);
    const body = await readIdentityJson(request, {
      allowedFields: ["email", "intent", "locale", "return_to", "initiation_nonce", "session_transport", "client"],
      requiredFields: ["email", "intent", "locale", "return_to", "session_transport", "client"]
    });
    const client = exactCustomerClient(body, request, env);
    if (client.sessionTransport === "cookie") requireOrigin(request, env);
    const suppliedInitiation = body.initiation_nonce === null || body.initiation_nonce === undefined
      ? null
      : String(body.initiation_nonce);
    if (
      body.intent !== "sign_in"
      || client.sessionTransport === "cookie" && suppliedInitiation !== null
      || client.sessionTransport === "bearer" && !TOKEN_PATTERN.test(suppliedInitiation || "")
    ) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    const returnTo = String(body.return_to || "home");
    if (!RETURN_TARGETS.has(returnTo)) protocolError("invalid_request", 400, "The request shape is invalid.");
    let normalized;
    try {
      normalized = normalizeEmailAddress(body.email);
    } catch {
      protocolError("invalid_email", 400, "Enter a valid email address.");
    }
    const database = requireDatabase(env);
    const nowAt = new Date().toISOString();
    const initiation = suppliedInitiation || opaqueToken();
    const initiationHash = await createVersionedChallengeTokenHash(env, initiation, "customer_login");
    const preferredLocale = locale(body.locale);
    let account = await verifiedEmailAccount(database, normalized.normalizedEmail);
    let registrationStatements = [];
    if (!account) {
      account = await pendingEmailRegistration(database, normalized.normalizedEmail);
    }
    if (!account) {
      const authAccountId = createOpaqueId();
      const emailAddressId = createOpaqueId();
      account = {
        auth_account_id: authAccountId,
        auth_version: 1,
        locale: preferredLocale,
        email_address_id: emailAddressId,
        display_email: normalized.displayEmail,
        normalized_email: normalized.normalizedEmail
      };
      registrationStatements = [
        database.prepare(`
          INSERT INTO auth_accounts (
            id, webauthn_user_handle, realm, status, auth_version,
            enrollment_state, last_transition_id, locale, created_at, updated_at
          ) VALUES (?, ?, 'customer', 'pending', 1, 'not_required', ?, ?, ?, ?)
        `).bind(
          authAccountId,
          createOpaqueId(),
          createOpaqueId(),
          preferredLocale,
          nowAt,
          nowAt
        ),
        database.prepare(`
          INSERT INTO auth_email_addresses (
            id, auth_account_id, realm, normalized_email, normalization_version,
            display_email, status, is_primary, created_at, updated_at
          ) VALUES (?, ?, 'customer', ?, ?, ?, 'pending', 0, ?, ?)
        `).bind(
          emailAddressId,
          authAccountId,
          normalized.normalizedEmail,
          normalized.normalizationVersion,
          normalized.displayEmail,
          nowAt,
          nowAt
        )
      ];
    }
    const active = await database.prepare(`
      SELECT id, resend_not_before, expires_at
      FROM auth_challenges
      WHERE auth_account_id = ? AND realm = 'customer' AND purpose = 'customer_login'
        AND status = 'pending' AND datetime(expires_at) > datetime(?)
      LIMIT 1
    `).bind(account.auth_account_id, nowAt).first();
    if (active?.resend_not_before && Date.parse(active.resend_not_before) > Date.parse(nowAt)) {
      return responseWithCookies(
        request,
        env,
        context.requestId,
        { ok: true, accepted: true, attempt_id: active.id, expires_in: Math.max(1, Math.floor((Date.parse(active.expires_at) - Date.parse(nowAt)) / 1000)) },
        202
      );
    }
    const challengeId = createOpaqueId();
    const token = opaqueToken();
    const code = manualCode();
    const expiresAt = new Date(Date.parse(nowAt) + CHALLENGE_LIFETIME_SECONDS * 1000).toISOString();
    const resendNotBefore = new Date(Date.parse(nowAt) + 60 * 1000).toISOString();
    const [tokenHash, verifier] = await Promise.all([
      createVersionedChallengeTokenHash(env, token, "customer_login"),
      codeVerifier(env, account.auth_account_id, challengeId, code)
    ]);
    const messageLocale = locale(body.locale || account.locale);
    const outbox = await prepareEncryptedOutboxInsert(
      env,
      {
        challengeId,
        emailAddressId: account.email_address_id,
        authAccountId: account.auth_account_id,
        realm: "customer",
        templateKey: "auth.customer.sign_in.v1",
        challengePurpose: "customer_login",
        locale: messageLocale,
        dedupeKey: `customer-login:${challengeId}`,
        maxAttempts: 5,
        availableAt: nowAt,
        expiresAt
      },
      {
        action_url: `${publicOrigin(env)}/auth/customer/continue#token=${token}`,
        manual_code: code,
        expires_at: expiresAt
      }
    );
    await database.batch([
      ...registrationStatements,
      database.prepare(`
        UPDATE auth_challenges
        SET status = 'invalidated', invalidated_at = ?, transition_id = COALESCE(transition_id, ?)
        WHERE auth_account_id = ? AND realm = 'customer' AND purpose = 'customer_login'
          AND status IN ('pending', 'verified')
      `).bind(nowAt, createOpaqueId(), account.auth_account_id),
      database.prepare(`
        INSERT INTO auth_challenges (
          id, auth_account_id, realm, email_address_id, expected_auth_version,
          purpose, status, verification_method, required_proof_policy,
          token_hash, code_verifier, initiation_state_hash, verifier_key_version,
          fingerprint_key_version, redirect_path, locale, correlation_id,
          max_attempts, failed_attempts, resend_not_before, expires_at, created_at
        ) VALUES (
          ?, ?, 'customer', ?, ?, 'customer_login', 'pending',
          'magic_link_or_email_code', 'single', ?, ?, ?, ?, ?, ?, ?, ?,
          5, 0, ?, ?, ?
        )
      `).bind(
        challengeId,
        account.auth_account_id,
        account.email_address_id,
        Number(account.auth_version),
        tokenHash.tokenHash,
        verifier.verifier,
        initiationHash.tokenHash,
        verifier.version,
        positiveVersion(env?.CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION || "1"),
        returnTo,
        messageLocale,
        createOpaqueId(),
        resendNotBefore,
        expiresAt,
        nowAt
      ),
      outbox.statement
    ]);
    return responseWithCookies(
      request,
      env,
      context.requestId,
      { ok: true, accepted: true, attempt_id: challengeId, expires_in: CHALLENGE_LIFETIME_SECONDS },
      202,
      client.sessionTransport === "cookie" ? [initiationCookie(initiation)] : []
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleCustomerEmailAuthComplete(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    readIdempotencyKey(request);
    const body = await readIdentityJson(request, {
      allowedFields: ["token", "attempt_id", "manual_code", "initiation_nonce", "session_transport", "client"],
      requiredFields: ["session_transport", "client"]
    });
    const client = exactCustomerClient(body, request, env);
    if (client.sessionTransport === "cookie") requireOrigin(request, env);
    const initiationNonce = body.initiation_nonce === null || body.initiation_nonce === undefined
      ? null
      : String(body.initiation_nonce);
    if (
      client.sessionTransport === "cookie" && initiationNonce !== null
      || client.sessionTransport === "bearer" && !TOKEN_PATTERN.test(initiationNonce || "")
    ) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    const token = String(body.token || "").trim();
    const attemptId = String(body.attempt_id || "").trim();
    const code = String(body.manual_code || "").trim();
    const usingToken = Boolean(token);
    const usingCode = Boolean(attemptId || code);
    if (
      usingToken === usingCode
      || usingToken && !TOKEN_PATTERN.test(token)
      || usingCode && (!ID_PATTERN.test(attemptId) || !CODE_PATTERN.test(code))
    ) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    const database = requireDatabase(env);
    const nowAt = new Date().toISOString();
    const challenge = usingToken
      ? await challengeByToken(env, database, token, nowAt)
      : await challengeByCode(env, database, attemptId, code, nowAt);
    if (!challenge || Number(challenge.expected_auth_version) !== Number(challenge.auth_version)) {
      protocolError("invalid_challenge", 401, "The sign-in request is invalid or expired.");
    }
    if (await initiationMatches(env, request, challenge, initiationNonce)) {
      const issued = await issueSession(env, database, challenge, client, nowAt);
      return responseWithCookies(
        request,
        env,
        context.requestId,
        issued.body,
        200,
        client.sessionTransport === "cookie" ? [
          ...serializeScopedAuthCookies("customer", {
            sessionToken: issued.sessionToken,
            csrfToken: issued.csrfToken,
            maxAgeSeconds: SESSION_LIFETIME_SECONDS
          }),
          clearInitiationCookie()
        ] : []
      );
    }
    const confirmationToken = opaqueToken();
    const continuationHash = await createVersionedChallengeTokenHash(env, confirmationToken, "customer_login");
    const confirmationExpiresAt = new Date(
      Math.min(Date.parse(challenge.expires_at), Date.parse(nowAt) + CONFIRMATION_LIFETIME_SECONDS * 1000)
    ).toISOString();
    const verified = await database.prepare(`
      UPDATE auth_challenges
      SET status = 'verified', verified_at = ?, continuation_token_hash = ?, expires_at = ?, transition_id = NULL
      WHERE id = ? AND status = 'pending' AND purpose = 'customer_login'
        AND expected_auth_version = ? AND datetime(expires_at) > datetime(?)
    `).bind(
      nowAt,
      continuationHash.tokenHash,
      confirmationExpiresAt,
      challenge.id,
      Number(challenge.expected_auth_version),
      nowAt
    ).run();
    if (Number(verified.meta?.changes || 0) !== 1) {
      protocolError("invalid_challenge", 401, "The sign-in request is invalid or expired.");
    }
    return identityResponse(
      request,
      env,
      {
        ok: true,
        request_id: context.requestId,
        confirmation_required: true,
        destination_masked: maskEmailAddress(challenge.display_email),
        confirmation_token: confirmationToken,
        expires_in: Math.max(1, Math.floor((Date.parse(confirmationExpiresAt) - Date.parse(nowAt)) / 1000))
      },
      200,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleCustomerEmailAuthConfirm(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    readIdempotencyKey(request);
    const body = await readIdentityJson(request, {
      allowedFields: ["confirmation_token", "confirmation", "session_transport", "client"],
      requiredFields: ["confirmation_token", "confirmation", "session_transport", "client"]
    });
    const client = exactCustomerClient(body, request, env);
    if (client.sessionTransport === "cookie") requireOrigin(request, env);
    const token = String(body.confirmation_token || "").trim();
    if (!TOKEN_PATTERN.test(token) || body.confirmation !== "continue") {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    const database = requireDatabase(env);
    const nowAt = new Date().toISOString();
    const hashes = await createAcceptedChallengeTokenHashes(env, token, "customer_login");
    const challenge = await database.prepare(`
      SELECT c.*, a.auth_version, a.status AS account_status,
        e.status AS email_status, e.display_email, e.normalized_email,
        p.id AS customer_id, p.full_name, p.username,
        p.preferred_language, p.language
      FROM auth_challenges c
      JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer'
      JOIN auth_email_addresses e ON e.id = c.email_address_id
      LEFT JOIN customers p ON p.auth_account_id = a.id AND COALESCE(p.is_blocked, 0) = 0
      WHERE c.continuation_token_hash IN (${hashes.map(() => "?").join(", ")})
        AND c.realm = 'customer' AND c.purpose = 'customer_login'
        AND c.status = 'verified' AND datetime(c.expires_at) > datetime(?)
        AND (
          (a.status = 'active' AND e.status = 'verified' AND p.id IS NOT NULL)
          OR (a.status = 'pending' AND e.status = 'pending' AND p.id IS NULL)
        )
      ORDER BY c.verified_at DESC LIMIT 1
    `).bind(...hashes, nowAt).first();
    if (!challenge || Number(challenge.expected_auth_version) !== Number(challenge.auth_version)) {
      protocolError("invalid_challenge", 401, "The sign-in confirmation is invalid or expired.");
    }
    const issued = await issueSession(env, database, challenge, client, nowAt);
    return responseWithCookies(
      request,
      env,
      context.requestId,
      issued.body,
      200,
      client.sessionTransport === "cookie" ? [
        ...serializeScopedAuthCookies("customer", {
          sessionToken: issued.sessionToken,
          csrfToken: issued.csrfToken,
          maxAgeSeconds: SESSION_LIFETIME_SECONDS
        }),
        clearInitiationCookie()
      ] : []
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleCustomerAuthSession(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "GET") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    const { session } = await requireCustomerSession(request, env);
    const customer = await requireDatabase(env).prepare(`
      SELECT c.id AS customer_id, c.full_name, c.username,
        c.preferred_language, c.language, a.locale,
        e.display_email
      FROM customers c
      JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer'
      LEFT JOIN auth_email_addresses e
        ON e.auth_account_id = a.id AND e.realm = 'customer'
       AND e.status = 'verified' AND e.is_primary = 1
       AND e.replaced_at IS NULL AND e.revoked_at IS NULL AND e.deleted_at IS NULL
      WHERE c.auth_account_id = ? LIMIT 1
    `).bind(session.auth_account_id).first();
    if (!customer) protocolError("unauthorized", 401, "A valid customer session is required.");
    return identityResponse(
      request,
      env,
      { ok: true, request_id: context.requestId, session: { scope: session.scope, expires_at: session.expires_at }, customer: mapCustomer(customer) },
      200,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleCustomerAuthLogout(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    const { authentication, session } = await requireCustomerSession(request, env);
    if (session.session_transport === "cookie") requireOrigin(request, env);
    await verifyScopedSessionMutation(request, env, session, "customer", authentication);
    await requireDatabase(env).prepare(`
      UPDATE auth_sessions
      SET revoked_at = CURRENT_TIMESTAMP, revocation_reason = 'customer_logout', last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ? AND revoked_at IS NULL
    `).bind(session.id).run();
    return responseWithCookies(
      request,
      env,
      context.requestId,
      { ok: true, logged_out: true },
      200,
      session.session_transport === "cookie"
        ? serializeScopedAuthCookieClears("customer")
        : []
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}
