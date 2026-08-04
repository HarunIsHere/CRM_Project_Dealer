import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createSessionHashesForIssuance } from "../../src/identity/session-keyring.js";
import {
  STAFF_ENROLLMENT_PASSWORD_ROUTE,
  STAFF_ENROLLMENT_PASSWORD_ACTION
} from "../../src/identity/staff/enrollment-password.js";
import {
  handleProtectedBootstrapEnrollmentPassword
} from "../../src/identity/staff/enrollment-password-http.js";
import {
  BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS
} from "../../src/identity/staff/invitation-acceptance.js";

const START = new Date("2030-01-01T00:00:00.000Z");
const ACCOUNT_ID = "a".repeat(32);
const EMAIL_ID = "e".repeat(32);
const INVITATION_ID = "d".repeat(32);
const INVITATION_CHALLENGE_ID = "c".repeat(32);
const PENDING_CHALLENGE_ID = "4".repeat(32);
const SESSION_ID = "1".repeat(32);
const SECOND_SESSION_ID = "2".repeat(32);
const ENROLLMENT_DEADLINE = "2030-01-04T00:00:00.000Z";
const SESSION_EXPIRY = "2030-01-01T00:30:00.000Z";
const SESSION_TOKEN = "primary_enrollment_session_token_123456789";
const CSRF_TOKEN = "primary_enrollment_csrf_token_123456789012";
const IDEMPOTENCY_KEY = "123e4567-e89b-12d3-a456-426614174200";
const PASSWORD = "correct unique password phrase 2030";
const LEGACY_VERIFIER = "9".repeat(64);

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
    this.beforeNextBatch = null;
  }

  prepare(sql) {
    return new SqliteD1Statement(this, sql);
  }

  async batch(statements) {
    if (this.beforeNextBatch) {
      const callback = this.beforeNextBatch;
      this.beforeNextBatch = null;
      callback(this.sqlite);
    }
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.executeBatch());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      this.lastBatchError = error;
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

function environment(sqlite) {
  return {
    DB: new SqliteD1Database(sqlite),
    SUPERADMIN_USERNAME: "senkimsin",
    ADMIN_USERNAME: "admin",
    CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT: "runbook:staff-bootstrap:test",
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_STAFF_WEBAUTHN_READY: "true",
    CRM_AUTH_CLIENT_READY_ADMIN_WEB: "true",
    CRM_AUTH_STAFF_RECONCILED: "false",
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "true",
    CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me",
    CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_SESSION_HMAC_KEY_V1: "s".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY_V2: "t".repeat(64),
    CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1: "i".repeat(64),
    CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1:
      Buffer.alloc(32, 8).toString("base64url"),
    CRM_AUTH_PASSWORD_PEPPER_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_PASSWORD_PEPPER_KEY_V1:
      Buffer.alloc(32, 7).toString("base64url")
  };
}

function authorizationContext() {
  return JSON.stringify({
    source: "staff_invitation",
    invitation_id: INVITATION_ID,
    challenge_id: INVITATION_CHALLENGE_ID,
    stage: "email_verified",
    allowed_actions: BOOTSTRAP_ENROLLMENT_ALLOWED_ACTIONS
  });
}

async function insertSession(sqlite, env, {
  id,
  token,
  csrf,
  scope = "staff_enrollment",
  authorization = authorizationContext(),
  createdTransitionId
}) {
  const hashes = await createSessionHashesForIssuance(env, {
    sessionToken: token,
    csrfToken: csrf
  });
  sqlite.prepare(`
    INSERT INTO auth_sessions (
      id, auth_account_id, realm, token_hash, token_hash_version,
      created_transition_id, issued_auth_version, scope, assurance_level,
      auth_methods_json, authorization_context_json, session_transport,
      csrf_token_hash, client_platform, app_version, authenticated_at,
      created_at, expires_at
    ) VALUES (?, ?, 'staff', ?, ?, ?, 1, ?, 1, '["email"]', ?, 'cookie', ?,
              'admin_web', '1.0.0', ?, ?, ?)
  `).run(
    id,
    ACCOUNT_ID,
    hashes.tokenHash,
    hashes.tokenHashVersion,
    createdTransitionId,
    scope,
    authorization,
    hashes.csrfTokenHash,
    START.toISOString(),
    START.toISOString(),
    SESSION_EXPIRY
  );
}

