import { hashOpaqueToken } from "./crypto.js";

const MAGIC_LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const VERSIONED_HASH = /^v([1-9][0-9]{0,2}):([0-9a-f]{64})$/;
const PURPOSE_CONTEXT = /^[a-z][a-z0-9._-]{2,79}$/;

export class ChallengeTokenError extends Error {
  constructor(code) {
    super("Challenge token verification is not configured.");
    this.name = "ChallengeTokenError";
    this.code = code;
  }
}

function fail(code) {
  throw new ChallengeTokenError(code);
}

function positiveVersion(value, code) {
  const source = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(source)) fail(code);
  return Number(source);
}

function keyForVersion(env, version) {
  const key = String(env?.[`CRM_AUTH_CHALLENGE_HMAC_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    fail("E_CHALLENGE_HMAC_KEY_INVALID");
  }
  return key;
}

export function createMagicLinkToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function parseVersionedChallengeTokenHash(value) {
  const match = String(value ?? "").match(VERSIONED_HASH);
  if (!match) fail("E_CHALLENGE_TOKEN_HASH_INVALID");
  return Object.freeze({ version: Number(match[1]), digest: match[2] });
}

export function readChallengeHmacKeyring(env) {
  const activeVersion = positiveVersion(
    env?.CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION,
    "E_CHALLENGE_HMAC_ACTIVE_VERSION_INVALID"
  );
  const configuredRetained = String(
    env?.CRM_AUTH_CHALLENGE_HMAC_RETAINED_KEY_VERSIONS ?? ""
  ).trim();
  const retained = configuredRetained
    ? configuredRetained.split(",").map((value) => positiveVersion(
      value,
      "E_CHALLENGE_HMAC_RETAINED_VERSIONS_INVALID"
    ))
    : [];
  const versions = [...new Set([activeVersion, ...retained])].sort((a, b) => b - a);
  if (versions.length > 5) fail("E_CHALLENGE_HMAC_RETAINED_VERSIONS_INVALID");

  const keys = new Map(versions.map((version) => [version, keyForVersion(env, version)]));
  return Object.freeze({ activeVersion, versions: Object.freeze(versions), keys });
}

async function hashWithKey(rawToken, purpose, version, key) {
  if (!MAGIC_LINK_TOKEN.test(String(rawToken ?? ""))) {
    fail("E_CHALLENGE_TOKEN_INVALID");
  }
  const normalizedPurpose = String(purpose ?? "");
  if (!PURPOSE_CONTEXT.test(normalizedPurpose)) {
    fail("E_CHALLENGE_PURPOSE_INVALID");
  }
  const digest = await hashOpaqueToken(
    `magic-link:${normalizedPurpose}:v${version}:${rawToken}`,
    key
  );
  return `v${version}:${digest}`;
}

export async function createVersionedChallengeTokenHash(env, rawToken, purpose) {
  const keyring = readChallengeHmacKeyring(env);
  return Object.freeze({
    version: keyring.activeVersion,
    tokenHash: await hashWithKey(
      rawToken,
      purpose,
      keyring.activeVersion,
      keyring.keys.get(keyring.activeVersion)
    )
  });
}

export async function createAcceptedChallengeTokenHashes(env, rawToken, purpose) {
  const keyring = readChallengeHmacKeyring(env);
  const hashes = await Promise.all(keyring.versions.map((version) => (
    hashWithKey(rawToken, purpose, version, keyring.keys.get(version))
  )));
  return Object.freeze(hashes);
}

export function isMagicLinkToken(value) {
  return MAGIC_LINK_TOKEN.test(String(value ?? ""));
}
