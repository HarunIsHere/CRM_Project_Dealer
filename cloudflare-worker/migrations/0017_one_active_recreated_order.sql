CREATE UNIQUE INDEX IF NOT EXISTS
  idx_customer_orders_v2_one_active_recreation
ON customer_orders_v2(recreated_from_order_id)
WHERE recreated_from_order_id IS NOT NULL
  AND COALESCE(
    order_status,
    status,
    ''
  ) NOT IN ('cancelled', 'closed', 'delivered');
