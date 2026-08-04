import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { hashOpaqueToken } from "../../src/identity/crypto.js";
import {
  createIdempotencyContext,
  reserveIdempotencyKey
} from "../../src/identity/idempotency.js";
import { verifyRecoveryCode } from "../../src/identity/recovery-codes.js";
import { createSessionHashesForIssuance } from "../../src/identity/session-keyring.js";
import {
  handleStaffEnrollmentRecoveryCodeSetAcknowledgement,
  handleStaffEnrollmentRecoveryCodeSetGeneration
} from "../../src/identity/staff/enrollment-recovery-code-http.js";
import {
  ACKNOWLEDGEMENT_LIFETIME_MS,
  STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE,
  STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
  StaffEnrollmentRecoveryCodeError,
  acknowledgeStaffEnrollmentRecoveryCodeSet,
  generateStaffEnrollmentRecoveryCodeSet,
  validateEnrollmentRecoveryCodeAckReplayEnvelope
} from "../../src/identity/staff/enrollment-recovery-code-sets.js";

const START = new Date("2030-01-01T00:00:00.000Z");
const ACCOUNT_ID = "a".repeat(32);
const EMAIL_ID = "e".repeat(32);
const INVITATION_ID = "d".repeat(32);
const INVITATION_CHALLENGE_ID = "c".repeat(32);
const SESSION_ID = "1".repeat(32);
const SECOND_SESSION_ID = "2".repeat(32);
const ACTIVE_SET_ID = "3".repeat(32);
const PENDING_CHALLENGE_ID = "4".repeat(32);
const ENROLLMENT_DEADLINE = "2030-01-04T00:00:00.000Z";
const SESSION_EXPIRY = "2030-01-01T00:30:00.000Z";
const GENERATE_KEY = "123e4567-e89b-12d3-a456-426614174100";
const ACK_KEY = "123e4567-e89b-12d3-a456-426614174101";
const PRIMARY_SESSION_TOKEN = "primary_enrollment_session_token_123456789";
const PRIMARY_CSRF_TOKEN = "primary_enrollment_csrf_token_123456789012";

const ALLOWED_ACTIONS = Object.freeze([
  "GET /api/v1/admin/auth/enrollment",
  "POST /api/v1/admin/auth/enrollment/logout",
  "PUT /api/v1/admin/auth/enrollment/password",
  "POST /api/v1/admin/auth/enrollment/passkeys/registration/options",
  "POST /api/v1/admin/auth/enrollment/passkeys/registration/complete",
  `POST ${STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE}`,
  `POST ${STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE}`,
  "POST /api/v1/admin/auth/enrollment/complete"
]);

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
    CRM_AUTH_SCHEMA_READY: "true",
    CRM_AUTH_CANONICAL_RESOLVER: "true",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_STAFF_WEBAUTHN_READY: "true",
    CRM_AUTH_CLIENT_READY_ADMIN_WEB: "true",
    CRM_AUTH_STAFF_RECONCILED: "false",
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "true",
    CRM_AUTH_ALLOWED_ORIGINS: "https://crm.ayartuerk.me",
    CRM_AUTH_RECOVERY_CODE_HMAC_ACTIVE_KEY_VERSION: "3",
    CRM_AUTH_RECOVERY_CODE_HMAC_RETAINED_KEY_VERSIONS: "2",
    CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V2: "q".repeat(64),
    CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V3: "r".repeat(64),
    CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_SESSION_HMAC_KEY_V1: "s".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY_V2: "t".repeat(64),
    CRM_AUTH_IDEMPOTENCY_HMAC_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1: "i".repeat(64),
    CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1: Buffer.alloc(32, 8).toString("base64url")
  };
}

function authorizationContext() {
  return JSON.stringify({
    source: "staff_invitation",
    invitation_id: INVITATION_ID,
    challenge_id: INVITATION_CHALLENGE_ID,
    stage: "email_verified",
    allowed_actions: ALLOWED_ACTIONS
  });
}

