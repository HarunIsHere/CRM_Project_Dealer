import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { decryptOutboxPayload } from "../../src/identity/email/outbox-crypto.js";
import { reconcileEnvironmentStaffAccounts } from "../../src/identity/staff/bootstrap.js";
import {
  STAFF_ENROLLMENT_LOGOUT_ROUTE,
  STAFF_ENROLLMENT_STATUS_ROUTE,
  handleProtectedBootstrapEnrollmentLogout,
  handleProtectedBootstrapEnrollmentStatus
} from "../../src/identity/staff/enrollment-http.js";
import {
  BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
  handleProtectedBootstrapInvitationAccept
} from "../../src/identity/staff/invitation-http.js";

const START = new Date("2030-01-01T00:00:00.000Z");
const ACCEPT_AT = new Date("2030-01-01T00:01:00.000Z");
const ORIGIN = "https://crm.ayartuerk.me";

class SqliteD1Statement {
  constructor(database, sql) {
    this.database = database;
    this.statement = database.sqlite.prepare(sql);
    this.bindings = [];
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

  executeBatch() {
    if (this.statement.columns().length > 0) {
      return { results: this.statement.all(...this.bindings) };
    }
    const result = this.statement.run(...this.bindings);
    return { meta: { changes: Number(result.changes) } };
  }

  async run() {
    return this.executeBatch();
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
    CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1: "i".repeat(64),
    CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1: Buffer.alloc(32, 8).toString("base64url"),
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: Buffer.alloc(32, 5).toString("base64url"),
    CRM_AUTH_ALLOWED_ORIGINS: ORIGIN,
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_STAFF_WEBAUTHN_READY: "true",
    CRM_AUTH_CLIENT_READY_ADMIN_WEB: "true",
    CRM_AUTH_STAFF_RECONCILED: "false",
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "true"
  };
}

function jsonRequest(path, body, idempotencyKey) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "cf-connecting-ip": "203.0.113.9",
      "idempotency-key": idempotencyKey
    },
    body: JSON.stringify(body)
  });
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

function enrollmentCookies(response) {
  const cookies = getSetCookies(response);
  return {
    sessionToken: cookieValue(cookies, "__Host-crm_staff_enrollment"),
    csrfToken: cookieValue(cookies, "__Host-crm_staff_enrollment_csrf")
  };
}

