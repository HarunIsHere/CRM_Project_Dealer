import assert from "node:assert/strict";
import test from "node:test";

import { hashOpaqueToken } from "../../src/identity/crypto.js";
import { resolveCanonicalSession } from "../../src/identity/repository.js";

const SESSION_TOKEN = "session_token_1234567890_ABCDEFGHIJKLMN";

class RecordingDatabase {
  constructor(row) {
    this.row = row;
    this.sql = null;
    this.bindings = [];
  }

  prepare(sql) {
    this.sql = sql;
    return {
      bind: (...bindings) => {
        this.bindings = bindings;
        return {
          first: async () => this.row
        };
      }
    };
  }
}

function keyringEnv(database) {
  return {
    DB: database,
    CRM_AUTH_SESSION_HMAC_ACTIVE_KEY_VERSION: "2",
    CRM_AUTH_SESSION_HMAC_RETAINED_KEY_VERSIONS: "1",
    CRM_AUTH_SESSION_HMAC_KEY_V1: "r".repeat(64),
    CRM_AUTH_SESSION_HMAC_KEY_V2: "s".repeat(64)
  };
}

async function validRetainedRow(overrides = {}) {
  return {
    id: "1".repeat(32),
    realm: "staff",
    scope: "staff_strong",
    account_status: "active",
    token_hash_version: 1,
    token_hash: await hashOpaqueToken(SESSION_TOKEN, "r".repeat(64)),
    issued_auth_version: 4,
    current_auth_version: 4,
    enrollment_state: "complete",
    enrollment_deadline_at: null,
    staff_profile_id: 7,
    staff_profile_is_active: 1,
    role: "admin",
    customer_profile_id: null,
    customer_profile_is_blocked: null,
    has_accepted_staff_invitation: 0,
    authorization_context_json: "{}",
    ...overrides
  };
}

test("canonical session resolution matches retained hash and version as one pair", async () => {
  const database = new RecordingDatabase(await validRetainedRow());
  const resolved = await resolveCanonicalSession(
    keyringEnv(database),
    SESSION_TOKEN,
    "staff",
    { now: "2030-01-01T00:00:00.000Z" }
  );

  assert.equal(resolved.id, "1".repeat(32));
  assert.deepEqual(resolved.authorization_context, {});
  assert.match(database.sql, /s\.token_hash_version = \? AND s\.token_hash = \?/);
  assert.equal(database.bindings[0], 2);
  assert.equal(database.bindings[2], 1);
  assert.equal(database.bindings.at(-2), "staff");
  assert.equal(database.bindings.at(-1), "2030-01-01T00:00:00.000Z");
  assert.match(database.sql, /LEFT JOIN admin_users/);
  assert.match(database.sql, /LEFT JOIN customers/);
  assert.match(database.sql, /auth_staff_invitations/);
});

test("staff password-limited sessions enforce enrollment state and deadline", async () => {
  const now = "2030-01-01T00:00:00.000Z";
  const eligible = await validRetainedRow({
    scope: "staff_password_limited",
    enrollment_state: "in_progress",
    enrollment_deadline_at: "2030-01-02T00:00:00.000Z"
  });
  assert.ok(await resolveCanonicalSession(
    keyringEnv(new RecordingDatabase(eligible)),
    SESSION_TOKEN,
    "staff",
    { now }
  ));

  for (const overrides of [
    { enrollment_state: "complete" },
    { enrollment_deadline_at: "2030-01-01T00:00:00.000Z" },
    { enrollment_deadline_at: "not-a-date" }
  ]) {
    const row = await validRetainedRow({
      scope: "staff_password_limited",
      enrollment_state: "required",
      enrollment_deadline_at: "2030-01-02T00:00:00.000Z",
      ...overrides
    });
    assert.equal(await resolveCanonicalSession(
      keyringEnv(new RecordingDatabase(row)),
      SESSION_TOKEN,
      "staff",
      { now }
    ), null);
  }
});