async function insertSession(sqlite, env, {
  id,
  token,
  csrf,
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
    ) VALUES (?, ?, 'staff', ?, ?, ?, 1, 'staff_enrollment', 1,
              '["email"]', ?, 'cookie', ?, 'admin_web', '1.0.0', ?, ?, ?)
  `).run(
    id,
    ACCOUNT_ID,
    hashes.tokenHash,
    hashes.tokenHashVersion,
    createdTransitionId,
    authorizationContext(),
    hashes.csrfTokenHash,
    START.toISOString(),
    START.toISOString(),
    SESSION_EXPIRY
  );
  return sqlite.prepare("SELECT * FROM auth_sessions WHERE id = ?").get(id);
}

async function seedEnrollment(sqlite, env, {
  secondSession = false,
  activeSet = false,
  pendingChallenge = false
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
    ) VALUES (1, 'senkimsin', '!canonical-auth-disabled!', 'superadmin', 1, ?, ?,
              'senkimsin', 1)
  `).run(START.toISOString(), ACCOUNT_ID);
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
    "6".repeat(64),
    "6".repeat(32),
    "2030-01-02T00:00:00.000Z",
    START.toISOString(),
    START.toISOString()
  );
  sqlite.prepare(`
    INSERT INTO auth_staff_invitations (
      id, auth_account_id, account_realm, admin_user_id, email_address_id,
      challenge_id, invited_by_actor_ref, status, expires_at, created_at,
      updated_at, accepted_at
    ) VALUES (?, ?, 'staff', 1, ?, ?, 'runbook:owner-bootstrap', 'accepted', ?,
              ?, ?, ?)
  `).run(
    INVITATION_ID,
    ACCOUNT_ID,
    EMAIL_ID,
    INVITATION_CHALLENGE_ID,
    "2030-01-02T00:00:00.000Z",
    START.toISOString(),
    START.toISOString(),
    START.toISOString()
  );

  const primary = await insertSession(sqlite, env, {
    id: SESSION_ID,
    token: PRIMARY_SESSION_TOKEN,
    csrf: PRIMARY_CSRF_TOKEN,
    createdTransitionId: "7".repeat(32)
  });
  let secondary = null;
  if (secondSession) {
    secondary = await insertSession(sqlite, env, {
      id: SECOND_SESSION_ID,
      token: "second_enrollment_session_token_1234567890",
      csrf: "second_enrollment_csrf_token_1234567890123",
      createdTransitionId: "8".repeat(32)
    });
  }

  if (activeSet) {
    sqlite.prepare(`
      INSERT INTO auth_recovery_code_sets (
        id, auth_account_id, account_realm, generating_session_id,
        expected_auth_version, status, code_count, created_at,
        acknowledgement_expires_at, acknowledged_at, activated_at,
        created_transition_id, activation_transition_id
      ) VALUES (?, ?, 'staff', ?, 1, 'active', 10, ?, ?, ?, ?, ?, ?)
    `).run(
      ACTIVE_SET_ID,
      ACCOUNT_ID,
      SESSION_ID,
      START.toISOString(),
      "2030-01-01T00:10:00.000Z",
      START.toISOString(),
      START.toISOString(),
      "9".repeat(32),
      "f".repeat(32)
    );
    const statement = sqlite.prepare(`
      INSERT INTO auth_recovery_codes (
        id, auth_account_id, account_realm, code_set_id, code_position,
        verifier, verifier_key_version, created_at
      ) VALUES (?, ?, 'staff', ?, ?, ?, 3, ?)
    `);
    for (let position = 1; position <= 10; position += 1) {
      statement.run(
        position.toString(16).padStart(32, "0"),
        ACCOUNT_ID,
        ACTIVE_SET_ID,
        position,
        position.toString(16).padStart(64, "0"),
        START.toISOString()
      );
    }
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
  return { primary, secondary };
}