function cookieHeader(tokens, { ambient = true } = {}) {
  const values = [
    `__Host-crm_staff_enrollment=${tokens.sessionToken}`,
    `__Host-crm_staff_enrollment_csrf=${tokens.csrfToken}`
  ];
  if (ambient) {
    values.unshift("__Host-crm_staff_session=ordinary_staff_cookie_1234567890");
    values.push("__Host-crm_staff_recovery=recovery_cookie_123456789012345678");
  }
  return values.join("; ");
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

async function acceptInvitation(sqlite, env, username, idempotencyKey) {
  const token = await invitationToken(sqlite, env, username);
  const response = await handleProtectedBootstrapInvitationAccept(
    jsonRequest(
      BOOTSTRAP_INVITATION_ACCEPT_ROUTE,
      {
        token,
        session_transport: "cookie",
        client: { platform: "admin_web", app_version: "1.0.0" }
      },
      idempotencyKey
    ),
    env,
    { now: ACCEPT_AT }
  );
  assert.equal(response.status, 200);
  return { token, response, ...enrollmentCookies(response) };
}

function statusRequest(tokens) {
  return new Request(`${ORIGIN}${STAFF_ENROLLMENT_STATUS_ROUTE}`, {
    method: "GET",
    headers: { cookie: cookieHeader(tokens) }
  });
}

function logoutRequest(tokens, {
  origin = ORIGIN,
  csrfToken = tokens.csrfToken,
  sessionToken = tokens.sessionToken,
  includeCsrfHeader = true,
  body = undefined
} = {}) {
  const headers = new Headers({
    cookie: cookieHeader({ sessionToken, csrfToken: tokens.csrfToken })
  });
  if (origin !== null) headers.set("origin", origin);
  if (includeCsrfHeader) headers.set("x-csrf-token", csrfToken);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}${STAFF_ENROLLMENT_LOGOUT_ROUTE}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function setupAccepted(t) {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = workerEnvironment(sqlite);
  await reconcileEnvironmentStaffAccounts(env, { now: START });
  const accepted = await acceptInvitation(
    sqlite,
    env,
    "senkimsin",
    "123e4567-e89b-12d3-a456-426614174010"
  );
  return { sqlite, env, accepted };
}

test("status returns a durable secret-free checklist without rotating CSRF", async (t) => {
  const { sqlite, env, accepted } = await setupAccepted(t);
  const before = sqlite.prepare(`
    SELECT id, csrf_token_hash, last_seen_at
    FROM auth_sessions
    WHERE revoked_at IS NULL
  `).get();
  const response = await handleProtectedBootstrapEnrollmentStatus(
    statusRequest(accepted),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(getSetCookies(response), []);
  const body = await response.json();
  assert.deepEqual(body.staff, {
    username: "senkimsin",
    role: "superadmin",
    email_masked: "o***@example.com",
    locale: "de"
  });
  assert.deepEqual(body.enrollment, {
    stage: "email_verified",
    email_verified: true,
    password_set: false,
    passkey_registered: false,
    recovery_codes_acknowledged: false,
    deadline_at: "2030-01-04T00:01:00.000Z"
  });
  assert.deepEqual(body.session, {
    scope: "staff_enrollment",
    expires_at: "2030-01-01T00:31:00.000Z"
  });
  assert.doesNotMatch(
    JSON.stringify(body),
    new RegExp(`${accepted.token}|${accepted.sessionToken}|${accepted.csrfToken}|owner@example\\.com|csrf_token_hash|token_hash`)
  );
  assert.deepEqual(
    { ...sqlite.prepare(`
      SELECT id, csrf_token_hash, last_seen_at
      FROM auth_sessions
      WHERE id = ?
    `).get(before.id) },
    { ...before }
  );

  const account = sqlite.prepare(`
    SELECT a.id AS account_id, a.auth_version, s.id AS session_id
    FROM admin_users u
    JOIN auth_accounts a ON a.id = u.auth_account_id
    JOIN auth_sessions s ON s.auth_account_id = a.id
    WHERE u.username = 'senkimsin' AND s.revoked_at IS NULL
  `).get();
  sqlite.prepare(`
    INSERT INTO auth_password_credentials (
      id, auth_account_id, account_realm, verifier, algorithm,
      algorithm_version, parameters_json, pepper_key_version,
      created_transition_id
    ) VALUES (?, ?, 'staff', 'test-verifier', 'test_v1', 1, '{}', 1, ?)
  `).run("1".repeat(32), account.account_id, "2".repeat(32));
  sqlite.prepare(`
    INSERT INTO auth_passkey_credentials (
      id, auth_account_id, realm, credential_id, rp_id, public_key_cose,
      created_transition_id
    ) VALUES (?, ?, 'staff', ?, 'crm.ayartuerk.me', ?, ?)
  `).run(
    "3".repeat(32),
    account.account_id,
    "passkey_credential_1",
    new Uint8Array([1, 2, 3]),
    "4".repeat(32)
  );
  sqlite.prepare(`
    INSERT INTO auth_recovery_code_sets (
      id, auth_account_id, account_realm, generating_session_id,
      expected_auth_version, status, code_count, acknowledgement_expires_at,
      acknowledged_at, activated_at, created_transition_id,
      activation_transition_id
    ) VALUES (?, ?, 'staff', ?, ?, 'active', 10, ?, ?, ?, ?, ?)
  `).run(
    "5".repeat(32),
    account.account_id,
    account.session_id,
    account.auth_version,
    "2030-01-01T00:20:00.000Z",
    "2030-01-01T00:03:00.000Z",
    "2030-01-01T00:03:00.000Z",
    "6".repeat(32),
    "7".repeat(32)
  );

  const updated = await handleProtectedBootstrapEnrollmentStatus(
    statusRequest(accepted),
    env,
    { now: new Date("2030-01-01T00:04:00.000Z") }
  );
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).enrollment, {
    stage: "email_verified",
    email_verified: true,
    password_set: true,
    passkey_registered: true,
    recovery_codes_acknowledged: true,
    deadline_at: "2030-01-04T00:01:00.000Z"
  });
});

