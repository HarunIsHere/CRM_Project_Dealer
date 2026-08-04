import assert from "node:assert/strict";
import test from "node:test";

import {
  IdempotencyError,
  createIdempotencyContext,
  decryptCompletedIdempotencyResponse,
  prepareIdempotencyCompletion,
  reserveIdempotencyKey
} from "../../src/identity/idempotency.js";
import { hashCanonicalIdentityRequest } from "../../src/identity/protocol.js";

const SUBJECT_HASH = "a".repeat(64);
const KEY_HASH = "b".repeat(64);
const REQUEST_HASH = "c".repeat(64);

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

  async run() {
    this.database.runs.push(this);
    return { meta: { changes: this.database.changes } };
  }
}

class RecordingDatabase {
  constructor({ mode = "reserved", completedRow = null, changes = 1 } = {}) {
    this.mode = mode;
    this.completedRow = completedRow;
    this.changes = changes;
    this.statements = [];
    this.batches = [];
    this.runs = [];
  }

  prepare(sql) {
    const statement = new RecordingStatement(this, sql);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements) {
    this.batches.push(statements);
    const insert = statements[1].bindings;
    let row = {
      id: insert[0],
      realm: insert[1],
      operation: insert[2],
      hash_key_version: insert[3],
      subject_scope_hash: insert[4],
      key_hash: insert[5],
      request_hash: insert[6],
      status: "in_progress",
      expires_at: insert[8]
    };
    if (this.mode === "in_progress") row.id = "9".repeat(32);
    if (this.mode === "reused") {
      row.id = "8".repeat(32);
      row.request_hash = "d".repeat(64);
    }
    if (this.mode === "completed") row = this.completedRow;
    return [{ meta: { changes: 0 } }, { meta: { changes: 1 } }, { results: [row] }];
  }
}

function responseKey(fill = 7) {
  return Buffer.alloc(32, fill).toString("base64url");
}

function env(database = new RecordingDatabase()) {
  return {
    DB: database,
    CRM_AUTH_IDEMPOTENCY_RESPONSE_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1: responseKey()
  };
}

function context(overrides = {}) {
  return {
    realm: "staff",
    operation: "POST /api/v1/admin/auth/invitations/accept",
    hashKeyVersion: 1,
    subjectScopeHash: SUBJECT_HASH,
    keyHash: KEY_HASH,
    requestHash: REQUEST_HASH,
    ...overrides
  };
}

function reservation(overrides = {}) {
  return {
    id: "1".repeat(32),
    ...context(),
    expiresAt: "2030-01-01T00:10:00.000Z",
    ...overrides
  };
}

test("idempotency context stores only domain-separated hashes", async () => {
  const rawKey = "123e4567-e89b-12d3-a456-426614174000";
  const rawScope = "anonymous-subject-scope";
  const request = new Request(
    "https://crm.ayartuerk.me/api/v1/admin/auth/invitations/accept",
    {
      method: "POST",
      headers: { "idempotency-key": rawKey }
    }
  );
  const created = await createIdempotencyContext(request, {
    realm: "staff",
    routeTemplate: "/api/v1/admin/auth/invitations/accept",
    body: { token: "opaque" },
    subjectScope: rawScope,
    hashKeyVersion: 1,
    hashKeyMaterial: "h".repeat(64)
  });
  assert.equal(created.operation, "POST /api/v1/admin/auth/invitations/accept");
  assert.match(created.subjectScopeHash, /^[0-9a-f]{64}$/);
  assert.match(created.keyHash, /^[0-9a-f]{64}$/);
  assert.match(created.requestHash, /^[0-9a-f]{64}$/);
  assert.notEqual(created.subjectScopeHash, created.keyHash);
  assert.equal(JSON.stringify(created).includes(rawKey), false);
  assert.equal(JSON.stringify(created).includes(rawScope), false);
});

test("request fingerprints are keyed and do not persist the canonical SHA digest", async () => {
  const request = new Request(
    "https://crm.ayartuerk.me/api/v1/admin/auth/invitations/accept",
    {
      method: "POST",
      headers: { "idempotency-key": "123e4567-e89b-12d3-a456-426614174000" }
    }
  );
  const body = {
    recovery_code: "low-entropy-secret",
    email: "admin@example.com"
  };
  const base = {
    realm: "staff",
    routeTemplate: "/api/v1/admin/auth/invitations/accept",
    body,
    subjectScope: "anonymous-subject-scope",
    hashKeyVersion: 1
  };
  const canonicalSha = await hashCanonicalIdentityRequest(
    request.method,
    base.routeTemplate,
    body
  );
  const first = await createIdempotencyContext(request, {
    ...base,
    hashKeyMaterial: "h".repeat(64)
  });
  const same = await createIdempotencyContext(request, {
    ...base,
    body: {
      email: "admin@example.com",
      recovery_code: "low-entropy-secret"
    },
    hashKeyMaterial: "h".repeat(64)
  });
  const differentKey = await createIdempotencyContext(request, {
    ...base,
    hashKeyMaterial: "j".repeat(64)
  });

  assert.notEqual(first.requestHash, canonicalSha);
  assert.equal(first.requestHash, same.requestHash);
  assert.notEqual(first.requestHash, differentKey.requestHash);
});

