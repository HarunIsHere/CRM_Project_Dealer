import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STAFF_RECONCILIATION_STEP_NAME,
  STAFF_RECONCILIATION_WORKFLOW_NAME,
  StaffReconciliationMaintenanceInvocationError,
  runEnvironmentStaffReconciliationMaintenance
} from "../../src/identity/staff/reconciliation-maintenance.js";

const OWNER_RECEIPT = "runbook:staff-bootstrap:maintenance-test";

function reconciledRow({ username, role, email, locale, suffix }) {
  const id = String(suffix).repeat(32).slice(0, 32);
  return {
    admin_user_id: Number(suffix),
    username,
    username_normalized: username.toLowerCase(),
    password_hash: "!canonical-auth-disabled!",
    role,
    is_active: 1,
    is_protected: 1,
    auth_account_id: id,
    account_realm: "staff",
    account_status: "active",
    enrollment_state: "complete",
    enrollment_deadline_at: null,
    account_locale: locale,
    email_address_id: `e${id.slice(1)}`,
    normalized_email: email,
    email_status: "verified",
    email_is_primary: 1,
    invitation_id: `i${id.slice(1)}`,
    invitation_status: "accepted",
    invited_by_actor_ref: OWNER_RECEIPT,
    challenge_id: `c${id.slice(1)}`,
    challenge_purpose: "staff_invitation",
    challenge_status: "consumed",
    challenge_locale: locale,
    outbox_id: `o${id.slice(1)}`,
    outbox_template_key: "auth.staff.invitation.v1",
    outbox_status: "sent",
    outbox_locale: locale,
    email_match_count: 1,
    invitation_match_count: 1,
    outbox_match_count: 1,
    security_event_count: 1,
    password_credential_count: 1
  };
}

class ExactReconciledDatabase {
  constructor(rows) {
    this.rows = new Map(rows.map((row) => [row.username_normalized, row]));
    this.readCount = 0;
  }

  prepare(sql) {
    assert.match(sql, /staff-bootstrap-state-v1/);
    let bindings = [];
    const database = this;
    return {
      bind(...values) {
        bindings = values;
        return this;
      },
      async first() {
        database.readCount += 1;
        return database.rows.get(bindings.at(-1)) ?? null;
      }
    };
  }

  async batch() {
    assert.fail("an exact repeated reconciliation must not write");
  }
}

function environment() {
  const rows = [
    reconciledRow({
      username: "senkimsin",
      role: "superadmin",
      email: "owner@example.com",
      locale: "de",
      suffix: 1
    }),
    reconciledRow({
      username: "admin",
      role: "admin",
      email: "admin@example.com",
      locale: "tr",
      suffix: 2
    })
  ];
  return {
    DB: new ExactReconciledDatabase(rows),
    SUPERADMIN_USERNAME: "senkimsin",
    ADMIN_USERNAME: "admin",
    CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE: "execute",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL: "owner@example.com",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_LOCALE: "de",
    CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
    CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE: "tr",
    CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT: OWNER_RECEIPT,
    CRM_AUTH_FINGERPRINT_KEY_V1: "f".repeat(64),
    CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "c".repeat(64),
    CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me",
    CRM_AUTH_PUBLIC_ORIGIN: "https://crm.ayartuerk.me"
  };
}

function workflowStep(calls) {
  return {
    async do(name, callback) {
      calls.push(name);
      return callback();
    }
  };
}

function isInvocationError(code) {
  return (error) => (
    error instanceof StaffReconciliationMaintenanceInvocationError
    && error.code === code
  );
}

