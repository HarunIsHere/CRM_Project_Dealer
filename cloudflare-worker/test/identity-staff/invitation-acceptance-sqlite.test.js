import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { hashOpaqueToken } from "../../src/identity/crypto.js";
import { decryptOutboxPayload } from "../../src/identity/email/outbox-crypto.js";
import { reconcileEnvironmentStaffAccounts } from "../../src/identity/staff/bootstrap.js";
import {
  BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS
} from "../../src/identity/staff/invitation-acceptance.js";
import {
  BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
  BOOTSTRAP_INVITATION_PREVIEW_ROUTE,
  handleProtectedBootstrapInvitationAccept,
  handleProtectedBootstrapInvitationPreview
} from "../../src/identity/staff/invitation-http.js";

const START = new Date("2030-01-01T00:00:00.000Z");
const ACCEPT_AT = new Date("2030-01-01T00:01:00.000Z");
const IDEMPOTENCY_KEY = "123e4567-e89b-12d3-a456-426614174000";

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

  executeBatch() {
    if (this.statement.columns().length > 0) {
      return { results: this.statement.all(...this.bindings) };
    }
    return this.runInternal();
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
      const results = statements.map((statement) => statement.executeBatch());
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
  const names = (await readdir(migrationsUrl))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const name of names) {
    sqlite.exec(await readFile(new URL(name, migrationsUrl), "utf8"));
  }
  return sqlite;
}

function workerEnvironment(sqlite) {
  return {
    DB: new SqliteD1Database(sqlite),
    SUPERADMIN_USERNAME: "senkimsin",
    ADMIN_USERNAME: "admin",
    CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE: "execute",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL: "owner@example.com",
    CRM_AUTH_BOOTSTRAP_SUPERADMIN_LOCALE: "de",
    CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
    CRM_AUTH_BOOTSTRAP_ADMIN_LOCALE: "tr",
    CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT: "runbook:staff-bootstrap:acceptance",
    CRM_AUTH_FINGERPRINT_KEY_V1: "f".repeat(64),
    CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_CHALLENGE_HMAC_KEY_V1: "c".repeat(64),
    CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_SESSION_HMAC_KEY_V1: "r".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY_V2: "s".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY: "legacy-session-key-must-not-be-used".repeat(2),
    CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1: "i".repeat(64),
    CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1: Buffer.alloc(32, 8).toString("base64url"),
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: Buffer.alloc(32, 5).toString("base64url"),
    CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me",
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_STAFF_WEBAUTHN_READY: "true",
    CRM_AUTH_CLIENT_READY_ADMIN_WEB: "true",
    CRM_AUTH_STAFF_RECONCILED: "false",
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "true"
  };
}

