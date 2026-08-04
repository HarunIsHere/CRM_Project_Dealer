import assert from "node:assert/strict";
import test from "node:test";

import { decryptOutboxPayload } from "../../src/identity/email/outbox-crypto.js";
import {
  OutboxRepositoryError,
  claimOutboxItem,
  expireUndeliverableOutboxItems,
  markOutboxSent,
  prepareEncryptedOutboxInsert,
  scheduleOutboxRetry,
  terminalizeOutboxItem
} from "../../src/identity/email/outbox-repository.js";

const OUTBOX_ID = "11111111111111111111111111111111";
const CHALLENGE_ID = "22222222222222222222222222222222";
const SECURITY_EVENT_ID = "33333333333333333333333333333333";
const EMAIL_ID = "44444444444444444444444444444444";
const ACCOUNT_ID = "55555555555555555555555555555555";
const LEASE_ID = "66666666666666666666666666666666";

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
  constructor({ changes = 1, batchChanges = [] } = {}) {
    this.changes = changes;
    this.batchChanges = batchChanges;
    this.statements = [];
    this.runs = [];
    this.batches = [];
  }

  prepare(sql) {
    const statement = new RecordingStatement(this, sql);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements) {
    this.batches.push(statements);
    return statements.map((_, index) => ({
      meta: { changes: this.batchChanges[index] ?? 0 }
    }));
  }
}

function repositoryEnv(database = new RecordingDatabase()) {
  return {
    DB: database,
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: Buffer.alloc(32, 9).toString("base64url")
  };
}

function insertMetadata(overrides = {}) {
  return {
    id: OUTBOX_ID,
    challengeId: CHALLENGE_ID,
    emailAddressId: EMAIL_ID,
    authAccountId: ACCOUNT_ID,
    realm: "staff",
    templateKey: "auth.staff.recovery.start.v1",
    challengePurpose: "staff_recovery",
    locale: "en",
    dedupeKey: "staff-recovery:challenge-1",
    maxAttempts: 5,
    availableAt: "2030-01-01T00:00:00.000Z",
    expiresAt: "2030-01-01T00:15:00.000Z",
    ...overrides
  };
}

test("prepares an encrypted outbox insert with authenticated metadata", async () => {
  const database = new RecordingDatabase();
  const env = repositoryEnv(database);
  const payload = {
    actionUrl: "https://crm.ayartuerk.me/auth/admin/recovery#token=sensitive-recovery-token",
    verificationCode: "12345678"
  };

  const prepared = await prepareEncryptedOutboxInsert(
    env,
    insertMetadata(),
    payload
  );

  assert.equal(database.statements.length, 1);
  const statement = database.statements[0];
  assert.strictEqual(prepared.statement, statement);
  assert.equal(prepared.outboxId, OUTBOX_ID);
  assert.equal(prepared.encryptionKeyVersion, 1);
  assert.match(statement.sql, /INSERT INTO auth_email_outbox/);
  assert.match(statement.sql, /'pending', 0/);
  assert.deepEqual(statement.bindings.slice(0, 8), [
    OUTBOX_ID,
    CHALLENGE_ID,
    null,
    EMAIL_ID,
    ACCOUNT_ID,
    "staff",
    "auth.staff.recovery.start.v1",
    "en"
  ]);
  assert.ok(statement.bindings[8] instanceof Uint8Array);
  assert.ok(statement.bindings[9] instanceof Uint8Array);
  assert.equal(statement.bindings[9].byteLength, 12);
  assert.equal(statement.bindings[10], 1);
  assert.deepEqual(statement.bindings.slice(11), [
    "staff-recovery:challenge-1",
    5,
    "2030-01-01T00:00:00.000Z",
    "2030-01-01T00:15:00.000Z"
  ]);
  assert.doesNotMatch(
    Buffer.from(statement.bindings[8]).toString("utf8"),
    /sensitive-recovery-token|12345678/
  );

  const decrypted = await decryptOutboxPayload(env, {
    id: statement.bindings[0],
    challenge_id: statement.bindings[1],
    security_event_id: statement.bindings[2],
    email_address_id: statement.bindings[3],
    auth_account_id: statement.bindings[4],
    realm: statement.bindings[5],
    template_key: statement.bindings[6],
    locale: statement.bindings[7],
    payload_ciphertext: statement.bindings[8],
    payload_iv: statement.bindings[9],
    encryption_key_version: statement.bindings[10],
    dedupe_key: statement.bindings[11],
    expires_at: statement.bindings[14]
  });
  assert.deepEqual(decrypted, payload);
});