function enrollmentMutation(path, {
  key,
  sessionToken = PRIMARY_SESSION_TOKEN,
  csrfCookie = PRIMARY_CSRF_TOKEN,
  csrfHeader = csrfCookie,
  body = {},
  origin = "https://crm.ayartuerk.me"
} = {}) {
  return new Request(`https://crm.ayartuerk.me${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": key,
      "origin": origin,
      "x-csrf-token": csrfHeader,
      "cookie": [
        `__Host-crm_staff_enrollment=${sessionToken}`,
        `__Host-crm_staff_enrollment_csrf=${csrfCookie}`
      ].join("; ")
    },
    body: JSON.stringify(body)
  });
}

function idempotencyRequest(path, key) {
  return new Request(`https://crm.ayartuerk.me${path}`, {
    method: "POST",
    headers: { "idempotency-key": key }
  });
}

async function reserve(env, {
  routeTemplate,
  actualPath = routeTemplate,
  key,
  body = {},
  subjectScope,
  now = START
}) {
  const request = idempotencyRequest(actualPath, key);
  const context = await createIdempotencyContext(request, {
    realm: "staff",
    routeTemplate,
    body,
    subjectScope,
    hashKeyVersion: 1,
    hashKeyMaterial: env.CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1
  });
  return {
    request,
    context,
    result: await reserveIdempotencyKey(env, context, {
      secretBearing: true,
      now
    })
  };
}

async function generate(sqlite, env, session, {
  key = GENERATE_KEY,
  now = START,
  requestId = "a1".repeat(16)
} = {}) {
  const held = await reserve(env, {
    routeTemplate: STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    key,
    subjectScope: `staff-enrollment:${session.id}:recovery-code-generation`,
    now
  });
  assert.equal(held.result.outcome, "reserved");
  const generated = await generateStaffEnrollmentRecoveryCodeSet(env, {
    session,
    reservation: held.result.reservation,
    requestId,
    now
  });
  return { ...held, generated };
}

async function reserveAcknowledgement(env, session, setId, {
  key = ACK_KEY,
  now = new Date("2030-01-01T00:01:00.000Z")
} = {}) {
  return reserve(env, {
    routeTemplate: STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE,
    actualPath: `/api/v1/admin/auth/enrollment/recovery-code-sets/${setId}/acknowledge`,
    key,
    subjectScope: `staff-enrollment:${session.id}:recovery-code-set:${setId}`,
    now
  });
}

