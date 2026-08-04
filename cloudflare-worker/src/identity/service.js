import {
  getIdentityCapabilities,
  isIdentityFeatureEnabled
} from "./config.js";
import {
  identityError,
  identityPreflight
} from "./http.js";
import {
  BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
  BOOTSTRAP_INVITATION_PREVIEW_ROUTE,
  handleProtectedBootstrapInvitationAccept,
  handleProtectedBootstrapInvitationPreview
} from "./staff/invitation-http.js";
import {
  STAFF_ENROLLMENT_LOGOUT_ROUTE,
  STAFF_ENROLLMENT_STATUS_ROUTE,
  handleProtectedBootstrapEnrollmentLogout,
  handleProtectedBootstrapEnrollmentStatus
} from "./staff/enrollment-http.js";
import {
  STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE,
  STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE
} from "./staff/enrollment-recovery-code-sets.js";
import {
  handleStaffEnrollmentRecoveryCodeSetAcknowledgement,
  handleStaffEnrollmentRecoveryCodeSetGeneration
} from "./staff/enrollment-recovery-code-http.js";

const IDENTITY_PATH = /^\/api\/v1\/(customer|admin)\/(auth|security)(?:\/|$)/;
const STAFF_ENROLLMENT_RECOVERY_CODE_ACK_PATH =
  /^\/api\/v1\/admin\/auth\/enrollment\/recovery-code-sets\/([0-9a-f]{32})\/acknowledge$/;
const IMPLEMENTED_ROUTES = new Map([
  [
    BOOTSTRAP_INVITATION_PREVIEW_ROUTE,
    Object.freeze({
      feature: "staff_bootstrap_enrollment",
      handler: handleProtectedBootstrapInvitationPreview
    })
  ],
  [
    BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
    Object.freeze({
      feature: "staff_bootstrap_enrollment",
      handler: handleProtectedBootstrapInvitationAccept
    })
  ],
  [
    STAFF_ENROLLMENT_STATUS_ROUTE,
    Object.freeze({
      feature: "staff_bootstrap_enrollment",
      handler: handleProtectedBootstrapEnrollmentStatus
    })
  ],
  [
    STAFF_ENROLLMENT_LOGOUT_ROUTE,
    Object.freeze({
      feature: "staff_bootstrap_enrollment",
      handler: handleProtectedBootstrapEnrollmentLogout
    })
  ],
  [
    STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    Object.freeze({
      feature: "staff_bootstrap_enrollment",
      handler: handleStaffEnrollmentRecoveryCodeSetGeneration
    })
  ]
]);

function implementedRouteForPath(pathname) {
  const exact = IMPLEMENTED_ROUTES.get(pathname);
  if (exact) return exact;
  const acknowledgement = pathname.match(
    STAFF_ENROLLMENT_RECOVERY_CODE_ACK_PATH
  );
  if (!acknowledgement) return null;
  return Object.freeze({
    feature: "staff_bootstrap_enrollment",
    handler(request, env) {
      return handleStaffEnrollmentRecoveryCodeSetAcknowledgement(
        request,
        env,
        { setId: acknowledgement[1] }
      );
    },
    routeTemplate: STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE
  });
}

function featureForPath(pathname) {
  const implemented = implementedRouteForPath(pathname);
  if (implemented) return implemented.feature;

  if (pathname.startsWith("/api/v1/customer/")) {
    if (pathname.includes("/merge")) return "customer_merge";
    if (pathname.includes("/telegram")) {
      return "telegram_init_data_verification";
    }
    if (pathname.includes("/passkey")) return "customer_passkeys";
    if (
      pathname.includes("/email")
      || pathname.includes("/recovery")
    ) {
      return "customer_email";
    }
    return "customer_guest";
  }

  if (pathname.includes("/auth/enrollment")) {
    return "staff_bootstrap_enrollment";
  }
  if (pathname.includes("/recovery")) return "staff_recovery";
  if (pathname.includes("/passkey")) return "staff_passkeys";
  return "staff_enrollment";
}

export function isIdentityPath(pathname) {
  return IDENTITY_PATH.test(pathname);
}

export async function handleIdentityApi(request, env) {
  const url = new URL(request.url);
  if (!isIdentityPath(url.pathname)) return null;

  if (request.method === "OPTIONS") {
    return identityPreflight(request, env);
  }

  const feature = featureForPath(url.pathname);
  if (!isIdentityFeatureEnabled(env, feature)) {
    return identityError(
      request,
      env,
      "feature_disabled",
      "This identity capability is not enabled.",
      503,
      { feature }
    );
  }

  const implemented = implementedRouteForPath(url.pathname);
  if (implemented) {
    return implemented.handler(request, env);
  }

  // A feature flag may never turn an unfinished implementation on. The staged
  // foundation therefore fails closed until the feature-specific amendment
  // replaces this guard with its reviewed handler.
  return identityError(
    request,
    env,
    "feature_not_ready",
    "This identity capability has not completed its rollout gates.",
    503,
    { feature }
  );
}

export { getIdentityCapabilities };
