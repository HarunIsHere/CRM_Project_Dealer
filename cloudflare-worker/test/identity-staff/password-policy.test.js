import assert from "node:assert/strict";
import test from "node:test";

import {
  STAFF_PASSWORD_POLICY,
  StaffPasswordPolicyError,
  validateStaffPasswordPolicy
} from "../../src/identity/staff/password-policy.js";

async function expectPolicyError(action, code, status) {
  await assert.rejects(action, (error) => {
    assert.equal(error instanceof StaffPasswordPolicyError, true);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test("staff password policy fixes the approved length and behavior", () => {
  assert.deepEqual(STAFF_PASSWORD_POLICY, {
    minimumCodePoints: 15,
    maximumCodePoints: 128,
    normalization: "none",
    compositionRules: false,
    compromisedOrCommonCheckRequired: true
  });
});

test("accepts spaces, long values, and Unicode without normalization", async () => {
  const password = "  cafe\u0301 password manager phrase  ";
  let checkedValue;
  const result = await validateStaffPasswordPolicy(password, {
    isKnownCompromisedOrCommon(value) {
      checkedValue = value;
      return false;
    }
  });

  assert.equal(result.accepted, true);
  assert.equal(result.codePointLength, Array.from(password).length);
  assert.equal(checkedValue, password);
});

test("counts Unicode code points rather than UTF-16 code units", async () => {
  const fourteen = "😀".repeat(14);
  await expectPolicyError(
    () => validateStaffPasswordPolicy(fourteen, {
      isKnownCompromisedOrCommon: () => false
    }),
    "weak_password",
    400
  );

  const fifteen = `${fourteen}😀`;
  const result = await validateStaffPasswordPolicy(fifteen, {
    isKnownCompromisedOrCommon: () => false
  });
  assert.equal(result.codePointLength, 15);
});

test("rejects values outside the 15 to 128 code-point boundary", async () => {
  for (const password of ["x".repeat(14), "x".repeat(129)]) {
    await expectPolicyError(
      () => validateStaffPasswordPolicy(password, {
        isKnownCompromisedOrCommon: () => false
      }),
      "weak_password",
      400
    );
  }
});

test("rejects ill-formed Unicode before UTF-8 encoding can collapse it", async () => {
  await expectPolicyError(
    () => validateStaffPasswordPolicy(`valid length text\ud800`, {
      isKnownCompromisedOrCommon: () => false
    }),
    "weak_password",
    400
  );
});

test("rejects a known compromised or common password", async () => {
  await expectPolicyError(
    () => validateStaffPasswordPolicy("correct horse battery staple", {
      isKnownCompromisedOrCommon: async () => true
    }),
    "weak_password",
    400
  );
});

test("fails closed when the compromised-password provider is unavailable", async () => {
  await expectPolicyError(
    () => validateStaffPasswordPolicy("a sufficiently long password"),
    "temporarily_unavailable",
    503
  );
  await expectPolicyError(
    () => validateStaffPasswordPolicy("a sufficiently long password", {
      isKnownCompromisedOrCommon: async () => {
        throw new Error("offline");
      }
    }),
    "temporarily_unavailable",
    503
  );
  await expectPolicyError(
    () => validateStaffPasswordPolicy("a sufficiently long password", {
      isKnownCompromisedOrCommon: async () => "no"
    }),
    "temporarily_unavailable",
    503
  );
});
