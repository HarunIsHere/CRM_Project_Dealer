# Project Terminology

Status: active reference

## Rule

All apps, bot, admin web, API, database, and documentation should use the same business terminology.

Different UI surfaces may have different interaction steps, but they must point to the same backend lifecycle and mean the same thing.

## Canonical terms

### Cart

Canonical term: `cart`

Meaning:

A temporary collection of products before checkout.

Use in:

- API
- database
- backend code
- Android
- iOS
- mini-app
- admin web
- documentation

Examples:

- `customer_cart_sessions`
- `customer_cart_items_v2`
- `cart_empty`
- `clear_cart`
- `cart items`

Legacy/old term:

- `basket`

Decision:

`basket` and `cart` mean the same thing, but `cart` is canonical.

Telegram may still have old internal callback data such as:

- `basket_view`
- `basket_clear`
- `basket_checkout`
- `basket_action_`
- `basket_remove_`

These callback names may stay temporarily for compatibility with existing Telegram inline buttons.

User-facing Telegram text should move from `basket` to `cart`.

### Order

Canonical term: `order`

Meaning:

A submitted cart after checkout.

Use:

- `customer_orders_v2`
- `customer_order_items_v2`
- `order_status`

### Order item

Canonical term: `order item`

Meaning:

A product inside an order.

Use:

- `customer_order_items_v2`

### Addition group

Canonical term: `addition group`

Meaning:

A grouped set of items added after initial checkout, or a grouped checkout batch.

Use:

- `order_addition_groups_v2`
- `initial_checkout`
- `delivery_pending_addition`
- `pickup_waiting_ready_confirmation`
- `scheduled_next_online_order_delivery`
- `scheduled_next_online_order_pickup`

### Checkout

Canonical term: `checkout`

Meaning:

The action that moves cart items into an order or order group.

Use:

- delivery checkout
- pickup checkout
- checkout address
- checkout pickup

### Fulfillment type

Canonical term: `fulfillment_type`

Allowed values:

- `delivery`
- `pickup`

Meaning:

How the customer receives the order.

### Order status

Canonical term: `order_status`

Meaning:

Overall lifecycle status of an order.

Examples:

- `submitted`
- `scheduled_for_next_online_order`
- `cancelled`
- `delivered`
- `not_delivered`
- `closed`

### Delivery status

Canonical term: `delivery_status`

Meaning:

Delivery-specific lifecycle state.

Examples:

- `not_started`
- `on_the_way`
- `delivered`
- `cancelled`
- `not_delivered`

Legacy/old terms to avoid:

- `ready_to_delivery`

### Pickup status

Canonical term: `pickup_status`

Meaning:

Pickup-specific lifecycle state.

Examples:

- `preparing`
- `ready_to_pickup`
- `picked_up`
- `cancelled`

UI label:

- `ready_to_pickup` should display as `Ready to pick up`.

### Pending admin approval

Canonical term: `pending_admin_approval`

Meaning:

A delivery addition is waiting for admin approval.

Use in:

- group status
- item status

### Waiting ready to pick up

Canonical term: `waiting_ready_to_pickup`

Meaning:

Pickup items are waiting until admin marks them ready.

UI label:

- `Waiting for pickup confirmation`

### Rejected

Canonical term: `rejected`

Meaning:

Admin rejected an addition group or item.

### Cancelled

Canonical term: `cancelled`

Meaning:

Order/group/item was cancelled and should not count as payable confirmed total.

### Scheduled

Canonical term: `scheduled_for_next_online_order`

Meaning:

Order/group/item is scheduled because online ordering is currently closed.

## Naming layers

### Database/API/internal code

Use canonical snake_case names.

Examples:

- `cart`
- `order`
- `order_status`
- `delivery_status`
- `pickup_status`
- `pending_admin_approval`
- `waiting_ready_to_pickup`

### UI text

Use readable labels.

Examples:

- `Your cart`
- `Edit cart`
- `Clear cart`
- `Ready to pick up`
- `Pending admin approval`
- `Waiting for pickup confirmation`

### Telegram callback data

Callback data may temporarily keep old names for compatibility.

Example:

- old callback: `basket_view`
- future callback: `cart_view`

During migration, support old callback names until old Telegram inline messages are no longer relevant.

## Migration checklist

1. Use `cart` in documentation from now.
2. Use `cart` in new code from now.
3. Change Telegram user-facing text from `basket` to `cart`.
4. Keep old `basket_*` callback data temporarily.
5. Rename old Telegram function names gradually after V2 migration points are stable.
6. Remove or alias old terminology only after affected flows are tested.
