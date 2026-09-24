import assert from "node:assert/strict";
import test from "node:test";

import {
  handleIdentityApi,
  isIdentityPath
} from "../../src/identity/service.js";
import {
  BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
  BOOTSTRAP_INVITATION_PREVIEW_ROUTE
} from "../../src/identity/staff/invitation-http.js";
import {
  STAFF_ENROLLMENT_LOGOUT_ROUTE,
  STAFF_ENROLLMENT_STATUS_ROUTE
} from "../../src/identity/staff/enrollment-http.js";
import {
  STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE,
  STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE
} from "../../src/identity/staff/enrollment-recovery-code-sets.js";

const ORIGIN = "https://crm.ayartuerk.me";

function enabledEnvironment(overrides = {}) {
  return {
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_STAFF_WEBAUTHN_READY: "true",
    CRM_AUTH_CLIENT_READY_ADMIN_WEB: "true",
    CRM_AUTH_STAFF_RECONCILED: "false",
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "true",
    CRM_AUTH_ALLOWED_ORIGINS: ORIGIN,
    ...overrides
  };
}

function request(path, {
  method = "POST",
  body = undefined,
  origin = ORIGIN,
  headers = {}
} = {}) {
  const requestHeaders = new Headers(headers);
  if (origin !== null) requestHeaders.set("origin", origin);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  return new Request(`https://crm.ayartuerk.me${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test("exact bootstrap invitation routes stay behind their capability gate", async () => {
  const disabled = enabledEnvironment({
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "false",
    DB: new Proxy({}, {
      get() {
        throw new Error("disabled route touched persistence");
      }
    })
  });

  for (const path of [
    BOOTSTRAP_INVITATION_PREVIEW_ROUTE,
    BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
    STAFF_ENROLLMENT_STATUS_ROUTE,
    STAFF_ENROLLMENT_LOGOUT_ROUTE,
    STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE.replace(
      "{set_id}",
      "a".repeat(32)
    )
  ]) {
    const response = await handleIdentityApi(
      request(path, { body: { token: "short" } }),
      disabled
    );
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error.code, "feature_disabled");
    assert.equal(payload.error.details.feature, "staff_bootstrap_enrollment");
  }
});

test("service dispatches only exact recovery-code generation and acknowledgement paths", async () => {
  const env = enabledEnvironment();
  const setId = "a".repeat(32);
  const acknowledgementPath = STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE.replace(
    "{set_id}",
    setId
  );

  for (const path of [
    STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    acknowledgementPath
  ]) {
    const response = await handleIdentityApi(
      request(path, { body: {} }),
      env
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "unauthorized");
  }

  const wrongMethod = await handleIdentityApi(
    request(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, { method: "GET" }),
    env
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal((await wrongMethod.json()).error.code, "method_not_allowed");

  for (const path of [
    `${acknowledgementPath}/extra`,
    STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE.replace("{set_id}", "not-an-id"),
    `/api/v1/admin/auth/enrollment/recovery-code-sets/${setId.toUpperCase()}/acknowledge`
  ]) {
    const response = await handleIdentityApi(request(path, { body: {} }), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "feature_not_ready");
  }
});

test("service dispatches only exact enrollment status and logout paths", async () => {
  const env = enabledEnvironment();

  const status = await handleIdentityApi(
    request(STAFF_ENROLLMENT_STATUS_ROUTE, { method: "GET" }),
    env
  );
  assert.equal(status.status, 401);
  assert.equal((await status.json()).error.code, "unauthorized");

  const logout = await handleIdentityApi(
    request(STAFF_ENROLLMENT_LOGOUT_ROUTE, { method: "POST" }),
    env
  );
  assert.equal(logout.status, 401);
  assert.equal((await logout.json()).error.code, "unauthorized");

  for (const path of [
    `${STAFF_ENROLLMENT_STATUS_ROUTE}/unknown`,
    `${STAFF_ENROLLMENT_LOGOUT_ROUTE}/unknown`
  ]) {
    const response = await handleIdentityApi(request(path), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "feature_not_ready");
  }
});

test("service dispatches only exact preview and acceptance paths", async () => {
  const env = enabledEnvironment();

  const preview = await handleIdentityApi(
    request(`${BOOTSTRAP_INVITATION_PREVIEW_ROUTE}?source=email`, {
      body: { token: "short" }
    }),
    env
  );
  assert.equal(preview.status, 400);
  assert.equal(
    (await preview.json()).error.code,
    "invalid_or_expired_invitation"
  );

  const accept = await handleIdentityApi(
    request(BOOTSTRAP_INVITATION_ACCEPT_ROUTE, {
      body: {
        token: "x".repeat(43),
        session_transport: "cookie",
        client: { platform: "admin_web", app_version: "1.0.0" }
      }
    }),
    env
  );
  assert.equal(accept.status, 400);
  assert.equal((await accept.json()).error.code, "idempotency_key_required");

  const wrongMethod = await handleIdentityApi(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { method: "GET" }),
    env
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal((await wrongMethod.json()).error.code, "method_not_allowed");

  for (const path of [
    `${BOOTSTRAP_INVITATION_PREVIEW_ROUTE}/extra`,
    `${BOOTSTRAP_INVITATION_ACCEPT_ROUTE}/extra`,
    "/api/v1/admin/auth/invitations"
  ]) {
    const response = await handleIdentityApi(
      request(path, { body: { token: "short" } }),
      env
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "feature_not_ready");
  }
});

test("OPTIONS remains the shared preflight path before feature routing", async () => {
  const disabled = enabledEnvironment({
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "false"
  });
  for (const path of [
    BOOTSTRAP_INVITATION_PREVIEW_ROUTE,
    BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
    STAFF_ENROLLMENT_STATUS_ROUTE,
    STAFF_ENROLLMENT_LOGOUT_ROUTE,
    STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE.replace(
      "{set_id}",
      "a".repeat(32)
    ),
    "/api/v1/admin/auth/not-implemented"
  ]) {
    const response = await handleIdentityApi(
      request(path, {
        method: "OPTIONS",
        headers: { "access-control-request-method": "POST" }
      }),
      disabled
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
    assert.match(
      response.headers.get("access-control-allow-headers"),
      /Idempotency-Key/
    );
  }
});

test("paths outside the identity namespace remain unclaimed", async () => {
  assert.equal(isIdentityPath(BOOTSTRAP_INVITATION_PREVIEW_ROUTE), true);
  assert.equal(isIdentityPath("/api/v1/admin/products"), false);
  assert.equal(
    await handleIdentityApi(
      request("/api/v1/admin/products", { body: {} }),
      enabledEnvironment()
    ),
    null
  );
});
