import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const WORKER_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const WRANGLER_CONFIG = path.join(WORKER_ROOT, "wrangler.toml");
const WRANGLER_BIN = path.join(WORKER_ROOT, "node_modules", ".bin", "wrangler");

export const REQUIRED_FALSE_FLAGS = Object.freeze([
  "CRM_AUTH_SCHEMA_READY",
  "CRM_AUTH_CANONICAL_RESOLVER",
  "CRM_AUTH_CUSTOMER_BOUNDARY",
  "CRM_AUTH_TELEGRAM_VERIFICATION",
  "CRM_AUTH_STAFF_RECONCILED",
  "CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT",
  "CRM_AUTH_STAFF_ENROLLMENT",
  "CRM_AUTH_CUSTOMER_PASSKEYS",
  "CRM_AUTH_STAFF_PASSKEYS",
  "CRM_AUTH_EMAIL_DELIVERY",
  "CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS",
  "CRM_AUTH_STAFF_RECOVERY",
  "CRM_AUTH_CUSTOMER_EMAIL",
  "CRM_AUTH_CUSTOMER_MERGE",
  "CRM_AUTH_LEGACY_LOGIN_DISABLED",
  "CRM_AUTH_CUSTOMER_WEBAUTHN_READY",
  "CRM_AUTH_STAFF_WEBAUTHN_READY",
  "CRM_AUTH_CLIENT_READY_TELEGRAM_BOT",
  "CRM_AUTH_CLIENT_READY_TELEGRAM_MINI_APP",
  "CRM_AUTH_CLIENT_READY_ADMIN_WEB",
  "CRM_AUTH_CLIENT_READY_ADMIN_ANDROID",
  "CRM_AUTH_CLIENT_READY_ADMIN_IOS",
  "CRM_AUTH_CLIENT_READY_CUSTOMER_WEB",
  "CRM_AUTH_CLIENT_READY_CUSTOMER_ANDROID",
  "CRM_AUTH_CLIENT_READY_CUSTOMER_IOS"
]);

export const REQUIRED_IDENTITY_TABLES = Object.freeze([
  "auth_accounts",
  "auth_email_addresses",
  "auth_external_identities",
  "auth_password_credentials",
  "auth_passkey_credentials",
  "auth_sessions",
  "auth_recovery_code_sets",
  "auth_recovery_codes",
  "auth_challenges",
  "auth_challenge_proofs",
  "auth_staff_invitations",
  "auth_email_change_requests",
  "auth_security_events",
  "auth_email_outbox",
  "auth_idempotency_keys",
  "auth_replay_guards",
  "auth_rate_limit_buckets",
  "auth_security_event_exports"
]);

const REQUIRED_FILES = Object.freeze([
  "migrations/0014_identity_email_recovery_foundation.sql",
  "migrations/0015_auth_account_locale.sql",
  "src/worker-entry.js",
  "src/identity/config.js",
  "src/identity/challenge-token.js",
  "src/identity/session-keyring.js",
  "src/identity/recovery-codes.js",
  "src/identity/staff/bootstrap.js",
  "src/identity/staff/invitation-acceptance.js",
  "src/identity/staff/invitation-http.js",
  "src/identity/staff/invitation-page.js",
  "src/identity/staff/enrollment-session.js",
  "src/identity/staff/enrollment-http.js",
  "src/identity/staff/enrollment-recovery-code-http.js",
  "src/identity/staff/enrollment-recovery-code-sets.js",
  "src/identity/staff/reconciliation-maintenance.js",
  "src/identity/staff/reconciliation-maintenance-workflow.js",
  "src/identity/staff/password-policy.js",
  "src/identity/staff/password-profile.js",
  "src/identity/staff/pwned-passwords.js",
  "src/identity/email/provider.js",
  "src/identity/email/dispatcher.js",
  "src/identity/email/outbox-crypto.js",
  "src/i18n/identity-email.generated.js",
  "src/i18n/admin-shared.generated.js",
  "test/identity-schema/account-locale-migration.test.js",
  "test/identity-staff/bootstrap-sqlite-integration.test.js",
  "test/identity-staff/invitation-acceptance-sqlite.test.js",
  "test/identity-staff/invitation-page.test.js",
  "test/identity-staff/invitation-worker-routing.test.js",
  "test/identity-staff/enrollment-session-sqlite.test.js",
  "test/identity-staff/enrollment-recovery-code-sets-sqlite.test.js",
  "test/identity-staff/reconciliation-maintenance-workflow.test.js",
  "test/identity-staff/password-policy.test.js",
  "test/identity-staff/password-profile.test.js",
  "test/identity-staff/pwned-passwords.test.js",
  "test/identity-staff/recovery-codes.test.js",
  "../shared/i18n/identity_email_templates.json",
  "../shared/i18n/admin_texts.json",
  "../scripts/check_admin_i18n.mjs",
  "../scripts/generate_admin_i18n.mjs",
  "../docs/architecture/identity-email-recovery-d1-contract.md",
  "../docs/verification/identity-recovery-api-implementation-contract.md",
  "../docs/runbooks/environment-staff-reconciliation.md",
  "../docs/runbooks/identity-email-controlled-delivery.md"
]);

