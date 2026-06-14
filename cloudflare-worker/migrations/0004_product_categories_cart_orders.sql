CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES product_categories(id);

INSERT OR IGNORE INTO product_categories (name, is_active)
VALUES ('Special Requests', 1);
