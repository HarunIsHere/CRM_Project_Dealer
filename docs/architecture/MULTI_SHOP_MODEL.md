# Multi-Shop Customer, Order, and Payment Model

## Core Decision

The system is multi-shop from the start.

A customer has one global account/session and can belong to many shops.

Customers can shop in two ways:

1. Browse and choose shops directly.
2. Use preferred providers by category, for example:
   - meat provider: Shop A
   - produce provider: Shop B
   - bakery provider: Shop C

Both shopping modes share one customer basket until checkout.

## Customer Model

Customer:
- can join many shops
- can add shops by QR code, Telegram bot link, Telegram mini-app link, Android deep link, or Apple deep link
- can choose an active shop/context
- can set preferred shops/providers by category
- can have one active basket containing items from multiple shops
- can configure available/preferred payment methods in their profile

## Admin Model

Super admin:
- can access all shops
- can access all customers
- can access all orders
- can manage global settings
- can manage global/default payment method settings

Shop admin:
- can own/manage one or more shops
- can manage products for their shops
- can see customers connected to their shops
- can see and process order parts belonging to their shops
- can toggle payment methods for each shop
- can override payment rules for specific customers if needed

## Canonical Tenant Authorization

Identity and shop authorization are intentionally separate:

- `auth_accounts` is the person shared by Web, Android, Apple, Telegram Mini
  App, and Telegram Bot.
- `admin_users` is a platform-staff profile and remains the source of
  Superadmin authority.
- `shop_memberships` grants `owner`, `manager`, or `staff` authority for one
  shop.
- `customer_shop_memberships` records a customer's commercial relationship
  with a shop and never grants administrative authority.

A customer account may become a shop owner without creating a second login.
Existing `admin_shop_access` rows are compatibility data and are backfilled to
canonical memberships while older clients are migrated.

## Shop Onboarding

The initial release remains invitation/approval controlled. The schema also
supports a later self-service flow:

1. an authenticated customer prepares one draft application;
2. the customer submits it for review;
3. a Superadmin approves or rejects it;
4. approval creates a `member_owned` shop;
5. the applicant receives the active `owner` membership;
6. all clients immediately see the same shop and permissions through the
   shared backend.

Only one draft or pending application is allowed per account. Approval and
membership changes are server-authoritative.

## Payment Model

Payment methods are supported from the start.

Payment configuration exists at multiple levels:
- global default payment methods
- shop-specific payment methods
- customer profile payment methods
- customer-specific admin overrides, if needed later

Examples:
- cash on delivery
- cash on pickup
- bank transfer
- card/payment link later
- unified digital payment later

Small shops may be cash-only, so cash must be treated as a first-class payment method.

## Payment Compatibility

A product/shop is payable only if there is an intersection between:
- payment methods allowed by the shop
- payment methods available/accepted by the customer

If there is no intersection:
- the customer should still be able to see the product/shop
- the UI should show a clear warning
- the UI should link the customer to payment method setup in their profile

## Basket Model

One basket can contain items from multiple shops.

Each basket item must keep:
- product_id
- shop_id
- quantity
- price snapshot
- product name snapshot
- payment method compatibility status

## Checkout Model

One checkout creates:
- one parent order for the customer
- one or more shop order parts grouped by shop

The customer sees one shopping experience.

Internally, each shop is responsible for its own order part.

At checkout, the customer must see:
- amount to pay per shop
- payment method per shop/order part
- cash amount per shop/order part
- total cash amount for the whole checkout
- total order amount

## Fulfillment Decision

First version:
- shops handle their own order parts separately
- delivery/pickup coordination can stay simple
- unified customer checkout exists before advanced logistics
- digital payment unification is postponed

Later:
- route planning
- combined delivery
- picker/shop communication
- live preparation camera
- product-specific modification flow
- unified digital payment
