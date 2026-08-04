import assert from "node:assert/strict";
import test from "node:test";

import { encryptOutboxPayload } from "../../src/identity/email/outbox-crypto.js";
import {
  dispatchAuthEmailOutboxItem,
  processAuthEmailDeadLetterQueue,
  processAuthEmailQueue,
  sweepAuthEmailOutbox
} from "../../src/identity/email/dispatcher.js";
import { getIdentityEmailTemplatePolicy } from "../../src/identity/email/policy.js";

const OUTBOX_ID = "11111111111111111111111111111111";
const EMAIL_ID = "22222222222222222222222222222222";
const ACCOUNT_ID = "33333333333333333333333333333333";
const EVENT_ID = "44444444444444444444444444444444";

class CleanupStatement {
  constructor(sql) {
    this.sql = sql;
    this.bindings = [];
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  async all() {
    return { results: [] };
  }
}

class CleanupDatabase {
  constructor(batchChanges = [0, 0]) {
    this.batchChanges = batchChanges;
    this.statements = [];
    this.batches = [];
  }

  prepare(sql) {
    const statement = new CleanupStatement(sql);
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

class DispatchStatement extends CleanupStatement {
  constructor(database, sql) {
    super(sql);
    this.database = database;
  }

  async run() {
    this.database.runs.push(this);
    return { meta: { changes: 1 } };
  }

  async first() {
    this.database.reads.push(this);
    return this.database.row;
  }
}

class DispatchDatabase {
  constructor(row) {
    this.row = row;
    this.statements = [];
    this.runs = [];
    this.reads = [];
  }

  prepare(sql) {
    const statement = new DispatchStatement(this, sql);
    this.statements.push(statement);
    return statement;
  }
}

async function eventDispatchFixture(templateKey, emailStatus) {
  const templatePolicy = getIdentityEmailTemplatePolicy(templateKey);
  const cryptoEnv = {
    CRM_AUTH_EMAIL_OUTBOX_ACTIVE_KEY_VERSION: "1",
    CRM_AUTH_EMAIL_OUTBOX_KEY_V1: Buffer.alloc(32, 8).toString("base64url")
  };
  const context = {
    id: OUTBOX_ID,
    challenge_id: null,
    security_event_id: EVENT_ID,
    email_address_id: EMAIL_ID,
    auth_account_id: ACCOUNT_ID,
    realm: templatePolicy.realm,
    template_key: templateKey,
    locale: "en",
    dedupe_key: `${templateKey}:event-1`,
    expires_at: "2030-01-01T01:00:00.000Z"
  };
  const encrypted = await encryptOutboxPayload(
    cryptoEnv,
    context,
    { event_time: "2030-01-01T00:00:00.000Z" }
  );
  const row = {
    ...context,
    payload_ciphertext: encrypted.payloadCiphertext,
    payload_iv: encrypted.payloadIv,
    encryption_key_version: encrypted.encryptionKeyVersion,
    display_email: "security-recipient@example.com",
    email_status: emailStatus,
    security_event_row_id: EVENT_ID,
    security_event_subject_account_id: ACCOUNT_ID,
    attempt_count: 1,
    max_attempts: 5
  };
  const database = new DispatchDatabase(row);
  const sends = [];
  const env = {
    ...cryptoEnv,
    DB: database,
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_EMAIL_PROVIDER: "cloudflare",
    CRM_AUTH_EMAIL_FROM: "security@auth.ayartuerk.me",
    CRM_AUTH_EMAIL_FROM_NAME: "CRM Delivery Security",
    CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS: "true",
    AUTH_EMAIL: {
      async send(message) {
        sends.push(message);
        return { messageId: "provider-message-1" };
      }
    }
  };
  return { database, env, sends };
}

function queueMessage(body, attempts = 1) {
  return {
    body,
    attempts,
    ackCount: 0,
    retryCalls: [],
    ack() {
      this.ackCount += 1;
    },
    retry(options) {
      this.retryCalls.push(options);
    }
  };
}

async function captureConsole(method, callback) {
  const original = console[method];
  const entries = [];
  console[method] = (...values) => {
    entries.push(values.map((value) => String(value)).join(" "));
  };
  try {
    const result = await callback();
    return { entries, result };
  } finally {
    console[method] = original;
  }
}

test("disabled dispatcher does not touch D1, templates, queue, or email delivery", async () => {
  let sends = 0;
  const env = {
    CRM_AUTH_EMAIL_DELIVERY: "false",
    DB: {
      prepare() {
        assert.fail("disabled single-item dispatch must not access D1");
      }
    },
    AUTH_EMAIL: {
      async send() {
        sends += 1;
      }
    },
    AUTH_EMAIL_QUEUE: {
      async send() {
        assert.fail("disabled single-item dispatch must not enqueue");
      }
    }
  };

  const result = await dispatchAuthEmailOutboxItem(env, OUTBOX_ID);

  assert.deepEqual(result, { outcome: "disabled", outboxId: OUTBOX_ID });
  assert.equal(sends, 0);
});

test("dispatcher sends completed-old notifications to the replaced address", async () => {
  const fixture = await eventDispatchFixture(
    "auth.staff.email_change.completed_old.v1",
    "replaced"
  );

  const result = await dispatchAuthEmailOutboxItem(
    fixture.env,
    OUTBOX_ID,
    { now: "2030-01-01T00:05:00.000Z" }
  );

  assert.equal(result.outcome, "sent");
  assert.equal(fixture.sends.length, 1);
  assert.match(fixture.database.runs.at(-1).sql, /status = 'sent'/);
});

test("dispatcher applies template-specific notification destination states", async () => {
  const disallowed = await eventDispatchFixture(
    "auth.staff.email_change.completed_old.v1",
    "verified"
  );
  const cancelled = await dispatchAuthEmailOutboxItem(
    disallowed.env,
    OUTBOX_ID,
    { now: "2030-01-01T00:05:00.000Z" }
  );
  assert.deepEqual(cancelled, {
    outcome: "cancelled",
    outboxId: OUTBOX_ID,
    errorCode: "E_OUTBOX_DESTINATION_INACTIVE"
  });
  assert.equal(disallowed.sends.length, 0);

  for (const emailStatus of ["pending", "revoked"]) {
    const allowed = await eventDispatchFixture(
      "auth.staff.email_change.cancelled_new.v1",
      emailStatus
    );
    const result = await dispatchAuthEmailOutboxItem(
      allowed.env,
      OUTBOX_ID,
      { now: "2030-01-01T00:05:00.000Z" }
    );
    assert.equal(result.outcome, "sent", emailStatus);
    assert.equal(allowed.sends.length, 1, emailStatus);
  }
});

test("queue acknowledges all wake-up messages while delivery is disabled", async () => {
  const database = new CleanupDatabase();
  let sends = 0;
  const valid = queueMessage({ outbox_id: OUTBOX_ID });
  const invalid = queueMessage({ outbox_id: "not-an-outbox-id" });
  const env = {
    CRM_AUTH_EMAIL_DELIVERY: "false",
    DB: database,
    AUTH_EMAIL: {
      async send() {
        sends += 1;
      }
    }
  };

  await processAuthEmailQueue({ messages: [valid, invalid] }, env);

  assert.equal(valid.ackCount, 1);
  assert.equal(invalid.ackCount, 1);
  assert.deepEqual(valid.retryCalls, []);
  assert.deepEqual(invalid.retryCalls, []);
  assert.equal(sends, 0);
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0].length, 2);
  for (const statement of database.batches[0]) {
    assert.match(statement.sql, /payload_ciphertext = NULL/);
    assert.match(statement.sql, /payload_iv = NULL/);
  }
});

test("disabled scheduled sweep only performs terminal cleanup", async () => {
  const database = new CleanupDatabase([2, 1]);
  let sends = 0;
  const env = {
    CRM_AUTH_EMAIL_DELIVERY: "false",
    DB: database,
    AUTH_EMAIL: {
      async send() {
        sends += 1;
      }
    }
  };

  const captured = await captureConsole(
    "warn",
    () => sweepAuthEmailOutbox(env, { limit: 100 })
  );
  const result = captured.result;

  assert.deepEqual(result, {
    disabled: true,
    terminalized: 3,
    processed: 0,
    outcomes: {}
  });
  assert.equal(sends, 0);
  assert.equal(database.batches.length, 1);
  assert.equal(database.statements.length, 2);
  assert.equal(captured.entries.length, 1);
  assert.deepEqual(JSON.parse(captured.entries[0]), {
    event: "auth_email.scheduled_sweep",
    outcome: "disabled_cleanup",
    processed_count: 0,
    terminalized_count: 3
  });
});

test("scheduled sweep emits no log when there is no work", async () => {
  const database = new CleanupDatabase();
  const captured = await captureConsole(
    "log",
    () => sweepAuthEmailOutbox({
      CRM_AUTH_EMAIL_DELIVERY: "true",
      DB: database
    }, { limit: 100 })
  );

  assert.deepEqual(captured.result, {
    disabled: false,
    terminalized: 0,
    processed: 0,
    outcomes: {}
  });
  assert.deepEqual(captured.entries, []);
});

test("dead-letter consumer logs only allowlisted metadata and acknowledges messages", async () => {
  const valid = queueMessage({
    outbox_id: OUTBOX_ID,
    email: "private@example.test",
    token: "do-not-log",
    action_url: "https://example.test/auth/#token=do-not-log",
    manual_code: "12345678"
  }, 4);
  const invalid = queueMessage({
    outbox_id: "private@example.test",
    body: "do-not-log"
  }, 2);

  const captured = await captureConsole(
    "error",
    () => processAuthEmailDeadLetterQueue({ messages: [valid, invalid] })
  );

  assert.deepEqual(captured.result, { acknowledged: 2, invalid: 1 });
  assert.equal(valid.ackCount, 1);
  assert.equal(invalid.ackCount, 1);
  assert.deepEqual(valid.retryCalls, []);
  assert.deepEqual(invalid.retryCalls, []);
  assert.equal(captured.entries.length, 3);

  const records = captured.entries.map((entry) => JSON.parse(entry));
  const allowedFields = new Set([
    "event",
    "outcome",
    "outbox_id",
    "attempt",
    "acknowledged_count",
    "invalid_count"
  ]);
  for (const record of records) {
    assert.ok(Object.keys(record).every((key) => allowedFields.has(key)));
  }
  assert.equal(records[0].outbox_id, OUTBOX_ID);
  assert.equal(records[0].attempt, 4);
  assert.equal(Object.hasOwn(records[1], "outbox_id"), false);
  assert.equal(records[2].acknowledged_count, 2);
  assert.equal(records[2].invalid_count, 1);

  const serialized = JSON.stringify(records);
  assert.doesNotMatch(serialized, /private@example\.test/);
  assert.doesNotMatch(serialized, /do-not-log/);
  assert.doesNotMatch(serialized, /12345678/);
  assert.doesNotMatch(serialized, /"(?:action_url|manual_code|token|email)":/);
});

test("Worker routes the dead-letter queue without touching D1", async () => {
  const worker = (await import("../../src/index.js")).default;
  const message = queueMessage({ outbox_id: OUTBOX_ID }, 5);
  const captured = await captureConsole(
    "error",
    () => worker.queue({
      queue: "crm-auth-email-outbox-dlq",
      messages: [message]
    }, {
      DB: {
        prepare() {
          assert.fail("dead-letter routing must not access D1");
        }
      }
    })
  );

  assert.equal(message.ackCount, 1);
  assert.equal(captured.entries.length, 2);
  assert.equal(JSON.parse(captured.entries[0]).outbox_id, OUTBOX_ID);
});
