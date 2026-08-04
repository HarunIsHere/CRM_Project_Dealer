import {
  IDENTITY_EMAIL_CATALOG,
  IDENTITY_EMAIL_TEMPLATE_KEYS
} from "../../i18n/identity-email.generated.js";
import {
  getIdentityEmailTemplatePolicy,
  isIdentityEmailLandingPathAllowed
} from "./policy.js";

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const EMAIL_CODE = /^\d{8}$/;
const MAGIC_LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function normalizeLocale(locale) {
  const normalized = String(locale || "en").trim().toLowerCase();
  return IDENTITY_EMAIL_CATALOG.supported_locales.includes(normalized)
    ? normalized
    : "en";
}

function rejectControlCharacters(value, name) {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(`${name} contains control characters`);
  }
}

function validateTimestamp(value, name) {
  if (!RFC3339_UTC.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${name} must be an RFC 3339 UTC timestamp`);
  }
}

function validateFirstPartyAuthUrl(value, name, templateKey) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${name} must be a valid URL`);
  }

  const expectedOrigin = IDENTITY_EMAIL_CATALOG.brand.first_party_origin;
  const fragment = parsed.hash.startsWith("#token=")
    ? parsed.hash.slice("#token=".length)
    : "";
  if (
    parsed.protocol !== "https:"
    || parsed.origin !== expectedOrigin
    || parsed.username
    || parsed.password
    || parsed.search
    || !isIdentityEmailLandingPathAllowed(templateKey, parsed.pathname)
    || !MAGIC_LINK_TOKEN.test(fragment)
  ) {
    throw new TypeError(
      `${name} must be a first-party HTTPS authentication URL with a 256-bit fragment token`
    );
  }
}

function validateVariable(value, type, name, templateKey) {
  if (typeof value !== "string" || !value) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  rejectControlCharacters(value, name);

  switch (type) {
    case "username":
      if (value.trim() !== value || value.length > 120) {
        throw new TypeError(`${name} must be a trimmed username of at most 120 characters`);
      }
      break;
    case "staff_role":
      if (!['admin', 'superadmin'].includes(value)) {
        throw new TypeError(`${name} must be admin or superadmin`);
      }
      break;
    case "first_party_auth_url":
      validateFirstPartyAuthUrl(value, name, templateKey);
      break;
    case "email_code":
      if (!EMAIL_CODE.test(value)) {
        throw new TypeError(`${name} must be an eight-digit verification code`);
      }
      break;
    case "rfc3339_timestamp":
      validateTimestamp(value, name);
      break;
    default:
      throw new TypeError(`${name} has an unsupported variable type`);
  }
}

function validatedValues(templateKey, definition, variables, shared) {
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    throw new TypeError("email template variables must be an object");
  }

  const expected = Object.keys(definition.variables).sort();
  const actual = Object.keys(variables).sort();
  if (
    expected.length !== actual.length
    || expected.some((key, index) => key !== actual[index])
  ) {
    throw new TypeError(
      `email template variables must be exactly: ${expected.join(", ")}`
    );
  }

  const values = {};
  for (const [name, type] of Object.entries(definition.variables)) {
    validateVariable(variables[name], type, name, templateKey);
    values[name] = variables[name];
  }
  if (Object.hasOwn(values, "role")) {
    values.role = shared[`role_${values.role}`];
  }
  return values;
}

