ALTER TABLE customer_orders_v2 ADD COLUMN order_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE customer_orders_v2 ADD COLUMN fulfillment_type TEXT;
ALTER TABLE customer_orders_v2 ADD COLUMN delivery_status TEXT;
ALTER TABLE customer_orders_v2 ADD COLUMN pickup_status TEXT;
ALTER TABLE customer_orders_v2 ADD COLUMN delivery_location_id INTEGER;
ALTER TABLE customer_orders_v2 ADD COLUMN delivery_location_label TEXT DEFAULT '';
ALTER TABLE customer_orders_v2 ADD COLUMN delivery_google_maps_link TEXT DEFAULT '';
ALTER TABLE customer_orders_v2 ADD COLUMN scheduled_for_next_online_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_orders_v2 ADD COLUMN next_online_order_at TEXT;
ALTER TABLE customer_orders_v2 ADD COLUMN active_shop_id INTEGER;
ALTER TABLE customer_orders_v2 ADD COLUMN admin_status_note TEXT DEFAULT '';
ALTER TABLE customer_orders_v2 ADD COLUMN cancelled_at TEXT;
ALTER TABLE customer_orders_v2 ADD COLUMN cancelled_by_admin_id INTEGER;
ALTER TABLE customer_orders_v2 ADD COLUMN cancel_reason TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS customer_locations_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  session_token TEXT,
  label TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  google_maps_link TEXT NOT NULL DEFAULT '',
  latitude TEXT,
  longitude TEXT,
  is_preferred INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual_address',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_addition_groups_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_order_id INTEGER NOT NULL,
  group_type TEXT NOT NULL DEFAULT 'initial_checkout',
  group_status TEXT NOT NULL DEFAULT 'draft',
  fulfillment_type TEXT,
  requires_admin_approval INTEGER NOT NULL DEFAULT 0,
  scheduled_for_next_online_order INTEGER NOT NULL DEFAULT 0,
  next_online_order_at TEXT,
  admin_decision TEXT,
  admin_decision_note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_order_id) REFERENCES customer_orders_v2(id)
);

ALTER TABLE customer_order_items_v2 ADD COLUMN group_id INTEGER;
ALTER TABLE customer_order_items_v2 ADD COLUMN item_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE customer_order_items_v2 ADD COLUMN added_phase TEXT NOT NULL DEFAULT 'initial_checkout';
ALTER TABLE customer_order_items_v2 ADD COLUMN requires_admin_approval INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_order_items_v2 ADD COLUMN admin_decision TEXT;
ALTER TABLE customer_order_items_v2 ADD COLUMN admin_decision_note TEXT;
ALTER TABLE customer_order_items_v2 ADD COLUMN decided_at TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_order_status
  ON customer_orders_v2(order_status);

CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_fulfillment
  ON customer_orders_v2(fulfillment_type);

CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_delivery_status
  ON customer_orders_v2(delivery_status);

CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_pickup_status
  ON customer_orders_v2(pickup_status);

CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_next_online_order
  ON customer_orders_v2(scheduled_for_next_online_order, next_online_order_at);

CREATE INDEX IF NOT EXISTS idx_customer_locations_v2_customer
  ON customer_locations_v2(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_locations_v2_session
  ON customer_locations_v2(session_token);

CREATE INDEX IF NOT EXISTS idx_order_addition_groups_v2_order
  ON order_addition_groups_v2(customer_order_id);

CREATE INDEX IF NOT EXISTS idx_order_addition_groups_v2_status
  ON order_addition_groups_v2(group_status);

CREATE INDEX IF NOT EXISTS idx_customer_order_items_v2_group
  ON customer_order_items_v2(group_id);

CREATE INDEX IF NOT EXISTS idx_customer_order_items_v2_status
  ON customer_order_items_v2(item_status);
