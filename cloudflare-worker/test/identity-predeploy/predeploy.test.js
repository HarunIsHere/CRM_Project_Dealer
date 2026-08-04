import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  parseWranglerJson,
  parseWranglerToml,
  REQUIRED_IDENTITY_TABLES,
  validateLocalPredeploy,
  validateRemoteSchemaPayload,
  validateSecretInventory
} from "../../scripts/identity-predeploy.mjs";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ROOT = path.resolve(TEST_DIR, "../..");
const CONFIG = fs.readFileSync(path.join(WORKER_ROOT, "wrangler.toml"), "utf8");
const MIGRATION_0014 = fs.readFileSync(
  path.join(WORKER_ROOT, "migrations", "0014_identity_email_recovery_foundation.sql"),
  "utf8"
);
const MIGRATION_0015 = fs.readFileSync(
  path.join(WORKER_ROOT, "migrations", "0015_auth_account_locale.sql"),
  "utf8"
);
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(WORKER_ROOT, "package.json"), "utf8"));

function validate(configSource = CONFIG, migration0014 = MIGRATION_0014, migration0015 = MIGRATION_0015) {
  return validateLocalPredeploy({
    workerRoot: WORKER_ROOT,
    configSource,
    migration0014,
    migration0015,
    packageJson: PACKAGE_JSON
  });
}

test("current staged identity configuration passes static predeployment policy", () => {
  assert.deepEqual(validate().errors, []);
});

test("TOML subset parser reads multiline secret arrays and binding records", () => {
  const parsed = parseWranglerToml(CONFIG);
  assert.deepEqual(parsed.sections.secrets.required, [
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
  assert.deepEqual(parsed.arrays.workflows, [{
    name: "crm-environment-staff-reconciliation",
    binding: "ENVIRONMENT_STAFF_RECONCILIATION_WORKFLOW",
    class_name: "EnvironmentStaffReconciliationWorkflow"
  }]);
  assert.equal(parsed.arrays.send_email[0].name, "AUTH_EMAIL");
  assert.equal(parsed.arrays["queues.producers"][0].remote, false);
});

test("guard fails closed when any staged identity flag is enabled", () => {
  const changed = CONFIG.replace(
    'CRM_AUTH_STAFF_RECOVERY = "false"',
    'CRM_AUTH_STAFF_RECOVERY = "true"'
  );
  assert.match(validate(changed).errors.join("\n"), /CRM_AUTH_STAFF_RECOVERY/);
});

test("guard rejects missing controlled-delivery secret declaration", () => {
  const changed = CONFIG.replace('  "CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS",\n', "");
  assert.match(
    validate(changed).errors.join("\n"),
    /required secret name is not declared: CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS/
  );
});

test("guard rejects a remote email binding in offline configuration", () => {
  const changed = CONFIG.replace(
    'allowed_sender_addresses = ["security@auth.ayartuerk.me"]\nremote = false',
    'allowed_sender_addresses = ["security@auth.ayartuerk.me"]\nremote = true'
  );
  assert.match(validate(changed).errors.join("\n"), /AUTH_EMAIL/);
});

test("guard rejects a permanently enabled or externally scripted maintenance runner", () => {
  const permanentGate = CONFIG.replace(
    'CRM_AUTH_STAFF_RECOVERY = "false"',
    'CRM_AUTH_STAFF_RECOVERY = "false"\nCRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE = "enabled"'
  );
  assert.match(
    validate(permanentGate).errors.join("\n"),
    /maintenance gate must remain an ephemeral Worker secret/
  );

  const externalWorkflow = CONFIG.replace(
    'class_name = "EnvironmentStaffReconciliationWorkflow"',
    'class_name = "EnvironmentStaffReconciliationWorkflow"\nscript_name = "other-worker"'
  );
  assert.match(
    validate(externalWorkflow).errors.join("\n"),
    /maintenance Workflow binding/
  );
});

test("guard rejects canonical schema drift", () => {
  const changed = MIGRATION_0014.replace("CREATE TABLE auth_security_events", "CREATE TABLE removed_events");
  assert.match(validate(CONFIG, changed).errors.join("\n"), /auth_security_events/);
});

test("secret inventory checks names without requiring or returning values", () => {
  const payload = parseWranglerJson('[{"name":"CRM_AUTH_EMAIL_OUTBOX_KEY_V1","type":"secret_text"}]');
  assert.deepEqual(validateSecretInventory(payload, [
    "CRM_AUTH_EMAIL_OUTBOX_KEY_V1",
    "CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS"
  ]), ["CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS"]);
  assert.equal(JSON.stringify(payload).includes("secret-value"), false);
});

test("remote schema result requires all canonical tables, locale, and clean foreign keys", () => {
  const good = [{ results: [{
    foreign_key_violations: 0,
    identity_table_count: REQUIRED_IDENTITY_TABLES.length,
    locale_column_count: 1
  }] }];
  assert.deepEqual(validateRemoteSchemaPayload(good), []);

  const bad = structuredClone(good);
  bad[0].results[0].foreign_key_violations = 2;
  bad[0].results[0].locale_column_count = 0;
  assert.deepEqual(validateRemoteSchemaPayload(bad), [
    "remote D1 has foreign-key violations",
    "remote D1 auth_accounts.locale is missing"
  ]);
});
