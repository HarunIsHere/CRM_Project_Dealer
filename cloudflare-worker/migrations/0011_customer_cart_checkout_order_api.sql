CREATE TABLE IF NOT EXISTS customer_cart_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL UNIQUE,
  customer_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_cart_items_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_token, product_id)
);

CREATE TABLE IF NOT EXISTS customer_orders_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_order_code TEXT NOT NULL UNIQUE,
  session_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  total_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  customer_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  delivery_address TEXT DEFAULT '',
  payment_method_code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_order_items_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  shop_id INTEGER,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_order_id) REFERENCES customer_orders_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_cart_items_v2_session ON customer_cart_items_v2(session_token);
CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_session ON customer_orders_v2(session_token);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_v2_order ON customer_order_items_v2(customer_order_id);
