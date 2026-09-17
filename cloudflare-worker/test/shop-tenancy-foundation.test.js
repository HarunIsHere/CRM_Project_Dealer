import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

async function migratedDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");

  const migrationsUrl = new URL("../migrations/", import.meta.url);
  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  for (const name of migrationNames) {
    sqlite.exec(await readFile(new URL(name, migrationsUrl), "utf8"));

    if (name === "0007_admin_users_and_audit_logs.sql") {
      sqlite.prepare(`
        INSERT INTO admin_users (
          username,
          password_hash,
          role,
          is_active
        )
        VALUES (?, ?, 'admin', 1)
      `).run("legacy_shop_admin", "a".repeat(64));
    }
  }

  return sqlite;
}

test(
  "shop tenancy uses canonical accounts and preserves legacy access",
  async (t) => {
    const sqlite = await migratedDatabase();
    t.after(() => sqlite.close());

    const migrated = sqlite.prepare(`
      SELECT membership.role, membership.status, account.realm
      FROM shop_memberships membership
      JOIN auth_accounts account
        ON account.id = membership.auth_account_id
      JOIN admin_users admin
        ON admin.auth_account_id = account.id
      WHERE admin.username = 'legacy_shop_admin'
        AND membership.shop_id = 1
    `).get();

    assert.deepEqual({ ...migrated }, {
      role: "manager",
      status: "active",
      realm: "staff"
    });

    sqlite.prepare(`
      INSERT INTO customers (
        telegram_user_id,
        username,
        language,
        preferred_language
      )
      VALUES ('future-owner', 'future_owner', 'en', 'en')
    `).run();

    const applicant = sqlite.prepare(`
      SELECT auth_account_id
      FROM customers
      WHERE telegram_user_id = 'future-owner'
    `).get();

    assert.ok(applicant.auth_account_id);

    sqlite.prepare(`
      INSERT INTO shop_applications (
        id,
        applicant_auth_account_id,
        proposed_name,
        proposed_slug,
        status,
        submitted_at
      )
      VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `).run(
      "b".repeat(32),
      applicant.auth_account_id,
      "Future Shop",
      "future-shop"
    );

    assert.throws(() => {
      sqlite.prepare(`
        INSERT INTO shop_applications (
          id,
          applicant_auth_account_id,
          proposed_name,
          proposed_slug
        )
        VALUES (?, ?, ?, ?)
      `).run(
        "c".repeat(32),
        applicant.auth_account_id,
        "Duplicate Open Application",
        "duplicate-open-application"
      );
    }, /UNIQUE constraint failed/);

    const reviewerAccountId = sqlite.prepare(`
      SELECT auth_account_id
      FROM admin_users
      WHERE username = 'legacy_shop_admin'
    `).get().auth_account_id;

    sqlite.prepare(`
      INSERT INTO shops (
        name,
        slug,
        ownership_model,
        created_by_auth_account_id,
        approved_by_auth_account_id,
        approved_at
      )
      VALUES (?, ?, 'member_owned', ?, ?, CURRENT_TIMESTAMP)
    `).run(
      "Future Shop",
      "future-shop",
      applicant.auth_account_id,
      reviewerAccountId
    );

    const shopId = Number(
      sqlite.prepare(`
        SELECT id FROM shops WHERE slug = 'future-shop'
      `).get().id
    );

    sqlite.prepare(`
      INSERT INTO shop_memberships (
        id,
        shop_id,
        auth_account_id,
        role,
        status,
        activated_at
      )
      VALUES (?, ?, ?, 'owner', 'active', CURRENT_TIMESTAMP)
    `).run(
      "d".repeat(32),
      shopId,
      applicant.auth_account_id
    );

    const ownership = sqlite.prepare(`
      SELECT shop.ownership_model, membership.role, account.realm
      FROM shops shop
      JOIN shop_memberships membership
        ON membership.shop_id = shop.id
      JOIN auth_accounts account
        ON account.id = membership.auth_account_id
      WHERE shop.id = ?
    `).get(shopId);

    assert.deepEqual({ ...ownership }, {
      ownership_model: "member_owned",
      role: "owner",
      realm: "customer"
    });
  }
);