test("staff enrollment sessions require the exact pending or active eligibility", async () => {
  const now = "2030-01-01T00:00:00.000Z";
  const pending = await validRetainedRow({
    scope: "staff_enrollment",
    account_status: "pending",
    enrollment_state: "in_progress",
    enrollment_deadline_at: "2030-01-02T00:00:00.000Z",
    has_accepted_staff_invitation: 1,
    authorization_context_json: JSON.stringify({ stage: "email_verified" })
  });
  assert.ok(await resolveCanonicalSession(
    keyringEnv(new RecordingDatabase(pending)),
    SESSION_TOKEN,
    "staff",
    { now }
  ));

  const pendingWithoutInvitation = new RecordingDatabase({
    ...pending,
    has_accepted_staff_invitation: 0
  });
  assert.equal(await resolveCanonicalSession(
    keyringEnv(pendingWithoutInvitation),
    SESSION_TOKEN,
    "staff",
    { now }
  ), null);

  const active = new RecordingDatabase({
    ...pending,
    account_status: "active",
    enrollment_state: "required",
    has_accepted_staff_invitation: 0
  });
  assert.ok(await resolveCanonicalSession(
    keyringEnv(active),
    SESSION_TOKEN,
    "staff",
    { now }
  ));

  const disabledExpired = new RecordingDatabase({
    ...pending,
    account_status: "disabled",
    disabled_reason: "enrollment_expired",
    enrollment_state: "expired",
    enrollment_deadline_at: "2030-01-02T00:00:00.000Z",
    staff_profile_is_active: 0,
    authorization_context_json: JSON.stringify({
      stage: "email_required",
      fresh_password_proof: true
    })
  });
  assert.equal(await resolveCanonicalSession(
    keyringEnv(disabledExpired),
    SESSION_TOKEN,
    "staff",
    { now }
  ), null);
});

test("staff recovery scopes require an active account", async () => {
  for (const scope of ["staff_recovery_email", "staff_recovery_authorized"]) {
    const active = await validRetainedRow({
      scope,
      account_status: "active",
      authorization_context_json: JSON.stringify({ grant_id: "2".repeat(32) })
    });
    assert.ok(await resolveCanonicalSession(
      keyringEnv(new RecordingDatabase(active)),
      SESSION_TOKEN,
      "staff",
      { now: "2030-01-01T00:00:00.000Z" }
    ));

    const disabled = new RecordingDatabase({
      ...active,
      account_status: "disabled",
      disabled_reason: "security_hold",
      staff_profile_is_active: 0
    });
    assert.equal(await resolveCanonicalSession(
      keyringEnv(disabled),
      SESSION_TOKEN,
      "staff",
      { now: "2030-01-01T00:00:00.000Z" }
    ), null);
  }
});

test("profile linkage and current staff activity fail closed", async () => {
  for (const overrides of [
    { staff_profile_id: null },
    { staff_profile_is_active: 0 },
    { role: null }
  ]) {
    const database = new RecordingDatabase(await validRetainedRow(overrides));
    assert.equal(await resolveCanonicalSession(
      keyringEnv(database),
      SESSION_TOKEN,
      "staff",
      { now: "2030-01-01T00:00:00.000Z" }
    ), null);
  }
});

test("customer sessions require their linked profile but do not treat blocking as authentication", async () => {
  const customer = await validRetainedRow({
    realm: "customer",
    scope: "customer_verified",
    staff_profile_id: null,
    staff_profile_is_active: null,
    role: null,
    customer_profile_id: 9,
    customer_profile_is_blocked: 1
  });
  const resolved = await resolveCanonicalSession(
    keyringEnv(new RecordingDatabase(customer)),
    SESSION_TOKEN,
    "customer",
    { now: "2030-01-01T00:00:00.000Z" }
  );
  assert.equal(resolved.customer_profile_id, 9);
  assert.equal(resolved.customer_profile_is_blocked, 1);

  const missing = new RecordingDatabase({
    ...customer,
    customer_profile_id: null
  });
  assert.equal(await resolveCanonicalSession(
    keyringEnv(missing),
    SESSION_TOKEN,
    "customer",
    { now: "2030-01-01T00:00:00.000Z" }
  ), null);
});

test("canonical session resolution rejects unknown, mismatched, and invalid scopes", async () => {
  const unknownVersion = new RecordingDatabase(await validRetainedRow({
    token_hash_version: 3
  }));
  assert.equal(
    await resolveCanonicalSession(keyringEnv(unknownVersion), SESSION_TOKEN, "staff"),
    null
  );

  const wrongHash = new RecordingDatabase(await validRetainedRow({
    token_hash: "f".repeat(64)
  }));
  assert.equal(
    await resolveCanonicalSession(keyringEnv(wrongHash), SESSION_TOKEN, "staff"),
    null
  );

  const invalidScope = new RecordingDatabase(await validRetainedRow({
    scope: "customer_verified"
  }));
  assert.equal(
    await resolveCanonicalSession(keyringEnv(invalidScope), SESSION_TOKEN, "staff"),
    null
  );
});