async function seedEnrollment(sqlite, env, {
  legacyCredential = true,
  secondarySession = true,
  pendingChallenge = true
} = {}) {
  sqlite.prepare(`
    INSERT INTO auth_accounts (
      id, webauthn_user_handle, realm, status, auth_version,
      enrollment_state, enrollment_deadline_at, last_transition_id,
      created_at, updated_at, locale
    ) VALUES (?, ?, 'staff', 'pending', 1, 'in_progress', ?, ?, ?, ?, 'en')
  `).run(
    ACCOUNT_ID,
    "b".repeat(32),
    ENROLLMENT_DEADLINE,
    "5".repeat(32),
    START.toISOString(),
    START.toISOString()
  );
  sqlite.prepare(`
    INSERT INTO admin_users (
      id, username, password_hash, role, is_active, created_at,
      auth_account_id, username_normalized, is_protected
    ) VALUES (1, 'senkimsin', ?, 'superadmin', 1, ?, ?, 'senkimsin', 1)
  `).run(
    legacyCredential ? LEGACY_VERIFIER : "!canonical-auth-disabled!",
    START.toISOString(),
    ACCOUNT_ID
  );
  if (legacyCredential) {
    sqlite.prepare(`
      INSERT INTO auth_password_credentials (
        id, auth_account_id, account_realm, verifier, algorithm,
        algorithm_version, parameters_json, pepper_key_version,
        needs_upgrade, created_at, updated_at, created_transition_id
      ) VALUES (?, ?, 'staff', ?, 'legacy_sha256_admin_jwt_secret_v1', 1,
                '{"digest":"SHA-256"}', 0, 1, ?, ?, ?)
    `).run(
      "6".repeat(32),
      ACCOUNT_ID,
      LEGACY_VERIFIER,
      START.toISOString(),
      START.toISOString(),
      "7".repeat(32)
    );
  }
  sqlite.prepare(`
    INSERT INTO auth_email_addresses (
      id, auth_account_id, realm, normalized_email, display_email, status,
      is_primary, verified_at, created_at, updated_at
    ) VALUES (?, ?, 'staff', 'owner@example.com', 'owner@example.com',
              'verified', 1, ?, ?, ?)
  `).run(
    EMAIL_ID,
    ACCOUNT_ID,
    START.toISOString(),
    START.toISOString(),
    START.toISOString()
  );
  sqlite.prepare(`
    INSERT INTO auth_challenges (
      id, auth_account_id, realm, email_address_id, expected_auth_version,
      purpose, status, verification_method, required_proof_policy, token_hash,
      fingerprint_key_version, locale, correlation_id, expires_at, created_at,
      consumed_at
    ) VALUES (?, ?, 'staff', ?, 1, 'staff_invitation', 'consumed',
              'magic_link', 'single', ?, 1, 'en', ?, ?, ?, ?)
  `).run(
    INVITATION_CHALLENGE_ID,
    ACCOUNT_ID,
    EMAIL_ID,
    "8".repeat(64),
    "8".repeat(32),
    "2030-01-02T00:00:00.000Z",
    START.toISOString(),
    START.toISOString()
  );
  sqlite.prepare(`
    INSERT INTO auth_staff_invitations (
      id, auth_account_id, account_realm, admin_user_id, email_address_id,
      challenge_id, invited_by_actor_ref, status, expires_at, created_at,
      updated_at, accepted_at
    ) VALUES (?, ?, 'staff', 1, ?, ?, ?, 'accepted', ?, ?, ?, ?)
  `).run(
    INVITATION_ID,
    ACCOUNT_ID,
    EMAIL_ID,
    INVITATION_CHALLENGE_ID,
    env.CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT,
    "2030-01-02T00:00:00.000Z",
    START.toISOString(),
    START.toISOString(),
    START.toISOString()
  );
  await insertSession(sqlite, env, {
    id: SESSION_ID,
    token: SESSION_TOKEN,
    csrf: CSRF_TOKEN,
    createdTransitionId: "9".repeat(32)
  });
  if (secondarySession) {
    await insertSession(sqlite, env, {
      id: SECOND_SESSION_ID,
      token: "secondary_enrollment_session_token_12345678",
      csrf: "secondary_enrollment_csrf_token_12345678901",
      createdTransitionId: "f".repeat(32)
    });
  }
  if (pendingChallenge) {
    sqlite.prepare(`
      INSERT INTO auth_challenges (
        id, auth_account_id, realm, expected_auth_version, purpose, status,
        verification_method, required_proof_policy, initiation_state_hash,
        fingerprint_key_version, locale, correlation_id, expires_at, created_at
      ) VALUES (?, ?, 'staff', 1, 'staff_recovery', 'pending', 'multi_proof',
                'staff_recovery', ?, 1, 'en', ?, ?, ?)
    `).run(
      PENDING_CHALLENGE_ID,
      ACCOUNT_ID,
      "a".repeat(64),
      "b".repeat(32),
      "2030-01-01T00:20:00.000Z",
      START.toISOString()
    );
  }
}

