import assert from "node:assert/strict";
import test from "node:test";

import { hashOpaqueToken } from "../../src/identity/crypto.js";
import { IdentityProtocolError } from "../../src/identity/protocol.js";
import {
  assertAllowedBrowserMutationOrigin,
  readScopedBearerAuthentication,
  readScopedCookieAuthentication,
  readScopedSessionAuthentication,
  requestHasBrowserMetadata,
  serializeScopedAuthCookieClears,
  serializeScopedAuthCookies,
  validateRequestedSessionTransport,
  verifyScopedCookieCsrf,
  verifyScopedSessionMutation
} from "../../src/identity/transport.js";

const SESSION_TOKEN = "session_token_1234567890_ABCDEFGHIJKLMN";
const CSRF_TOKEN = "csrf_token_1234567890_ABCDEFGHIJKLMNO";

function browserRequest({ cookie = "", csrf = CSRF_TOKEN, origin = "https://crm.ayartuerk.me" } = {}) {
  const headers = {
    origin,
    "sec-fetch-site": "same-origin"
  };
  if (cookie) headers.cookie = cookie;
  if (csrf !== null) headers["x-csrf-token"] = csrf;
  return new Request("https://crm.ayartuerk.me/api/v1/admin/auth/enrollment/password", {
    method: "PUT",
    headers
  });
}

test("browser metadata forces a web platform and cookie transport before lookup", () => {
  const request = browserRequest();
  assert.equal(requestHasBrowserMetadata(request), true);
  assert.deepEqual(
    validateRequestedSessionTransport(request, {
      sessionTransport: "cookie",
      clientPlatform: "admin_web"
    }),
    { sessionTransport: "cookie", clientPlatform: "admin_web" }
  );

  assert.throws(
    () => validateRequestedSessionTransport(request, {
      sessionTransport: "bearer",
      clientPlatform: "admin_android",
      nativeBearerEnabled: true
    }),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_session_transport"
  );

  const nativeRequest = new Request("https://crm.ayartuerk.me/api/v1/admin/auth/password", {
    method: "POST"
  });
  assert.throws(
    () => validateRequestedSessionTransport(nativeRequest, {
      sessionTransport: "bearer",
      clientPlatform: "admin_android"
    }),
    (error) => error instanceof IdentityProtocolError
      && error.code === "capability_disabled"
      && error.status === 503
  );
});

