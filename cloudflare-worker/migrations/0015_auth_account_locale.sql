-- Durable identity locale used as the source for challenge and email snapshots.
-- Existing accounts retain the prior effective fallback of English.

ALTER TABLE auth_accounts
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'
  CHECK (locale IN ('en', 'de', 'tr', 'ar', 'ru'));
