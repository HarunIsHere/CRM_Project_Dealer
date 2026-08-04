import { createOpaqueId } from "./crypto.js";

const DEFAULT_ALLOWED_ORIGINS = ["https://crm.ayartuerk.me"];
const ALLOWED_METHODS = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-CSRF-Token",
  "Idempotency-Key",
  "X-Request-ID",
  "Accept-Language"
].join(", ");

function validConfiguredOrigin(value) {
  if (!value || value === "null" || value.includes("*")) return false;
  try {
    const parsed = new URL(value);
    const localHttp = (
      parsed.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    );
    return (
      (parsed.protocol === "https:" || localHttp)
      && parsed.origin === value
      && parsed.username === ""
      && parsed.password === ""
      && parsed.pathname === "/"
      && parsed.search === ""
      && parsed.hash === ""
    );
  } catch {
    return false;
  }
}

export function configuredIdentityOrigins(env) {
  const raw = String(env?.CRM_AUTH_ALLOWED_ORIGINS || "").trim();
  const values = raw
    ? raw.split(",").map((value) => value.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  if (values.length === 0 || values.some((value) => !validConfiguredOrigin(value))) {
    return [];
  }
  return [...new Set(values)];
}

export function isIdentityOriginAllowed(request, env) {
  const origin = request?.headers?.get("origin");
  return Boolean(origin && configuredIdentityOrigins(env).includes(origin));
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  if (!origin || !isIdentityOriginAllowed(request, env)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-headers": ALLOWED_HEADERS,
    "access-control-max-age": "600"
  };
}

export function identityResponse(request, env, body, status, requestId) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-request-id": requestId,
      "vary": "Origin",
      ...corsHeaders(request, env)
    }
  });
}

export function identityError(
  request,
  env,
  code,
  message,
  status = 400,
  details = undefined,
  requestId = createOpaqueId()
) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return identityResponse(
    request,
    env,
    { ok: false, request_id: requestId, error },
    status,
    requestId
  );
}

export function identityPreflight(request, env) {
  const requestId = createOpaqueId();
  const origin = request.headers.get("origin");
  if (!origin || !isIdentityOriginAllowed(request, env)) {
    return identityError(
      request,
      env,
      "origin_not_allowed",
      "The request origin is not allowed.",
      403,
      undefined,
      requestId
    );
  }
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId,
      "vary": "Origin",
      ...corsHeaders(request, env)
    }
  });
}
