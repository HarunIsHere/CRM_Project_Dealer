# Telegram Bot V2 Migration

Status: active migration plan

## Current decision

Telegram bot will migrate directly to V2.

The legacy bot/admin order system does not need to stay live during migration.

Legacy code is kept only as a reference for useful interaction logic.

## Current legacy flow to replace

Telegram bot currently uses:

- `shopping_carts`
- `shopping_cart_items`
- `waiting_location`
- `ready_to_delivery`
- `on_the_way`
- legacy `/admin/orders`
- legacy `/admin/closedorders`
- Telegram `/o` listing based on `shopping_carts`

## V2 destination

Telegram bot should use:

- `customer_cart_sessions`
- `customer_cart_items_v2`
- `customer_orders_v2`
- `customer_order_items_v2`
- `order_addition_groups_v2`
- `customer_locations_v2`

## Replacement map

### Basket/cart

Replace:

- `getOrCreateActiveCart`
- `getActiveCart`
- `addProductToBasket`
- `getCartItems`
- `getCartItemForCustomer`
- direct `shopping_cart_items` writes

With V2 cart session and `customer_cart_items_v2`.

### Checkout

Replace:

- `setActiveCartOrderStatus(..., "waiting_location")`

With customer state only until a valid delivery/pickup decision submits a V2 order.

### Delivery checkout

Replace:

- `ready_to_delivery`
- cart delivery fields

With:

- V2 delivery order
- V2 location
- `fulfillment_type = delivery`
- `delivery_status`
- V2 order groups/items

### Pickup checkout

Use V2 pickup order lifecycle:

- `fulfillment_type = pickup`
- `pickup_status`
- waiting-ready group
- admin ready-to-pickup confirms items

### Admin/on-the-way

Replace:

- cart `order_status = on_the_way`

With:

- V2 order `delivery_status = on_the_way`

### Telegram `/o`

Replace:

- `shopping_carts` query

With:

- `customer_orders_v2`
- grouped V2 order items
- delivery/pickup status sections

## Development rule

Do not build a long compatibility layer.

Change one vertical flow at a time, test it, then continue.
