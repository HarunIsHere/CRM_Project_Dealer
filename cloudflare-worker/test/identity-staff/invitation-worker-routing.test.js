import assert from "node:assert/strict";
import test from "node:test";

import worker from "../../src/index.js";
import { ADMIN_INVITATION_LANDING_ROUTE } from "../../src/identity/staff/invitation-page.js";

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
    ...overrides
  };
}

function request(path, { method = "GET", headers = {} } = {}) {
  return new Request(`${ORIGIN}${path}`, { method, headers });
}

async function fetchWorker(path, options = {}, env = enabledEnvironment()) {
  return worker.fetch(request(path, options), env, {
    waitUntil() {
      assert.fail("invitation landing routing must not schedule background work");
    }
  });
}

test("the exact landing is reachable before legacy Admin auth only while enabled", async () => {
  const response = await fetchWorker(ADMIN_INVITATION_LANDING_ROUTE, {
    headers: { "accept-language": "tr-TR,tr;q=0.9" }
  });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.match(response.headers.get("content-security-policy"), /script-src 'nonce-/);
  assert.match(html, /<html lang="tr" dir="ltr">/);
  assert.match(html, /Personel hesabınızı kurun/);
  assert.doesNotMatch(html, /Admin Login/);
});

test("a disabled landing falls through to the same generic Worker 404", async () => {
  const disabled = enabledEnvironment({
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "false",
    DB: new Proxy({}, {
      get() {
        assert.fail("disabled invitation landing touched persistence");
      }
    })
  });

  for (const [path, method] of [
    [ADMIN_INVITATION_LANDING_ROUTE, "GET"],
    [`${ADMIN_INVITATION_LANDING_ROUTE}?token=must-not-be-reflected`, "GET"],
    [ADMIN_INVITATION_LANDING_ROUTE, "POST"]
  ]) {
    const response = await fetchWorker(path, { method }, disabled);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.deepEqual(await response.json(), {
      error: "Not found",
      path: ADMIN_INVITATION_LANDING_ROUTE
    });
  }
});

test("enabled query and method failures retain the landing hardening", async () => {
  const queryResponse = await fetchWorker(
    `${ADMIN_INVITATION_LANDING_ROUTE}?token=must-not-be-reflected`
  );
  assert.equal(queryResponse.status, 404);
  assert.equal(queryResponse.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(queryResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(queryResponse.headers.get("referrer-policy"), "no-referrer");
  assert.equal(queryResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(queryResponse.headers.get("x-frame-options"), "DENY");
  assert.doesNotMatch(await queryResponse.text(), /must-not-be-reflected/);

  const methodResponse = await fetchWorker(ADMIN_INVITATION_LANDING_ROUTE, {
    method: "POST"
  });
  assert.equal(methodResponse.status, 405);
  assert.equal(methodResponse.headers.get("allow"), "GET");
  assert.equal(methodResponse.headers.get("cache-control"), "no-store, max-age=0");
});

test("nearby and legacy Admin routes remain outside the landing handler", async () => {
  for (const path of [
    `${ADMIN_INVITATION_LANDING_ROUTE}/`,
    `${ADMIN_INVITATION_LANDING_ROUTE}/extra`,
    "/auth/admin/enrollment"
  ]) {
    const response = await fetchWorker(path);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  }

  const legacyLogin = await fetchWorker("/admin/login");
  const legacyHtml = await legacyLogin.text();
  assert.equal(legacyLogin.status, 200);
  assert.match(legacyHtml, /<title>Admin Login<\/title>/);
  assert.match(legacyHtml, /action="\/admin\/login"/);
});
