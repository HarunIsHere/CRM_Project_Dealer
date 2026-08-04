import { createOpaqueId } from "./crypto.js";

export const MAX_IDENTITY_JSON_BYTES = 64 * 1024;

const URL_SAFE_ASCII = /^[A-Za-z0-9._~-]+$/;
const REQUEST_KEY_MIN_LENGTH = 16;
const REQUEST_KEY_MAX_LENGTH = 128;
const textEncoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

export class IdentityProtocolError extends Error {
  constructor(code, status, message, details = undefined) {
    super(message);
    this.name = "IdentityProtocolError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

function invalidRequest(message = "The request shape is invalid.") {
  return new IdentityProtocolError("invalid_request", 400, message);
}

function validRequestKey(value) {
  return (
    typeof value === "string"
    && value.length >= REQUEST_KEY_MIN_LENGTH
    && value.length <= REQUEST_KEY_MAX_LENGTH
    && URL_SAFE_ASCII.test(value)
  );
}

export function readClientRequestId(request) {
  const value = request?.headers?.get("x-request-id");
  return validRequestKey(value) ? value : null;
}

export function createIdentityRequestContext(request) {
  return Object.freeze({
    requestId: createOpaqueId(),
    parentRequestId: readClientRequestId(request)
  });
}

export function readIdempotencyKey(request, { required = true } = {}) {
  const value = request?.headers?.get("idempotency-key");
  if (value === null || value === "") {
    if (!required) return null;
    throw new IdentityProtocolError(
      "idempotency_key_required",
      400,
      "An Idempotency-Key header is required."
    );
  }
  if (!validRequestKey(value)) {
    throw invalidRequest("The Idempotency-Key header is invalid.");
  }
  return value;
}

function isApplicationJson(contentType) {
  if (!contentType) return false;
  const parts = contentType.split(";").map((part) => part.trim());
  if (parts.shift()?.toLowerCase() !== "application/json") return false;

  let charsetSeen = false;
  for (const parameter of parts) {
    if (!parameter) return false;
    const match = parameter.match(/^charset\s*=\s*(?:"utf-8"|utf-8)$/i);
    if (!match || charsetSeen) return false;
    charsetSeen = true;
  }
  return true;
}

async function readLimitedBody(request, maxBytes) {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw invalidRequest();
    if (Number(contentLength) > maxBytes) {
      throw invalidRequest("The request body exceeds the identity API limit.");
    }
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw invalidRequest();
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw invalidRequest("The request body exceeds the identity API limit.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof IdentityProtocolError) throw error;
    throw invalidRequest("The request body could not be read.");
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function requireFieldList(values, name) {
  if (!Array.isArray(values) || values.some((value) => (
    typeof value !== "string" || value === ""
  ))) {
    throw new IdentityProtocolError(
      "temporarily_unavailable",
      503,
      `Identity JSON ${name} are not configured.`
    );
  }
  const unique = new Set(values);
  if (unique.size !== values.length) {
    throw new IdentityProtocolError(
      "temporarily_unavailable",
      503,
      `Identity JSON ${name} contain duplicates.`
    );
  }
  return unique;
}

export async function readIdentityJson(
  request,
  {
    allowedFields,
    requiredFields = [],
    allowEmpty = false,
    maxBytes = MAX_IDENTITY_JSON_BYTES
  } = {}
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_IDENTITY_JSON_BYTES) {
    throw new IdentityProtocolError(
      "temporarily_unavailable",
      503,
      "The identity request-size policy is invalid."
    );
  }

  const allowed = requireFieldList(allowedFields, "allowed fields");
  const required = requireFieldList(requiredFields, "required fields");
  for (const field of required) {
    if (!allowed.has(field)) {
      throw new IdentityProtocolError(
        "temporarily_unavailable",
        503,
        "An identity required field is not allowlisted."
      );
    }
  }

  const bytes = await readLimitedBody(request, maxBytes);
  if (bytes.byteLength === 0) {
    if (allowEmpty) return null;
    throw new IdentityProtocolError(
      "invalid_json",
      400,
      "A JSON request body is required."
    );
  }

  if (!isApplicationJson(request.headers.get("content-type"))) {
    throw new IdentityProtocolError(
      "unsupported_media_type",
      415,
      "Content-Type application/json is required."
    );
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new IdentityProtocolError(
      "invalid_json",
      400,
      "The JSON request body is not valid UTF-8."
    );
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new IdentityProtocolError(
      "invalid_json",
      400,
      "The JSON request body is malformed."
    );
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw invalidRequest();
  }

  const keys = Object.keys(value);
  if (keys.some((field) => !allowed.has(field))) throw invalidRequest();
  if ([...required].some((field) => !Object.hasOwn(value, field))) {
    throw invalidRequest();
  }
  return value;
}

function canonicalJsonValue(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidRequest();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonValue).join(",")}]`;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw invalidRequest();
    }
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJsonValue(value[key])}`
    )).join(",")}}`;
  }
  throw invalidRequest();
}

export function canonicalIdentityJson(value) {
  return canonicalJsonValue(value);
}

export function canonicalIdentityOperation(method, routeTemplate) {
  const normalizedMethod = String(method ?? "").toUpperCase();
  const normalizedRoute = String(routeTemplate ?? "");
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)
    || !normalizedRoute.startsWith("/api/v1/")
    || normalizedRoute.includes("?")
    || normalizedRoute.includes("#")
    || /\s/.test(normalizedRoute)
  ) {
    throw new IdentityProtocolError(
      "temporarily_unavailable",
      503,
      "The canonical identity operation is invalid."
    );
  }
  return `${normalizedMethod} ${normalizedRoute}`;
}

export async function hashCanonicalIdentityRequest(method, routeTemplate, body) {
  const operation = canonicalIdentityOperation(method, routeTemplate);
  const canonicalBody = canonicalIdentityJson(body);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`${operation}\n${canonicalBody}`)
  );
  return toHex(new Uint8Array(digest));
}
