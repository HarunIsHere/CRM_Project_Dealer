import assert from "node:assert/strict";
import test from "node:test";

import {
  StaffBootstrapError,
  readEnvironmentStaffBootstrapConfig,
  reconcileEnvironmentStaffAccounts
} from "../../src/identity/staff/bootstrap.js";

const NOW = new Date("2030-01-01T00:00:00.000Z");
const OWNER_RECEIPT = "runbook:staff-bootstrap:20300101";

class RecordingStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.bindings = [];
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  async first() {
    this.database.firstCalls.push(this);
    return this.database.firstResults.shift() ?? null;
  }

  async all() {
    this.database.allCalls.push(this);
    return this.database.allResults.shift() ?? { results: [] };
  }
}

class RecordingDatabase {
  constructor({ firstResults = [], allResults = [], batchError = null } = {}) {
    this.firstResults = [...firstResults];
    this.allResults = [...allResults];
    this.batchError = batchError;
    this.prepared = [];
    this.firstCalls = [];
    this.allCalls = [];
    this.batches = [];
  }

  prepare(sql) {
    const statement = new RecordingStatement(this, sql);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements) {
    this.batches.push(statements);
    if (this.batchError) throw this.batchError;
    return statements.map(() => ({ meta: { changes: 1 } }));
  }
}

function bootstrapEnv(database = new RecordingDatabase(), overrides = {}) {
  return {
    DB: database,
    SUPERADMIN_USERNAME: "senkimsin",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "must-never-be-read-or-copied",
    SUPERADMIN_PASSWORD: "must-never-be-read-or-copied-either",
    CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE: "execute",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL: "Owner@Example.com",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_LOCALE: "de",
    CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL: "Admin+Security@Example.com",
    CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE: "tr",
    CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT: OWNER_RECEIPT,
    CRM_AUTH_FINGERPRINT_KEY_V1: "f".repeat(64),
    CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "c".repeat(64),
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: Buffer.alloc(32, 7).toString("base64url"),
    CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me",
    ...overrides
  };
}

function reconciledRow({
  username,
  role,
  normalizedEmail,
  locale,
  suffix,
  fresh = true
}) {
  const id = String(suffix).repeat(32).slice(0, 32);
  return {
    admin_user_id: Number(suffix),
    username,
    username_normalized: username.toLowerCase(),
    password_hash: "!canonical-auth-disabled!",
    role,
    is_active: fresh ? 1 : 0,
    is_protected: 1,
    auth_account_id: id,
    account_realm: "staff",
    account_status: fresh ? "pending" : "active",
    enrollment_state: fresh ? "required" : "complete",
    enrollment_deadline_at: null,
    account_locale: locale,
    email_address_id: `e${id.slice(1)}`,
    normalized_email: normalizedEmail,
    email_status: fresh ? "pending" : "verified",
    email_is_primary: fresh ? 0 : 1,
    invitation_id: `i${id.slice(1)}`,
    invitation_status: fresh ? "pending" : "accepted",
    invited_by_actor_ref: OWNER_RECEIPT,
    challenge_id: `c${id.slice(1)}`,
    challenge_purpose: "staff_invitation",
    challenge_status: fresh ? "pending" : "consumed",
    challenge_locale: role === "superadmin" ? "de" : "tr",
    outbox_id: `o${id.slice(1)}`,
    outbox_template_key: "auth.staff.invitation.v1",
    outbox_status: fresh ? "pending" : "sent",
    outbox_locale: role === "superadmin" ? "de" : "tr",
    email_match_count: 1,
    invitation_match_count: 1,
    outbox_match_count: 1,
    security_event_count: 1,
    password_credential_count: fresh ? 0 : 1
  };
}

function freshRows() {
  return [
    reconciledRow({
      username: "senkimsin",
      role: "superadmin",
      normalizedEmail: "owner@example.com",
      locale: "de",
      suffix: 1
    }),
    reconciledRow({
      username: "admin",
      role: "admin",
      normalizedEmail: "admin+security@example.com",
      locale: "tr",
      suffix: 2
    })
  ];
}

function isErrorCode(code) {
  return (error) => error instanceof StaffBootstrapError && error.code === code;
}

test("configuration requires the explicit maintenance gate and durable locales", () => {
  assert.throws(
    () => readEnvironmentStaffBootstrapConfig(bootstrapEnv(undefined, {
      CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE: "false"
    })),
    isErrorCode("E_STAFF_BOOTSTRAP_MAINTENANCE_DISABLED")
  );

  assert.throws(
    () => readEnvironmentStaffBootstrapConfig(bootstrapEnv(undefined, {
      CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE: "fr"
    })),
    isErrorCode("E_STAFF_BOOTSTRAP_LOCALE_INVALID")
  );
});

test("configuration requires distinct explicit destinations and safe receipt", () => {
  assert.throws(
    () => readEnvironmentStaffBootstrapConfig(bootstrapEnv(undefined, {
      CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL: "OWNER@example.com"
    })),
    isErrorCode("E_STAFF_BOOTSTRAP_EMAIL_COLLISION")
  );

  assert.throws(
    () => readEnvironmentStaffBootstrapConfig(bootstrapEnv(undefined, {
      CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT: "owner@example.com"
    })),
    isErrorCode("E_STAFF_BOOTSTRAP_OWNER_RECEIPT_INVALID")
  );
});