test("generation stores ten context-bound HMAC verifiers and replays raw codes only from ciphertext", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  const { primary } = await seedEnrollment(sqlite, env);

  await assert.rejects(
    generateStaffEnrollmentRecoveryCodeSet(env, {
      session: primary,
      reservation: null,
      requestId: "01".repeat(16),
      now: START
    }),
    (error) => error instanceof StaffEnrollmentRecoveryCodeError
      && error.code === "idempotency_required"
  );

  const result = await generate(sqlite, env, primary);
  const body = result.generated.body;
  assert.equal(body.codes.length, 10);
  assert.equal(new Set(body.codes).size, 10);
  assert.equal(body.recovery_code_set.acknowledgement_required, true);
  assert.equal(
    Date.parse(body.recovery_code_set.expires_at) - START.getTime(),
    ACKNOWLEDGEMENT_LIFETIME_MS
  );
  for (const code of body.codes) {
    assert.match(code, /^(?:[0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/);
  }

  const set = sqlite.prepare("SELECT * FROM auth_recovery_code_sets WHERE id = ?")
    .get(result.generated.setId);
  assert.equal(set.status, "generated");
  assert.equal(set.generating_session_id, SESSION_ID);
  assert.equal(set.expected_auth_version, 1);
  assert.equal(set.code_count, 10);
  const storedCodes = sqlite.prepare(`
    SELECT * FROM auth_recovery_codes WHERE code_set_id = ? ORDER BY code_position
  `).all(result.generated.setId);
  assert.equal(storedCodes.length, 10);
  assert.ok(storedCodes.every((row) => row.verifier_key_version === 3));
  assert.ok(storedCodes.every((row) => /^[0-9a-f]{64}$/.test(row.verifier)));
  assert.equal(await verifyRecoveryCode(env, body.codes[0], storedCodes[0]), true);

  const persistedSnapshot = JSON.stringify({
    sets: sqlite.prepare("SELECT * FROM auth_recovery_code_sets").all(),
    codes: sqlite.prepare("SELECT * FROM auth_recovery_codes").all(),
    events: sqlite.prepare("SELECT * FROM auth_security_events").all(),
    idempotency: sqlite.prepare("SELECT * FROM auth_idempotency_keys").all()
  }, (_key, value) => (
    value instanceof Uint8Array ? Buffer.from(value).toString("hex") : value
  ));
  for (const code of body.codes) {
    assert.equal(persistedSnapshot.includes(code), false);
  }
  const persistedIdempotency = sqlite.prepare("SELECT * FROM auth_idempotency_keys").get();
  assert.equal(persistedIdempotency.status, "completed");
  assert.ok(persistedIdempotency.response_payload_ciphertext instanceof Uint8Array);

  const replay = await reserveIdempotencyKey(env, result.context, {
    secretBearing: true,
    now: new Date("2030-01-01T00:00:01.000Z")
  });
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.response.status, 201);
  assert.deepEqual(replay.response.body, body);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_code_sets").get().count, 1);

  const replacement = await generate(sqlite, env, primary, {
    key: "123e4567-e89b-12d3-a456-426614174103",
    now: new Date("2030-01-01T00:00:02.000Z"),
    requestId: "a2".repeat(16)
  });
  assert.notEqual(replacement.generated.setId, result.generated.setId);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_code_sets WHERE status = 'generated'")
      .get().count,
    1
  );
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_recovery_code_sets WHERE id = ?")
      .get(result.generated.setId).status,
    "revoked"
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_codes WHERE code_set_id = ? AND revoked_at IS NOT NULL")
      .get(result.generated.setId).count,
    10
  );
  const originalReplay = await reserveIdempotencyKey(env, result.context, {
    secretBearing: true,
    now: new Date("2030-01-01T00:00:03.000Z")
  });
  assert.equal(originalReplay.outcome, "replay");
  assert.deepEqual(originalReplay.response.body, body);
});