function passwordRequest({
  password = PASSWORD,
  key = IDEMPOTENCY_KEY,
  sessionToken = SESSION_TOKEN,
  csrfCookie = CSRF_TOKEN,
  csrfHeader = csrfCookie,
  origin = "https://crm.ayartuerk.me",
  body = { new_password: password },
  authorization
} = {}) {
  const headers = {
    "content-type": "application/json",
    "idempotency-key": key,
    origin,
    "x-csrf-token": csrfHeader,
    cookie: [
      `__Host-crm_staff_enrollment=${sessionToken}`,
      `__Host-crm_staff_enrollment_csrf=${csrfCookie}`
    ].join("; ")
  };
  if (authorization) headers.authorization = authorization;
  return new Request(
    `https://crm.ayartuerk.me${STAFF_ENROLLMENT_PASSWORD_ROUTE}`,
    { method: "PUT", headers, body: JSON.stringify(body) }
  );
}

async function deterministicTestArgon2id(input) {
  assert.equal(input.password.byteLength, 32);
  assert.equal(input.salt.byteLength, 16);
  assert.deepEqual(
    {
      memoryKiB: input.memoryKiB,
      iterations: input.iterations,
      parallelism: input.parallelism,
      hashBytes: input.hashBytes
    },
    { memoryKiB: 19456, iterations: 2, parallelism: 1, hashBytes: 32 }
  );
  const source = new Uint8Array(input.password.length + input.salt.length);
  source.set(input.password);
  source.set(input.salt, input.password.length);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", source));
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

function snapshot(sqlite) {
  return JSON.stringify({
    accounts: sqlite.prepare("SELECT * FROM auth_accounts").all(),
    profiles: sqlite.prepare("SELECT * FROM admin_users").all(),
    credentials: sqlite.prepare("SELECT * FROM auth_password_credentials").all(),
    sessions: sqlite.prepare("SELECT * FROM auth_sessions").all(),
    challenges: sqlite.prepare("SELECT * FROM auth_challenges").all(),
    events: sqlite.prepare("SELECT * FROM auth_security_events").all(),
    idempotency: sqlite.prepare("SELECT * FROM auth_idempotency_keys").all()
  }, (_key, value) => (
    value instanceof Uint8Array ? Buffer.from(value).toString("hex") : value
  ));
}

test("password enrollment atomically replaces legacy proof and rotates only the initiating restricted session", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  await seedEnrollment(sqlite, env);

  const response = await handleProtectedBootstrapEnrollmentPassword(
    passwordRequest(),
    env,
    {
      now: START,
      deriveArgon2id: deterministicTestArgon2id,
      isKnownCompromisedOrCommon: async () => false
    }
  );
  assert.equal(response.status, 200);
  const body = await responseJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.enrollment.stage, "email_verified");
  assert.equal(body.enrollment.password_set, true);
  assert.equal(body.session.scope, "staff_enrollment");
  assert.equal(body.session.transport, "cookie");
  assert.equal(Object.hasOwn(body.session, "access_token"), false);
  assert.equal(JSON.stringify(body).includes(PASSWORD), false);
  assert.match(response.headers.get("set-cookie"), /__Host-crm_staff_enrollment=/);

  const account = sqlite.prepare("SELECT * FROM auth_accounts WHERE id = ?")
    .get(ACCOUNT_ID);
  assert.equal(account.auth_version, 2);
  assert.equal(account.legacy_sessions_revoked_before, START.toISOString());
  assert.equal(account.legacy_login_disabled_at, null);
  assert.equal(account.enrollment_state, "in_progress");
  assert.equal(
    sqlite.prepare("SELECT password_hash FROM admin_users WHERE id = 1")
      .get().password_hash,
    "!canonical-auth-disabled!"
  );

  const credentials = sqlite.prepare(`
    SELECT * FROM auth_password_credentials ORDER BY created_at, id
  `).all();
  assert.equal(credentials.length, 2);
  const legacy = credentials.find((row) => (
    row.algorithm === "legacy_sha256_admin_jwt_secret_v1"
  ));
  const canonical = credentials.find((row) => row.algorithm === "argon2id_phc_v1");
  assert.equal(legacy.revoked_at, START.toISOString());
  assert.equal(canonical.revoked_at, null);
  assert.equal(canonical.algorithm_version, 1);
  assert.equal(canonical.pepper_key_version, 1);
  assert.equal(canonical.needs_upgrade, 0);
  assert.equal(
    canonical.parameters_json,
    '{"memoryKiB":19456,"iterations":2,"parallelism":1,"saltBytes":16,"hashBytes":32}'
  );
  assert.match(canonical.verifier, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);

  const sessions = sqlite.prepare("SELECT * FROM auth_sessions ORDER BY id").all();
  assert.equal(sessions.filter((row) => row.revoked_at === null).length, 1);
  const source = sessions.find((row) => row.id === SESSION_ID);
  const secondary = sessions.find((row) => row.id === SECOND_SESSION_ID);
  const next = sessions.find((row) => row.id === body.session.id);
  assert.equal(source.revocation_reason, "enrollment_password_set");
  assert.equal(source.rotated_to_session_id, body.session.id);
  assert.equal(secondary.revocation_reason, "password_changed");
  assert.equal(next.issued_auth_version, 2);
  assert.equal(next.rotated_from_session_id, SESSION_ID);
  assert.equal(next.scope, "staff_enrollment");
  assert.equal(next.session_transport, "cookie");
  assert.equal(JSON.parse(next.authorization_context_json).password_set, true);
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_challenges WHERE id = ?")
      .get(PENDING_CHALLENGE_ID).status,
    "invalidated"
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_security_events WHERE event_type = 'staff.enrollment.password_set'")
      .get().count,
    1
  );
  const idempotency = sqlite.prepare("SELECT * FROM auth_idempotency_keys").get();
  assert.equal(idempotency.operation, STAFF_ENROLLMENT_PASSWORD_ACTION);
  assert.equal(idempotency.status, "completed");
  assert.ok(idempotency.response_payload_ciphertext instanceof Uint8Array);
  const persisted = snapshot(sqlite);
  assert.equal(persisted.includes(PASSWORD), false);
  assert.equal(persisted.includes(body.session.csrf_token), false);

  const replay = await handleProtectedBootstrapEnrollmentPassword(
    passwordRequest(),
    env,
    {
      now: new Date("2030-01-01T00:00:01.000Z"),
      deriveArgon2id: () => {
        throw new Error("must not derive on replay");
      },
      isKnownCompromisedOrCommon: () => {
        throw new Error("must not screen on replay");
      }
    }
  );
  assert.equal(replay.status, 200);
  assert.deepEqual(await responseJson(replay), body);
  assert.match(replay.headers.get("set-cookie"), /__Host-crm_staff_enrollment=/);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_password_credentials").get().count,
    2
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions").get().count,
    3
  );
});

