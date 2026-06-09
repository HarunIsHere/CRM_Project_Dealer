CREATE TABLE IF NOT EXISTS customer_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    description TEXT,
    latitude TEXT,
    longitude TEXT,
    google_maps_link TEXT,
    is_preferred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_locations_customer_id
ON customer_locations(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_locations_preferred
ON customer_locations(customer_id, is_preferred);