test("acknowledgement atomically activates the set, revokes prior credentials, and rotates only the generating session", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  const { primary } = await seedEnrollment(sqlite, env, {
    secondSession: true,
    activeSet: true,
    pendingChallenge: true
  });
  const generated = await generate(sqlite, env, primary);
  const ackAt = new Date("2030-01-01T00:01:00.000Z");
  const held = await reserveAcknowledgement(
    env,
    primary,
    generated.generated.setId,
    { now: ackAt }
  );
  assert.equal(held.result.outcome, "reserved");
  const acknowledged = await acknowledgeStaffEnrollmentRecoveryCodeSet(env, {
    session: primary,
    setId: generated.generated.setId,
    reservation: held.result.reservation,
    requestId: "b2".repeat(16),
    now: ackAt
  });
  const envelope = validateEnrollmentRecoveryCodeAckReplayEnvelope(
    acknowledged.envelope
  );
  assert.equal(envelope.public_body.recovery_code_set.status, "active");
  assert.equal(envelope.public_body.enrollment.recovery_codes_acknowledged, true);
  assert.equal(Object.hasOwn(envelope.public_body.session, "access_token"), false);
  assert.doesNotMatch(
    JSON.stringify(envelope.public_body),
    new RegExp(generated.generated.body.codes.join("|"))
  );

  const account = sqlite.prepare("SELECT * FROM auth_accounts WHERE id = ?").get(ACCOUNT_ID);
  assert.equal(account.auth_version, 2);
  assert.equal(account.legacy_sessions_revoked_before, ackAt.toISOString());
  const sets = sqlite.prepare(`
    SELECT id, status, revoked_at FROM auth_recovery_code_sets ORDER BY id
  `).all();
  assert.deepEqual(sets.map(({ id, status }) => ({ id, status })), [
    { id: ACTIVE_SET_ID, status: "revoked" },
    { id: generated.generated.setId, status: "active" }
  ].sort((left, right) => left.id.localeCompare(right.id)));
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_codes WHERE code_set_id = ? AND revoked_at IS NOT NULL")
      .get(ACTIVE_SET_ID).count,
    10
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_codes WHERE code_set_id = ? AND revoked_at IS NULL")
      .get(generated.generated.setId).count,
    10
  );

  const sessions = sqlite.prepare("SELECT * FROM auth_sessions ORDER BY created_at, id").all();
  const activeSessions = sessions.filter((row) => row.revoked_at === null);
  assert.equal(activeSessions.length, 1);
  assert.equal(activeSessions[0].id, acknowledged.sessionId);
  assert.equal(activeSessions[0].issued_auth_version, 2);
  assert.equal(activeSessions[0].token_hash_version, 2);
  assert.equal(activeSessions[0].rotated_from_session_id, SESSION_ID);
  assert.equal(
    activeSessions[0].token_hash,
    await hashOpaqueToken(
      envelope.cookie_session_token,
      env.CRM_AUTH_SESSION_HMAC_KEY_V2
    )
  );
  const rotated = sessions.find((row) => row.id === SESSION_ID);
  assert.equal(rotated.rotated_to_session_id, acknowledged.sessionId);
  assert.equal(rotated.revoked_at, ackAt.toISOString());
  assert.equal(
    sessions.find((row) => row.id === SECOND_SESSION_ID).revoked_at,
    ackAt.toISOString()
  );
  const context = JSON.parse(activeSessions[0].authorization_context_json);
  assert.equal(context.recovery_codes_acknowledged, true);
  assert.deepEqual(context.allowed_actions, ALLOWED_ACTIONS);
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_challenges WHERE id = ?")
      .get(PENDING_CHALLENGE_ID).status,
    "invalidated"
  );

  const replay = await reserveIdempotencyKey(env, held.context, {
    secretBearing: true,
    now: new Date("2030-01-01T00:01:01.000Z")
  });
  assert.equal(replay.outcome, "replay");
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.response.body, envelope);

  const duplicateHeld = await reserveAcknowledgement(
    env,
    primary,
    generated.generated.setId,
    {
      key: "123e4567-e89b-12d3-a456-426614174102",
      now: new Date("2030-01-01T00:01:02.000Z")
    }
  );
  await assert.rejects(
    acknowledgeStaffEnrollmentRecoveryCodeSet(env, {
      session: primary,
      setId: generated.generated.setId,
      reservation: duplicateHeld.result.reservation,
      requestId: "c3".repeat(16),
      now: new Date("2030-01-01T00:01:02.000Z")
    }),
    (error) => error instanceof StaffEnrollmentRecoveryCodeError
      && error.code === "unauthorized"
  );
  assert.equal(sqlite.prepare("SELECT auth_version FROM auth_accounts WHERE id = ?").get(ACCOUNT_ID).auth_version, 2);
});

