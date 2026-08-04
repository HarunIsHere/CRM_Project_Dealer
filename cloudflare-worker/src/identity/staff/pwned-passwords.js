const DEFAULT_ENDPOINT = "https://api.pwnedpasswords.com/range/";
const DEFAULT_USER_AGENT = "CRM-Delivery-Security/1.0 (auth.ayartuerk.me)";
const MAX_RESPONSE_BYTES = 128 * 1024;
const HASH_SUFFIX = /^[A-F0-9]{35}$/;
const DECIMAL_COUNT = /^(?:0|[1-9][0-9]{0,15})$/;
const textEncoder = new TextEncoder();

export class CompromisedPasswordServiceError extends Error {
  constructor() {
    super("Compromised-password screening is temporarily unavailable.");
    this.name = "CompromisedPasswordServiceError";
    this.code = "temporarily_unavailable";
    this.status = 503;
  }
}

function fail() {
  throw new CompromisedPasswordServiceError();
}

function toUpperHex(bytes) {
  return Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("").toUpperCase();
}

async function sha1Utf8(value) {
  const digest = await crypto.subtle.digest("SHA-1", textEncoder.encode(value));
  return toUpperHex(new Uint8Array(digest));
}

function validEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.pathname.endsWith("/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function responseSuffixes(body) {
  if (typeof body !== "string" || textEncoder.encode(body).byteLength > MAX_RESPONSE_BYTES) {
    fail();
  }
  const suffixes = new Map();
  for (const rawLine of body.split(/\r?\n/)) {
    if (rawLine === "") continue;
    const separator = rawLine.indexOf(":");
    if (separator !== 35 || rawLine.indexOf(":", separator + 1) !== -1) fail();
    const suffix = rawLine.slice(0, separator).toUpperCase();
    const count = rawLine.slice(separator + 1);
    if (!HASH_SUFFIX.test(suffix) || !DECIMAL_COUNT.test(count)) fail();
    if (suffixes.has(suffix)) fail();
    suffixes.set(suffix, Number(count));
  }
  if (suffixes.size === 0) fail();
  return suffixes;
}

export function createPwnedPasswordsChecker({
  fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
  userAgent = DEFAULT_USER_AGENT
} = {}) {
  const normalizedEndpoint = validEndpoint(endpoint);
  if (
    typeof fetchImpl !== "function"
    || !normalizedEndpoint
    || typeof userAgent !== "string"
    || userAgent.trim() === ""
    || /[\r\n]/.test(userAgent)
  ) {
    fail();
  }

  return async function isKnownCompromisedOrCommon(password) {
    if (typeof password !== "string") fail();
    const hash = await sha1Utf8(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    let response;
    try {
      response = await fetchImpl(`${normalizedEndpoint}${prefix}`, {
        method: "GET",
        headers: {
          accept: "text/plain",
          "add-padding": "true",
          "user-agent": userAgent
        },
        redirect: "error"
      });
    } catch {
      fail();
    }
    if (!response || response.status !== 200) fail();
    const mediaType = String(response.headers?.get?.("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (mediaType !== "text/plain") fail();
    const declaredLength = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) fail();

    let body;
    try {
      body = await response.text();
    } catch {
      fail();
    }
    const count = responseSuffixes(body).get(suffix) ?? 0;
    return count > 0;
  };
}

export const PWNED_PASSWORDS_PROVIDER = Object.freeze({
  endpoint: DEFAULT_ENDPOINT,
  hash: "SHA-1",
  prefixLength: 5,
  padding: true,
  sendsPlaintext: false,
  sendsFullHash: false
});