const REQUIRED_STATIC_VARS = Object.freeze({
  CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me",
  CRM_AUTH_PUBLIC_ORIGIN: "https://crm.ayartuerk.me",
  CRM_AUTH_EMAIL_PROVIDER: "cloudflare",
  CRM_AUTH_EMAIL_FROM: "security@auth.ayartuerk.me",
  CRM_AUTH_EMAIL_FROM_NAME: "CRM Delivery Security",
  CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_CHALLENGE_HMAC_RETAINED_KEY_VERSIONS: "",
  CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "",
  CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_RECOVERY_CODE_HMAC_ACTIVE_KEY_VERSION: "1",
  CRM_AUTH_RECOVERY_CODE_HMAC_RETAINED_KEY_VERSIONS: "",
  CRM_AUTH_BOOTSTRAP_SUPERADMIN_LOCALE: "en",
  CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE: "en"
});

const REQUIRED_DECLARED_SECRETS = Object.freeze([
  "CRM_AUTH_EMAIL_OUTBOX_KEY_V1",
  "CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS",
  "CRM_AUTH_CHALLENGE_HMAC_KEY_V1",
  "CRM_AUTH_SESSION_HMAC_KEY_V1",
  "CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1",
  "CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1",
  "CRM_AUTH_FINGERPRINT_KEY_V1",
  "CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V1",
  "CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL",
  "CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL",
  "CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT"
]);

const REQUIRED_BINDING_NAMES = Object.freeze([
  "DB",
  "AUTH_EMAIL",
  "AUTH_EMAIL_QUEUE",
  "ENVIRONMENT_STAFF_RECONCILIATION_WORKFLOW"
]);
const REQUIRED_QUEUES = Object.freeze([
  "crm-auth-email-outbox",
  "crm-auth-email-outbox-dlq"
]);

function stripComment(line) {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') quoted = !quoted;
    if (character === "#" && !quoted) return line.slice(0, index);
  }
  return line;
}

function bracketsBalanced(value) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') quoted = !quoted;
    if (!quoted && character === "[") depth += 1;
    if (!quoted && character === "]") depth -= 1;
  }
  return depth === 0;
}

function parseTomlValue(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('"')) return JSON.parse(value);
  if (value.startsWith("[") && !value.includes("{")) return JSON.parse(value.replace(/,\s*]/g, "]"));
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?[0-9]+(?:\.[0-9]+)?$/.test(value)) return Number(value);
  return value;
}

export function parseWranglerToml(source) {
  const document = { root: {}, sections: {}, arrays: {} };
  const lines = String(source).split(/\r?\n/);
  let current = document.root;

  for (let index = 0; index < lines.length; index += 1) {
    let line = stripComment(lines[index]).trim();
    if (!line) continue;

    const arrayHeader = line.match(/^\[\[([^\]]+)]]$/);
    if (arrayHeader) {
      const name = arrayHeader[1].trim();
      current = {};
      (document.arrays[name] ||= []).push(current);
      continue;
    }

    const sectionHeader = line.match(/^\[([^\]]+)]$/);
    if (sectionHeader) {
      const name = sectionHeader[1].trim();
      current = document.sections[name] ||= {};
      continue;
    }

    const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!assignment) continue;
    const [, key] = assignment;
    let rawValue = assignment[2];
    while (rawValue.trimStart().startsWith("[") && !bracketsBalanced(rawValue)) {
      index += 1;
      if (index >= lines.length) throw new Error(`unterminated TOML array for ${key}`);
      rawValue += `\n${stripComment(lines[index]).trim()}`;
    }
    current[key] = parseTomlValue(rawValue);
  }

  return document;
}

