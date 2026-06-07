CREATE TABLE IF NOT EXISTS learned_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_text TEXT NOT NULL,
    normalized_pattern TEXT NOT NULL,
    intent TEXT NOT NULL,
    response_text TEXT,
    product_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'ai',
    hit_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME
);
