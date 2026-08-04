import assert from "node:assert/strict";
import test from "node:test";

import {
  IdentityProtocolError,
  MAX_IDENTITY_JSON_BYTES,
  canonicalIdentityJson,
  createIdentityRequestContext,
  hashCanonicalIdentityRequest,
  readIdempotencyKey,
  readIdentityJson
} from "../../src/identity/protocol.js";
import {
  configuredIdentityOrigins,
  identityError,
  identityPreflight
} from "../../src/identity/http.js";

function jsonRequest(body, headers = {}) {
  return new Request("https://crm.ayartuerk.me/api/v1/admin/auth/recovery/start", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    },
    body
  });
}

test("strict JSON parsing accepts only an allowlisted object shape", async () => {
  const body = await readIdentityJson(
    jsonRequest(JSON.stringify({ identifier: "admin", locale: "en" })),
    {
      allowedFields: ["identifier", "locale"],
      requiredFields: ["identifier"]
    }
  );
  assert.deepEqual(body, { identifier: "admin", locale: "en" });

  await assert.rejects(
    () => readIdentityJson(
      jsonRequest(JSON.stringify({ identifier: "admin", typo: true })),
      { allowedFields: ["identifier"], requiredFields: ["identifier"] }
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_request"
      && error.status === 400
  );

  await assert.rejects(
    () => readIdentityJson(
      jsonRequest(JSON.stringify({ locale: "en" })),
      { allowedFields: ["identifier", "locale"], requiredFields: ["identifier"] }
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_request"
  );
});

test("JSON media type, syntax, UTF-8, and 64 KiB limit fail closed", async () => {
  await assert.rejects(
    () => readIdentityJson(
      jsonRequest("{}", { "content-type": "text/plain" }),
      { allowedFields: [] }
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "unsupported_media_type"
      && error.status === 415
  );

  await assert.rejects(
    () => readIdentityJson(jsonRequest("{"), { allowedFields: [] }),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_json"
  );

  const invalidUtf8 = new Uint8Array([0xc3, 0x28]);
  await assert.rejects(
    () => readIdentityJson(
      new Request("https://crm.ayartuerk.me/api/v1/customer/auth/guest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: invalidUtf8
      }),
      { allowedFields: [] }
    ),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_json"
  );

  const oversized = JSON.stringify({ value: "x".repeat(MAX_IDENTITY_JSON_BYTES) });
  await assert.rejects(
    () => readIdentityJson(jsonRequest(oversized), { allowedFields: ["value"] }),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_request"
  );
});

test("request IDs are server generated and idempotency keys use exact syntax", () => {
  const validParent = "parent-request_1234567890";
  const context = createIdentityRequestContext(new Request("https://example.com", {
    headers: { "x-request-id": validParent }
  }));
  assert.match(context.requestId, /^[0-9a-f]{32}$/);
  assert.equal(context.parentRequestId, validParent);

  const invalidContext = createIdentityRequestContext(new Request("https://example.com", {
    headers: { "x-request-id": "short" }
  }));
  assert.equal(invalidContext.parentRequestId, null);

  assert.equal(
    readIdempotencyKey(new Request("https://example.com", {
      headers: { "idempotency-key": "123e4567-e89b-12d3-a456-426614174000" }
    })),
    "123e4567-e89b-12d3-a456-426614174000"
  );
  assert.throws(
    () => readIdempotencyKey(new Request("https://example.com")),
    (error) => error instanceof IdentityProtocolError
      && error.code === "idempotency_key_required"
  );
  assert.throws(
    () => readIdempotencyKey(new Request("https://example.com", {
      headers: { "idempotency-key": "not allowed spaces" }
    })),
    (error) => error instanceof IdentityProtocolError
      && error.code === "invalid_request"
  );
});

test("canonical request hashes ignore object key order but bind method and route", async () => {
  assert.equal(
    canonicalIdentityJson({ z: [2, 1], a: { y: true, x: "v" } }),
    "{\"a\":{\"x\":\"v\",\"y\":true},\"z\":[2,1]}"
  );
  const first = await hashCanonicalIdentityRequest(
    "POST",
    "/api/v1/admin/auth/invitations/accept",
    { token: "opaque", client: { platform: "admin_web", app_version: "1" } }
  );
  const reordered = await hashCanonicalIdentityRequest(
    "POST",
    "/api/v1/admin/auth/invitations/accept",
    { client: { app_version: "1", platform: "admin_web" }, token: "opaque" }
  );
  const different = await hashCanonicalIdentityRequest(
    "POST",
    "/api/v1/admin/auth/recovery/start",
    { client: { app_version: "1", platform: "admin_web" }, token: "opaque" }
  );
  assert.equal(first, reordered);
  assert.notEqual(first, different);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test("identity responses and preflight expose the complete strict header contract", async () => {
  const request = new Request("https://crm.ayartuerk.me/api/v1/admin/auth/recovery/start", {
    method: "OPTIONS",
    headers: { origin: "https://crm.ayartuerk.me" }
  });
  const response = identityError(
    request,
    {},
    "invalid_request",
    "Invalid request.",
    400
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("pragma"), "no-cache");

  const preflight = identityPreflight(request, {});
  assert.equal(preflight.status, 204);
  const allowed = preflight.headers.get("access-control-allow-headers").toLowerCase();
  assert.match(allowed, /x-request-id/);
  assert.match(allowed, /accept-language/);

  assert.deepEqual(configuredIdentityOrigins({ CRM_AUTH_ALLOWED_ORIGINS: "*" }), []);
  const rejected = identityPreflight(new Request(request.url, {
    method: "OPTIONS",
    headers: { origin: "https://evil.example" }
  }), {});
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).error.code, "origin_not_allowed");
});
