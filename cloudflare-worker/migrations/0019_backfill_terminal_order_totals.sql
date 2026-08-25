-- Repair historical terminal canonical V2 orders whose stored commercial
-- total was never finalized. Existing non-zero totals remain unchanged.
-- Rejected, cancelled, and otherwise ineligible item values stay excluded.

UPDATE customer_orders_v2
SET total_amount = (
  SELECT COALESCE(
    SUM(COALESCE(i.line_total, i.quantity * i.unit_price, 0)),
    0
  )
  FROM customer_order_items_v2 i
  WHERE i.customer_order_id = customer_orders_v2.id
    AND COALESCE(
      NULLIF(TRIM(i.status_before_cancel), ''),
      NULLIF(TRIM(i.item_status), ''),
      'confirmed'
    ) IN (
      'confirmed',
      'approved',
      'waiting_ready_to_pickup',
      'scheduled_for_next_online_order'
    )
)
WHERE COALESCE(order_status, status, '') IN (
    'delivered',
    'not_delivered',
    'closed',
    'cancelled'
  )
  AND COALESCE(total_amount, 0) = 0
  AND EXISTS (
    SELECT 1
    FROM customer_order_items_v2 i
    WHERE i.customer_order_id = customer_orders_v2.id
      AND COALESCE(
        NULLIF(TRIM(i.status_before_cancel), ''),
        NULLIF(TRIM(i.item_status), ''),
        'confirmed'
      ) IN (
        'confirmed',
        'approved',
        'waiting_ready_to_pickup',
        'scheduled_for_next_online_order'
      )
  );
