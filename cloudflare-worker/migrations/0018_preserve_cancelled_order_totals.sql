-- Preserve the historical commercial value of cancelled canonical V2 orders.
-- Rejected and otherwise ineligible additions remain excluded.

UPDATE customer_orders_v2
SET total_amount = COALESCE(
  (
    SELECT SUM(
      CASE
        WHEN COALESCE(
          i.status_before_cancel,
          i.item_status,
          'confirmed'
        ) IN (
          'confirmed',
          'approved',
          'waiting_ready_to_pickup',
          'scheduled_for_next_online_order'
        )
        THEN COALESCE(i.line_total, 0)
        ELSE 0
      END
    )
    FROM customer_order_items_v2 i
    WHERE i.customer_order_id = customer_orders_v2.id
  ),
  0
)
WHERE COALESCE(order_status, status, '') = 'cancelled'
  AND COALESCE(total_amount, 0) = 0;
