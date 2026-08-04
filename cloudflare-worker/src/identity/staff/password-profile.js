const textEncoder = new TextEncoder();
const CANONICAL_ALGORITHM = "argon2id_phc_v1";
const CANONICAL_ALGORITHM_VERSION = 1;
const CANONICAL_PEPPER_VERSION = 1;
const PARAMETERS = Object.freeze({
  memoryKiB: 19456,
  iterations: 2,
  parallelism: 1,
  saltBytes: 16,
  hashBytes: 32
});
const BASE64URL_KEY = /^[A-Za-z0-9_-]{43}$/;
const BASE64_NO_PADDING = /^[A-Za-z0-9+/]+$/;

export class StaffPasswordProfileError extends Error {
  constructor(code = "temporarily_unavailable", status = 503) {
    super("Canonical staff password processing is temporarily unavailable.");
    this.name = "StaffPasswordProfileError";
    this.code = code;
    this.status = status;
  }
}

function fail() {
  throw new StaffPasswordProfileError();
}

function positiveVersion(value) {
  const text = String(value ?? "");
  if (!/^[1-9][0-9]*$/.test(text)) fail();
  const version = Number(text);
  if (!Number.isSafeInteger(version)) fail();
  return version;
}

function decodeBase64Url32(value) {
  const encoded = String(value ?? "");
  if (!BASE64URL_KEY.test(encoded)) fail();
  let binary;
  try {
    binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/") + "=");
  } catch {
    fail();
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== 32) fail();
  return bytes;
}

function base64NoPadding(bytes) {
  if (!(bytes instanceof Uint8Array)) fail();
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, "");
}

function decodeBase64NoPadding(value, expectedBytes) {
  const encoded = String(value ?? "");
  if (
    !BASE64_NO_PADDING.test(encoded)
    || encoded.includes("=")
    || encoded.length % 4 === 1
  ) {
    fail();
  }
  const padding = "=".repeat((4 - (encoded.length % 4)) % 4);
  let binary;
  try {
    binary = atob(encoded + padding);
  } catch {
    fail();
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== expectedBytes || base64NoPadding(bytes) !== encoded) fail();
  return bytes;
}

function pepperForVersion(env, version) {
  if (version !== CANONICAL_PEPPER_VERSION) fail();
  return decodeBase64Url32(env?.[`CRM_AUTH_PASSWORD_PEPPER_KEY_V${version}`]);
}

export function getActiveStaffPasswordPepper(env) {
  const version = positiveVersion(env?.CRM_AUTH_PASSWORD_PEPPER_ACTIVE_KEY_VERSION);
  return Object.freeze({ version, key: pepperForVersion(env, version) });
}

export async function prehashStaffPassword(env, password, { pepperVersion } = {}) {
  if (typeof password !== "string") fail();
  const selected = pepperVersion === undefined
    ? getActiveStaffPasswordPepper(env)
    : Object.freeze({
      version: positiveVersion(pepperVersion),
      key: pepperForVersion(env, positiveVersion(pepperVersion))
    });
  const key = await crypto.subtle.importKey(
    "raw",
    selected.key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(password)
  );
  const prehash = new Uint8Array(signature);
  if (prehash.byteLength !== 32) fail();
  return Object.freeze({ pepperVersion: selected.version, prehash });
}

function validateDerivedHash(value) {
  if (!(value instanceof Uint8Array) || value.byteLength !== PARAMETERS.hashBytes) {
    fail();
  }
  return value;
}

function requireDeriver(deriveArgon2id) {
  if (typeof deriveArgon2id !== "function") fail();
  return deriveArgon2id;
}

export async function createCanonicalStaffPasswordVerifier(
  env,
  password,
  { deriveArgon2id }
) {
  const derive = requireDeriver(deriveArgon2id);
  const { pepperVersion, prehash } = await prehashStaffPassword(env, password);
  const salt = new Uint8Array(PARAMETERS.saltBytes);
  crypto.getRandomValues(salt);
  let derived;
  try {
    derived = validateDerivedHash(await derive(Object.freeze({
      password: prehash,
      salt,
      memoryKiB: PARAMETERS.memoryKiB,
      iterations: PARAMETERS.iterations,
      parallelism: PARAMETERS.parallelism,
      hashBytes: PARAMETERS.hashBytes
    })));
  } catch (error) {
    if (error instanceof StaffPasswordProfileError) throw error;
    fail();
  }
  const verifier = [
    "",
    "argon2id",
    "v=19",
    `m=${PARAMETERS.memoryKiB},t=${PARAMETERS.iterations},p=${PARAMETERS.parallelism}`,
    base64NoPadding(salt),
    base64NoPadding(derived)
  ].join("$");

  return Object.freeze({
    verifier,
    algorithm: CANONICAL_ALGORITHM,
    algorithmVersion: CANONICAL_ALGORITHM_VERSION,
    parametersJson: JSON.stringify(PARAMETERS),
    pepperKeyVersion: pepperVersion,
    needsUpgrade: 0
  });
}

export function parseCanonicalStaffPasswordVerifier(verifier) {
  const parts = String(verifier ?? "").split("$");
  if (
    parts.length !== 6
    || parts[0] !== ""
    || parts[1] !== "argon2id"
    || parts[2] !== "v=19"
    || parts[3] !== `m=${PARAMETERS.memoryKiB},t=${PARAMETERS.iterations},p=${PARAMETERS.parallelism}`
  ) {
    fail();
  }
  return Object.freeze({
    salt: decodeBase64NoPadding(parts[4], PARAMETERS.saltBytes),
    hash: decodeBase64NoPadding(parts[5], PARAMETERS.hashBytes)
  });
}

export const CANONICAL_STAFF_PASSWORD_PROFILE = Object.freeze({
  algorithm: CANONICAL_ALGORITHM,
  algorithmVersion: CANONICAL_ALGORITHM_VERSION,
  parameters: PARAMETERS,
  pepperKeyVersion: CANONICAL_PEPPER_VERSION,
  prehash: "HMAC-SHA-256",
  phcVersion: 19
});
