import { constantTimeEqual } from "./crypto.js";
import { isIdentityOriginAllowed } from "./http.js";
import { IdentityProtocolError } from "./protocol.js";
import { hashSessionSecretForVersion } from "./session-keyring.js";

const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
const MAX_COOKIE_AGE_SECONDS = 90 * 24 * 60 * 60;

const COOKIE_SCOPES = Object.freeze({
  customer: Object.freeze({
    realm: "customer",
    sessionCookie: "__Host-crm_customer_session",
    csrfCookie: "__Host-crm_customer_csrf",
    sessionScopes: Object.freeze(["customer_guest", "customer_verified"])
  }),
  staff: Object.freeze({
    realm: "staff",
    sessionCookie: "__Host-crm_staff_session",
    csrfCookie: "__Host-crm_staff_csrf",
    sessionScopes: Object.freeze(["staff_password_limited", "staff_strong"])
  }),
  staff_enrollment: Object.freeze({
    realm: "staff",
    sessionCookie: "__Host-crm_staff_enrollment",
    csrfCookie: "__Host-crm_staff_enrollment_csrf",
    sessionScopes: Object.freeze(["staff_enrollment"])
  }),
  staff_recovery: Object.freeze({
    realm: "staff",
    sessionCookie: "__Host-crm_staff_recovery",
    csrfCookie: "__Host-crm_staff_recovery_csrf",
    sessionScopes: Object.freeze([
      "staff_recovery_email",
      "staff_recovery_authorized"
    ])
  })
});

const WEB_PLATFORMS = new Set([
  "admin_web",
  "customer_web",
  "telegram_mini_app"
]);
const NATIVE_PLATFORMS = new Set([
  "admin_android",
  "admin_ios",
  "customer_android",
  "customer_ios"
]);

function protocolError(code, status, message) {
  return new IdentityProtocolError(code, status, message);
}

function scopeDefinition(scope) {
  const definition = COOKIE_SCOPES[String(scope ?? "")];
  if (!definition) {
    throw protocolError(
      "temporarily_unavailable",
      503,
      "The identity cookie scope is not configured."
    );
  }
  return definition;
}

function parseCookies(request) {
  const raw = request?.headers?.get("cookie") || "";
  const values = new Map();
  if (!raw) return values;

  for (const segment of raw.split(";")) {
    const part = segment.trim();
    if (!part) continue;
    const equals = part.indexOf("=");
    if (equals <= 0) {
      throw protocolError("unauthorized", 401, "The authentication cookie is invalid.");
    }
    const name = part.slice(0, equals).trim();
    const value = part.slice(equals + 1).trim();
    if (!name || values.has(name)) {
      throw protocolError("unauthorized", 401, "The authentication cookie is invalid.");
    }
    values.set(name, value);
  }
  return values;
}

function requireOpaqueToken(value, code, status, message) {
  if (!OPAQUE_TOKEN.test(String(value ?? ""))) {
    throw protocolError(code, status, message);
  }
  return String(value);
}

export function getIdentityCookieScope(scope) {
  return scopeDefinition(scope);
}

export function requestHasBrowserMetadata(request) {
  if (request?.headers?.has("origin")) return true;
  for (const [name] of request?.headers || []) {
    if (name.toLowerCase().startsWith("sec-fetch-")) return true;
  }
  return false;
}

export function assertAllowedBrowserMutationOrigin(request, env) {
  if (!isIdentityOriginAllowed(request, env)) {
    throw protocolError(
      "forbidden",
      403,
      "The request origin is not allowed."
    );
  }
  return request.headers.get("origin");
}

