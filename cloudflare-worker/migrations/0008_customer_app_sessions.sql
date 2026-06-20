CREATE TABLE IF NOT EXISTS customer_app_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_id TEXT,
    platform TEXT,
    app_version TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT,
    revoked_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_app_sessions_customer_id
ON customer_app_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_app_sessions_token_hash
ON customer_app_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_customer_app_sessions_device_id
ON customer_app_sessions(device_id);
