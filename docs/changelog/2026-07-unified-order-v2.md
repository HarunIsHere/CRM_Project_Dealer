# 2026-07 Unified Order V2 Changelog

## Added

- Unified customer order lifecycle V2.
- `order_addition_groups_v2`.
- `customer_locations_v2`.
- Delivery location validation.
- Delivery pending additions.
- Admin approve/reject for delivery additions.
- Pickup waiting-ready groups.
- Admin ready-to-pickup action.
- Admin delivery on-the-way action.
- Admin cancel order action.
- Admin customer-app order detail route.
- V2 live verification scripts.

## Changed

- Customer app cart/order flow now uses V2 cart and order tables.
- Delivery checkout blocks weak unconfirmed location input.
- Confirmed totals, pending totals, waiting-ready totals, rejected totals, scheduled totals, and cancelled totals are separated.
- Cancellation now overrides order status, fulfillment-specific status, groups, and items.

## Kept intentionally

- Telegram bot legacy order flow.
- `shopping_carts`.
- `shopping_cart_items`.
- `ready_to_delivery`.
- unresolved Telegram/admin handoff.
- location description flow.
- AI fallback behavior.

## Verified live

- Pickup initial checkout.
- Pickup ready-to-pickup.
- Pickup addition after ready.
- Pickup ready again.
- Delivery weak-location block.
- Delivery valid checkout.
- Delivery pending addition approval.
- Delivery pending addition rejection.
- Delivery on-the-way.
- Delivery cancellation after cancellation patch.
- Admin customer-app order detail route.