function exactArray(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && value.every((item, index) => item === expected[index]);
}

function recordMatches(records, expected) {
  return records.some((record) => Object.entries(expected).every(([key, value]) => {
    if (Array.isArray(value)) return exactArray(record[key], value);
    return record[key] === value;
  }));
}

function readUtf8(relativePath) {
  return fs.readFileSync(path.resolve(WORKER_ROOT, relativePath), "utf8");
}

export function validateLocalPredeploy({
  workerRoot = WORKER_ROOT,
  configSource = fs.readFileSync(path.join(workerRoot, "wrangler.toml"), "utf8"),
  migration0014 = fs.readFileSync(
    path.join(workerRoot, "migrations", "0014_identity_email_recovery_foundation.sql"),
    "utf8"
  ),
  migration0015 = fs.readFileSync(
    path.join(workerRoot, "migrations", "0015_auth_account_locale.sql"),
    "utf8"
  ),
  workerEntry = fs.readFileSync(path.join(workerRoot, "src", "worker-entry.js"), "utf8"),
  packageJson = JSON.parse(fs.readFileSync(path.join(workerRoot, "package.json"), "utf8"))
} = {}) {
  const errors = [];
  const config = parseWranglerToml(configSource);
  const vars = config.sections.vars || {};
  const declaredSecrets = config.sections.secrets?.required;

  for (const relativePath of REQUIRED_FILES) {
    if (!fs.existsSync(path.resolve(workerRoot, relativePath))) {
      errors.push(`required file is missing: ${relativePath}`);
    }
  }

  for (const flagName of REQUIRED_FALSE_FLAGS) {
    if (vars[flagName] !== "false") {
      errors.push(`${flagName} must be explicitly set to the string \"false\"`);
    }
  }
  for (const [name, value] of Object.entries(vars)) {
    if (
      name.startsWith("CRM_AUTH_")
      && (value === true || (typeof value === "string" && value.toLowerCase() === "true"))
    ) {
      errors.push(`staged identity configuration cannot contain an enabled flag: ${name}`);
    }
  }
  for (const [name, expected] of Object.entries(REQUIRED_STATIC_VARS)) {
    if (vars[name] !== expected) errors.push(`${name} must equal ${JSON.stringify(expected)}`);
  }

  if (!Array.isArray(declaredSecrets)) {
    errors.push("[secrets].required must declare required remote secret names");
  } else {
    const duplicateSecrets = declaredSecrets.filter(
      (name, index) => declaredSecrets.indexOf(name) !== index
    );
    if (duplicateSecrets.length) errors.push("[secrets].required contains duplicate names");
    for (const name of REQUIRED_DECLARED_SECRETS) {
      if (!declaredSecrets.includes(name)) errors.push(`required secret name is not declared: ${name}`);
    }
    for (const name of declaredSecrets) {
      if (!/^CRM_AUTH_[A-Z0-9_]+$/.test(name)) {
        errors.push("[secrets].required contains an invalid secret name");
      }
      if (Object.hasOwn(vars, name)) {
        errors.push(`secret ${name} must not be stored in [vars]`);
      }
    }
  }

  if (config.root.name !== "crm-delivery-worker") errors.push("Worker name must remain crm-delivery-worker");
  if (config.root.main !== "src/worker-entry.js") {
    errors.push("Worker entry point must remain the reviewed Cloudflare wrapper");
  }
  if (
    !/import\s+worker\s+from\s+["']\.\/index\.js["'];/.test(workerEntry)
    || !/EnvironmentStaffReconciliationWorkflow/.test(workerEntry)
    || !/export\s+default\s+worker;/.test(workerEntry)
    || /\b(?:fetch|queue|scheduled)\s*\(/.test(workerEntry)
    || /\.create\s*\(/.test(workerEntry)
  ) {
    errors.push("Cloudflare Worker wrapper must only delegate and export the maintenance Workflow");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(config.root.compatibility_date || ""))) {
    errors.push("compatibility_date must be present in YYYY-MM-DD form");
  }

  if (
    Object.hasOwn(vars, "CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE")
    || declaredSecrets?.includes("CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE")
  ) {
    errors.push("staff reconciliation maintenance gate must remain an ephemeral Worker secret");
  }

  if (!recordMatches(config.arrays.d1_databases || [], {
    binding: "DB",
    database_name: "crm-delivery-db",
    database_id: "14103291-eb66-4a3d-9f84-585832a4b015"
  })) {
    errors.push("canonical D1 binding DB/crm-delivery-db is missing or changed");
  }
  const workflows = config.arrays.workflows || [];
  if (
    workflows.length !== 1
    || !recordMatches(workflows, {
      name: "crm-environment-staff-reconciliation",
      binding: "ENVIRONMENT_STAFF_RECONCILIATION_WORKFLOW",
      class_name: "EnvironmentStaffReconciliationWorkflow"
    })
    || Object.hasOwn(workflows[0] || {}, "script_name")
    || Object.hasOwn(workflows[0] || {}, "schedules")
  ) {
    errors.push("owner maintenance Workflow binding is missing or exposes an unreviewed trigger");
  }
  if (!recordMatches(config.arrays.send_email || [], {
    name: "AUTH_EMAIL",
    allowed_sender_addresses: ["security@auth.ayartuerk.me"],
    remote: false
  })) {
    errors.push("AUTH_EMAIL must be sender-restricted and locally simulated");
  }
  if (!recordMatches(config.arrays["queues.producers"] || [], {
    binding: "AUTH_EMAIL_QUEUE",
    queue: "crm-auth-email-outbox",
    remote: false
  })) {
    errors.push("AUTH_EMAIL_QUEUE must target the controlled outbox queue and remain local by default");
  }
  if (!recordMatches(config.arrays["queues.consumers"] || [], {
    queue: "crm-auth-email-outbox",
    dead_letter_queue: "crm-auth-email-outbox-dlq"
  })) {
    errors.push("main identity email queue consumer/DLQ wiring is missing");
  }
  if (!recordMatches(config.arrays["queues.consumers"] || [], {
    queue: "crm-auth-email-outbox-dlq"
  })) {
    errors.push("identity email dead-letter queue consumer is missing");
  }
  if (!exactArray(config.sections.triggers?.crons, ["* * * * *"])) {
    errors.push("identity outbox sweep cron must remain configured once per minute");
  }

  for (const table of REQUIRED_IDENTITY_TABLES) {
    const expression = new RegExp(`CREATE\\s+TABLE\\s+${table}\\s*\\(`, "i");
    if (!expression.test(migration0014)) errors.push(`0014 is missing canonical table ${table}`);
  }
  if (!/(?:PRAGMA\s+foreign_key_check\s*;|FROM\s+pragma_foreign_key_check\b)/i.test(migration0014)) {
    errors.push("0014 must contain a foreign-key verification gate");
  }
  if (!/ALTER\s+TABLE\s+auth_accounts\s+ADD\s+COLUMN\s+locale\s+TEXT/i.test(migration0015)) {
    errors.push("0015 must add auth_accounts.locale");
  }
  for (const locale of ["en", "de", "tr", "ar", "ru"]) {
    if (!migration0015.includes(`'${locale}'`)) errors.push(`0015 locale constraint is missing ${locale}`);
  }
  if (!/DEFAULT\s+'en'/i.test(migration0015)) errors.push("0015 locale default must be en");

  for (const scriptName of ["test", "i18n:identity:check", "i18n:admin:check"]) {
    if (!packageJson.scripts?.[scriptName]) errors.push(`package script is missing: ${scriptName}`);
  }

  return {
    errors,
    config,
    requiredSecrets: Array.isArray(declaredSecrets) ? [...declaredSecrets] : []
  };
}

function removeAnsi(value) {
  return String(value).replace(/\u001b\[[0-9;]*m/g, "");
}

export function parseWranglerJson(output) {
  const clean = removeAnsi(output).trim();
  try {
    return JSON.parse(clean);
  } catch {
    const firstArray = clean.indexOf("[");
    const firstObject = clean.indexOf("{");
    const start = [firstArray, firstObject].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    const end = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));
    if (start === undefined || end < start) throw new Error("Wrangler did not return JSON");
    return JSON.parse(clean.slice(start, end + 1));
  }
}

function collectObjects(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output);
  } else if (value && typeof value === "object") {
    output.push(value);
    for (const item of Object.values(value)) collectObjects(item, output);
  }
  return output;
}