test("password policy, provider, and Argon2 failures fail closed without mutation", async (t) => {
  const cases = [
    {
      name: "weak",
      password: "too short",
      checker: async () => false,
      derive: deterministicTestArgon2id,
      status: 400,
      code: "weak_password"
    },
    {
      name: "compromised",
      password: PASSWORD,
      checker: async () => true,
      derive: deterministicTestArgon2id,
      status: 400,
      code: "weak_password"
    },
    {
      name: "provider",
      password: PASSWORD,
      checker: async () => { throw new Error("offline"); },
      derive: deterministicTestArgon2id,
      status: 503,
      code: "temporarily_unavailable"
    },
    {
      name: "engine missing",
      password: PASSWORD,
      checker: async () => {
        throw new Error("screening must not run without an engine");
      },
      derive: undefined,
      status: 503,
      code: "temporarily_unavailable"
    },
    {
      name: "engine failure",
      password: PASSWORD,
      checker: async () => false,
      derive: async () => { throw new Error("argon unavailable"); },
      status: 503,
      code: "temporarily_unavailable"
    }
  ];

  for (const item of cases) {
    await t.test(item.name, async (subtest) => {
      const sqlite = await migratedDatabase();
      subtest.after(() => sqlite.close());
      const env = environment(sqlite);
      await seedEnrollment(sqlite, env, {
        secondarySession: false,
        pendingChallenge: false
      });
      const before = snapshot(sqlite);
      const response = await handleProtectedBootstrapEnrollmentPassword(
        passwordRequest({ password: item.password }),
        env,
        {
          now: START,
          deriveArgon2id: item.derive,
          isKnownCompromisedOrCommon: item.checker
        }
      );
      assert.equal(response.status, item.status);
      assert.equal((await responseJson(response)).error.code, item.code);
      assert.equal(snapshot(sqlite), before);
      assert.equal(
        sqlite.prepare("SELECT COUNT(*) AS count FROM auth_idempotency_keys").get().count,
        0
      );
    });
  }
});