test("generation rolls back supersession when eligibility is lost after the read", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  const { primary } = await seedEnrollment(sqlite, env);
  const original = await generate(sqlite, env, primary);
  const held = await reserve(env, {
    routeTemplate: STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE,
    key: "123e4567-e89b-12d3-a456-426614174104",
    subjectScope: `staff-enrollment:${primary.id}:recovery-code-generation`,
    now: new Date("2030-01-01T00:00:10.000Z")
  });
  assert.equal(held.result.outcome, "reserved");
  env.DB.beforeNextBatch = (database) => {
    database.prepare(`
      UPDATE auth_sessions
      SET revoked_at = '2030-01-01T00:00:10.000Z',
          revocation_reason = 'concurrent_security_change'
      WHERE id = ?
    `).run(SESSION_ID);
  };

  await assert.rejects(
    generateStaffEnrollmentRecoveryCodeSet(env, {
      session: primary,
      reservation: held.result.reservation,
      requestId: "a3".repeat(16),
      now: new Date("2030-01-01T00:00:10.000Z")
    }),
    (error) => error instanceof StaffEnrollmentRecoveryCodeError
      && error.code === "temporarily_unavailable"
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_code_sets").get().count,
    1
  );
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_recovery_code_sets WHERE id = ?")
      .get(original.generated.setId).status,
    "generated"
  );
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_codes WHERE code_set_id = ? AND revoked_at IS NOT NULL")
      .get(original.generated.setId).count,
    0
  );
  assert.equal(
    sqlite.prepare("SELECT status FROM auth_idempotency_keys WHERE id = ?")
      .get(held.result.reservation.id).status,
    "in_progress"
  );
});

test("acknowledgement rejects a different valid enrollment session", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  const { primary, secondary } = await seedEnrollment(sqlite, env, {
    secondSession: true
  });
  const generated = await generate(sqlite, env, primary);
  const held = await reserveAcknowledgement(
    env,
    secondary,
    generated.generated.setId
  );
  await assert.rejects(
    acknowledgeStaffEnrollmentRecoveryCodeSet(env, {
      session: secondary,
      setId: generated.generated.setId,
      reservation: held.result.reservation,
      requestId: "d4".repeat(16),
      now: new Date("2030-01-01T00:01:00.000Z")
    }),
    (error) => error instanceof StaffEnrollmentRecoveryCodeError
      && error.code === "invalid_or_expired_recovery_code_set"
  );
  assert.equal(sqlite.prepare("SELECT auth_version FROM auth_accounts WHERE id = ?").get(ACCOUNT_ID).auth_version, 1);
  assert.equal(sqlite.prepare("SELECT status FROM auth_recovery_code_sets WHERE id = ?").get(generated.generated.setId).status, "generated");
});

test("acknowledgement rejects the exact expiry boundary without partial mutation", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  const { primary } = await seedEnrollment(sqlite, env);
  const generated = await generate(sqlite, env, primary);
  const expiredAt = new Date(START.getTime() + ACKNOWLEDGEMENT_LIFETIME_MS);
  const held = await reserveAcknowledgement(env, primary, generated.generated.setId, {
    now: expiredAt
  });
  await assert.rejects(
    acknowledgeStaffEnrollmentRecoveryCodeSet(env, {
      session: primary,
      setId: generated.generated.setId,
      reservation: held.result.reservation,
      requestId: "e5".repeat(16),
      now: expiredAt
    }),
    (error) => error instanceof StaffEnrollmentRecoveryCodeError
      && error.code === "invalid_or_expired_recovery_code_set"
  );
  assert.equal(sqlite.prepare("SELECT auth_version FROM auth_accounts WHERE id = ?").get(ACCOUNT_ID).auth_version, 1);
  assert.equal(sqlite.prepare("SELECT status FROM auth_recovery_code_sets WHERE id = ?").get(generated.generated.setId).status, "generated");
});