export function validateSecretInventory(payload, requiredSecrets) {
  const names = new Set(
    collectObjects(payload)
      .map((entry) => entry.name)
      .filter((name) => typeof name === "string")
  );
  return requiredSecrets.filter((name) => !names.has(name));
}

export function validateRemoteSchemaPayload(payload) {
  const row = collectObjects(payload).find((entry) => (
    Object.hasOwn(entry, "foreign_key_violations")
    && Object.hasOwn(entry, "identity_table_count")
    && Object.hasOwn(entry, "locale_column_count")
  ));
  if (!row) return ["remote D1 schema query returned no verification row"];
  const errors = [];
  if (Number(row.foreign_key_violations) !== 0) errors.push("remote D1 has foreign-key violations");
  if (Number(row.identity_table_count) !== REQUIRED_IDENTITY_TABLES.length) {
    errors.push("remote D1 identity table count does not match the canonical schema");
  }
  if (Number(row.locale_column_count) !== 1) errors.push("remote D1 auth_accounts.locale is missing");
  return errors;
}

function commandFailure(label, result) {
  const detail = removeAnsi(result.stderr || result.stdout || "")
    .trim()
    .split(/\r?\n/)
    .slice(-8)
    .join("\n");
  return new Error(`${label} failed with exit code ${result.status}${detail ? `\n${detail}` : ""}`);
}

