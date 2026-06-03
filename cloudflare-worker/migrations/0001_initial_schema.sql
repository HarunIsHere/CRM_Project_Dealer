CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id TEXT NOT NULL UNIQUE,
    username TEXT,
    full_name TEXT,
    language TEXT,
    preferred_language TEXT,
    notes TEXT,
    conversation_state TEXT,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    direction TEXT NOT NULL,
    platform TEXT DEFAULT 'telegram',
    content TEXT,
    message_type TEXT DEFAULT 'text',
    language TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    alias TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_product_aliases_alias
ON product_aliases(alias);

CREATE TABLE IF NOT EXISTS meeting_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    google_maps_link TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    request_type TEXT NOT NULL,
    request_text TEXT,
    item_name TEXT,
    quantity INTEGER,
    location_label TEXT,
    latitude TEXT,
    longitude TEXT,
    google_maps_link TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_requests_customer_id
ON customer_requests(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_requests_status
ON customer_requests(status);