export function validateRequestedSessionTransport(
  request,
  {
    sessionTransport,
    clientPlatform,
    nativeBearerEnabled = false,
    env
  } = {}
) {
  const transport = String(sessionTransport ?? "");
  const platform = String(clientPlatform ?? "");
  const isBrowserControlled = requestHasBrowserMetadata(request);

  if (isBrowserControlled && (!WEB_PLATFORMS.has(platform) || transport !== "cookie")) {
    throw protocolError(
      "invalid_session_transport",
      400,
      "The requested session transport is invalid."
    );
  }

  if (WEB_PLATFORMS.has(platform) && transport === "cookie") {
    assertAllowedBrowserMutationOrigin(request, env);
    return Object.freeze({ sessionTransport: transport, clientPlatform: platform });
  }

  if (NATIVE_PLATFORMS.has(platform) && transport === "bearer") {
    if (!nativeBearerEnabled) {
      throw protocolError(
        "capability_disabled",
        503,
        "Native identity bearer transport is not enabled."
      );
    }
    return Object.freeze({ sessionTransport: transport, clientPlatform: platform });
  }

  throw protocolError(
    "invalid_session_transport",
    400,
    "The requested session transport is invalid."
  );
}

export function readScopedCookieAuthentication(request, scope) {
  const definition = scopeDefinition(scope);
  const cookies = parseCookies(request);
  const sessionToken = requireOpaqueToken(
    cookies.get(definition.sessionCookie),
    "unauthorized",
    401,
    "A valid authentication session is required."
  );

  const csrfCookieToken = cookies.get(definition.csrfCookie) || null;
  const csrfHeaderToken = request.headers.get("x-csrf-token");
  return Object.freeze({
    scope: String(scope),
    sessionToken,
    csrfCookieToken,
    csrfHeaderToken
  });
}

export async function verifyScopedCookieCsrf(request, env, session, scope) {
  assertAllowedBrowserMutationOrigin(request, env);
  const definition = scopeDefinition(scope);
  const authentication = readScopedCookieAuthentication(request, scope);

  if (
    !session
    || session.realm !== definition.realm
    || session.session_transport !== "cookie"
    || !definition.sessionScopes.includes(session.scope)
    || !/^[0-9a-f]{64}$/.test(String(session.csrf_token_hash ?? ""))
  ) {
    throw protocolError("unauthorized", 401, "A valid authentication session is required.");
  }

  const cookieToken = requireOpaqueToken(
    authentication.csrfCookieToken,
    "forbidden",
    403,
    "CSRF verification failed."
  );
  const headerToken = requireOpaqueToken(
    authentication.csrfHeaderToken,
    "forbidden",
    403,
    "CSRF verification failed."
  );

  let tokenHash;
  try {
    tokenHash = await hashSessionSecretForVersion(
      env,
      headerToken,
      session.token_hash_version
    );
  } catch {
    throw protocolError(
      "temporarily_unavailable",
      503,
      "Canonical session verification is not configured."
    );
  }

  const [headerMatchesCookie, hashMatchesSession] = await Promise.all([
    constantTimeEqual(headerToken, cookieToken),
    constantTimeEqual(tokenHash, session.csrf_token_hash)
  ]);
  if (!headerMatchesCookie || !hashMatchesSession) {
    throw protocolError("forbidden", 403, "CSRF verification failed.");
  }
  return authentication;
}

function requireCookieMaxAge(value) {
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed)
    || parsed < 1
    || parsed > MAX_COOKIE_AGE_SECONDS
  ) {
    throw protocolError(
      "temporarily_unavailable",
      503,
      "The identity cookie lifetime is invalid."
    );
  }
  return parsed;
}

export function serializeScopedAuthCookies(
  scope,
  { sessionToken, csrfToken, maxAgeSeconds }
) {
  const definition = scopeDefinition(scope);
  const session = requireOpaqueToken(
    sessionToken,
    "temporarily_unavailable",
    503,
    "The identity session token is invalid."
  );
  const csrf = requireOpaqueToken(
    csrfToken,
    "temporarily_unavailable",
    503,
    "The identity CSRF token is invalid."
  );
  const maxAge = requireCookieMaxAge(maxAgeSeconds);

  return Object.freeze([
    `${definition.sessionCookie}=${session}; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`,
    `${definition.csrfCookie}=${csrf}; Secure; Path=/; SameSite=Strict; Max-Age=${maxAge}`
  ]);
}

export function serializeScopedAuthCookieClears(scope) {
  const definition = scopeDefinition(scope);
  return Object.freeze([
    `${definition.sessionCookie}=; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    `${definition.csrfCookie}=; Secure; Path=/; SameSite=Strict; Max-Age=0`
  ]);
}

export { COOKIE_SCOPES };
