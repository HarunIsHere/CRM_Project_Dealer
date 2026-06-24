CREATE TABLE IF NOT EXISTS customer_order_status_history_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by_admin_id INTEGER,
  changed_by_admin_username TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES customer_orders_v2(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_order_status_history_v2_order_id
  ON customer_order_status_history_v2(order_id);

CREATE INDEX IF NOT EXISTS idx_customer_order_status_history_v2_created_at
  ON customer_order_status_history_v2(created_at);
