# Development Strategy

## Direction

The project will be developed as an app-first, admin-first business system.

The main product is:

- Customer app
- Admin web/app
- Unified API
- Unified database
- Unified order/cart lifecycle

The Telegram bot is secondary. It should become a thin client that uses the same backend state and business rules as the apps.

## Core Principle

All clients must use the same backend meaning:

- same terminology
- same lifecycle
- same database state
- same validation rules
- same business rules

No client should have its own separate order/cart lifecycle.

## Priority Order

1. Backend/API correctness
2. Main admin web
3. Customer app
4. Admin app
5. Telegram bot

Telegram must not slow down the core app/admin/API development.

## Canonical Backend State

Canonical cart/order tables:

- customer_cart_sessions
- customer_cart_items_v2
- customer_orders_v2
- customer_order_items_v2
- order_addition_groups_v2
- customer_locations_v2

Legacy order/cart tables must not be used by active code:

- shopping_carts
- shopping_cart_items

## Main Admin Direction

`/admin` is the main admin web.

The existing `/admin` has substantial useful business functionality and should be modernized and developed as the real admin interface for the whole system.

`/admin-v2` is temporary only. It may be used as a reference if needed, but it is not a long-term testing surface and should not become a parallel admin system.

The goal is a sleek, capable system without unnecessary duplicate admin interfaces.

Final direction:

- merge useful `/admin-v2` order logic into `/admin`
- remove `/admin-v2` when it is no longer needed
- keep one main admin web

## Customer App Direction

The customer app should be the main ordering experience.

Required core flow:

- browse products
- filter by categories
- add to cart
- edit cart
- checkout pickup/delivery
- validate delivery address
- enforce allowed delivery cities
- create V2 orders
- show order status
- support additions to existing orders
- support cancellation rules

## Admin Operations Direction

Admin web/app must support:

- view new/open orders
- view closed/cancelled/not-delivered orders
- approve/reject additions
- mark pickup ready
- mark delivery on the way
- mark delivered
- mark not delivered
- cancel orders
- view customer details
- view customer locations
- manage products
- manage product categories
- manage aliases
- manage meeting points
- manage delivery cities
- manage fulfillment settings
- manage bot/app settings where needed

## Telegram Bot Direction

Telegram bot is useful but secondary.

It should not have its own special lifecycle or independent business rules.

When developed further, it must use the same backend behavior as the apps:

- same cart tables
- same order tables
- same location validation
- same delivery city validation
- same checkout rules
- same admin lifecycle

Bot-specific UX is allowed. Bot-specific backend state/lifecycle is not.

## Delivery Rule

Delivery city/location validation must be enforced by backend logic.

No client may bypass delivery rules.

If allowed delivery cities are Berlin and Potsdam, a Koh Phangan location must not create or progress a delivery order.

The backend must reject invalid delivery locations before admin delivery workflow starts.

## Working Method

Each development slice should follow this workflow:

1. inspect current code
2. patch the smallest coherent part
3. run syntax check
4. run grep checks for old terminology/state
5. commit
6. push
7. deploy only after commit when needed
8. live smoke test
9. move to next slice

## Current Known Bot Defects To Revisit Later

These are known but should not redirect the whole project back to bot-first development:

- product click cart feedback needs verification
- Telegram product/category pagination needs verification
- delivery city validation was bypassed by a Koh Phangan map location
- admin delivery ETA flow can show "No active V2 delivery order found for this customer"
- bot delivery flow must be re-aligned with V2 backend rules after core admin/app flow is stable

## Decision

From this point forward, development should avoid creating parallel systems.

When a temporary system exists, it should be either merged into the main system or removed.

The target is one sleek, capable backend and one main admin interface.