test("a concurrent auth-version change rolls back every password-side effect", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  await seedEnrollment(sqlite, env);
  env.DB.beforeNextBatch = null;
  const response = await handleProtectedBootstrapEnrollmentPassword(
    passwordRequest(),
    env,
    {
      now: START,
      deriveArgon2id: deterministicTestArgon2id,
      isKnownCompromisedOrCommon: async () => {
        env.DB.beforeNextBatch = (database) => {
          database.prepare(`
            UPDATE auth_accounts SET auth_version = 2 WHERE id = ?
          `).run(ACCOUNT_ID);
        };
        return false;
      }
    }
  );
  assert.equal(response.status, 503);
  assert.equal((await responseJson(response)).error.code, "temporarily_unavailable");
  assert.equal(
    sqlite.prepare("SELECT auth_version FROM auth_accounts WHERE id = ?")
      .get(ACCOUNT_ID).auth_version,
    2
  );
  const credentials = sqlite.prepare("SELECT * FROM auth_password_credentials").all();
  assert.equal(credentials.length, 1);
  assert.equal(credentials[0].algorithm, "legacy_sha256_admin_jwt_secret_v1");
  assert.equal(credentials[0].revoked_at, null);
  assert.equal(
    sqlite.prepare("SELECT password_hash FROM admin_users WHERE id = 1")
      .get().password_hash,
    LEGACY_VERIFIER
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE revoked_at IS NOT NULL")
      .get().count,
    0
  );
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_challenges WHERE id = ?")
      .get(PENDING_CHALLENGE_ID).status,
    "pending"
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_security_events").get().count,
    0
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_idempotency_keys").get().count,
    0
  );
});

