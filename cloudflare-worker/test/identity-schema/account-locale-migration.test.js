import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(testDirectory, "..", "..", "migrations");

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");

  for (const filename of readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    database.exec(readFileSync(join(migrationsDirectory, filename), "utf8"));
  }

  return database;
}

test("0015 persists a validated account locale with an English fallback", () => {
  const database = migratedDatabase();
  const accountId = "a".repeat(32);
  const userHandle = "b".repeat(32);

  database.prepare(`
    INSERT INTO auth_accounts (
      id,
      webauthn_user_handle,
      realm,
      status,
      enrollment_state
    ) VALUES (?, ?, 'staff', 'pending', 'required')
  `).run(accountId, userHandle);

  const initial = database.prepare(
    "SELECT locale FROM auth_accounts WHERE id = ?"
  ).get(accountId);
  assert.equal(initial.locale, "en");

  database.prepare(
    "UPDATE auth_accounts SET locale = 'de' WHERE id = ?"
  ).run(accountId);
  assert.equal(
    database.prepare("SELECT locale FROM auth_accounts WHERE id = ?")
      .get(accountId).locale,
    "de"
  );

  assert.throws(() => {
    database.prepare(
      "UPDATE auth_accounts SET locale = 'fr' WHERE id = ?"
    ).run(accountId);
  }, /CHECK constraint failed/);

  database.close();
});
