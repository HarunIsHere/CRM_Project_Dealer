# Current Project Structure

Status: active reference

## Main active systems

### Telegram bot

Still uses legacy bot/order flow in parts of the Worker and Python app.

Keep until migration is planned:

- `shopping_carts`
- `shopping_cart_items`
- `ready_to_delivery`
- unresolved admin handoff
- contact admin / location description flow

### Customer app / mini-app / future mobile apps

Uses V2 lifecycle:

- `customer_cart_sessions`
- `customer_cart_items_v2`
- `customer_orders_v2`
- `customer_order_items_v2`
- `order_addition_groups_v2`
- `customer_locations_v2`

### Admin web

Admin web has two relevant order areas:

- legacy admin order views for older Telegram/cart flow
- V2 customer-app order management

Do not merge or delete either side until their usage is proven.

## Documentation rule

Docs under `docs/CURRENT/` are active implementation truth.

Docs under `docs/archive/` are historical context and should not be used as current implementation reference.

Docs under `docs/decisions/` explain why major direction changes happened.
