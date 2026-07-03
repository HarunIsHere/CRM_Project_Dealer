# ADR-0003: Unified Customer Order Lifecycle V2

Date: 2026-07-03  
Status: accepted

## Context

The project had multiple overlapping order concepts:

- Telegram bot / legacy admin order flow using `shopping_carts`
- Customer app cart/order flow
- Newer V2 customer order tables
- Admin customer-app order management
- Delivery and pickup behavior that needed different lifecycle rules

The old flow could accidentally allow weak delivery fallback data, such as a city-only address. It also mixed order status, delivery status, pickup status, and additions into one less precise flow.

## Decision

Use a unified V2 lifecycle for customer app / mini-app / future mobile app orders.

Active V2 tables:

- `customer_orders_v2`
- `customer_order_items_v2`
- `order_addition_groups_v2`
- `customer_cart_sessions`
- `customer_cart_items_v2`
- `customer_locations_v2`

Separate concepts:

- `order_status`
- `fulfillment_type`
- `delivery_status`
- `pickup_status`
- addition groups
- item status
- section totals

## Consequences

Delivery and pickup now behave differently by design.

Delivery:

- confirmed delivery location required
- initial checkout confirmed immediately
- later additions need admin approval
- rejected additions remain separate
- on-the-way is delivery-specific
- cancellation overrides delivery status, groups, and items

Pickup:

- no delivery location required
- initial checkout waits for ready-to-pickup
- later additions wait for ready confirmation
- ready-to-pickup confirms waiting groups
- cancellation overrides pickup status, groups, and items

## Compatibility rule

Do not delete Telegram bot / legacy admin logic until it is migrated or proven unused.

Keep for now:

- `shopping_carts`
- `shopping_cart_items`
- `ready_to_delivery`
- unresolved Telegram/admin handoff
- contact admin / location description flow

## Cleanup rule

Only remove code that is certainly wrong or certainly obsolete.

Move old planning notes to archive instead of deleting them immediately.
