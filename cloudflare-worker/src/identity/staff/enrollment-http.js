import { getIdentityCapabilities } from "../config.js";
import { identityError, identityResponse } from "../http.js";
import {
  IdentityProtocolError,
  createIdentityRequestContext
} from "../protocol.js";
import { resolveCanonicalSession } from "../repository.js";
import {
  assertAllowedBrowserMutationOrigin,
  readScopedCookieAuthentication,
  serializeScopedAuthCookieClears,
  verifyScopedCookieCsrf
} from "../transport.js";
import {
  STAFF_ENROLLMENT_LOGOUT_ROUTE,
  STAFF_ENROLLMENT_STATUS_ROUTE,
  StaffEnrollmentSessionError,
  getProtectedBootstrapEnrollmentStatus,
  resolveProtectedBootstrapEnrollmentForLogout,
  revokeProtectedBootstrapEnrollmentSession
} from "./enrollment-session.js";

function protocolError(code, status, message) {
  throw new IdentityProtocolError(code, status, message);
}

function assertBootstrapEnabled(env) {
  if (getIdentityCapabilities(env).staff_bootstrap_enrollment !== true) {
    protocolError(
      "feature_disabled",
      503,
      "This identity capability is not enabled."
    );
  }
}

function assertMethod(request, expected) {
  if (request.method !== expected) {
    protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
  }
}

function assertEmptyBody(request) {
  if (request.body !== null) {
    protocolError("invalid_request", 400, "The request body must be empty.");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && contentLength !== "0") {
    protocolError("invalid_request", 400, "The request body must be empty.");
  }
}

function unauthorized() {
  return new StaffEnrollmentSessionError("unauthorized", 401);
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
  if (error instanceof StaffEnrollmentSessionError) {
    return identityError(
      request,
      env,
      error.code,
      error.message,
      error.status,
      undefined,
      requestId
    );
  }
  return identityError(
    request,
    env,
    "temporarily_unavailable",
    "The identity service is temporarily unavailable.",
    503,
    undefined,
    requestId
  );
}

function withEnrollmentCookieClears(request, env, body, requestId) {
  const response = identityResponse(request, env, body, 200, requestId);
  const headers = new Headers(response.headers);
  for (const cookie of serializeScopedAuthCookieClears("staff_enrollment")) {
    headers.append("set-cookie", cookie);
  }
  return new Response(response.body, { status: response.status, headers });
}

export async function handleProtectedBootstrapEnrollmentStatus(
  request,
  env,
  { now = new Date() } = {}
) {
  const context = createIdentityRequestContext(request);
  try {
    assertMethod(request, "GET");
    assertBootstrapEnabled(env);
    const authentication = readScopedCookieAuthentication(
      request,
      "staff_enrollment"
    );
    const session = await resolveCanonicalSession(
      env,
      authentication.sessionToken,
      "staff",
      { now }
    );
    if (!session || session.scope !== "staff_enrollment") throw unauthorized();
    const status = await getProtectedBootstrapEnrollmentStatus(env, {
      session,
      now
    });
    return identityResponse(
      request,
      env,
      { ok: true, request_id: context.requestId, ...status },
      200,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleProtectedBootstrapEnrollmentLogout(
  request,
  env,
  { now = new Date() } = {}
) {
  const context = createIdentityRequestContext(request);
  try {
    assertMethod(request, "POST");
    assertBootstrapEnabled(env);
    assertAllowedBrowserMutationOrigin(request, env);
    assertEmptyBody(request);
    const authentication = readScopedCookieAuthentication(
      request,
      "staff_enrollment"
    );
    const session = await resolveProtectedBootstrapEnrollmentForLogout(env, {
      rawSessionToken: authentication.sessionToken
    });
    await verifyScopedCookieCsrf(
      request,
      env,
      session,
      "staff_enrollment"
    );
    await revokeProtectedBootstrapEnrollmentSession(env, { session, now });
    return withEnrollmentCookieClears(
      request,
      env,
      {
        ok: true,
        request_id: context.requestId,
        logged_out: true
      },
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export {
  STAFF_ENROLLMENT_LOGOUT_ROUTE,
  STAFF_ENROLLMENT_STATUS_ROUTE
};
