import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);

export const CATALOG_PATH = path.resolve(
  SCRIPT_DIR,
  "../../shared/i18n/identity_email_templates.json"
);
export const OUTPUT_PATH = path.resolve(
  SCRIPT_DIR,
  "../src/i18n/identity-email.generated.js"
);

const EXPECTED_LOCALES = ["en", "de", "tr", "ar", "ru"];
const SHARED_FIELDS = [
  "code_label",
  "code_help",
  "link_fallback",
  "expires_at",
  "ignore",
  "security_notice",
  "event_time",
  "not_you",
  "support_notice",
  "footer",
  "role_admin",
  "role_superadmin"
];
const CONTENT_FIELDS = {
  link: ["subject", "preheader", "heading", "intro", "cta"],
  link_code: ["subject", "preheader", "heading", "intro", "cta"],
  code: ["subject", "preheader", "heading", "intro"],
  notification: ["subject", "preheader", "heading", "intro"]
};
const VARIABLE_TYPES = new Set([
  "username",
  "staff_role",
  "first_party_auth_url",
  "email_code",
  "rfc3339_timestamp"
]);
const VARIABLE_NAME_TYPES = {
  username: "username",
  role: "staff_role",
  action_url: "first_party_auth_url",
  manual_code: "email_code",
  expires_at: "rfc3339_timestamp",
  event_time: "rfc3339_timestamp"
};
const STRUCTURAL_VARIABLES = {
  link: new Set(["action_url", "expires_at"]),
  link_code: new Set(["action_url", "manual_code", "expires_at"]),
  code: new Set(["manual_code", "expires_at"]),
  notification: new Set(["event_time"])
};

function fail(message) {
  throw new Error(`identity email catalog: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, context) {
  if (!isRecord(value)) fail(`${context} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${context} keys must be exactly: ${wanted.join(", ")}`);
  }
}

function placeholders(value) {
  return [...value.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map((match) => match[1]);
}

function validateText(value, context, allowedVariables) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${context} must be a non-empty string`);
  }
  if (/[<>]/.test(value)) {
    fail(`${context} must contain structured text, not HTML`);
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    fail(`${context} must not contain control characters`);
  }
  for (const variable of placeholders(value)) {
    if (!allowedVariables.has(variable)) {
      fail(`${context} uses undeclared variable {${variable}}`);
    }
  }
}

function validateTemplateDefinitions(templates) {
  if (!isRecord(templates) || Object.keys(templates).length === 0) {
    fail("templates must be a non-empty object");
  }

  for (const [templateKey, definition] of Object.entries(templates)) {
    if (!/^auth\.(staff|customer)\.[a-z0-9_.]+\.v[1-9][0-9]*$/.test(templateKey)) {
      fail(`invalid versioned template key: ${templateKey}`);
    }
    assertExactKeys(
      definition,
      ["kind", "realm", "layout", "variables"],
      `templates.${templateKey}`
    );
    if (!["challenge", "notification"].includes(definition.kind)) {
      fail(`${templateKey}.kind is invalid`);
    }
    if (!["staff", "customer"].includes(definition.realm)) {
      fail(`${templateKey}.realm is invalid`);
    }
    if (!templateKey.startsWith(`auth.${definition.realm}.`)) {
      fail(`${templateKey}.realm does not match its key`);
    }
    if (!Object.hasOwn(CONTENT_FIELDS, definition.layout)) {
      fail(`${templateKey}.layout is invalid`);
    }
    if (definition.kind === "notification" && definition.layout !== "notification") {
      fail(`${templateKey} notification must use notification layout`);
    }
    if (definition.kind === "challenge" && definition.layout === "notification") {
      fail(`${templateKey} challenge cannot use notification layout`);
    }
    if (!isRecord(definition.variables)) {
      fail(`${templateKey}.variables must be an object`);
    }
    for (const [variable, type] of Object.entries(definition.variables)) {
      if (!/^[a-z][a-z0-9_]*$/.test(variable)) {
        fail(`${templateKey} has invalid variable name ${variable}`);
      }
      if (!VARIABLE_TYPES.has(type)) {
        fail(`${templateKey}.${variable} has invalid type ${type}`);
      }
      if (VARIABLE_NAME_TYPES[variable] !== type) {
        fail(`${templateKey}.${variable} must use type ${VARIABLE_NAME_TYPES[variable] || "none"}`);
      }
    }
    for (const variable of STRUCTURAL_VARIABLES[definition.layout]) {
      if (!Object.hasOwn(definition.variables, variable)) {
        fail(`${templateKey} is missing structural variable ${variable}`);
      }
    }
  }
}

