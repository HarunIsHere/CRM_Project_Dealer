import assert from "node:assert/strict";
import test from "node:test";

import {
  IDENTITY_EMAIL_TEMPLATE_POLICIES,
  getIdentityEmailTemplatePolicy,
  isIdentityEmailDestinationStatusAllowed,
  isIdentityEmailLandingPathAllowed
} from "../../src/identity/email/policy.js";
import { listIdentityEmailTemplateKeys } from "../../src/identity/email/templates.js";

const CHALLENGE_MAPPINGS = Object.freeze({
  "auth.customer.sign_in.v1": [
    "customer", "customer_login", "/auth/customer/continue", ["verified"]
  ],
  "auth.customer.recovery.start.v1": [
    "customer", "customer_recovery", "/auth/customer/continue", ["verified"]
  ],
  "auth.customer.email_enrollment.verify.v1": [
    "customer", "email_enrollment", "/auth/customer/email/enrollment", ["pending"]
  ],
  "auth.customer.email_change.verify_new.v1": [
    "customer", "email_change_new", "/auth/customer/email-change/new", ["pending"]
  ],
  "auth.customer.email_change.review_old.v1": [
    "customer", "email_change_old_approval", "/auth/customer/email-change/old", ["verified"]
  ],
  "auth.customer.step_up.email.v1": [
    "customer", "customer_email_step_up", null, ["verified"]
  ],
  "auth.staff.invitation.v1": [
    "staff", "staff_invitation", "/auth/admin/invitation", ["pending"]
  ],
  "auth.staff.enrollment.verify_email.v1": [
    "staff", "email_enrollment", "/auth/admin/enrollment/email", ["pending"]
  ],
  "auth.staff.enrollment.resume.v1": [
    "staff", "staff_enrollment_resume", "/auth/admin/enrollment/resume", ["verified"]
  ],
  "auth.staff.recovery.start.v1": [
    "staff", "staff_recovery", "/auth/admin/recovery", ["verified"]
  ],
  "auth.staff.email_change.verify_new.v1": [
    "staff", "email_change_new", "/auth/admin/email-change/new", ["pending"]
  ],
  "auth.staff.email_change.review_old.v1": [
    "staff", "email_change_old_approval", "/auth/admin/email-change/old", ["verified"]
  ]
});

test("policy covers exactly the 25 canonical identity email templates", () => {
  const policyKeys = Object.keys(IDENTITY_EMAIL_TEMPLATE_POLICIES).sort();
  assert.equal(policyKeys.length, 25);
  assert.deepEqual(policyKeys, listIdentityEmailTemplateKeys().sort());
});

test("challenge templates have fixed realm, purpose, landing path, and destination state", () => {
  assert.equal(Object.keys(CHALLENGE_MAPPINGS).length, 12);
  for (const [templateKey, expected] of Object.entries(CHALLENGE_MAPPINGS)) {
    const [realm, challengePurpose, landingPath, destinationStatuses] = expected;
    const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);
    assert.deepEqual(templatePolicy, {
      realm,
      kind: "challenge",
      challengePurpose,
      landingPath,
      destinationStatuses
    });
    if (landingPath) {
      assert.equal(isIdentityEmailLandingPathAllowed(templateKey, landingPath), true);
      assert.equal(isIdentityEmailLandingPathAllowed(templateKey, `${landingPath}/`), false);
    }
  }
});

test("email-change notification destination states follow transition state", () => {
  const cases = [
    ["auth.staff.email_change.completed_old.v1", ["replaced"]],
    ["auth.customer.email_change.completed_old.v1", ["replaced"]],
    ["auth.staff.email_change.completed_new.v1", ["verified"]],
    ["auth.customer.email_change.completed_new.v1", ["verified"]],
    ["auth.staff.email_change.cancelled_new.v1", ["pending", "revoked"]],
    ["auth.customer.email_change.cancelled_new.v1", ["pending", "revoked"]]
  ];

  for (const [templateKey, allowed] of cases) {
    const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);
    assert.equal(templatePolicy.kind, "notification");
    assert.deepEqual(templatePolicy.destinationStatuses, allowed);
    for (const status of ["pending", "verified", "replaced", "revoked"] ) {
      assert.equal(
        isIdentityEmailDestinationStatusAllowed(templateKey, status),
        allowed.includes(status),
        `${templateKey}/${status}`
      );
    }
  }
});

test("all other notifications require a verified destination", () => {
  for (const [templateKey, templatePolicy] of Object.entries(
    IDENTITY_EMAIL_TEMPLATE_POLICIES
  )) {
    if (templatePolicy.kind !== "notification" || templateKey.includes("email_change")) {
      continue;
    }
    assert.deepEqual(templatePolicy.destinationStatuses, ["verified"]);
  }
});
