import { hashOpaqueToken } from "./crypto.js";

const SESSION_SECRET = /^[A-Za-z0-9_-]{32,256}$/;
const MAX_RETAINED_SESSION_KEYS = 5;

export class SessionKeyringError extends Error {
  constructor(code) {
    super("Canonical session hashing is not configured.");
    this.name = "SessionKeyringError";
    this.code = code;
  }
}

function fail(code) {
  throw new SessionKeyringError(code);
}

function positiveVersion(value, code) {
  const source = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(source)) fail(code);
  return Number(source);
}

function keyForVersion(env, version) {
  const key = String(env?.[`CRM_AUTH_SESSION_HMAC_KEY_V${version}`] ?? "");
  if (key.length < 32 || key.length > 1024) {
    fail("E_SESSION_HMAC_KEY_INVALID");
  }
  return key;
}

function requireSessionSecret(value) {
  const secret = String(value ?? "");
  if (!SESSION_SECRET.test(secret)) fail("E_SESSION_SECRET_INVALID");
  return secret;
}

export function readSessionHmacKeyring(env) {
  const activeVersion = positiveVersion(
    env?.CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION,
    "E_SESSION_HMAC_ACTIVE_VERSION_INVALID"
  );
  const configuredRetained = String(
    env?.CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS ?? ""
  ).trim();
  const retainedVersions = configuredRetained
    ? configuredRetained.split(",").map((value) => positiveVersion(
      value,
      "E_SESSION_HMAC_RETAINED_VERSIONS_INVALID"
    ))
    : [];
  const versions = [...new Set([activeVersion, ...retainedVersions])];
  if (versions.length > MAX_RETAINED_SESSION_KEYS) {
    fail("E_SESSION_HMAC_RETAINED_VERSIONS_INVALID");
  }

  const keys = new Map(
    versions.map((version) => [version, keyForVersion(env, version)])
  );
  return Object.freeze({
    activeVersion,
    versions: Object.freeze(versions),
    keys
  });
}

export async function hashSessionSecretForVersion(
  env,
  rawSecret,
  version
) {
  const selectedVersion = positiveVersion(
    version,
    "E_SESSION_HMAC_VERSION_INVALID"
  );
  const keyring = readSessionHmacKeyring(env);
  const key = keyring.keys.get(selectedVersion);
  if (!key) fail("E_SESSION_HMAC_KEY_VERSION_UNKNOWN");
  return hashOpaqueToken(requireSessionSecret(rawSecret), key);
}

export async function createSessionHashesForIssuance(
  env,
  { sessionToken, csrfToken = null } = {}
) {
  const keyring = readSessionHmacKeyring(env);
  const key = keyring.keys.get(keyring.activeVersion);
  const tokenHashPromise = hashOpaqueToken(
    requireSessionSecret(sessionToken),
    key
  );
  const csrfHashPromise = csrfToken === null
    ? Promise.resolve(null)
    : hashOpaqueToken(requireSessionSecret(csrfToken), key);
  const [tokenHash, csrfTokenHash] = await Promise.all([
    tokenHashPromise,
    csrfHashPromise
  ]);

  return Object.freeze({
    tokenHash,
    tokenHashVersion: keyring.activeVersion,
    csrfTokenHash
  });
}

export async function createAcceptedSessionTokenHashes(env, sessionToken) {
  const keyring = readSessionHmacKeyring(env);
  const rawToken = requireSessionSecret(sessionToken);
  const hashes = await Promise.all(keyring.versions.map(async (version) => (
    Object.freeze({
      tokenHashVersion: version,
      tokenHash: await hashOpaqueToken(rawToken, keyring.keys.get(version))
    })
  )));
  return Object.freeze(hashes);
}

