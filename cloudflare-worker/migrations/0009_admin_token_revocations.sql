CREATE TABLE IF NOT EXISTS admin_token_revocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    username TEXT,
    revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_token_revocations_token_hash
ON admin_token_revocations(token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_token_revocations_username
ON admin_token_revocations(username);