test("acknowledgement fails closed after the account auth version becomes stale", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  const { primary } = await seedEnrollment(sqlite, env);
  const generated = await generate(sqlite, env, primary);
  sqlite.prepare(`
    UPDATE auth_accounts
    SET auth_version = 2,
        legacy_sessions_revoked_before = ?,
        last_transition_id = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    "2030-01-01T00:00:30.000Z",
    "0".repeat(32),
    "2030-01-01T00:00:30.000Z",
    ACCOUNT_ID
  );
  const held = await reserveAcknowledgement(
    env,
    primary,
    generated.generated.setId
  );
  await assert.rejects(
    acknowledgeStaffEnrollmentRecoveryCodeSet(env, {
      session: primary,
      setId: generated.generated.setId,
      reservation: held.result.reservation,
      requestId: "f6".repeat(16),
      now: new Date("2030-01-01T00:01:00.000Z")
    }),
    (error) => error instanceof StaffEnrollmentRecoveryCodeError
      && error.code === "unauthorized"
  );
  assert.equal(sqlite.prepare("SELECT auth_version FROM auth_accounts WHERE id = ?").get(ACCOUNT_ID).auth_version, 2);
  assert.equal(sqlite.prepare("SELECT status FROM auth_recovery_code_sets WHERE id = ?").get(generated.generated.setId).status, "generated");
});

test("HTTP generation requires the enrollment cookie and exact CSRF, then securely replays the one-time codes", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  await seedEnrollment(sqlite, env);
  const key = "123e4567-e89b-12d3-a456-426614174110";

  const wrongOrigin = await handleStaffEnrollmentRecoveryCodeSetGeneration(
    enrollmentMutation(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, {
      key,
      origin: "https://attacker.example"
    }),
    env,
    { now: START }
  );
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json()).error.code, "forbidden");

  const ambientStaffCookie =
    await handleStaffEnrollmentRecoveryCodeSetGeneration(
      new Request(
        `https://crm.ayartuerk.me${STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": key,
            "origin": "https://crm.ayartuerk.me",
            "x-csrf-token": PRIMARY_CSRF_TOKEN,
            "cookie": [
              `__Host-crm_staff_session=${PRIMARY_SESSION_TOKEN}`,
              `__Host-crm_staff_csrf=${PRIMARY_CSRF_TOKEN}`
            ].join("; ")
          },
          body: "{}"
        }
      ),
      env,
      { now: START }
    );
  assert.equal(ambientStaffCookie.status, 401);
  assert.equal((await ambientStaffCookie.json()).error.code, "unauthorized");

  const rejected = await handleStaffEnrollmentRecoveryCodeSetGeneration(
    enrollmentMutation(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, {
      key,
      csrfHeader: "wrong_csrf_token_that_is_long_enough_1234"
    }),
    env,
    { now: START }
  );
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).error.code, "forbidden");
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_idempotency_keys").get().count,
    0
  );

  const first = await handleStaffEnrollmentRecoveryCodeSetGeneration(
    enrollmentMutation(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, { key }),
    env,
    { now: START }
  );
  assert.equal(first.status, 201);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal(first.headers.get("set-cookie"), null);
  const firstBody = await first.json();
  assert.equal(firstBody.codes.length, 10);

  const replay = await handleStaffEnrollmentRecoveryCodeSetGeneration(
    enrollmentMutation(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, { key }),
    env,
    { now: new Date("2030-01-01T00:00:01.000Z") }
  );
  assert.equal(replay.status, 201);
  assert.deepEqual(await replay.json(), firstBody);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM auth_recovery_code_sets").get().count,
    1
  );
});

