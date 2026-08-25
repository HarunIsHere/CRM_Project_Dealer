ALTER TABLE customer_orders_v2
  ADD COLUMN recreated_from_order_id INTEGER;

ALTER TABLE customer_orders_v2
  ADD COLUMN recreation_key TEXT;

ALTER TABLE customer_orders_v2
  ADD COLUMN recreated_by_admin_id INTEGER;

ALTER TABLE customer_orders_v2
  ADD COLUMN recreation_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE customer_orders_v2
  ADD COLUMN recreation_confirmed_at TEXT;

ALTER TABLE order_addition_groups_v2
  ADD COLUMN status_before_cancel TEXT;

ALTER TABLE customer_order_items_v2
  ADD COLUMN status_before_cancel TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_orders_v2_recreated_from
  ON customer_orders_v2(recreated_from_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_orders_v2_recreation_key
  ON customer_orders_v2(recreation_key);