function interpolate(value, variables) {
  return value.replace(PLACEHOLDER, (_, name) => {
    if (!Object.hasOwn(variables, name)) {
      throw new TypeError(`missing interpolation variable: ${name}`);
    }
    return String(variables[name]);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textBody(definition, content, shared, values) {
  const lines = [
    interpolate(content.heading, values),
    "",
    interpolate(content.intro, values)
  ];

  if (definition.layout.includes("link")) {
    lines.push(
      "",
      interpolate(content.cta, values),
      values.action_url,
      "",
      shared.link_fallback,
      values.action_url
    );
  }
  if (definition.layout.includes("code")) {
    lines.push(
      "",
      `${shared.code_label}: ${values.manual_code}`,
      shared.code_help
    );
  }
  if (definition.kind === "challenge") {
    lines.push(
      "",
      interpolate(shared.expires_at, values),
      shared.ignore,
      shared.security_notice
    );
  } else {
    lines.push("", shared.not_you, shared.support_notice);
  }
  lines.push("", shared.footer);
  return lines.join("\n");
}

function htmlBody(locale, direction, definition, content, shared, values) {
  const align = direction === "rtl" ? "right" : "left";
  const action = definition.layout.includes("link")
    ? `
      <p style="margin:24px 0;text-align:${align}">
        <a href="${escapeHtml(values.action_url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${escapeHtml(interpolate(content.cta, values))}</a>
      </p>
      <p style="margin:16px 0 4px;color:#475569;font-size:14px">${escapeHtml(shared.link_fallback)}</p>
      <p dir="ltr" style="margin:0;color:#2563eb;font-size:13px;word-break:break-all;text-align:left">${escapeHtml(values.action_url)}</p>`
    : "";
  const code = definition.layout.includes("code")
    ? `
      <p style="margin:24px 0 6px;color:#475569;font-size:14px">${escapeHtml(shared.code_label)}</p>
      <p dir="ltr" style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.18em;text-align:left">${escapeHtml(values.manual_code)}</p>
      <p style="margin:8px 0 0;color:#475569;font-size:14px">${escapeHtml(shared.code_help)}</p>`
    : "";
  const closing = definition.kind === "challenge"
    ? `
      <p style="margin:24px 0 0;color:#475569;font-size:14px">${escapeHtml(interpolate(shared.expires_at, values))}</p>
      <p style="margin:8px 0 0;color:#475569;font-size:14px">${escapeHtml(shared.ignore)}</p>
      <p style="margin:8px 0 0;color:#991b1b;font-size:14px;font-weight:600">${escapeHtml(shared.security_notice)}</p>`
    : `
      <p style="margin:24px 0 0;color:#991b1b;font-size:14px;font-weight:600">${escapeHtml(shared.not_you)}</p>
      <p style="margin:8px 0 0;color:#475569;font-size:14px">${escapeHtml(shared.support_notice)}</p>`;

  return `<!doctype html>
<html lang="${locale}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(interpolate(content.subject, values))}</title>
</head>
<body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif;text-align:${align}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(interpolate(content.preheader, values))}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f1f5f9">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe3ee;border-radius:12px">
        <tr><td style="padding:28px;text-align:${align}">
          <p style="margin:0 0 20px;color:#2563eb;font-size:16px;font-weight:700">${escapeHtml(IDENTITY_EMAIL_CATALOG.brand.name)}</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">${escapeHtml(interpolate(content.heading, values))}</h1>
          <p style="margin:0;font-size:16px;line-height:1.6">${escapeHtml(interpolate(content.intro, values))}</p>${action}${code}${closing}
          <hr style="margin:28px 0 16px;border:0;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#64748b;font-size:12px">${escapeHtml(shared.footer)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderIdentityEmail(templateKey, locale = "en", variables = {}) {
  const definition = IDENTITY_EMAIL_CATALOG.templates[templateKey];
  if (!definition) {
    throw new RangeError(`unknown identity email template: ${templateKey}`);
  }
  const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);
  if (
    !templatePolicy
    || templatePolicy.realm !== definition.realm
    || templatePolicy.kind !== definition.kind
  ) {
    throw new RangeError(`invalid identity email template policy: ${templateKey}`);
  }

  const resolvedLocale = normalizeLocale(locale);
  const localized = IDENTITY_EMAIL_CATALOG.translations[resolvedLocale];
  const content = localized.templates[templateKey];
  const values = validatedValues(
    templateKey,
    definition,
    variables,
    localized.shared
  );

  return {
    template_key: templateKey,
    locale: resolvedLocale,
    direction: localized.direction,
    from: {
      email: IDENTITY_EMAIL_CATALOG.brand.sender_email,
      name: IDENTITY_EMAIL_CATALOG.brand.sender_name
    },
    subject: interpolate(content.subject, values),
    text: textBody(definition, content, localized.shared, values),
    html: htmlBody(
      resolvedLocale,
      localized.direction,
      definition,
      content,
      localized.shared,
      values
    )
  };
}

export const renderAuthEmail = renderIdentityEmail;

export function listIdentityEmailTemplateKeys() {
  return [...IDENTITY_EMAIL_TEMPLATE_KEYS];
}