test("the Workflow returns only the existing masked idempotent result", async () => {
  const env = environment();
  const stepCalls = [];
  const event = {
    workflowName: STAFF_RECONCILIATION_WORKFLOW_NAME,
    payload: undefined,
    timestamp: new Date("2030-01-01T00:00:00.000Z")
  };

  const first = await runEnvironmentStaffReconciliationMaintenance(
    env,
    event,
    workflowStep(stepCalls)
  );
  const repeated = await runEnvironmentStaffReconciliationMaintenance(
    env,
    event,
    workflowStep(stepCalls)
  );

  assert.deepEqual(first, {
    outcome: "already_reconciled",
    account_count: 2,
    accounts: [
      {
        role: "superadmin",
        locale: "de",
        email_masked: "o***@example.com",
        enrollment_state: "complete"
      },
      {
        role: "admin",
        locale: "tr",
        email_masked: "a***@example.com",
        enrollment_state: "complete"
      }
    ]
  });
  assert.deepEqual(repeated, first);
  assert.deepEqual(stepCalls, [
    STAFF_RECONCILIATION_STEP_NAME,
    STAFF_RECONCILIATION_STEP_NAME
  ]);
  assert.equal(env.DB.readCount, 4);
  assert.doesNotMatch(
    JSON.stringify(first),
    /owner@example\.com|admin@example\.com|CRM_AUTH|password|token|secret/i
  );
});

test("the Workflow rejects parameters and a mismatched management-plane name", async () => {
  const env = environment();
  let stepCalled = false;
  const step = {
    async do() {
      stepCalled = true;
      assert.fail("a rejected invocation must not enter the durable step");
    }
  };

  await assert.rejects(
    () => runEnvironmentStaffReconciliationMaintenance(env, {
      workflowName: STAFF_RECONCILIATION_WORKFLOW_NAME,
      payload: { email: "must-not-be-accepted@example.com" }
    }, step),
    isInvocationError("E_STAFF_RECONCILIATION_PARAMETERS_FORBIDDEN")
  );
  await assert.rejects(
    () => runEnvironmentStaffReconciliationMaintenance(
      env,
      { workflowName: "other-workflow", payload: undefined },
      step
    ),
    isInvocationError("E_STAFF_RECONCILIATION_WORKFLOW_INVALID")
  );
  await assert.rejects(
    () => runEnvironmentStaffReconciliationMaintenance(env, {
      workflowName: STAFF_RECONCILIATION_WORKFLOW_NAME,
      payload: undefined,
      schedule: "0 0 * * *"
    }, step),
    isInvocationError("E_STAFF_RECONCILIATION_SCHEDULE_FORBIDDEN")
  );

  assert.equal(stepCalled, false);
  assert.equal(env.DB.readCount, 0);
});

test("configuration exposes only the authenticated Workflow trigger", async () => {
  const [config, adapterSource, workflowSource, entrySource, indexSource, runbook] = await Promise.all([
    readFile(new URL("../../wrangler.toml", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../src/identity/staff/reconciliation-maintenance.js",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../../src/identity/staff/reconciliation-maintenance-workflow.js",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(new URL("../../src/worker-entry.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/index.js", import.meta.url), "utf8"),
    readFile(
      new URL("../../../docs/runbooks/environment-staff-reconciliation.md", import.meta.url),
      "utf8"
    )
  ]);

  const workflowBlock = config.match(
    /\[\[workflows\]\][\s\S]*?(?=\n\[\[send_email\]\])/
  )?.[0] ?? "";
  const secretBlock = config.match(
    /\[secrets\][\s\S]*?(?=\n\[\[d1_databases\]\])/
  )?.[0] ?? "";

  assert.match(workflowBlock, /name = "crm-environment-staff-reconciliation"/);
  assert.match(workflowBlock, /class_name = "EnvironmentStaffReconciliationWorkflow"/);
  assert.doesNotMatch(workflowBlock, /schedule|queue|route|script_name/);
  assert.doesNotMatch(secretBlock, /CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE/);

  assert.match(config, /^main = "src\/worker-entry\.js"$/m);
  assert.match(workflowSource, /from "cloudflare:workers"/);
  assert.match(workflowSource, /extends WorkflowEntrypoint/);
  assert.match(entrySource, /EnvironmentStaffReconciliationWorkflow/);
  assert.doesNotMatch(
    `${adapterSource}\n${workflowSource}`,
    /\bfetch\b|\bscheduled\b|\bqueue\b|console\./
  );
  assert.doesNotMatch(adapterSource, /ADMIN_PASSWORD|SUPERADMIN_PASSWORD/);
  assert.doesNotMatch(indexSource, /ENVIRONMENT_STAFF_RECONCILIATION_WORKFLOW|\.create\s*\(/);
  assert.doesNotMatch(runbook, /CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE\s*=/);
  assert.doesNotMatch(runbook, /harunayarturk@|hayartur80@/i);
});