test("web cookie session issuance always requires an exact allowed origin", () => {
  const transport = {
    sessionTransport: "cookie",
    clientPlatform: "admin_web"
  };
  assert.deepEqual(
    validateRequestedSessionTransport(browserRequest(), transport),
    { sessionTransport: "cookie", clientPlatform: "admin_web" }
  );
  assert.throws(
    () => validateRequestedSessionTransport(
      browserRequest({ origin: "https://evil.example" }),
      transport
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "forbidden"
      && error.status === 403
  );
  assert.throws(
    () => validateRequestedSessionTransport(
      new Request("https://crm.ayartuerk.me/api/v1/admin/auth/password", {
        method: "POST"
      }),
      transport
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "forbidden"
      && error.status === 403
  );
});

test("browser mutation origin is exact and wildcard configuration fails closed", () => {
  assert.equal(
    assertAllowedBrowserMutationOrigin(browserRequest(), {}),
    "https://crm.ayartuerk.me"
  );
  assert.throws(
    () => assertAllowedBrowserMutationOrigin(
      browserRequest({ origin: "https://evil.example" }),
      {}
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "forbidden"
  );
  assert.throws(
    () => assertAllowedBrowserMutationOrigin(
      browserRequest(),
      { CRM_AUTH_ALLOWED_ORIGINS: "*" }
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "forbidden"
  );
});

test("scope-specific cookie parsing ignores ambient scopes and rejects duplicates", () => {
  const request = browserRequest({
    cookie: [
      `__Host-crm_staff_session=${SESSION_TOKEN}`,
      `__Host-crm_staff_csrf=${CSRF_TOKEN}`,
      "__Host-crm_staff_recovery=ambient_recovery_token_123456789012345"
    ].join("; ")
  });
  const authentication = readScopedCookieAuthentication(request, "staff");
  assert.equal(authentication.sessionToken, SESSION_TOKEN);
  assert.equal(authentication.csrfCookieToken, CSRF_TOKEN);

  assert.throws(
    () => readScopedCookieAuthentication(browserRequest({
      cookie: [
        `__Host-crm_staff_session=${SESSION_TOKEN}`,
        `__Host-crm_staff_session=${SESSION_TOKEN}`
      ].join("; ")
    }), "staff"),
    (error) => error instanceof IdentityProtocolError
      && error.code === "unauthorized"
  );
});

test("CSRF requires exact scope, header-cookie equality, session hash, and origin", async () => {
  const env = {
    CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_SESSION_HMAC_KEY_V1: "r".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY_V2: "s".repeat(64)
  };
  const request = browserRequest({
    cookie: [
      `__Host-crm_staff_enrollment=${SESSION_TOKEN}`,
      `__Host-crm_staff_enrollment_csrf=${CSRF_TOKEN}`
    ].join("; ")
  });
  const session = {
    realm: "staff",
    scope: "staff_enrollment",
    session_transport: "cookie",
    token_hash_version: 1,
    csrf_token_hash: await hashOpaqueToken(CSRF_TOKEN, env.CRM_AUTH_SESSION_HMAC_KEY_V1)
  };

  const verified = await verifyScopedCookieCsrf(
    request,
    env,
    session,
    "staff_enrollment"
  );
  assert.equal(verified.sessionToken, SESSION_TOKEN);

  await assert.rejects(
    () => verifyScopedCookieCsrf(
      browserRequest({
        cookie: [
          `__Host-crm_staff_enrollment=${SESSION_TOKEN}`,
          `__Host-crm_staff_enrollment_csrf=${CSRF_TOKEN}`
        ].join("; "),
        csrf: "different_csrf_token_1234567890_ABCDEFG"
      }),
      env,
      session,
      "staff_enrollment"
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "forbidden"
  );

  await assert.rejects(
    () => verifyScopedCookieCsrf(request, env, session, "staff_recovery"),
    (error) => error instanceof IdentityProtocolError
      && error.code === "unauthorized"
  );

  await assert.rejects(
    () => verifyScopedCookieCsrf(
      request,
      env,
      { ...session, token_hash_version: 3 },
      "staff_enrollment"
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "temporarily_unavailable"
      && error.status === 503
  );
});

test("issued and cleared cookies use the contract attributes without Domain", () => {
  const issued = serializeScopedAuthCookies("staff_recovery", {
    sessionToken: SESSION_TOKEN,
    csrfToken: CSRF_TOKEN,
    maxAgeSeconds: 900
  });
  assert.deepEqual(issued, [
    `__Host-crm_staff_recovery=${SESSION_TOKEN}; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=900`,
    `__Host-crm_staff_recovery_csrf=${CSRF_TOKEN}; Secure; Path=/; SameSite=Strict; Max-Age=900`
  ]);
  assert.equal(issued.some((value) => /Domain=/i.test(value)), false);

  assert.deepEqual(serializeScopedAuthCookieClears("staff_recovery"), [
    "__Host-crm_staff_recovery=; Secure; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
    "__Host-crm_staff_recovery_csrf=; Secure; Path=/; SameSite=Strict; Max-Age=0"
  ]);
});


test("native recovery bearer authentication is accepted securely", async () => {
  const token = "n".repeat(48);
  const request = new Request(
    "https://crm.ayartuerk.me/api/v1/admin/auth/recovery/password",
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );

  const direct = readScopedBearerAuthentication(
    request,
    "staff_recovery"
  );
  assert.equal(direct.sessionToken, token);
  assert.equal(direct.sessionTransport, "bearer");

  const selected = readScopedSessionAuthentication(
    request,
    "staff_recovery"
  );
  assert.equal(selected.sessionToken, token);
  assert.equal(selected.sessionTransport, "bearer");

  const verified = await verifyScopedSessionMutation(
    request,
    {},
    {
      realm: "staff",
      scope: "staff_recovery_email",
      session_transport: "bearer",
      client_platform: "admin_android"
    },
    "staff_recovery",
    selected
  );

  assert.equal(verified.sessionToken, token);
});

test("recovery bearer rejects browser requests and incompatible sessions", async () => {
  const token = "b".repeat(48);
  const browserBearerRequest = new Request(
    "https://crm.ayartuerk.me/api/v1/admin/auth/recovery/password",
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        origin: "https://crm.ayartuerk.me",
        "sec-fetch-site": "same-origin"
      }
    }
  );

  assert.throws(
    () => readScopedBearerAuthentication(
      browserBearerRequest,
      "staff_recovery"
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_session_transport"
      && error.status === 400
  );

  const nativeRequest = new Request(
    "https://crm.ayartuerk.me/api/v1/admin/auth/recovery/password",
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`
      }
    }
  );
  const authentication = readScopedSessionAuthentication(
    nativeRequest,
    "staff_recovery"
  );

  await assert.rejects(
    verifyScopedSessionMutation(
      nativeRequest,
      {},
      {
        realm: "staff",
        scope: "staff_recovery_email",
        session_transport: "cookie",
        client_platform: "admin_android"
      },
      "staff_recovery",
      authentication
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "unauthorized"
      && error.status === 401
  );

  await assert.rejects(
    verifyScopedSessionMutation(
      nativeRequest,
      {},
      {
        realm: "staff",
        scope: "staff_recovery_email",
        session_transport: "bearer",
        client_platform: "admin_web"
      },
      "staff_recovery",
      authentication
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "unauthorized"
      && error.status === 401
  );
});

test("scoped session authentication preserves the cookie CSRF path", () => {
  const request = browserRequest({
    cookie: [
      `__Host-crm_staff_recovery=${SESSION_TOKEN}`,
      `__Host-crm_staff_recovery_csrf=${CSRF_TOKEN}`
    ].join("; ")
  });

  const authentication = readScopedSessionAuthentication(
    request,
    "staff_recovery"
  );

  assert.equal(authentication.sessionToken, SESSION_TOKEN);
  assert.equal(authentication.csrfCookieToken, CSRF_TOKEN);
  assert.equal(authentication.csrfHeaderToken, CSRF_TOKEN);
  assert.equal(authentication.sessionTransport, "cookie");
});