test("HTTP acknowledgement replays before canonical resolution and restores the exact rotated cookies", async (t) => {
  const sqlite = await migratedDatabase();
  t.after(() => sqlite.close());
  const env = environment(sqlite);
  await seedEnrollment(sqlite, env, {
    secondSession: true,
    activeSet: true,
    pendingChallenge: true
  });
  const generation = await handleStaffEnrollmentRecoveryCodeSetGeneration(
    enrollmentMutation(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, {
      key: "123e4567-e89b-12d3-a456-426614174111"
    }),
    env,
    { now: START }
  );
  assert.equal(generation.status, 201);
  const generated = await generation.json();
  const setId = generated.recovery_code_set.id;
  const path = STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE.replace(
    "{set_id}",
    setId
  );
  const acknowledgementKey = "123e4567-e89b-12d3-a456-426614174112";
  const acknowledgedAt = new Date("2030-01-01T00:01:00.000Z");
  const otherSetId = "b".repeat(32);
  const wrongSet = await handleStaffEnrollmentRecoveryCodeSetAcknowledgement(
    enrollmentMutation(
      STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE.replace(
        "{set_id}",
        otherSetId
      ),
      { key: acknowledgementKey }
    ),
    env,
    {
      setId: otherSetId,
      now: new Date("2030-01-01T00:00:30.000Z")
    }
  );
  assert.equal(wrongSet.status, 400);
  assert.equal(
    (await wrongSet.json()).error.code,
    "invalid_or_expired_recovery_code_set"
  );
  assert.equal(
    sqlite.prepare(`
      SELECT COUNT(*) AS count FROM auth_idempotency_keys
      WHERE operation = ? AND status = 'in_progress'
    `).get(`POST ${STAFF_ENROLLMENT_RECOVERY_CODE_ACK_ROUTE}`).count,
    0
  );

  // The same key is safe on the intended concrete set because the path
  // parameter is bound into the acknowledgement idempotency context.
  const first = await handleStaffEnrollmentRecoveryCodeSetAcknowledgement(
    enrollmentMutation(path, { key: acknowledgementKey }),
    env,
    { setId, now: acknowledgedAt }
  );
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  const firstCookies = first.headers.get("set-cookie");
  assert.equal(firstBody.recovery_code_set.status, "active");
  assert.match(firstCookies, /__Host-crm_staff_enrollment=/);
  assert.match(firstCookies, /__Host-crm_staff_enrollment_csrf=/);
  assert.equal(
    sqlite.prepare("SELECT revoked_at FROM auth_sessions WHERE id = ?")
      .get(SESSION_ID).revoked_at,
    acknowledgedAt.toISOString()
  );

  // Retry with the now-revoked source cookie. A canonical lookup first would
  // return 401 and make a lost acknowledgement response unrecoverable.
  const replay = await handleStaffEnrollmentRecoveryCodeSetAcknowledgement(
    enrollmentMutation(path, { key: acknowledgementKey }),
    env,
    {
      setId,
      now: new Date("2030-01-01T00:01:01.000Z")
    }
  );
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), firstBody);
  assert.equal(replay.headers.get("set-cookie"), firstCookies);

  const forgedCsrfReplay =
    await handleStaffEnrollmentRecoveryCodeSetAcknowledgement(
      enrollmentMutation(path, {
        key: acknowledgementKey,
        csrfHeader: "forged_csrf_token_that_is_long_enough_123"
      }),
      env,
      {
        setId,
        now: new Date("2030-01-01T00:01:02.000Z")
      }
    );
  assert.equal(forgedCsrfReplay.status, 403);
  assert.equal(forgedCsrfReplay.headers.get("set-cookie"), null);
  assert.equal((await forgedCsrfReplay.json()).error.code, "forbidden");
});

test("HTTP recovery-code endpoints fail closed before persistence when bootstrap is disabled", async () => {
  const env = {
    ...environment(null),
    CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT: "false",
    DB: new Proxy({}, {
      get() {
        throw new Error("disabled endpoint touched persistence");
      }
    })
  };
  for (const [handler, options] of [
    [handleStaffEnrollmentRecoveryCodeSetGeneration, { now: START }],
    [handleStaffEnrollmentRecoveryCodeSetAcknowledgement, {
      setId: "a".repeat(32),
      now: START
    }]
  ]) {
    const response = await handler(
      enrollmentMutation(STAFF_ENROLLMENT_RECOVERY_CODE_SET_ROUTE, {
        key: "123e4567-e89b-12d3-a456-426614174113"
      }),
      env,
      options
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "feature_disabled");
  }
});
