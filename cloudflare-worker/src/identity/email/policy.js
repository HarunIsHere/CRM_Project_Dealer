const CHALLENGE = "challenge";
const NOTIFICATION = "notification";

function policy(
  realm,
  kind,
  challengePurpose,
  landingPath,
  destinationStatuses
) {
  return Object.freeze({
    realm,
    kind,
    challengePurpose,
    landingPath,
    destinationStatuses: Object.freeze([...destinationStatuses])
  });
}

export const IDENTITY_EMAIL_TEMPLATE_POLICIES = Object.freeze({
  "auth.staff.invitation.v1": policy(
    "staff",
    CHALLENGE,
    "staff_invitation",
    "/auth/admin/invitation",
    ["pending"]
  ),
  "auth.staff.enrollment.verify_email.v1": policy(
    "staff",
    CHALLENGE,
    "email_enrollment",
    "/auth/admin/enrollment/email",
    ["pending"]
  ),
  "auth.staff.enrollment.resume.v1": policy(
    "staff",
    CHALLENGE,
    "staff_enrollment_resume",
    "/auth/admin/enrollment/resume",
    ["verified"]
  ),
  "auth.staff.recovery.start.v1": policy(
    "staff",
    CHALLENGE,
    "staff_recovery",
    "/auth/admin/recovery",
    ["verified"]
  ),
  "auth.customer.email_enrollment.verify.v1": policy(
    "customer",
    CHALLENGE,
    "email_enrollment",
    "/auth/customer/email/enrollment",
    ["pending"]
  ),
  "auth.customer.sign_in.v1": policy(
    "customer",
    CHALLENGE,
    "customer_login",
    "/auth/customer/continue",
    ["verified"]
  ),
  "auth.customer.recovery.start.v1": policy(
    "customer",
    CHALLENGE,
    "customer_recovery",
    "/auth/customer/continue",
    ["verified"]
  ),
  "auth.customer.step_up.email.v1": policy(
    "customer",
    CHALLENGE,
    "customer_email_step_up",
    null,
    ["verified"]
  ),
  "auth.staff.email_change.verify_new.v1": policy(
    "staff",
    CHALLENGE,
    "email_change_new",
    "/auth/admin/email-change/new",
    ["pending"]
  ),
  "auth.staff.email_change.review_old.v1": policy(
    "staff",
    CHALLENGE,
    "email_change_old_approval",
    "/auth/admin/email-change/old",
    ["verified"]
  ),
  "auth.customer.email_change.verify_new.v1": policy(
    "customer",
    CHALLENGE,
    "email_change_new",
    "/auth/customer/email-change/new",
    ["pending"]
  ),
  "auth.customer.email_change.review_old.v1": policy(
    "customer",
    CHALLENGE,
    "email_change_old_approval",
    "/auth/customer/email-change/old",
    ["verified"]
  ),
  "auth.staff.recovery.completed.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.customer.recovery.completed.v1": policy(
    "customer", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.staff.email_change.completed_old.v1": policy(
    "staff", NOTIFICATION, null, null, ["replaced"]
  ),
  "auth.staff.email_change.completed_new.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.customer.email_change.completed_old.v1": policy(
    "customer", NOTIFICATION, null, null, ["replaced"]
  ),
  "auth.customer.email_change.completed_new.v1": policy(
    "customer", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.staff.email_change.cancelled_new.v1": policy(
    "staff", NOTIFICATION, null, null, ["pending", "revoked"]
  ),
  "auth.customer.email_change.cancelled_new.v1": policy(
    "customer", NOTIFICATION, null, null, ["pending", "revoked"]
  ),
  "auth.staff.password.changed.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.staff.passkey.removed.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.staff.recovery_codes.changed.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.staff.break_glass.started.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  ),
  "auth.staff.break_glass.completed.v1": policy(
    "staff", NOTIFICATION, null, null, ["verified"]
  )
});

export function getIdentityEmailTemplatePolicy(templateKey) {
  return IDENTITY_EMAIL_TEMPLATE_POLICIES[String(templateKey ?? "")] ?? null;
}

export function isIdentityEmailDestinationStatusAllowed(templateKey, status) {
  const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);
  return Boolean(
    templatePolicy
    && templatePolicy.destinationStatuses.includes(String(status ?? ""))
  );
}

export function isIdentityEmailLandingPathAllowed(templateKey, pathname) {
  const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);
  return Boolean(
    templatePolicy
    && templatePolicy.landingPath !== null
    && templatePolicy.landingPath === String(pathname ?? "")
  );
}
