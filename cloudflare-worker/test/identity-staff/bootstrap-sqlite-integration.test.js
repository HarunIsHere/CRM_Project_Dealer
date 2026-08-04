import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { decryptOutboxPayload } from "../../src/identity/email/outbox-crypto.js";
import { reconcileEnvironmentStaffAccounts } from "../../src/identity/staff/bootstrap.js";

class SqliteD1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.bindings = [];
    this.statement = database.sqlite.prepare(sql);
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  async first() {
    return this.statement.get(...this.bindings) ?? null;
  }

  async all() {
    return { results: this.statement.all(...this.bindings) };
  }

  runInternal() {
    const result = this.statement.run(...this.bindings);
    return { meta: { changes: Number(result.changes) } };
  }

  async run() {
    return this.runInternal();
  }
}

class SqliteD1Database {
  constructor(sqlite) {
    this.sqlite = sqlite;
  }

  prepare(sql) {
    return new SqliteD1Statement(this, sql);
  }

  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.runInternal());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

async function migratedDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrationsUrl = new URL("../../migrations/", import.meta.url);
  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const name of migrationNames) {
    sqlite.exec(await readFile(new URL(name, migrationsUrl), "utf8"));
  }
  return sqlite;
}

function environment(sqlite) {
  return {
    DB: new SqliteD1Database(sqlite),
    SUPERADMIN_USERNAME: "senkimsin",
    ADMIN_USERNAME: "admin",
    CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE: "execute",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL: "owner@example.com",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_LOCALE: "de",
    CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
    CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE: "tr",
    CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT: "runbook:staff-bootstrap:integration",
    CRM_AUTH_FINGERPRINT_KEY_V1: "f".repeat(64),
    CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "c".repeat(64),
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: Buffer.alloc(32, 5).toString("base64url"),
    CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me"
  };
}

test("real SQLite schema atomically reconciles both env staff identities", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);

  const created = await reconcileEnvironmentStaffAccounts(env, {
    now: new Date("2030-01-01T00:00:00.000Z")
  });
  assert.equal(created.outcome, "created");

  const profiles = sqlite.prepare(`
    SELECT
      u.username, u.role, u.password_hash, u.is_protected,
      a.status, a.enrollment_state, a.locale
    FROM admin_users u
    JOIN auth_accounts a ON a.id = u.auth_account_id
    ORDER BY u.username
  `).all();
  assert.deepEqual(profiles.map((row) => ({ ...row })), [
    {
      username: "admin",
      role: "admin",
      password_hash: "!canonical-auth-disabled!",
      is_protected: 1,
      status: "pending",
      enrollment_state: "required",
      locale: "tr"
    },
    {
      username: "senkimsin",
      role: "superadmin",
      password_hash: "!canonical-auth-disabled!",
      is_protected: 1,
      status: "pending",
      enrollment_state: "required",
      locale: "de"
    }
  ]);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_password_credentials").get().count,
    0
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_staff_invitations").get().count,
    2
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_accounts WHERE enrollment_deadline_at IS NULL").get().count,
    2
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_challenges WHERE token_hash GLOB 'v1:[0-9a-f]*'").get().count,
    2
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_security_events").get().count,
    2
  );

  const outboxRows = sqlite.prepare(`
    SELECT * FROM auth_email_outbox ORDER BY locale
  `).all();
  assert.equal(outboxRows.length, 2);
  for (const row of outboxRows) {
    assert.ok(row.payload_ciphertext instanceof Uint8Array);
    const payload = await decryptOutboxPayload(env, row);
    assert.match(
      payload.action_url,
      /^https:\/\/crm\.ayartuerk\.me\/auth\/admin\/invitation#token=[A-Za-z0-9_-]{43}$/
    );
  }

  const repeated = await reconcileEnvironmentStaffAccounts(env, {
    now: new Date("2030-01-01T00:01:00.000Z")
  });
  assert.equal(repeated.outcome, "already_reconciled");
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_accounts").get().count,
    2
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_email_outbox").get().count,
    2
  );
});