test("outbox insert requires exactly one valid parent", async () => {
  const env = repositoryEnv();

  await assert.rejects(
    () => prepareEncryptedOutboxInsert(
      env,
      insertMetadata({ challengeId: null }),
      { verificationCode: "12345678" }
    ),
    (error) => error instanceof OutboxRepositoryError
      && error.code === "E_OUTBOX_INSERT_PARENT_INVALID"
  );

  await assert.rejects(
    () => prepareEncryptedOutboxInsert(
      env,
      insertMetadata({ securityEventId: SECURITY_EVENT_ID }),
      { verificationCode: "12345678" }
    ),
    (error) => error instanceof OutboxRepositoryError
      && error.code === "E_OUTBOX_INSERT_PARENT_INVALID"
  );
});

test("outbox insert binds a challenge to its fixed template policy", async () => {
  const env = repositoryEnv();

  await assert.rejects(
    () => prepareEncryptedOutboxInsert(
      env,
      insertMetadata({ challengePurpose: null }),
      { verificationCode: "12345678" }
    ),
    (error) => error instanceof OutboxRepositoryError
      && error.code === "E_OUTBOX_INSERT_TEMPLATE_POLICY_INVALID"
  );

  await assert.rejects(
    () => prepareEncryptedOutboxInsert(
      env,
      insertMetadata({ challengePurpose: "email_enrollment" }),
      { verificationCode: "12345678" }
    ),
    (error) => error instanceof OutboxRepositoryError
      && error.code === "E_OUTBOX_INSERT_TEMPLATE_POLICY_INVALID"
  );
});

test("claim uses a conditional lease and binds one consistent timestamp", async () => {
  const database = new RecordingDatabase({ changes: 1 });
  const now = new Date("2030-01-01T00:00:00.000Z");

  const lease = await claimOutboxItem(
    repositoryEnv(database),
    OUTBOX_ID,
    { now, leaseSeconds: 120 }
  );

  assert.equal(database.runs.length, 1);
  const statement = database.runs[0];
  assert.match(statement.sql, /attempt_count = attempt_count \+ 1/);
  assert.match(statement.sql, /status IN \('pending', 'retry'\)/);
  assert.match(statement.sql, /status = 'leased'/);
  assert.match(statement.sql, /datetime\(lease_expires_at\) <= datetime\(\?\)/);
  assert.match(lease.leaseId, /^[0-9a-f]{32}$/);
  assert.deepEqual(statement.bindings, [
    lease.leaseId,
    "2030-01-01T00:02:00.000Z",
    "2030-01-01T00:00:00.000Z",
    OUTBOX_ID,
    "2030-01-01T00:00:00.000Z",
    "2030-01-01T00:00:00.000Z",
    "2030-01-01T00:00:00.000Z"
  ]);
});

