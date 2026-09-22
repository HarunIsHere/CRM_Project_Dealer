import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync(
  new URL(
    "../../migrations/0014_identity_email_recovery_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const migration = readFileSync(
  new URL(
    "../../migrations/0021_telegram_canonical_bearer_sessions.sql",
    import.meta.url
  ),
  "utf8"
);

function originalSessionSchema() {
  const start = foundation.indexOf("CREATE TABLE auth_sessions (");
  const end = foundation.indexOf("CREATE TABLE auth_recovery_code_sets (");
  assert.ok(start >= 0 && end > start);
  return foundation.slice(start, end);
}

function insertSession(database, {
  id,
  accountId,
  realm,
  scope,
  transport,
  csrf,
  platform
}) {
  database.prepare(`
    INSERT INTO auth_sessions (
      id, auth_account_id, realm, token_hash, token_hash_version,
      created_transition_id, issued_auth_version, scope, assurance_level,
      auth_methods_json, authorization_context_json, session_transport,
      csrf_token_hash, client_platform, authenticated_at, expires_at
    ) VALUES (?, ?, ?, ?, 1, ?, 1, ?, 1, '[]', '{}', ?, ?, ?, ?, ?)
  `).run(
    id,
    accountId,
    realm,
    `hash-${id}`,
    id.split("").reverse().join(""),
    scope,
    transport,
    csrf,
    platform,
    "2026-09-18T00:00:00.000Z",
    "2027-09-18T00:00:00.000Z"
  );
}

test("Telegram bearer sessions become canonical without losing existing sessions", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY,
      auth_account_id TEXT,
      username TEXT,
      password_hash TEXT,
      active INTEGER
    );
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      auth_account_id TEXT
    );
    CREATE TABLE auth_accounts (
      id TEXT PRIMARY KEY NOT NULL,
      realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
      UNIQUE (id, realm)
    ) STRICT;
    ${originalSessionSchema()}
    CREATE TABLE auth_session_child (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE RESTRICT
    ) STRICT;
  `);

  const staffAccount = "a".repeat(32);
  const customerAccount = "b".repeat(32);
  const staffSession = "c".repeat(32);
  database.prepare(
    "INSERT INTO auth_accounts (id, realm) VALUES (?, 'staff'), (?, 'customer')"
  ).run(staffAccount, customerAccount);
  insertSession(database, {
    id: staffSession,
    accountId: staffAccount,
    realm: "staff",
    scope: "staff_strong",
    transport: "cookie",
    csrf: "csrf-hash",
    platform: "admin_web"
  });
  database.prepare(
    "INSERT INTO auth_session_child (id, session_id) VALUES ('child', ?)"
  ).run(staffSession);

  database.exec("BEGIN;");
  database.exec(migration);
  database.exec("COMMIT;");

  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count,
    1
  );
  assert.equal(
    database.prepare("SELECT COUNT(*) AS count FROM pragma_foreign_key_check").get().count,
    0
  );

  insertSession(database, {
    id: "d".repeat(32),
    accountId: customerAccount,
    realm: "customer",
    scope: "customer_verified",
    transport: "bearer",
    csrf: null,
    platform: "telegram_mini_app"
  });

  assert.throws(() => insertSession(database, {
    id: "e".repeat(32),
    accountId: customerAccount,
    realm: "customer",
    scope: "customer_verified",
    transport: "bearer",
    csrf: null,
    platform: "customer_web"
  }), /constraint/i);
});