export function validateIdentityEmailCatalog(catalog) {
  assertExactKeys(
    catalog,
    ["schema_version", "supported_locales", "brand", "templates", "translations"],
    "root"
  );
  if (catalog.schema_version !== 1) fail("schema_version must be 1");
  if (
    !Array.isArray(catalog.supported_locales)
    || catalog.supported_locales.length !== EXPECTED_LOCALES.length
    || catalog.supported_locales.some((locale, index) => locale !== EXPECTED_LOCALES[index])
  ) {
    fail(`supported_locales must be ${EXPECTED_LOCALES.join(", ")}`);
  }
  assertExactKeys(
    catalog.brand,
    ["name", "sender_name", "sender_email", "first_party_origin"],
    "brand"
  );
  if (catalog.brand.name !== "CRM Delivery") fail("brand.name is invalid");
  if (catalog.brand.sender_name !== "CRM Delivery Security") {
    fail("brand.sender_name is invalid");
  }
  if (catalog.brand.sender_email !== "security@auth.ayartuerk.me") {
    fail("brand.sender_email is invalid");
  }
  if (catalog.brand.first_party_origin !== "https://crm.ayartuerk.me") {
    fail("brand.first_party_origin is invalid");
  }

  validateTemplateDefinitions(catalog.templates);
  assertExactKeys(catalog.translations, EXPECTED_LOCALES, "translations");
  const templateKeys = Object.keys(catalog.templates).sort();

  for (const locale of EXPECTED_LOCALES) {
    const localeCatalog = catalog.translations[locale];
    assertExactKeys(localeCatalog, ["direction", "shared", "templates"], `translations.${locale}`);
    const expectedDirection = locale === "ar" ? "rtl" : "ltr";
    if (localeCatalog.direction !== expectedDirection) {
      fail(`${locale}.direction must be ${expectedDirection}`);
    }
    assertExactKeys(localeCatalog.shared, SHARED_FIELDS, `${locale}.shared`);
    for (const [field, value] of Object.entries(localeCatalog.shared)) {
      const allowed = new Set(
        field === "expires_at"
          ? ["expires_at"]
          : field === "event_time"
            ? ["event_time"]
            : []
      );
      validateText(value, `${locale}.shared.${field}`, allowed);
    }

    assertExactKeys(localeCatalog.templates, templateKeys, `${locale}.templates`);
    for (const templateKey of templateKeys) {
      const definition = catalog.templates[templateKey];
      const translation = localeCatalog.templates[templateKey];
      assertExactKeys(
        translation,
        CONTENT_FIELDS[definition.layout],
        `${locale}.templates.${templateKey}`
      );
      const allowed = new Set(Object.keys(definition.variables));
      const used = new Set(STRUCTURAL_VARIABLES[definition.layout]);
      for (const [field, value] of Object.entries(translation)) {
        validateText(value, `${locale}.${templateKey}.${field}`, allowed);
        for (const variable of placeholders(value)) used.add(variable);
      }
      for (const variable of allowed) {
        if (!used.has(variable)) {
          fail(`${locale}.${templateKey} declares unused variable ${variable}`);
        }
      }
    }
  }

  return catalog;
}

export function loadIdentityEmailCatalog() {
  const source = fs.readFileSync(CATALOG_PATH, "utf8");
  return validateIdentityEmailCatalog(JSON.parse(source));
}

export function generateIdentityEmailModule(catalog = loadIdentityEmailCatalog()) {
  const serialized = JSON.stringify(catalog, null, 2);
  return `// Generated by scripts/generate-identity-i18n.mjs. Do not edit by hand.\n`
    + `function deepFreeze(value) {\n`
    + `  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;\n`
    + `  Object.freeze(value);\n`
    + `  for (const child of Object.values(value)) deepFreeze(child);\n`
    + `  return value;\n`
    + `}\n\n`
    + `export const IDENTITY_EMAIL_CATALOG = deepFreeze(${serialized});\n\n`
    + `export const IDENTITY_EMAIL_TEMPLATE_KEYS = Object.freeze(\n`
    + `  Object.keys(IDENTITY_EMAIL_CATALOG.templates)\n`
    + `);\n`;
}

function main() {
  const generated = generateIdentityEmailModule();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, generated, "utf8");
  process.stdout.write(`Generated ${OUTPUT_PATH}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
