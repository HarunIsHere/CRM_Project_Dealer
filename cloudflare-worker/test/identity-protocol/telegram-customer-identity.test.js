import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  upsertCanonicalTelegramCustomer
} from "../../src/identity/repository.js";

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
    return {
      results: this.statement.all(...this.bindings)
    };
  }

  runInternal() {
    const result = this.statement.run(...this.bindings);
    return {
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid)
      }
    };
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
      const results = statements.map(
        (statement) => statement.runInternal()
      );
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

  const migrationsUrl = new URL(
    "../../migrations/",
    import.meta.url
  );

  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  for (const name of migrationNames) {
    sqlite.exec(
      await readFile(new URL(name, migrationsUrl), "utf8")
    );
  }

  return sqlite;
}

function countRows(sqlite, table) {
  return Number(
    sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get()
      .count
  );
}

test(
  "new Telegram customer creates one canonical identity and refreshes idempotently",
  async (t) => {
    const sqlite = await migratedDatabase();
    t.after(() => sqlite.close());

    const env = {
      DB: new SqliteD1Database(sqlite)
    };

    const first = await upsertCanonicalTelegramCustomer(
      env,
      {
        id: 12345,
        username: "first_name",
        first_name: "First",
        last_name: "Customer"
      },
      "tr"
    );

    assert.ok(first.id);
    assert.ok(first.auth_account_id);
    assert.equal(first.telegram_user_id, "12345");
    assert.equal(first.preferred_language, "tr");

    const second = await upsertCanonicalTelegramCustomer(
      env,
      {
        id: 12345,
        username: "updated_name",
        first_name: "Updated",
        last_name: "Customer"
      },
      "de"
    );

    assert.equal(second.id, first.id);
    assert.equal(
      second.auth_account_id,
      first.auth_account_id
    );
    assert.equal(second.username, "updated_name");
    assert.equal(second.full_name, "Updated Customer");
    assert.equal(second.preferred_language, "de");

    assert.equal(countRows(sqlite, "customers"), 1);
    assert.equal(countRows(sqlite, "auth_accounts"), 1);
    assert.equal(
      countRows(sqlite, "auth_external_identities"),
      1
    );

    const identity = sqlite.prepare(`
      SELECT
        x.provider,
        x.provider_subject,
        x.auth_account_id,
        a.realm,
        a.status,
        a.locale
      FROM auth_external_identities x
      JOIN auth_accounts a
        ON a.id = x.auth_account_id
      WHERE x.revoked_at IS NULL
    `).get();

    assert.equal(identity.provider, "telegram");
    assert.equal(identity.provider_subject, "12345");
    assert.equal(identity.auth_account_id, first.auth_account_id);
    assert.equal(identity.realm, "customer");
    assert.equal(identity.status, "active");
    assert.equal(identity.locale, "de");
  }
);