test("retry releases the lease without scrubbing the encrypted payload", async () => {
  const database = new RecordingDatabase({ changes: 1 });
  const updated = await scheduleOutboxRetry(
    repositoryEnv(database),
    OUTBOX_ID,
    LEASE_ID,
    {
      provider: "cloudflare_email_service",
      errorCode: "E_RATE_LIMIT_EXCEEDED",
      availableAt: "2030-01-01T00:01:00.000Z",
      now: "2030-01-01T00:00:00.000Z"
    }
  );

  assert.equal(updated, true);
  const statement = database.runs[0];
  assert.match(statement.sql, /status = 'retry'/);
  assert.match(statement.sql, /lease_id = NULL/);
  assert.match(statement.sql, /lease_expires_at = NULL/);
  assert.doesNotMatch(statement.sql, /payload_ciphertext\s*=\s*NULL/);
  assert.doesNotMatch(statement.sql, /payload_iv\s*=\s*NULL/);
  assert.deepEqual(statement.bindings, [
    "cloudflare_email_service",
    "E_RATE_LIMIT_EXCEEDED",
    "2030-01-01T00:01:00.000Z",
    "2030-01-01T00:00:00.000Z",
    OUTBOX_ID,
    LEASE_ID,
    "2030-01-01T00:00:00.000Z"
  ]);
});

test("terminal and sent transitions scrub payload and lease material", async () => {
  const terminalDatabase = new RecordingDatabase({ changes: 1 });
  const terminalized = await terminalizeOutboxItem(
    repositoryEnv(terminalDatabase),
    OUTBOX_ID,
    LEASE_ID,
    {
      status: "failed",
      provider: "cloudflare_email_service",
      errorCode: "E_SENDER_NOT_VERIFIED",
      now: "2030-01-01T00:03:00.000Z"
    }
  );

  assert.equal(terminalized, true);
  const terminalStatement = terminalDatabase.runs[0];
  assert.match(terminalStatement.sql, /payload_ciphertext = NULL/);
  assert.match(terminalStatement.sql, /payload_iv = NULL/);
  assert.match(terminalStatement.sql, /lease_id = NULL/);
  assert.match(terminalStatement.sql, /lease_expires_at = NULL/);
  assert.deepEqual(terminalStatement.bindings, [
    "failed",
    "cloudflare_email_service",
    "E_SENDER_NOT_VERIFIED",
    "2030-01-01T00:03:00.000Z",
    "2030-01-01T00:03:00.000Z",
    OUTBOX_ID,
    LEASE_ID
  ]);

  const sentDatabase = new RecordingDatabase({ changes: 1 });
  const sent = await markOutboxSent(
    repositoryEnv(sentDatabase),
    OUTBOX_ID,
    LEASE_ID,
    {
      provider: "cloudflare_email_service",
      messageId: "message-42",
      now: "2030-01-01T00:04:00.000Z"
    }
  );

  assert.equal(sent, true);
  const sentStatement = sentDatabase.runs[0];
  assert.match(sentStatement.sql, /status = 'sent'/);
  assert.match(sentStatement.sql, /payload_ciphertext = NULL/);
  assert.match(sentStatement.sql, /payload_iv = NULL/);
  assert.match(sentStatement.sql, /lease_id = NULL/);
  assert.deepEqual(sentStatement.bindings, [
    "cloudflare_email_service",
    "message-42",
    "2030-01-01T00:04:00.000Z",
    "2030-01-01T00:04:00.000Z",
    "2030-01-01T00:04:00.000Z",
    OUTBOX_ID,
    LEASE_ID
  ]);
});

test("expiration cleanup scrubs both expired and exhausted rows", async () => {
  const database = new RecordingDatabase({ batchChanges: [2, 3] });
  const changed = await expireUndeliverableOutboxItems(
    repositoryEnv(database),
    "2030-01-01T00:05:00.000Z"
  );

  assert.equal(changed, 5);
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0].length, 2);
  for (const statement of database.batches[0]) {
    assert.match(statement.sql, /payload_ciphertext = NULL/);
    assert.match(statement.sql, /payload_iv = NULL/);
    assert.match(statement.sql, /lease_id = NULL/);
    assert.match(statement.sql, /lease_expires_at = NULL/);
    assert.ok(statement.bindings.every(
      (value) => value === "2030-01-01T00:05:00.000Z"
    ));
  }
  assert.match(
    database.batches[0][0].sql,
    /status = 'leased'[\s\S]*datetime\(lease_expires_at\) <= datetime\(\?\)/
  );
  assert.equal(database.batches[0][0].bindings.length, 4);
});
