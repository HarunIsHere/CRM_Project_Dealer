import {
  normalizeEmailAddress as normalizeCanonicalEmailAddress
} from "./normalization.js";

const CLOUDFLARE_PROVIDER = "cloudflare_email_service";
const CLOUDFLARE_PROVIDER_CODES = new Set([
  "E_VALIDATION_ERROR",
  "E_FIELD_MISSING",
  "E_TOO_MANY_RECIPIENTS",
  "E_TOO_MANY_ATTACHMENTS",
  "E_SENDER_NOT_VERIFIED",
  "E_RECIPIENT_NOT_ALLOWED",
  "E_RECIPIENT_SUPPRESSED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_CONTENT_TOO_LARGE",
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_DELIVERY_FAILED",
  "E_INTERNAL_SERVER_ERROR",
  "E_HEADER_NOT_ALLOWED",
  "E_HEADER_USE_API_FIELD",
  "E_HEADER_VALUE_INVALID",
  "E_HEADER_VALUE_TOO_LONG",
  "E_HEADER_NAME_INVALID",
  "E_HEADERS_TOO_LARGE",
  "E_HEADERS_TOO_MANY"
]);

const RETRYABLE_PROVIDER_CODES = new Set([
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_DELIVERY_FAILED",
  "E_INTERNAL_SERVER_ERROR"
]);

export class EmailDeliveryError extends Error {
  constructor(code, retryable = false, provider = CLOUDFLARE_PROVIDER) {
    super("Transactional email delivery failed.");
    this.name = "EmailDeliveryError";
    this.code = code;
    this.retryable = retryable;
    this.provider = provider;
  }
}

export function normalizeEmailAddress(value) {
  try {
    return normalizeCanonicalEmailAddress(String(value ?? "")).normalizedEmail;
  } catch {
    return "";
  }
}

export function isArbitraryRecipientDeliveryAllowed(env) {
  return env?.CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS === "true";
}

function controlledDestinations(env) {
  return new Set(
    String(env?.CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS ?? "")
      .split(",")
      .map(normalizeEmailAddress)
      .filter(Boolean)
  );
}

export function isControlledDestinationAllowed(env, destination) {
  if (isArbitraryRecipientDeliveryAllowed(env)) return true;
  const normalized = normalizeEmailAddress(destination);
  return normalized !== "" && controlledDestinations(env).has(normalized);
}

export function classifyProviderError(error) {
  if (error instanceof EmailDeliveryError) return error;

  const rawCode = String(error?.code ?? "").trim().toUpperCase();
  if (CLOUDFLARE_PROVIDER_CODES.has(rawCode)) {
    return new EmailDeliveryError(
      rawCode,
      RETRYABLE_PROVIDER_CODES.has(rawCode),
      CLOUDFLARE_PROVIDER
    );
  }

  return new EmailDeliveryError(
    "E_PROVIDER_UNKNOWN",
    true,
    CLOUDFLARE_PROVIDER
  );
}

function requireCanonicalMessage(message) {
  const destination = normalizeEmailAddress(message?.to);
  const subject = String(message?.subject ?? "").trim();
  const text = String(message?.text ?? "");
  const html = String(message?.html ?? "");

  if (!destination || !subject || !text || !html) {
    throw new EmailDeliveryError("E_CANONICAL_MESSAGE_INVALID");
  }

  return { destination, subject, text, html };
}

export function createTransactionalEmailProvider(env) {
  if (env?.CRM_AUTH_EMAIL_DELIVERY !== "true") {
    throw new EmailDeliveryError("E_EMAIL_DELIVERY_DISABLED");
  }

  const configuredProvider = String(
    env?.CRM_AUTH_EMAIL_PROVIDER ?? "cloudflare"
  ).trim().toLowerCase();

  if (configuredProvider !== "cloudflare") {
    throw new EmailDeliveryError("E_EMAIL_PROVIDER_UNSUPPORTED");
  }

  if (!env?.AUTH_EMAIL || typeof env.AUTH_EMAIL.send !== "function") {
    throw new EmailDeliveryError("E_EMAIL_BINDING_UNAVAILABLE");
  }

  const sender = normalizeEmailAddress(env.CRM_AUTH_EMAIL_FROM);
  const senderName = String(env.CRM_AUTH_EMAIL_FROM_NAME ?? "CRM Delivery Security").trim();
  if (!sender || !senderName) {
    throw new EmailDeliveryError("E_EMAIL_SENDER_NOT_CONFIGURED");
  }

  return Object.freeze({
    name: CLOUDFLARE_PROVIDER,
    async send(message) {
      const canonical = requireCanonicalMessage(message);
      if (!isControlledDestinationAllowed(env, canonical.destination)) {
        throw new EmailDeliveryError("E_RECIPIENT_NOT_ALLOWED");
      }

      try {
        const result = await env.AUTH_EMAIL.send({
          to: canonical.destination,
          from: { email: sender, name: senderName },
          subject: canonical.subject,
          text: canonical.text,
          html: canonical.html
        });

        return {
          provider: CLOUDFLARE_PROVIDER,
          messageId: result?.messageId ? String(result.messageId) : null
        };
      } catch (error) {
        throw classifyProviderError(error);
      }
    }
  });
}

export async function sendTransactionalEmail(env, message) {
  const provider = createTransactionalEmailProvider(env);
  return provider.send(message);
}
