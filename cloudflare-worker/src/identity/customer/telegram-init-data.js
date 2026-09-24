const textEncoder = new TextEncoder();
const MAX_INIT_DATA_BYTES = 8 * 1024;
const MAX_AGE_SECONDS = 5 * 60;
const MAX_FUTURE_SKEW_SECONDS = 30;
const HASH_PATTERN = /^[0-9a-f]{64}$/i;
const DIGIT_STRING = /^[1-9][0-9]{0,19}$/;

function invalidAuthorization() {
  const error = new Error("Telegram authorization is invalid.");
  error.code = "invalid_telegram_authorization";
  error.status = 401;
  return error;
}

function decodeFormComponent(value) {
  try {
    return decodeURIComponent(String(value).replace(/\+/g, " "));
  } catch {
    throw invalidAuthorization();
  }
}

function parseInitData(rawInitData) {
  const source = String(rawInitData ?? "");
  if (
    !source
    || textEncoder.encode(source).byteLength > MAX_INIT_DATA_BYTES
    || source.startsWith("?")
  ) {
    throw invalidAuthorization();
  }

  const fields = new Map();
  for (const part of source.split("&")) {
    const separator = part.indexOf("=");
    if (!part || separator <= 0) throw invalidAuthorization();
    const key = decodeFormComponent(part.slice(0, separator));
    const value = decodeFormComponent(part.slice(separator + 1));
    if (!key || fields.has(key)) throw invalidAuthorization();
    fields.set(key, value);
  }

  const suppliedHash = fields.get("hash");
  if (!HASH_PATTERN.test(String(suppliedHash ?? ""))) {
    throw invalidAuthorization();
  }

  const dataCheckString = [...fields.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  if (!dataCheckString) throw invalidAuthorization();
  return { fields, suppliedHash: suppliedHash.toLowerCase(), dataCheckString };
}

function hexBytes(value) {
  if (!HASH_PATTERN.test(value)) throw invalidAuthorization();
  return Uint8Array.from(
    value.match(/.{2}/g),
    (pair) => Number.parseInt(pair, 16)
  );
}

async function verifySignature(botToken, suppliedHash, dataCheckString) {
  const token = String(botToken ?? "");
  if (!token) throw invalidAuthorization();

  const derivationKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secret = await crypto.subtle.sign(
    "HMAC",
    derivationKey,
    textEncoder.encode(token)
  );
  const validationKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    validationKey,
    hexBytes(suppliedHash),
    textEncoder.encode(dataCheckString)
  );
  if (!valid) throw invalidAuthorization();
}

function parseTelegramUser(rawUser) {
  if (!rawUser || rawUser.length > 4096) throw invalidAuthorization();
  const idMatches = [...rawUser.matchAll(/"id"\s*:\s*([0-9]+)/g)];
  if (idMatches.length !== 1 || !DIGIT_STRING.test(idMatches[0][1])) {
    throw invalidAuthorization();
  }

  let parsed;
  try {
    const quotedId = rawUser.replace(
      /("id"\s*:\s*)([0-9]+)/,
      '$1"$2"'
    );
    parsed = JSON.parse(quotedId);
  } catch {
    throw invalidAuthorization();
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalidAuthorization();
  }
  parsed.id = idMatches[0][1];
  return parsed;
}

export async function verifyTelegramMiniAppInitData(
  rawInitData,
  botToken,
  { now = new Date() } = {}
) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowSeconds = Math.floor(nowDate.getTime() / 1000);
  if (!Number.isSafeInteger(nowSeconds)) throw invalidAuthorization();

  const parsed = parseInitData(rawInitData);
  await verifySignature(
    botToken,
    parsed.suppliedHash,
    parsed.dataCheckString
  );

  const authDateText = String(parsed.fields.get("auth_date") ?? "");
  if (!/^[0-9]{1,12}$/.test(authDateText)) throw invalidAuthorization();
  const authDate = Number(authDateText);
  if (
    !Number.isSafeInteger(authDate)
    || authDate < nowSeconds - MAX_AGE_SECONDS
    || authDate > nowSeconds + MAX_FUTURE_SKEW_SECONDS
  ) {
    throw invalidAuthorization();
  }

  return Object.freeze({
    user: Object.freeze(parseTelegramUser(parsed.fields.get("user"))),
    authDate,
    dataCheckString: parsed.dataCheckString,
    suppliedHash: parsed.suppliedHash
  });
}

export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