test("status enforces the closed action list and account deadline", async (t) => {
  const { sqlite, env, accepted } = await setupAccepted(t);
  const session = sqlite.prepare(`
    SELECT id, authorization_context_json FROM auth_sessions WHERE revoked_at IS NULL
  `).get();
  const context = JSON.parse(session.authorization_context_json);
  context.allowed_actions = context.allowed_actions.filter((action) => (
    action !== `GET ${STAFF_ENROLLMENT_STATUS_ROUTE}`
  ));
  sqlite.prepare(`
    UPDATE auth_sessions SET authorization_context_json = ? WHERE id = ?
  `).run(JSON.stringify(context), session.id);

  const denied = await handleProtectedBootstrapEnrollmentStatus(
    statusRequest(accepted),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "unauthorized");
  assert.deepEqual(getSetCookies(denied), []);

  context.allowed_actions.push(`GET ${STAFF_ENROLLMENT_STATUS_ROUTE}`);
  sqlite.prepare(`
    UPDATE auth_sessions SET authorization_context_json = ? WHERE id = ?
  `).run(JSON.stringify(context), session.id);
  sqlite.prepare(`
    UPDATE auth_accounts
    SET enrollment_deadline_at = '2030-01-01T00:01:30.000Z'
    WHERE id = (SELECT auth_account_id FROM admin_users WHERE username = 'senkimsin')
  `).run();
  const expired = await handleProtectedBootstrapEnrollmentStatus(
    statusRequest(accepted),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).error.code, "unauthorized");

  const ordinaryOnly = await handleProtectedBootstrapEnrollmentStatus(
    new Request(`${ORIGIN}${STAFF_ENROLLMENT_STATUS_ROUTE}`, {
      method: "GET",
      headers: { cookie: "__Host-crm_staff_session=ordinary_staff_cookie_1234567890" }
    }),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(ordinaryOnly.status, 401);
});

