const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const WHITESPACE = /\s/u;
const FORBIDDEN_LOCAL_CHARACTERS = /[()<>,;:\\"\[\]]/u;
const ASCII_DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class EmailNormalizationError extends Error {
  constructor(code = "E_EMAIL_INVALID") {
    super("Email address is invalid.");
    this.name = "EmailNormalizationError";
    this.code = code;
  }
}

function invalid() {
  throw new EmailNormalizationError();
}

function normalizeDomain(domain) {
  if (
    !domain
    || domain.startsWith(".")
    || domain.endsWith(".")
    || domain.includes("..")
    || domain.includes("@")
    || domain.includes(":")
    || domain.includes("/")
  ) {
    invalid();
  }

  let asciiDomain;
  try {
    const parsed = new URL(`https://${domain}`);
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.port
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      invalid();
    }
    asciiDomain = parsed.hostname.toLowerCase();
  } catch {
    invalid();
  }

  if (
    !asciiDomain
    || asciiDomain.length > 253
    || !asciiDomain.includes(".")
    || /^\d+(?:\.\d+){3}$/.test(asciiDomain)
    || asciiDomain.split(".").some((label) => !ASCII_DOMAIN_LABEL.test(label))
  ) {
    invalid();
  }
  return asciiDomain;
}

/**
 * Canonical email normalization v1.
 *
 * Local-part case folding is intentional for this product's account lookup
 * contract. Dots and plus tags remain significant and are never rewritten.
 */
export function normalizeEmailAddress(value) {
  if (typeof value !== "string") invalid();

  const displayEmail = value.trim().normalize("NFC");
  if (
    displayEmail.length < 3
    || displayEmail.length > 320
    || CONTROL_CHARACTERS.test(displayEmail)
    || WHITESPACE.test(displayEmail)
  ) {
    invalid();
  }

  const separator = displayEmail.lastIndexOf("@");
  if (
    separator <= 0
    || separator !== displayEmail.indexOf("@")
    || separator === displayEmail.length - 1
  ) {
    invalid();
  }

  const localPart = displayEmail.slice(0, separator);
  const domain = displayEmail.slice(separator + 1);
  if (
    localPart.length > 64
    || localPart.startsWith(".")
    || localPart.endsWith(".")
    || localPart.includes("..")
    || FORBIDDEN_LOCAL_CHARACTERS.test(localPart)
  ) {
    invalid();
  }

  const asciiDomain = normalizeDomain(domain);
  const normalizedEmail = `${localPart.toLocaleLowerCase("en-US")}@${asciiDomain}`;
  if (normalizedEmail.length > 320) invalid();

  return Object.freeze({
    displayEmail,
    normalizedEmail,
    normalizationVersion: 1
  });
}

export function maskEmailAddress(value) {
  const { normalizedEmail } = normalizeEmailAddress(value);
  const separator = normalizedEmail.lastIndexOf("@");
  const localPart = normalizedEmail.slice(0, separator);
  const domain = normalizedEmail.slice(separator + 1);
  const prefix = Array.from(localPart)[0] ?? "";
  return `${prefix}***@${domain}`;
}
