import assert from "node:assert/strict";
import test from "node:test";

import {
  RateLimitError,
  consumeFixedWindowRateLimit,
  fixedWindowBounds
} from "../../src/identity/rate-limit.js";

const SUBJECT_HASH = "a".repeat(64);

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
    this.database.executed.push(this);
    return this.database.row;
  }
}

class RecordingDatabase {
  constructor(row) {
    this.row = row;
    this.statements = [];
    this.executed = [];
  }

  prepare(sql) {
    const statement = new RecordingStatement(this, sql);
    this.statements.push(statement);
    return statement;
  }
}

test("fixed windows are deterministic UTC boundaries", () => {
  assert.deepEqual(
    fixedWindowBounds("2030-01-01T00:01:01.000Z", 60),
    {
      startedAt: "2030-01-01T00:01:00.000Z",
      endsAt: "2030-01-01T00:02:00.000Z"
    }
  );
});

test("rate consumption uses one atomic upsert and returns an allowed count", async () => {
  const database = new RecordingDatabase({
    id: "1".repeat(32),
    request_count: 5,
    blocked_until: null,
    window_started_at: "2030-01-01T00:00:00.000Z",
    expires_at: "2030-01-01T02:00:00.000Z"
  });
  const result = await consumeFixedWindowRateLimit(
    { DB: database },
    {
      dimension: "destination",
      subjectKeyVersion: 1,
      subjectHash: SUBJECT_HASH,
      windowSeconds: 3600,
      maxRequests: 5,
      now: "2030-01-01T00:30:00.000Z"
    }
  );

  assert.equal(result.allowed, true);
  assert.equal(result.requestCount, 5);
  assert.equal(result.retryAfterSeconds, 0);
  assert.equal(database.executed.length, 1);
  assert.match(database.executed[0].sql, /ON CONFLICT/);
  assert.match(database.executed[0].sql, /request_count = auth_rate_limit_buckets\.request_count \+ 1/);
  assert.match(database.executed[0].sql, /RETURNING id, request_count/);
  assert.deepEqual(database.executed[0].bindings.slice(1, 6), [
    "destination",
    1,
    SUBJECT_HASH,
    3600,
    "2030-01-01T00:00:00.000Z"
  ]);
});

test("the first request beyond the limit is blocked until the window ends", async () => {
  const database = new RecordingDatabase({
    id: "2".repeat(32),
    request_count: 6,
    blocked_until: "2030-01-01T01:00:00.000Z",
    window_started_at: "2030-01-01T00:00:00.000Z",
    expires_at: "2030-01-01T02:00:00.000Z"
  });
  const result = await consumeFixedWindowRateLimit(
    { DB: database },
    {
      dimension: "ip",
      subjectKeyVersion: 1,
      subjectHash: SUBJECT_HASH,
      windowSeconds: 3600,
      maxRequests: 5,
      now: "2030-01-01T00:59:30.000Z"
    }
  );
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.equal(result.retryAfterSeconds, 30);
});

test("raw subjects, invalid dimensions, and missing D1 fail closed", async () => {
  await assert.rejects(
    () => consumeFixedWindowRateLimit(
      { DB: new RecordingDatabase({}) },
      {
        dimension: "email",
        subjectKeyVersion: 1,
        subjectHash: "person@example.com",
        windowSeconds: 60,
        maxRequests: 5
      }
    ),
    (error) => error instanceof RateLimitError
      && error.code === "E_RATE_LIMIT_INPUT_INVALID"
  );

  await assert.rejects(
    () => consumeFixedWindowRateLimit({}, {
      dimension: "system",
      subjectKeyVersion: 1,
      subjectHash: SUBJECT_HASH,
      windowSeconds: 60,
      maxRequests: 5
    }),
    (error) => error instanceof RateLimitError
      && error.code === "E_RATE_LIMIT_DATABASE_UNAVAILABLE"
  );
});