function request(
  path,
  body,
  {
    idempotencyKey = null,
    cookie = null,
    origin = "https://crm.ayartuerk.me"
  } = {}
) {
  const headers = {
    "content-type": "application/json",
    origin,
    "cf-connecting-ip": "203.0.113.9"
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  if (cookie) headers.cookie = cookie;
  return new Request(`https://crm.ayartuerk.me${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

function acceptBody(token, appVersion = "1.0.0") {
  return {
    token,
    session_transport: "cookie",
    client: { platform: "admin_web", app_version: appVersion }
  };
}

async function invitationToken(sqlite, env, username) {
  const row = sqlite.prepare(`
    SELECT o.*
    FROM auth_email_outbox o
    JOIN auth_staff_invitations i ON i.challenge_id = o.challenge_id
    JOIN admin_users u ON u.id = i.admin_user_id
    WHERE u.username = ?
  `).get(username);
  const payload = await decryptOutboxPayload(env, row);
  return new URL(payload.action_url).hash.slice("#token=".length);
}

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const value = response.headers.get("set-cookie");
  return value ? [value] : [];
}

function cookieValue(cookies, name) {
  const selected = [...cookies].reverse().find((cookie) => (
    cookie.startsWith(`${name}=`) && !cookie.startsWith(`${name}=;`)
  ));
  return selected?.slice(name.length + 1).split(";", 1)[0] ?? null;
}

test("preview is non-consuming and acceptance atomically issues only enrollment", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = workerEnvironment(sqlite);
  await reconcileEnvironmentStaffAccounts(env, { now: START });
  const token = await invitationToken(sqlite, env, "senkimsin");

  const preview = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token }),
    env,
    { now: START }
  );
  assert.equal(preview.status, 200);
  assert.deepEqual(getSetCookies(preview), []);
  const previewBody = await preview.json();
  assert.deepEqual(previewBody.invitation, {
    username: "senkimsin",
    role: "superadmin",
    email_masked: "o***@example.com",
    locale: "de",
    status: "pending",
    expires_at: "2030-01-02T00:00:00.000Z"
  });
  assert.doesNotMatch(JSON.stringify(previewBody), /owner@example\.com|#token=|[A-Za-z0-9_-]{43}/);
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_challenges WHERE token_hash IS NOT NULL ORDER BY created_at LIMIT 1").get().status,
    "pending"
  );

  const ambientOrdinaryToken = "ordinary_staff_session_token_1234567890";
  const accepted = await handleProtectedBootstrapInvitationAccept(
    request(
      BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
      acceptBody(token),
      {
        idempotencyKey: IDEMPOTENCY_KEY,
        cookie: `__Host-crm_staff_session=${ambientOrdinaryToken}`
      }
    ),
    env,
    { now: ACCEPT_AT }
  );
  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json();
  const acceptedCookies = getSetCookies(accepted);
  assert.equal(acceptedCookies.length, 6);
  assert.ok(acceptedCookies.some((cookie) => (
    cookie.startsWith("__Host-crm_staff_recovery=;") && cookie.includes("Max-Age=0")
  )));
  assert.ok(acceptedCookies.some((cookie) => (
    cookie.startsWith("__Host-crm_staff_enrollment=;") && cookie.includes("Max-Age=0")
  )));
  assert.ok(!acceptedCookies.some((cookie) => cookie.startsWith("__Host-crm_staff_session=;")));

  const rawSessionToken = cookieValue(
    acceptedCookies,
    "__Host-crm_staff_enrollment"
  );
  const rawCsrfToken = cookieValue(
    acceptedCookies,
    "__Host-crm_staff_enrollment_csrf"
  );
  assert.match(rawSessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(rawCsrfToken, acceptedBody.session.csrf_token);
  assert.equal(Object.hasOwn(acceptedBody.session, "access_token"), false);
  assert.doesNotMatch(
    JSON.stringify(acceptedBody),
    new RegExp(`${token}|${rawSessionToken}|owner@example\\.com`)
  );
  assert.equal(acceptedBody.enrollment.deadline_at, "2030-01-04T00:01:00.000Z");
  assert.equal(acceptedBody.session.scope, "staff_enrollment");

  const account = sqlite.prepare(`
    SELECT a.*, e.status AS email_status, e.is_primary,
           i.status AS invitation_status, c.status AS challenge_status
    FROM admin_users u
    JOIN auth_accounts a ON a.id = u.auth_account_id
    JOIN auth_staff_invitations i ON i.admin_user_id = u.id
    JOIN auth_email_addresses e ON e.id = i.email_address_id
    JOIN auth_challenges c ON c.id = i.challenge_id
    WHERE u.username = 'senkimsin'
  `).get();
  assert.equal(account.status, "pending");
  assert.equal(account.enrollment_state, "in_progress");
  assert.equal(account.enrollment_deadline_at, "2030-01-04T00:01:00.000Z");
  assert.equal(account.email_status, "verified");
  assert.equal(account.is_primary, 1);
  assert.equal(account.invitation_status, "accepted");
  assert.equal(account.challenge_status, "consumed");

  const session = sqlite.prepare("SELECT * FROM auth_sessions").get();
  assert.equal(session.scope, "staff_enrollment");
  assert.equal(session.session_transport, "cookie");
  assert.equal(session.client_platform, "admin_web");
  assert.equal(session.token_hash_version, 2);
  assert.equal(
    session.token_hash,
    await hashOpaqueToken(rawSessionToken, env.CRM_AUTH_SESSION_HMAC_KEY_V2)
  );
  assert.notEqual(
    session.token_hash,
    await hashOpaqueToken(rawSessionToken, env.CRM_AUTH_SESSION_HMAC_KEY)
  );
  const authorization = JSON.parse(session.authorization_context_json);
  assert.equal(authorization.stage, "email_verified");
  assert.deepEqual(authorization.allowed_actions, BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE scope <> 'staff_enrollment'").get().count,
    0
  );

  const idempotency = sqlite.prepare("SELECT * FROM auth_idempotency_keys").get();
  assert.equal(idempotency.status, "completed");
  assert.ok(idempotency.response_payload_ciphertext instanceof Uint8Array);
  const encryptedText = Buffer.from(idempotency.response_payload_ciphertext).toString("utf8");
  assert.doesNotMatch(encryptedText, new RegExp(`${rawSessionToken}|${rawCsrfToken}`));

  const replay = await handleProtectedBootstrapInvitationAccept(
    request(BOOTSTRAP_INVITATION_ACCEPT_ROUTE, acceptBody(token), {
      idempotencyKey: IDEMPOTENCY_KEY
    }),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), acceptedBody);
  assert.deepEqual(getSetCookies(replay), acceptedCookies);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 1);

  const reused = await handleProtectedBootstrapInvitationAccept(
    request(BOOTSTRAP_INVITATION_ACCEPT_ROUTE, acceptBody(token, "1.0.1"), {
      idempotencyKey: IDEMPOTENCY_KEY
    }),
    env,
    { now: new Date("2030-01-01T00:03:00.000Z") }
  );
  assert.equal(reused.status, 409);
  assert.equal((await reused.json()).error.code, "idempotency_key_reused");

  const secondKey = await handleProtectedBootstrapInvitationAccept(
    request(BOOTSTRAP_INVITATION_ACCEPT_ROUTE, acceptBody(token), {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174001"
    }),
    env,
    { now: new Date("2030-01-01T00:04:00.000Z") }
  );
  assert.equal(secondKey.status, 400);
  assert.equal((await secondKey.json()).error.code, "invalid_or_expired_invitation");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM auth_idempotency_keys").get().count, 1);

  const untouchedAdmin = sqlite.prepare(`
    SELECT a.enrollment_state, e.status AS email_status, i.status AS invitation_status
    FROM admin_users u
    JOIN auth_accounts a ON a.id = u.auth_account_id
    JOIN auth_staff_invitations i ON i.admin_user_id = u.id
    JOIN auth_email_addresses e ON e.id = i.email_address_id
    WHERE u.username = 'admin'
  `).get();
  assert.deepEqual({ ...untouchedAdmin }, {
    enrollment_state: "required",
    email_status: "pending",
    invitation_status: "pending"
  });
});

test("all preview misses return one non-consuming generic envelope", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = workerEnvironment(sqlite);
  await reconcileEnvironmentStaffAccounts(env, { now: START });
  const token = await invitationToken(sqlite, env, "admin");
  const unknownToken = "z".repeat(43);

  const malformed = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token: "short" }),
    env,
    { now: START }
  );
  const unknown = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token: unknownToken }),
    env,
    { now: START }
  );
  const expired = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token }),
    env,
    { now: new Date("2030-01-02T00:00:01.000Z") }
  );

  for (const response of [malformed, unknown, expired]) {
    assert.equal(response.status, 400);
    assert.deepEqual(getSetCookies(response), []);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "invalid_or_expired_invitation");
    assert.equal(Object.hasOwn(body.error, "details"), false);
  }
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_challenges WHERE status <> 'pending'").get().count,
    0
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count,
    0
  );
});

test("preview applies an account-independent IP emergency limit", async () => {
  class BlockedStatement {
    bind() {
      return this;
    }

    async first() {
      return {
        id: "1".repeat(32),
        request_count: 31,
        blocked_until: "2030-01-01T00:01:00.000Z",
        window_started_at: "2030-01-01T00:00:00.000Z",
        expires_at: "2030-01-01T01:01:00.000Z"
      };
    }
  }

  const env = workerEnvironment({ prepare: () => new BlockedStatement() });
  env.DB = { prepare: () => new BlockedStatement() };
  const response = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token: "x".repeat(43) }),
    env,
    { now: START }
  );
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "rate_limited");
  assert.deepEqual(getSetCookies(response), []);
});

test("configured browser origins and bootstrap fingerprint version fail closed", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = workerEnvironment(sqlite);
  env.CRM_AUTH_ALLOWED_ORIGINS = "https://admin.example.test";
  await reconcileEnvironmentStaffAccounts(env, { now: START });
  const token = await invitationToken(sqlite, env, "senkimsin");

  const accepted = await handleProtectedBootstrapInvitationAccept(
    request(BOOTSTRAP_INVITATION_ACCEPT_ROUTE, acceptBody(token), {
      idempotencyKey: IDEMPOTENCY_KEY,
      origin: "https://admin.example.test"
    }),
    env,
    { now: ACCEPT_AT }
  );
  assert.equal(accepted.status, 200);

  env.CRM_AUTH_ALLOWED_ORIGINS = "*";
  const malformedConfiguration = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token }),
    env,
    { now: ACCEPT_AT }
  );
  assert.equal(malformedConfiguration.status, 403);
  assert.equal((await malformedConfiguration.json()).error.code, "forbidden");

  env.CRM_AUTH_ALLOWED_ORIGINS = "https://crm.ayartuerk.me";
  env.CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION = "2";
  const unsupportedFingerprintRotation = await handleProtectedBootstrapInvitationPreview(
    request(BOOTSTRAP_INVITATION_PREVIEW_ROUTE, { token }),
    env,
    { now: ACCEPT_AT }
  );
  assert.equal(unsupportedFingerprintRotation.status, 503);
  assert.equal(
    (await unsupportedFingerprintRotation.json()).error.code,
    "temporarily_unavailable"
  );
});

test("a lost invitation-claim race rolls back every acceptance mutation", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = workerEnvironment(sqlite);
  await reconcileEnvironmentStaffAccounts(env, { now: START });
  const token = await invitationToken(sqlite, env, "senkimsin");
  const batch = env.DB.batch.bind(env.DB);
  let injectedRace = false;
  env.DB.batch = async (statements) => {
    if (!injectedRace && statements.length === 8) {
      injectedRace = true;
      sqlite.prepare(`
        UPDATE auth_challenges
        SET status = 'invalidated', invalidated_at = ?
        WHERE purpose = 'staff_invitation'
          AND auth_account_id = (
            SELECT auth_account_id FROM admin_users WHERE username = 'senkimsin'
          )
      `).run(ACCEPT_AT.toISOString());
    }
    return batch(statements);
  };

  const response = await handleProtectedBootstrapInvitationAccept(
    request(BOOTSTRAP_INVITATION_ACCEPT_ROUTE, acceptBody(token), {
      idempotencyKey: IDEMPOTENCY_KEY
    }),
    env,
    { now: ACCEPT_AT }
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_or_expired_invitation");
  assert.equal(injectedRace, true);

  const state = sqlite.prepare(`
    SELECT a.enrollment_state,
           a.enrollment_deadline_at,
           e.status AS email_status,
           e.is_primary,
           i.status AS invitation_status,
           c.status AS challenge_status
    FROM admin_users u
    JOIN auth_accounts a ON a.id = u.auth_account_id
    JOIN auth_staff_invitations i ON i.admin_user_id = u.id
    JOIN auth_email_addresses e ON e.id = i.email_address_id
    JOIN auth_challenges c ON c.id = i.challenge_id
    WHERE u.username = 'senkimsin'
  `).get();
  assert.deepEqual({ ...state }, {
    enrollment_state: "required",
    enrollment_deadline_at: null,
    email_status: "pending",
    is_primary: 0,
    invitation_status: "pending",
    challenge_status: "invalidated"
  });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count, 0);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_idempotency_keys").get().count,
    0
  );
});
