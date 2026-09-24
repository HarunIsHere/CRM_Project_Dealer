import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CUSTOMER_AUTH_LOGOUT_ROUTE,
  CUSTOMER_AUTH_SESSION_ROUTE,
  CUSTOMER_EMAIL_AUTH_COMPLETE_ROUTE,
  CUSTOMER_EMAIL_AUTH_CONFIRM_ROUTE,
  CUSTOMER_EMAIL_AUTH_START_ROUTE
} from "../../src/identity/customer/email-auth-http.js";
import {
  CUSTOMER_EMAIL_CONTINUE_ROUTE,
  CUSTOMER_SHOP_ROUTE,
  handleCustomerEmailAuthPage
} from "../../src/identity/customer/email-auth-page.js";
import { handleIdentityApi } from "../../src/identity/service.js";

const ORIGIN = "https://crm.ayartuerk.me";

function environment(enabled) {
  return {
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_CUSTOMER_BOUNDARY: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_CUSTOMER_EMAIL: enabled ? "true" : "false",
    CRM_AUTH_CLIENT_READY_CUSTOMER_WEB: enabled ? "true" : "false",
    CRM_AUTH_ALLOWED_ORIGINS: ORIGIN
  };
}

function request(path, method = "POST") {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      "content-type": "application/json"
    },
    body: method === "POST" ? "{}" : undefined
  });
}

test("customer Web email routes are exact, gated, and implemented", async () => {
  for (const [path, method] of [
    [CUSTOMER_EMAIL_AUTH_START_ROUTE, "POST"],
    [CUSTOMER_EMAIL_AUTH_COMPLETE_ROUTE, "POST"],
    [CUSTOMER_EMAIL_AUTH_CONFIRM_ROUTE, "POST"],
    [CUSTOMER_AUTH_SESSION_ROUTE, "GET"],
    [CUSTOMER_AUTH_LOGOUT_ROUTE, "POST"]
  ]) {
    const disabled = await handleIdentityApi(request(path, method), environment(false));
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).error.code, "feature_disabled");

    const enabled = await handleIdentityApi(request(path, method), environment(true));
    assert.notEqual((await enabled.clone().json()).error?.code, "feature_not_ready");
  }
});

test("customer Web page supports code, same-browser link, and explicit cross-browser confirmation", async () => {
  assert.equal(CUSTOMER_SHOP_ROUTE, "/shop");
  assert.equal(CUSTOMER_EMAIL_CONTINUE_ROUTE, "/auth/customer/continue");
  for (const path of [CUSTOMER_SHOP_ROUTE, CUSTOMER_EMAIL_CONTINUE_ROUTE]) {
    const response = handleCustomerEmailAuthPage(request(path, "GET"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    const html = await response.text();
    assert.match(html, /Eight-digit code/);
    assert.match(html, /location\.hash/);
    assert.match(html, /history\.replaceState/);
    assert.match(html, /Continue sign-in\?/);
    assert.match(html, /credentials:"same-origin"/);
  }
});

test("customer Web auth issues canonical cookie sessions without merging accounts", async () => {
  const source = await readFile(
    new URL("../../src/identity/customer/email-auth-http.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /INSERT INTO auth_sessions/);
  assert.match(source, /'customer_verified'/);
  assert.match(source, /serializeScopedAuthCookies\("customer"/);
  assert.match(source, /readScopedSessionAuthentication\(request, "customer"\)/);
  assert.match(source, /__Host-crm_customer_auth_initiation/);
  assert.match(source, /confirmation_required: true/);
  assert.match(source, /status = 'verified'/);
  assert.doesNotMatch(source, /INSERT INTO customers/);
  assert.doesNotMatch(source, /UPDATE customers[\s\S]*auth_account_id/);
});