test("reservation atomically distinguishes owner, in-progress, and reused keys", async () => {
  const now = "2030-01-01T00:00:00.000Z";
  const reservedDb = new RecordingDatabase();
  const reserved = await reserveIdempotencyKey(
    env(reservedDb),
    context(),
    { secretBearing: true, now }
  );
  assert.equal(reserved.outcome, "reserved");
  assert.match(reserved.reservation.id, /^[0-9a-f]{32}$/);
  assert.equal(reserved.reservation.expiresAt, "2030-01-01T00:10:00.000Z");
  assert.equal(reservedDb.batches.length, 1);
  assert.match(reservedDb.batches[0][0].sql, /DELETE FROM auth_idempotency_keys/);
  assert.match(reservedDb.batches[0][1].sql, /INSERT OR IGNORE/);

  const inProgress = await reserveIdempotencyKey(
    env(new RecordingDatabase({ mode: "in_progress" })),
    context(),
    { now }
  );
  assert.deepEqual(inProgress, { outcome: "in_progress" });

  const reused = await reserveIdempotencyKey(
    env(new RecordingDatabase({ mode: "reused" })),
    context(),
    { now }
  );
  assert.deepEqual(reused, { outcome: "reused" });
});

test("completed responses are AES-GCM encrypted and replayable", async () => {
  const database = new RecordingDatabase();
  const workerEnv = env(database);
  const body = {
    ok: true,
    request_id: "2".repeat(32),
    access_token: "secret-session-token"
  };
  const prepared = await prepareIdempotencyCompletion(
    workerEnv,
    reservation(),
    {
      status: 200,
      body,
      resourceType: "auth_session",
      resourceId: "3".repeat(32),
      completedAt: "2030-01-01T00:01:00.000Z"
    }
  );
  const bindings = prepared.statement.bindings;
  assert.ok(bindings[1] instanceof Uint8Array);
  assert.ok(bindings[2] instanceof Uint8Array);
  assert.equal(bindings[2].byteLength, 12);
  assert.doesNotMatch(
    Buffer.from(bindings[1]).toString("utf8"),
    /secret-session-token/
  );

  const completedRow = {
    id: reservation().id,
    realm: reservation().realm,
    operation: reservation().operation,
    hash_key_version: reservation().hashKeyVersion,
    subject_scope_hash: reservation().subjectScopeHash,
    key_hash: reservation().keyHash,
    request_hash: reservation().requestHash,
    expires_at: reservation().expiresAt,
    status: "completed",
    response_status: bindings[0],
    response_payload_ciphertext: bindings[1],
    response_payload_iv: bindings[2],
    response_key_version: bindings[3]
  };
  assert.deepEqual(
    await decryptCompletedIdempotencyResponse(workerEnv, completedRow),
    { status: 200, body }
  );

  const replay = await reserveIdempotencyKey(
    env(new RecordingDatabase({ mode: "completed", completedRow })),
    context(),
    { secretBearing: true, now: "2030-01-01T00:00:00.000Z" }
  );
  assert.deepEqual(replay, {
    outcome: "replay",
    response: { status: 200, body }
  });
});

test("idempotency persistence fails closed for missing keys, invalid TTL, or missing D1", async () => {
  await assert.rejects(
    () => prepareIdempotencyCompletion(
      { DB: new RecordingDatabase() },
      reservation(),
      { status: 200, body: { ok: true }, completedAt: "2030-01-01T00:01:00.000Z" }
    ),
    (error) => error instanceof IdempotencyError
      && error.code === "E_IDEMPOTENCY_RESPONSE_KEY_VERSION_NOT_CONFIGURED"
  );

  await assert.rejects(
    () => reserveIdempotencyKey(
      env(),
      context(),
      {
        secretBearing: true,
        ttlSeconds: 601,
        now: "2030-01-01T00:00:00.000Z"
      }
    ),
    (error) => error instanceof IdempotencyError
      && error.code === "E_IDEMPOTENCY_TTL_INVALID"
  );

  await assert.rejects(
    () => reserveIdempotencyKey({}, context()),
    (error) => error instanceof IdempotencyError
      && error.code === "E_IDEMPOTENCY_DATABASE_UNAVAILABLE"
  );
});
