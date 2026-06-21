CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    address TEXT,
    google_maps_link TEXT,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

INSERT OR IGNORE INTO shops (id, name, slug, description, is_active)
VALUES (1, 'Default Shop', 'default-shop', 'Default shop for existing single-shop data', 1);

CREATE TABLE IF NOT EXISTS admin_shop_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user_id INTEGER NOT NULL,
    shop_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'shop_admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(admin_user_id, shop_id),
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE TABLE IF NOT EXISTS customer_shop_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    shop_id INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    is_active INTEGER NOT NULL DEFAULT 1,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    UNIQUE(customer_id, shop_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO payment_methods (code, name, is_active)
VALUES
    ('cash_delivery', 'Cash on delivery', 1),
    ('cash_pickup', 'Cash on pickup', 1),
    ('bank_transfer', 'Bank transfer', 1),
    ('digital_later', 'Digital payment later', 0);

CREATE TABLE IF NOT EXISTS shop_payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id INTEGER NOT NULL,
    payment_method_code TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, payment_method_code),
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code)
);

INSERT OR IGNORE INTO shop_payment_methods (shop_id, payment_method_code, is_enabled)
VALUES
    (1, 'cash_delivery', 1),
    (1, 'cash_pickup', 1),
    (1, 'bank_transfer', 1);

CREATE TABLE IF NOT EXISTS customer_payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    payment_method_code TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_preferred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, payment_method_code),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code)
);

CREATE TABLE IF NOT EXISTS customer_preferred_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    shop_id INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    UNIQUE(customer_id, category_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (category_id) REFERENCES product_categories(id),
    FOREIGN KEY (shop_id) REFERENCES shops(id)
);

CREATE TABLE IF NOT EXISTS customer_checkouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    total_amount REAL NOT NULL DEFAULT 0,
    total_cash_amount REAL NOT NULL DEFAULT 0,
    delivery_location_label TEXT,
    delivery_google_maps_link TEXT,
    delivery_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    closed_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS shop_order_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkout_id INTEGER NOT NULL,
    shop_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    subtotal_amount REAL NOT NULL DEFAULT 0,
    cash_amount REAL NOT NULL DEFAULT 0,
    payment_method_code TEXT,
    fulfillment_type TEXT,
    admin_status_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    closed_at TEXT,
    FOREIGN KEY (checkout_id) REFERENCES customer_checkouts(id),
    FOREIGN KEY (shop_id) REFERENCES shops(id),
    FOREIGN KEY (payment_method_code) REFERENCES payment_methods(code)
);

ALTER TABLE products ADD COLUMN shop_id INTEGER REFERENCES shops(id);
ALTER TABLE product_categories ADD COLUMN shop_id INTEGER REFERENCES shops(id);
ALTER TABLE meeting_points ADD COLUMN shop_id INTEGER REFERENCES shops(id);
ALTER TABLE shopping_carts ADD COLUMN active_shop_id INTEGER REFERENCES shops(id);
ALTER TABLE shopping_carts ADD COLUMN checkout_id INTEGER REFERENCES customer_checkouts(id);
ALTER TABLE shopping_cart_items ADD COLUMN shop_id INTEGER REFERENCES shops(id);
ALTER TABLE shopping_cart_items ADD COLUMN payment_compatible INTEGER;
ALTER TABLE shopping_cart_items ADD COLUMN payment_warning TEXT;

UPDATE products SET shop_id = 1 WHERE shop_id IS NULL;
UPDATE product_categories SET shop_id = 1 WHERE shop_id IS NULL;
UPDATE meeting_points SET shop_id = 1 WHERE shop_id IS NULL;
UPDATE shopping_cart_items SET shop_id = 1 WHERE shop_id IS NULL;

INSERT OR IGNORE INTO customer_shop_memberships (customer_id, shop_id, source, is_active)
SELECT id, 1, 'migration_default_shop', 1 FROM customers;

INSERT OR IGNORE INTO admin_shop_access (admin_user_id, shop_id, role, is_active)
SELECT id, 1, role, 1 FROM admin_users;

CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_admin_shop_access_admin ON admin_shop_access(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_shop_access_shop ON admin_shop_access(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_shop_memberships_customer ON customer_shop_memberships(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_shop_memberships_shop ON customer_shop_memberships(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_payment_methods_shop ON shop_payment_methods(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer ON customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_preferred_providers_customer ON customer_preferred_providers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_preferred_providers_shop ON customer_preferred_providers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_checkouts_customer_status ON customer_checkouts(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_shop_order_parts_checkout ON shop_order_parts(checkout_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_parts_shop_status ON shop_order_parts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_shop ON product_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_shopping_cart_items_shop ON shopping_cart_items(shop_id);