test(
  "legacy Telegram customer is linked without creating a duplicate customer or account",
  async (t) => {
    const sqlite = await migratedDatabase();
    t.after(() => sqlite.close());

    sqlite.prepare(`
      INSERT INTO customers (
        telegram_user_id,
        username,
        full_name,
        language,
        preferred_language
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "45678",
      "legacy",
      "Legacy Customer",
      "en",
      "en"
    );

    const before = sqlite.prepare(`
      SELECT id, auth_account_id
      FROM customers
      WHERE telegram_user_id = '45678'
    `).get();

    assert.ok(before.auth_account_id);

    const env = {
      DB: new SqliteD1Database(sqlite)
    };

    const linked = await upsertCanonicalTelegramCustomer(
      env,
      {
        id: 45678,
        username: "legacy_updated",
        first_name: "Legacy",
        last_name: "Updated"
      },
      "de"
    );

    assert.equal(linked.id, before.id);
    assert.equal(
      linked.auth_account_id,
      before.auth_account_id
    );
    assert.equal(linked.username, "legacy_updated");
    assert.equal(linked.preferred_language, "de");

    assert.equal(countRows(sqlite, "customers"), 1);
    assert.equal(countRows(sqlite, "auth_accounts"), 1);
    assert.equal(
      countRows(sqlite, "auth_external_identities"),
      1
    );
  }
);

test(
  "conflicting legacy and canonical Telegram mappings fail closed",
  async (t) => {
    const sqlite = await migratedDatabase();
    t.after(() => sqlite.close());

    sqlite.prepare(`
      INSERT INTO customers (
        telegram_user_id,
        username,
        language,
        preferred_language
      )
      VALUES ('7001', 'legacy_a', 'en', 'en')
    `).run();

    sqlite.prepare(`
      INSERT INTO customers (
        telegram_user_id,
        username,
        language,
        preferred_language
      )
      VALUES ('7002', 'legacy_b', 'en', 'en')
    `).run();

    const secondAccount = sqlite.prepare(`
      SELECT auth_account_id
      FROM customers
      WHERE telegram_user_id = '7002'
    `).get().auth_account_id;

    sqlite.prepare(`
      INSERT INTO auth_external_identities (
        id,
        auth_account_id,
        realm,
        provider,
        provider_subject,
        verified_at,
        linked_at,
        created_transition_id,
        provider_metadata_json
      )
      VALUES (?, ?, 'customer', 'telegram', '7001', ?, ?, ?, '{}')
    `).run(
      "a".repeat(32),
      secondAccount,
      new Date().toISOString(),
      new Date().toISOString(),
      "b".repeat(32)
    );

    const env = {
      DB: new SqliteD1Database(sqlite)
    };

    await assert.rejects(
      () => upsertCanonicalTelegramCustomer(
        env,
        {
          id: 7001,
          username: "conflicting"
        },
        "en"
      ),
      (error) => (
        error?.code === "telegram_identity_conflict"
      )
    );

    assert.equal(countRows(sqlite, "customers"), 2);
    assert.equal(countRows(sqlite, "auth_accounts"), 2);
    assert.equal(
      countRows(sqlite, "auth_external_identities"),
      1
    );
  }
);

test(
  "database uniqueness prevents duplicate active Telegram mappings",
  async (t) => {
    const sqlite = await migratedDatabase();
    t.after(() => sqlite.close());

    const env = {
      DB: new SqliteD1Database(sqlite)
    };

    const first = await upsertCanonicalTelegramCustomer(
      env,
      {
        id: 9001,
        username: "canonical"
      },
      "en"
    );

    sqlite.prepare(`
      INSERT INTO customers (
        telegram_user_id,
        username,
        language,
        preferred_language
      )
      VALUES ('9002', 'other', 'en', 'en')
    `).run();

    const otherAccount = sqlite.prepare(`
      SELECT auth_account_id
      FROM customers
      WHERE telegram_user_id = '9002'
    `).get().auth_account_id;

    const now = new Date().toISOString();

    assert.throws(() => {
      sqlite.prepare(`
        INSERT INTO auth_external_identities (
          id,
          auth_account_id,
          realm,
          provider,
          provider_subject,
          verified_at,
          linked_at,
          created_transition_id,
          provider_metadata_json
        )
        VALUES (?, ?, 'customer', 'telegram', '9001', ?, ?, ?, '{}')
      `).run(
        "c".repeat(32),
        otherAccount,
        now,
        now,
        "d".repeat(32)
      );
    }, /UNIQUE constraint failed/);

    assert.throws(() => {
      sqlite.prepare(`
        INSERT INTO auth_external_identities (
          id,
          auth_account_id,
          realm,
          provider,
          provider_subject,
          verified_at,
          linked_at,
          created_transition_id,
          provider_metadata_json
        )
        VALUES (?, ?, 'customer', 'telegram', '9999', ?, ?, ?, '{}')
      `).run(
        "e".repeat(32),
        first.auth_account_id,
        now,
        now,
        "f".repeat(32)
      );
    }, /UNIQUE constraint failed/);
  }
);
