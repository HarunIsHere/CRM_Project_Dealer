# ADR-0006: Canonical Shop Tenancy and Self-Service Onboarding

## Status

Accepted.

## Decision

Authentication accounts, platform privileges, and shop privileges are separate.

- `auth_accounts` identifies a person across supported clients.
- `admin_users` continues to represent platform staff, including Superadmins.
- `shops` represents a business tenant.
- `shop_memberships` grants a canonical account a shop-scoped `owner`,
  `manager`, or `staff` role.
- `shop_applications` records the future self-service shop-opening workflow.
- `customer_shop_memberships` remains the customer's commercial relationship
  with a shop; it is not an authorization grant.
- `admin_shop_access` remains temporarily for compatibility and is backfilled
  into canonical memberships. New authorization work must target
  `shop_memberships`.

A customer account may later apply to open a shop. Approval creates a
`member_owned` shop and an active owner membership for the same canonical
account. The person does not need a second identity merely to operate a shop.

Superadmin remains a platform role. Global platform access must not be modeled
as membership in every shop.

## Initial rollout

Self-service application routes remain disabled initially. Existing shops and
admin behavior continue unchanged. The first rollout only establishes the
schema, backfills existing database-backed shop access, and defines the shared
authorization model.

Later phases add:

1. customer shop-application submission;
2. Superadmin review and approval;
3. owner-managed invitations and memberships;
4. shop-scoped product, order, payment, and customer authorization;
5. synchronized Web, Android, Apple, Telegram Mini App, and Bot experiences.

## Authorization rule

Every shop-scoped mutation must resolve the authenticated canonical account,
then require an active membership with a sufficient shop role. Client-provided
roles or shop ownership claims are never authoritative.