test("creates both protected pending staff accounts in one atomic batch", async () => {
  const database = new RecordingDatabase({
    firstResults: [null, null, ...freshRows()],
    allResults: [{ results: [] }]
  });
  const env = bootstrapEnv(database);

  const result = await reconcileEnvironmentStaffAccounts(env, { now: NOW });

  assert.equal(result.outcome, "created");
  assert.equal(result.account_count, 2);
  assert.deepEqual(result.accounts, [
    {
      role: "superadmin",
      locale: "de",
      email_masked: "o***@example.com",
      enrollment_state: "required"
    },
    {
      role: "admin",
      locale: "tr",
      email_masked: "a***@example.com",
      enrollment_state: "required"
    }
  ]);
  assert.doesNotMatch(JSON.stringify(result), /owner@example\.com|admin\+security@example\.com/i);

  assert.equal(database.batches.length, 1);
  const statements = database.batches[0];
  assert.equal(statements.length, 14);
  assert.equal(
    statements.filter((statement) => /INSERT INTO auth_accounts/.test(statement.sql)).length,
    2
  );
  assert.equal(
    statements.filter((statement) => /INSERT INTO admin_users/.test(statement.sql)).length,
    2
  );
  assert.equal(
    statements.filter((statement) => /INSERT INTO auth_email_outbox/.test(statement.sql)).length,
    2
  );
  assert.equal(
    statements.filter((statement) => /INSERT INTO auth_password_credentials/.test(statement.sql)).length,
    0
  );

  const profileStatements = statements.filter((statement) => (
    /INSERT INTO admin_users/.test(statement.sql)
  ));
  assert.ok(profileStatements.every((statement) => (
    statement.bindings.includes("!canonical-auth-disabled!")
  )));

  const accountStatements = statements.filter((statement) => (
    /INSERT INTO auth_accounts/.test(statement.sql)
  ));
  assert.ok(accountStatements[0].bindings.includes("de"));
  assert.ok(accountStatements[1].bindings.includes("tr"));

  const allStringBindings = statements.flatMap((statement) => statement.bindings)
    .filter((binding) => typeof binding === "string");
  assert.ok(!allStringBindings.some((binding) => binding.includes("#token=")));
  assert.ok(!allStringBindings.includes(env.ADMIN_PASSWORD));
  assert.ok(!allStringBindings.includes(env.SUPERADMIN_PASSWORD));
  assert.ok(!allStringBindings.includes(env.CRM_AUTH_CHALLENGE_HMAC_KEY_V1));

  const outboxStatements = statements.filter((statement) => (
    /INSERT INTO auth_email_outbox/.test(statement.sql)
  ));
  assert.ok(outboxStatements.every((statement) => statement.bindings[8] instanceof Uint8Array));
});

test("an exact prior reconciliation is a no-op and preserves changed account locale", async () => {
  const priorRows = freshRows().map((row, index) => ({
    ...row,
    is_active: index,
    account_status: index ? "active" : "disabled",
    enrollment_state: "complete",
    account_locale: index ? "ru" : "ar",
    email_status: "verified",
    email_is_primary: 1,
    invitation_status: "accepted",
    challenge_status: "consumed",
    outbox_status: "sent",
    password_credential_count: 1
  }));
  const database = new RecordingDatabase({ firstResults: priorRows });

  const result = await reconcileEnvironmentStaffAccounts(bootstrapEnv(database), {
    now: NOW
  });

  assert.equal(result.outcome, "already_reconciled");
  assert.deepEqual(result.accounts.map((account) => account.locale), ["ar", "ru"]);
  assert.equal(database.batches.length, 0);
  assert.equal(database.allCalls.length, 0);
});

test("partial username state fails closed without writes", async () => {
  const collision = {
    ...freshRows()[0],
    is_protected: 0,
    password_hash: "legacy-verifier"
  };
  const database = new RecordingDatabase({ firstResults: [collision, null] });

  await assert.rejects(
    () => reconcileEnvironmentStaffAccounts(bootstrapEnv(database), { now: NOW }),
    isErrorCode("E_STAFF_BOOTSTRAP_EXISTING_STATE_CONFLICT")
  );
  assert.equal(database.batches.length, 0);
});

test("a pending or verified destination conflict fails before writes", async () => {
  const database = new RecordingDatabase({
    firstResults: [null, null],
    allResults: [{ results: [{ id: "existing-email" }] }]
  });

  await assert.rejects(
    () => reconcileEnvironmentStaffAccounts(bootstrapEnv(database), { now: NOW }),
    isErrorCode("E_STAFF_BOOTSTRAP_EMAIL_IN_USE")
  );
  assert.equal(database.batches.length, 0);
});

test("a concurrent exact reconciliation is accepted after a batch race", async () => {
  const database = new RecordingDatabase({
    firstResults: [null, null, ...freshRows()],
    allResults: [{ results: [] }],
    batchError: new Error("constraint race")
  });

  const result = await reconcileEnvironmentStaffAccounts(bootstrapEnv(database), {
    now: NOW
  });
  assert.equal(result.outcome, "already_reconciled");
  assert.equal(database.batches.length, 1);
});

test("a failed write with no exact concurrent state returns a safe error", async () => {
  const database = new RecordingDatabase({
    firstResults: [null, null, null, null],
    allResults: [{ results: [] }],
    batchError: new Error("constraint failure")
  });

  await assert.rejects(
    () => reconcileEnvironmentStaffAccounts(bootstrapEnv(database), { now: NOW }),
    isErrorCode("E_STAFF_BOOTSTRAP_WRITE_FAILED")
  );
});

test("bootstrap source has no Telegram or legacy password integration", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => (
    readFile(new URL("../../src/identity/staff/bootstrap.js", import.meta.url), "utf8")
  ));
  assert.doesNotMatch(source, /telegram/i);
  assert.doesNotMatch(source, /ADMIN_PASSWORD|SUPERADMIN_PASSWORD/);
  assert.doesNotMatch(source, /app_settings/i);
});
