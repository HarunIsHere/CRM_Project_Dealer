import { constantTimeEqual, hashOpaqueToken } from "./crypto.js";

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const FORMATTED_CODE = /^(?:[0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/;
const COMPACT_CODE = /^[0-9A-HJKMNP-TV-Z]{24}$/;
const ID_32 = /^[0-9a-f]{32}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const MAX_RETAINED_KEY_VERSIONS = 5;
const textEncoder = new TextEncoder();

export class RecoveryCodeError extends Error {
  constructor(code) {
    super("Recovery-code verification is not configured.");
    this.name = "RecoveryCodeError";
    this.code = code;
  }
}

function fail(code) {
  throw new RecoveryCodeError(code);
}

function positiveInteger(value, code, maximum = Number.MAX_SAFE_INTEGER) {
  const source = String(value ?? "").trim();
  if (!/^[1-9][0-9]*$/.test(source)) fail(code);
  const parsed = Number(source);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) fail(code);
  return parsed;
}

function keyForVersion(env, version) {
  const key = String(env?.[`CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    fail("E_RECOVERY_CODE_HMAC_KEY_INVALID");
  }
  return key;
}

function requireContext({ accountId, codeSetId, position } = {}) {
  const normalizedPosition = positiveInteger(
    position,
    "E_RECOVERY_CODE_CONTEXT_INVALID",
    20
  );
  if (!ID_32.test(String(accountId ?? "")) || !ID_32.test(String(codeSetId ?? ""))) {
    fail("E_RECOVERY_CODE_CONTEXT_INVALID");
  }
  return Object.freeze({
    accountId: String(accountId),
    codeSetId: String(codeSetId),
    position: normalizedPosition
  });
}

function verifierInput(normalizedCode, context, version) {
  return [
    "crm-recovery-code-v1",
    "staff",
    `key-v${version}`,
    context.accountId,
    context.codeSetId,
    String(context.position),
    normalizedCode
  ].join("\u0000");
}

export function normalizeRecoveryCode(value) {
  const source = String(value ?? "");
  if (source !== source.trim() || /[^\x00-\x7f]/.test(source)) {
    fail("E_RECOVERY_CODE_INVALID");
  }
  const upper = source.toUpperCase();
  if (!FORMATTED_CODE.test(upper) && !COMPACT_CODE.test(upper)) {
    fail("E_RECOVERY_CODE_INVALID");
  }
  const normalized = upper.replaceAll("-", "");
  if (!COMPACT_CODE.test(normalized)) fail("E_RECOVERY_CODE_INVALID");
  return normalized;
}

function encodeCrockford120(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 15) {
    fail("E_RECOVERY_CODE_RANDOMNESS_INVALID");
  }
  let accumulator = 0;
  let availableBits = 0;
  let result = "";
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      result += CROCKFORD_ALPHABET[(accumulator >>> availableBits) & 31];
      accumulator &= (1 << availableBits) - 1;
    }
  }
  if (availableBits !== 0 || result.length !== 24) {
    fail("E_RECOVERY_CODE_RANDOMNESS_INVALID");
  }
  return result;
}

export function createRecoveryCode() {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  const compact = encodeCrockford120(bytes);
  return compact.match(/.{4}/g).join("-");
}

export function createRecoveryCodeSet(count = 10) {
  const normalizedCount = positiveInteger(
    count,
    "E_RECOVERY_CODE_COUNT_INVALID",
    20
  );
  const codes = new Set();
  const maximumAttempts = normalizedCount * 4;
  for (let attempt = 0; codes.size < normalizedCount && attempt < maximumAttempts; attempt += 1) {
    codes.add(createRecoveryCode());
  }
  if (codes.size !== normalizedCount) fail("E_RECOVERY_CODE_RANDOMNESS_INVALID");
  return Object.freeze([...codes]);
}

export function readRecoveryCodeHmacKeyring(env) {
  const activeVersion = positiveInteger(
    env?.CRM_AUTH_RECOVERY_CODE_HMAC_ACTIVE_KEY_VERSION,
    "E_RECOVERY_CODE_HMAC_ACTIVE_VERSION_INVALID",
    999
  );
  const configuredRetained = String(
    env?.CRM_AUTH_RECOVERY_CODE_HMAC_RETAINED_KEY_VERSIONS ?? ""
  ).trim();
  const retained = configuredRetained
    ? configuredRetained.split(",").map((value) => positiveInteger(
      value,
      "E_RECOVERY_CODE_HMAC_RETAINED_VERSIONS_INVALID",
      999
    ))
    : [];
  const versions = [...new Set([activeVersion, ...retained])].sort((a, b) => b - a);
  if (versions.length > MAX_RETAINED_KEY_VERSIONS) {
    fail("E_RECOVERY_CODE_HMAC_RETAINED_VERSIONS_INVALID");
  }
  const keys = new Map(versions.map((version) => [version, keyForVersion(env, version)]));
  return Object.freeze({ activeVersion, versions: Object.freeze(versions), keys });
}

async function verifierForVersion(env, rawCode, rawContext, version) {
  const context = requireContext(rawContext);
  const normalizedCode = normalizeRecoveryCode(rawCode);
  const keyring = readRecoveryCodeHmacKeyring(env);
  if (!keyring.keys.has(version)) fail("E_RECOVERY_CODE_HMAC_VERSION_UNAVAILABLE");
  return hashOpaqueToken(
    verifierInput(normalizedCode, context, version),
    keyring.keys.get(version)
  );
}

export async function createRecoveryCodeVerifier(env, rawCode, context) {
  const keyring = readRecoveryCodeHmacKeyring(env);
  return Object.freeze({
    version: keyring.activeVersion,
    verifier: await verifierForVersion(
      env,
      rawCode,
      context,
      keyring.activeVersion
    )
  });
}

export async function verifyRecoveryCode(env, rawCode, stored) {
  const version = positiveInteger(
    stored?.verifier_key_version ?? stored?.verifierKeyVersion,
    "E_RECOVERY_CODE_VERIFIER_INVALID",
    999
  );
  const expected = String(stored?.verifier ?? "");
  if (!HEX_64.test(expected)) fail("E_RECOVERY_CODE_VERIFIER_INVALID");
  const actual = await verifierForVersion(env, rawCode, {
    accountId: stored?.auth_account_id ?? stored?.accountId,
    codeSetId: stored?.code_set_id ?? stored?.codeSetId,
    position: stored?.code_position ?? stored?.position
  }, version);
  return constantTimeEqual(actual, expected);
}

export { CROCKFORD_ALPHABET };