function runCapture(command, args, { label, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd: WORKER_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1", ...env }
  });
  if (result.error) throw new Error(`${label || command} could not start: ${result.error.message}`);
  if (result.status !== 0) throw commandFailure(label || command, result);
  return result.stdout;
}

function wranglerEnvironment(tempRoot) {
  return {
    WRANGLER_LOG_PATH: path.join(tempRoot, "wrangler.log")
  };
}

function runLocalCommands() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crm-identity-predeploy-"));
  try {
    const testFiles = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (entry.isFile() && entry.name.endsWith(".test.js")) testFiles.push(target);
      }
    };
    visit(path.join(WORKER_ROOT, "test"));
    testFiles.sort();
    runCapture(process.execPath, ["--test", ...testFiles], { label: "Worker test suite" });
    runCapture(process.execPath, ["--check", "src/index.js"], { label: "Worker syntax check" });
    runCapture(process.execPath, ["--check", "src/worker-entry.js"], {
      label: "Cloudflare Worker entry syntax check"
    });
    runCapture(process.execPath, ["scripts/check-identity-i18n.mjs"], {
      label: "identity localization drift check"
    });
    runCapture(process.execPath, ["../scripts/check_admin_i18n.mjs"], {
      label: "shared Admin localization drift check"
    });
    if (!fs.existsSync(WRANGLER_BIN)) throw new Error("repo-local Wrangler is missing");
    const isolatedConfig = path.join(tempRoot, "wrangler.toml");
    fs.copyFileSync(WRANGLER_CONFIG, isolatedConfig);
    fs.symlinkSync(path.join(WORKER_ROOT, "src"), path.join(tempRoot, "src"), "dir");
    runCapture(WRANGLER_BIN, [
      "deploy",
      "--dry-run",
      "--config",
      isolatedConfig,
      "--cwd",
      tempRoot,
      "--keep-vars",
      "--outdir",
      path.join(tempRoot, "bundle"),
      "--upload-source-maps=false"
    ], {
      label: "Wrangler no-send dry-run",
      env: wranglerEnvironment(tempRoot)
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runWrangler(args, label, tempRoot) {
  return runCapture(WRANGLER_BIN, args, {
    label,
    env: wranglerEnvironment(tempRoot)
  });
}

function remoteSchemaSql() {
  const tableNames = REQUIRED_IDENTITY_TABLES.map((name) => `'${name}'`).join(",");
  return `SELECT (SELECT COUNT(*) FROM pragma_foreign_key_check) AS foreign_key_violations,`
    + ` (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN (${tableNames}))`
    + ` AS identity_table_count,`
    + ` (SELECT COUNT(*) FROM pragma_table_info('auth_accounts') WHERE name='locale')`
    + ` AS locale_column_count;`;
}

function runRemotePrerequisites(requiredSecrets) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crm-identity-remote-"));
  const errors = [];
  try {
    const secretPayload = parseWranglerJson(runWrangler(
      ["secret", "list", "--format=json"],
      "remote secret-name inventory",
      tempRoot
    ));
    for (const name of validateSecretInventory(secretPayload, requiredSecrets)) {
      errors.push(`required remote secret name is missing: ${name}`);
    }

    const queues = runWrangler(["queues", "list"], "remote queue inventory", tempRoot);
    for (const queueName of REQUIRED_QUEUES) {
      if (!queues.includes(queueName)) errors.push(`required remote queue is missing: ${queueName}`);
    }

    const pendingMigrations = runWrangler(
      ["d1", "migrations", "list", "DB", "--remote"],
      "remote D1 migration inventory",
      tempRoot
    );
    for (const migration of [
      "0014_identity_email_recovery_foundation.sql",
      "0015_auth_account_locale.sql"
    ]) {
      if (pendingMigrations.includes(migration)) errors.push(`remote D1 migration is still pending: ${migration}`);
    }

    const schemaPayload = parseWranglerJson(runWrangler([
      "d1",
      "execute",
      "DB",
      "--remote",
      "--json",
      "--yes",
      `--command=${remoteSchemaSql()}`
    ], "remote D1 schema verification", tempRoot));
    errors.push(...validateRemoteSchemaPayload(schemaPayload));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  return errors;
}

function runRemoteDeploymentVerification(requiredSecrets) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crm-identity-deployed-"));
  const errors = [];
  try {
    const status = parseWranglerJson(runWrangler(
      ["deployments", "status", "--json"],
      "deployed Worker status",
      tempRoot
    ));
    const activeVersions = Array.isArray(status?.versions)
      ? status.versions.filter((entry) => Number(entry.percentage) > 0)
      : [];
    if (!activeVersions.length) errors.push("deployed Worker has no active version");
    for (const active of activeVersions) {
      if (typeof active.version_id !== "string") {
        errors.push("deployed Worker status omitted an active version ID");
        continue;
      }
      const version = parseWranglerJson(runWrangler(
        ["versions", "view", active.version_id, "--json"],
        "deployed Worker binding inventory",
        tempRoot
      ));
      const names = new Set(
        Array.isArray(version?.resources?.bindings)
          ? version.resources.bindings.map((binding) => binding.name)
          : []
      );
      for (const name of [...REQUIRED_BINDING_NAMES, ...requiredSecrets]) {
        if (!names.has(name)) errors.push(`active Worker version is missing binding name: ${name}`);
      }
    }

    for (const queueName of REQUIRED_QUEUES) {
      const consumers = parseWranglerJson(runWrangler(
        ["queues", "consumer", "list", queueName, "--json"],
        `deployed consumer inventory for ${queueName}`,
        tempRoot
      ));
      const workerNames = new Set(
        collectObjects(consumers)
          .flatMap((entry) => [entry.script_name, entry.service, entry.worker_name, entry.name])
          .filter((name) => typeof name === "string")
      );
      if (!workerNames.has("crm-delivery-worker")) {
        errors.push(`queue has no crm-delivery-worker consumer: ${queueName}`);
      }
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
  return errors;
}

function usage() {
  return [
    "Usage: node scripts/identity-predeploy.mjs [--remote-prerequisites] [--remote-deployed]",
    "",
    "Default: offline local policy, migration, tests, localization, syntax, and Wrangler dry-run.",
    "--remote-prerequisites: read-only checks for secret names, queues, applied migrations, and D1 schema.",
    "--remote-deployed: also verify bindings and queue consumers on every active Worker version."
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const allowed = new Set(["--remote-prerequisites", "--remote-deployed"]);
  for (const argument of argv) {
    if (!allowed.has(argument)) throw new Error(`unknown argument: ${argument}`);
  }

  process.stdout.write("Identity predeployment guard: static policy\n");
  const local = validateLocalPredeploy();
  if (local.errors.length) {
    throw new Error(`local identity policy failed:\n- ${local.errors.join("\n- ")}`);
  }
  process.stdout.write("Identity predeployment guard: offline verification\n");
  runLocalCommands();

  if (argv.includes("--remote-prerequisites") || argv.includes("--remote-deployed")) {
    process.stdout.write("Identity predeployment guard: explicit read-only remote prerequisites\n");
    const errors = runRemotePrerequisites(local.requiredSecrets);
    if (errors.length) throw new Error(`remote identity prerequisites failed:\n- ${errors.join("\n- ")}`);
  }
  if (argv.includes("--remote-deployed")) {
    process.stdout.write("Identity predeployment guard: explicit deployed wiring verification\n");
    const errors = runRemoteDeploymentVerification(local.requiredSecrets);
    if (errors.length) throw new Error(`deployed identity wiring failed:\n- ${errors.join("\n- ")}`);
  }
  process.stdout.write("Identity predeployment guard: PASS\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Identity predeployment guard: FAIL\n${error.message}\n`);
    process.exitCode = 1;
  }
}
