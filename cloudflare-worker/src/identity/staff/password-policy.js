const MIN_PASSWORD_CODE_POINTS = 15;
const MAX_PASSWORD_CODE_POINTS = 128;

export class StaffPasswordPolicyError extends Error {
  constructor(code = "weak_password", status = 400) {
    super(
      code === "weak_password"
        ? "The password does not meet the staff password policy."
        : "Staff password policy validation is temporarily unavailable."
    );
    this.name = "StaffPasswordPolicyError";
    this.code = code;
    this.status = status;
  }
}

function invalidUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export async function validateStaffPasswordPolicy(
  password,
  { isKnownCompromisedOrCommon } = {}
) {
  if (typeof password !== "string" || invalidUnicode(password)) {
    throw new StaffPasswordPolicyError();
  }

  const codePointLength = Array.from(password).length;
  if (
    codePointLength < MIN_PASSWORD_CODE_POINTS
    || codePointLength > MAX_PASSWORD_CODE_POINTS
  ) {
    throw new StaffPasswordPolicyError();
  }

  if (typeof isKnownCompromisedOrCommon !== "function") {
    throw new StaffPasswordPolicyError("temporarily_unavailable", 503);
  }

  let rejected;
  try {
    rejected = await isKnownCompromisedOrCommon(password);
  } catch {
    throw new StaffPasswordPolicyError("temporarily_unavailable", 503);
  }
  if (typeof rejected !== "boolean") {
    throw new StaffPasswordPolicyError("temporarily_unavailable", 503);
  }
  if (rejected) throw new StaffPasswordPolicyError();

  return Object.freeze({
    accepted: true,
    codePointLength
  });
}

export const STAFF_PASSWORD_POLICY = Object.freeze({
  minimumCodePoints: MIN_PASSWORD_CODE_POINTS,
  maximumCodePoints: MAX_PASSWORD_CODE_POINTS,
  normalization: "none",
  compositionRules: false,
  compromisedOrCommonCheckRequired: true
});
