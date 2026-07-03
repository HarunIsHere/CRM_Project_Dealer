# ADR-0004: Telegram Bot Migrates to Unified Order V2

Date: 2026-07-03  
Status: accepted

## Decision

The Telegram bot will migrate to the unified V2 customer order lifecycle.

Keeping the legacy Telegram bot order flow live during migration is not required.

Keeping the legacy admin order web live during migration is not required.

## Target state

These customer-facing surfaces should use the same V2 lifecycle:

- Telegram bot
- Telegram mini-app
- Android app
- iOS app
- admin web

## Target V2 tables

Telegram bot order/cart behavior should move to:

- `customer_cart_sessions`
- `customer_cart_items_v2`
- `customer_orders_v2`
- `customer_order_items_v2`
- `order_addition_groups_v2`
- `customer_locations_v2`

## Legacy code policy

Legacy bot/admin code is useful as logic reference, but should not remain as a parallel live system.

Reuse or adapt useful logic from legacy code:

- Telegram language handling
- product menu flow
- basket UI text
- quantity change flow
- remove item flow
- clear basket flow
- checkout prompt text
- typed address handling
- meeting point selection
- contact admin / location description flow
- admin notification text
- delivery ETA message text
- `/o` actionable order listing idea
- customer state handling
- `saveMessage`
- `logCustomerRequest`

Replace legacy storage/status logic:

- `shopping_carts`
- `shopping_cart_items`
- `ready_to_delivery`
- `waiting_location` as cart status
- `on_the_way` as cart status
- `setActiveCartOrderStatus`
- legacy `/admin/orders`
- legacy `/admin/closedorders`
- Telegram `/o` reading `shopping_carts`

## Migration strategy

Do a direct V2 replacement in controlled steps.

1. Rewrite Telegram basket/cart functions to use V2 cart tables.
2. Rewrite Telegram checkout to create V2 orders.
3. Rewrite Telegram typed-address and meeting-point flows to use V2 locations/orders.
4. Rewrite Telegram `/o` listing to read V2 orders.
5. Rewrite Telegram ETA/on-the-way actions to update V2 delivery status.
6. Replace or retire legacy admin order views.
7. Stop creating new `shopping_carts` / `shopping_cart_items`.
8. Keep old tables only for old data/archive until deletion is explicitly approved.

## Rule

Use legacy bot/admin logic as a template.

Do not maintain two live order systems.
