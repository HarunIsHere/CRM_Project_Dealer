ALTER TABLE shopping_carts ADD COLUMN order_status TEXT NOT NULL DEFAULT 'in_progress';
ALTER TABLE shopping_carts ADD COLUMN delivery_location_label TEXT;
ALTER TABLE shopping_carts ADD COLUMN delivery_google_maps_link TEXT;
ALTER TABLE shopping_carts ADD COLUMN delivery_note TEXT;
ALTER TABLE shopping_carts ADD COLUMN delivered_at TEXT;
ALTER TABLE shopping_carts ADD COLUMN closed_at TEXT;
ALTER TABLE shopping_carts ADD COLUMN admin_status_note TEXT;

CREATE INDEX IF NOT EXISTS idx_shopping_carts_order_status
ON shopping_carts(order_status);

UPDATE shopping_carts
SET order_status = 'in_progress'
WHERE order_status IS NULL OR order_status = '';