test("logout revokes only the exact enrollment session and repeats safely", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = workerEnvironment(sqlite);
  await reconcileEnvironmentStaffAccounts(env, { now: START });
  const owner = await acceptInvitation(
    sqlite,
    env,
    "senkimsin",
    "123e4567-e89b-12d3-a456-426614174020"
  );
  const admin = await acceptInvitation(
    sqlite,
    env,
    "admin",
    "123e4567-e89b-12d3-a456-426614174021"
  );

  const wrongOrigin = await handleProtectedBootstrapEnrollmentLogout(
    logoutRequest(admin, { origin: "https://evil.example" }),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(wrongOrigin.status, 403);
  assert.deepEqual(getSetCookies(wrongOrigin), []);

  const wrongCsrf = await handleProtectedBootstrapEnrollmentLogout(
    logoutRequest(admin, { csrfToken: "w".repeat(43) }),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(wrongCsrf.status, 403);
  assert.deepEqual(getSetCookies(wrongCsrf), []);

  const first = await handleProtectedBootstrapEnrollmentLogout(
    logoutRequest(owner),
    env,
    { now: new Date("2030-01-01T00:03:00.000Z") }
  );
  assert.equal(first.status, 200);
  assert.equal((await first.json()).logged_out, true);
  const clears = getSetCookies(first);
  assert.equal(clears.length, 2);
  assert.ok(clears.every((cookie) => cookie.includes("Max-Age=0")));
  assert.ok(clears.every((cookie) => cookie.startsWith("__Host-crm_staff_enrollment")));
  assert.ok(!clears.some((cookie) => cookie.startsWith("__Host-crm_staff_session")));

  const ownerRow = sqlite.prepare(`
    SELECT s.revoked_at, s.revocation_reason
    FROM auth_sessions s
    JOIN admin_users u ON u.auth_account_id = s.auth_account_id
    WHERE u.username = 'senkimsin'
  `).get();
  assert.deepEqual({ ...ownerRow }, {
    revoked_at: "2030-01-01T00:03:00.000Z",
    revocation_reason: "enrollment_logout"
  });
  assert.equal(sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_sessions s
    JOIN admin_users u ON u.auth_account_id = s.auth_account_id
    WHERE u.username = 'admin' AND s.revoked_at IS NULL
  `).get().count, 1);

  const repeated = await handleProtectedBootstrapEnrollmentLogout(
    logoutRequest(owner),
    env,
    { now: new Date("2030-01-01T00:04:00.000Z") }
  );
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).logged_out, true);
  assert.equal(getSetCookies(repeated).length, 2);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT revoked_at, revocation_reason FROM auth_sessions
    WHERE auth_account_id = (
      SELECT auth_account_id FROM admin_users WHERE username = 'senkimsin'
    )
  `).get() }, { ...ownerRow });

  sqlite.prepare(`
    UPDATE auth_accounts
    SET enrollment_deadline_at = '2030-01-01T00:01:30.000Z'
    WHERE id = (SELECT auth_account_id FROM admin_users WHERE username = 'admin')
  `).run();
  const expiredButExact = await handleProtectedBootstrapEnrollmentLogout(
    logoutRequest(admin),
    env,
    { now: new Date("2030-01-01T00:05:00.000Z") }
  );
  assert.equal(expiredButExact.status, 200);
  assert.equal(sqlite.prepare(`
    SELECT COUNT(*) AS count
    FROM auth_sessions s
    JOIN admin_users u ON u.auth_account_id = s.auth_account_id
    WHERE u.username = 'admin'
      AND s.revoked_at = '2030-01-01T00:05:00.000Z'
      AND s.revocation_reason = 'enrollment_logout'
  `).get().count, 1);
});

test("logout rejects unknown sessions, missing CSRF, and non-empty bodies without clearing", async (t) => {
  const { sqlite, env, accepted } = await setupAccepted(t);
  const cases = [
    logoutRequest(accepted, { includeCsrfHeader: false }),
    logoutRequest(accepted, { body: {} }),
    logoutRequest(accepted, { sessionToken: "u".repeat(43) }),
    logoutRequest(accepted, { sessionToken: "short" })
  ];
  const expected = [403, 400, 401, 401];
  for (let index = 0; index < cases.length; index += 1) {
    const response = await handleProtectedBootstrapEnrollmentLogout(
      cases[index],
      env,
      { now: new Date("2030-01-01T00:02:00.000Z") }
    );
    assert.equal(response.status, expected[index]);
    assert.deepEqual(getSetCookies(response), []);
  }
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE revoked_at IS NULL").get().count,
    1
  );

  sqlite.prepare(`
    UPDATE auth_sessions SET scope = 'staff_recovery_email'
    WHERE revoked_at IS NULL
  `).run();
  const wrongScope = await handleProtectedBootstrapEnrollmentLogout(
    logoutRequest(accepted),
    env,
    { now: new Date("2030-01-01T00:02:00.000Z") }
  );
  assert.equal(wrongScope.status, 401);
  assert.deepEqual(getSetCookies(wrongScope), []);
  assert.deepEqual({ ...sqlite.prepare(`
    SELECT scope, revoked_at FROM auth_sessions
  `).get() }, { scope: "staff_recovery_email", revoked_at: null });
});
