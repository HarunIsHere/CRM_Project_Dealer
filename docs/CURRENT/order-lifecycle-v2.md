# Current Order Lifecycle V2

Status: active project structure  
Phase: unified customer order lifecycle v2  
Branch introduced: unified-order-v2

## Active customer app order system

The customer app / mini-app / future mobile app order lifecycle uses:

- `customer_orders_v2`
- `customer_order_items_v2`
- `order_addition_groups_v2`
- `customer_cart_sessions`
- `customer_cart_items_v2`
- `customer_locations_v2`

These tables are the active path for customer app cart, checkout, order history, delivery additions, pickup readiness, cancellation, and admin customer-app order management.

## Legacy Telegram/admin flow still kept

The Telegram bot and older admin/order flow may still use:

- `shopping_carts`
- `shopping_cart_items`
- `ready_to_delivery`
- unresolved Telegram/admin handoff
- location description / contact admin flow

Do not remove these until the Telegram bot and legacy admin flow are migrated or proven obsolete.

## Delivery lifecycle

Initial delivery checkout:

- Requires confirmed/usable delivery location.
- Weak fallback address such as only `Berlin` must be blocked.
- Creates `initial_checkout` group.
- Initial delivery items are immediately confirmed.
- Confirmed total increases immediately.

Delivery additions after checkout:

- Create separate `delivery_pending_addition` group.
- Group status starts as `pending_admin_approval`.
- Items start as `pending_admin_approval`.
- Confirmed total does not increase until admin approves.

Admin approval:

- Group becomes `approved`.
- Items become `confirmed`.
- Confirmed total increases.

Admin rejection:

- Group becomes `rejected`.
- Items become `rejected`.
- Confirmed total stays unchanged.
- Rejected section shows rejected value.

Delivery on the way:

- Only applies to delivery orders.
- Sets `delivery_status = on_the_way`.
- Does not close or lock the order.
- Further additions may still be handled separately.

Delivery cancellation:

- `order_status = cancelled`
- `delivery_status = cancelled`
- all groups become `cancelled`
- all items become `cancelled`
- `total_amount = 0`
- cancelled section shows cancelled item value

## Pickup lifecycle

Initial pickup checkout:

- Does not require delivery location.
- Creates `initial_checkout` group.
- Items start as `waiting_ready_to_pickup`.
- Confirmed total stays 0 until admin marks ready.

Admin marks ready to pick up:

- `pickup_status = ready_to_pickup`
- waiting pickup groups become `confirmed`
- waiting pickup items become `confirmed`
- confirmed total increases.

Pickup additions after ready:

- Create separate `pickup_waiting_ready_confirmation` group.
- New items stay separate until admin marks ready again.
- Existing confirmed pickup items stay confirmed.
- `pickup_status` resets to `preparing`.

Pickup cancellation:

- `order_status = cancelled`
- `pickup_status = cancelled`
- all groups become `cancelled`
- all items become `cancelled`
- `total_amount = 0`
- cancelled section shows cancelled item value

## Admin actions

Active V2 admin customer-app routes:

- `GET /api/v1/admin/customer-app-orders`
- `GET /api/v1/admin/customer-app-orders/{id}`
- `PATCH /api/v1/admin/customer-app-orders/{id}/status`
- `POST /api/v1/admin/customer-app-orders/{id}/on-the-way`
- `POST /api/v1/admin/customer-app-orders/{id}/ready-to-pickup`
- `POST /api/v1/admin/customer-app-orders/{id}/cancel`
- `POST /api/v1/admin/customer-app-orders/{id}/groups/{groupId}/approve`
- `POST /api/v1/admin/customer-app-orders/{id}/groups/{groupId}/reject`

## Cleanup rule

Remove only code that is certainly wrong or certainly obsolete.

Keep anything that may still support:

- Telegram bot
- admin web
- Android app
- iOS app
- compatibility
- future migration path
