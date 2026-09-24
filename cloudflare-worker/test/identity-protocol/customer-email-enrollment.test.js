import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CUSTOMER_EMAIL_ENROLLMENT_ROUTE,
  CUSTOMER_EMAIL_ENROLLMENT_START_ROUTE,
  CUSTOMER_EMAIL_ENROLLMENT_VERIFY_ROUTE
} from "../../src/identity/customer/email-enrollment-http.js";
import {
  CUSTOMER_EMAIL_ENROLLMENT_LANDING_ROUTE,
  handleCustomerEmailEnrollmentLanding
} from "../../src/identity/customer/email-enrollment-page.js";
import { handleIdentityApi } from "../../src/identity/service.js";

const ORIGIN = "https://crm.ayartuerk.me";

function environment(customerEmail) {
  return {
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_CUSTOMER_BOUNDARY: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_CUSTOMER_EMAIL: customerEmail ? "true" : "false",
    CRM_AUTH_ALLOWED_ORIGINS: `${ORIGIN},https://crm-delivery-mini-app.pages.dev`
  };
}

function request(path, method = "GET") {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN }
  });
}

test("customer email enrollment routes remain gated and require the customer session", async () => {
  for (const [path, method] of [
    [CUSTOMER_EMAIL_ENROLLMENT_ROUTE, "GET"],
    [CUSTOMER_EMAIL_ENROLLMENT_START_ROUTE, "POST"],
    [CUSTOMER_EMAIL_ENROLLMENT_VERIFY_ROUTE, "POST"]
  ]) {
    const disabled = await handleIdentityApi(request(path, method), environment(false));
    assert.equal(disabled.status, 503);
    assert.equal((await disabled.json()).error.code, "feature_disabled");

    const enabled = await handleIdentityApi(request(path, method), environment(true));
    assert.ok([400, 401].includes(enabled.status));
    assert.notEqual((await enabled.json()).error.code, "feature_not_ready");
  }
});

test("magic-link landing removes the fragment and returns the user to the initiating session", async () => {
  const response = handleCustomerEmailEnrollmentLanding(
    request(CUSTOMER_EMAIL_ENROLLMENT_LANDING_ROUTE)
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /location\.hash/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /enter the eight-digit code/);
});

test("Mini App exposes email start and code verification without storing bearer state", async () => {
  const [api, main, handler] = await Promise.all([
    readFile(new URL("../../../telegram/mini-app/src/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../telegram/mini-app/src/main.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/identity/customer/email-enrollment-http.js", import.meta.url), "utf8")
  ]);
  assert.match(api, /customer\/security\/email\/enrollment/);
  assert.match(api, /customer\/security\/email\/enrollment\/complete/);
  assert.match(main, /eight-digit code/);
  assert.doesNotMatch(main, /localStorage/);
  assert.match(handler, /initiating_session_id/);
  assert.match(handler, /auth_account_id <> \?/);
  assert.match(handler, /email_in_use/);
});