test("HTTP contract is exact, origin/CSRF scoped, and never accepts native bearer authentication", async (t) => {
  await t.test("exact body", async (subtest) => {
    const sqlite = await migratedDatabase();
    subtest.after(() => sqlite.close());
    const env = environment(sqlite);
    await seedEnrollment(sqlite, env);
    const response = await handleProtectedBootstrapEnrollmentPassword(
      passwordRequest({ body: { new_password: PASSWORD, current_password: "x" } }),
      env,
      {
        now: START,
        deriveArgon2id: deterministicTestArgon2id,
        isKnownCompromisedOrCommon: async () => false
      }
    );
    assert.equal(response.status, 400);
    assert.equal((await responseJson(response)).error.code, "invalid_request");
  });

  await t.test("origin and CSRF", async (subtest) => {
    for (const request of [
      passwordRequest({ origin: "https://evil.example" }),
      passwordRequest({ csrfHeader: "wrong_csrf_token_value_1234567890123456" })
    ]) {
      const sqlite = await migratedDatabase();
      subtest.after(() => sqlite.close());
      const env = environment(sqlite);
      await seedEnrollment(sqlite, env);
      const response = await handleProtectedBootstrapEnrollmentPassword(
        request,
        env,
        {
          now: START,
          deriveArgon2id: deterministicTestArgon2id,
          isKnownCompromisedOrCommon: async () => false
        }
      );
      assert.equal([401, 403].includes(response.status), true);
      assert.equal(
        sqlite.prepare("SELECT COUNT(*) AS count FROM auth_idempotency_keys").get().count,
        0
      );
    }
  });

  await t.test("bearer-only native assumption", async (subtest) => {
    const sqlite = await migratedDatabase();
    subtest.after(() => sqlite.close());
    const env = environment(sqlite);
    await seedEnrollment(sqlite, env);
    const request = new Request(
      `https://crm.ayartuerk.me${STAFF_ENROLLMENT_PASSWORD_ROUTE}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "idempotency-key": IDEMPOTENCY_KEY,
          origin: "https://crm.ayartuerk.me",
          authorization: `Bearer ${SESSION_TOKEN}`
        },
        body: JSON.stringify({ new_password: PASSWORD })
      }
    );
    const response = await handleProtectedBootstrapEnrollmentPassword(
      request,
      env,
      {
        now: START,
        deriveArgon2id: deterministicTestArgon2id,
        isKnownCompromisedOrCommon: async () => false
      }
    );
    assert.equal(response.status, 401);
    assert.equal((await responseJson(response)).error.code, "unauthorized");
  });
});

test("same idempotency key with a changed password is rejected before retired-cookie resolution", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  await seedEnrollment(sqlite, env);
  const options = {
    now: START,
    deriveArgon2id: deterministicTestArgon2id,
    isKnownCompromisedOrCommon: async () => false
  };
  assert.equal(
    (await handleProtectedBootstrapEnrollmentPassword(
      passwordRequest(),
      env,
      options
    )).status,
    200
  );
  const changed = await handleProtectedBootstrapEnrollmentPassword(
    passwordRequest({ password: `${PASSWORD} changed` }),
    env,
    { ...options, now: new Date("2030-01-01T00:00:01.000Z") }
  );
  assert.equal(changed.status, 409);
  assert.equal((await responseJson(changed)).error.code, "idempotency_key_reused");
});
