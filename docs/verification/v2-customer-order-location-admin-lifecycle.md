# V2 Customer Order / Location / Admin Lifecycle Verification

## Scope

This verification covers the V2 customer ordering flow across:

- Backend V2 cart/order/location tables
- Telegram Mini App customer flow
- Telegram bot customer flow
- Android shared customer API client
- Apple shared customer API client
- Admin API lifecycle
- Admin web form lifecycle

## Verified production deployment

Production domain:

https://crm.ayartuerk.me

Latest verified Worker deployment:

b32f5ee3-04d5-4b6d-8591-b84054ab0eb6

Verified commit:

97500fe Align web admin pickup lifecycle with API

## Verified commits in this lifecycle track

97500fe Align web admin pickup lifecycle with API
546dc34 Add mobile customer location API parity
16d8536 Add Mini App save delivery location button
e05769d Add Mini App delivery location flow
2a6b7cb Fill active cart order customer mapping
ce4dddc Fix customer app language and order customer mapping
b1fbe79 Wire Telegram Mini App customer UI parity flows
53bb422 Add Telegram Mini App customer API parity methods
0dbdbd2 Add Apple customer API parity methods
0575225 Add Android customer API parity methods
6318059 Consolidate V2 customer cart order and location flows

## Core V2 tables covered

customer_cart_sessions
customer_cart_items_v2
customer_orders_v2
customer_order_items_v2
customer_order_status_history_v2
customer_locations_v2

## Live production test result

{
  "delivery_order_id": 16,
  "pickup_order_id": 17,
  "location_id": 10,
  "delivery_customer": "admin_web_delivery_test_1783602836",
  "pickup_customer": "admin_web_pickup_test_1783602838",
  "api_admin_lifecycle_verification": "passed",
  "web_admin_pickup_lifecycle_verification": "passed"
}

## Confirmed live behavior

### Customer / catalog

Public catalog works
Customer session start works
Cart item add works
Saved customer location creation works
Delivery checkout with saved_location_id works
Pickup checkout works

### Delivery lifecycle

Delivery order appears in admin API list
Admin API detail shows fulfillment_type = delivery
Admin API detail shows correct delivery_location_id
Admin API on-the-way action works
Customer order detail shows delivery_status = on_the_way
Admin API cancel action works
Cancelled delivery order shows order_status = cancelled

### Pickup lifecycle

Pickup order appears in admin API list
Admin API detail shows fulfillment_type = pickup
Admin web form route /admin/orders/{id}/status accepts ready_to_pickup
Web admin ready-to-pickup updates V2 pickup_status
Customer order detail shows pickup_status = ready_to_pickup

## Important consistency fix

The web admin ready-to-pickup path was aligned with the API admin ready-to-pickup path.

The web admin path now:

Confirms waiting_ready_to_pickup groups
Confirms waiting_ready_to_pickup items
Sets pickup_status = ready_to_pickup
Normalizes draft order/status to submitted
Updates confirmed total
Adds V2 order history
Notifies customer

## Current verified status

Backend V2 order/cart/location model: verified
Telegram bot customer location/order flow: verified
Telegram Mini App location/order flow: verified
Android shared API parity: verified
Apple shared API parity: verified
Admin API lifecycle: verified
Admin web pickup lifecycle: verified
Production smoke test: passed

## Repeatable production verification command

Set real admin credentials before running.

cd ~/Developer/CRM_Project_Dealer

export ADMIN_USERNAME='admin'
export ADMIN_PASSWORD='REPLACE_WITH_REAL_PASSWORD'

Then run the production API + WEB admin lifecycle script from the project notes/conversation.

## Manual admin UI checklist

Open:

https://crm.ayartuerk.me/admin/orders

Check:

Delivery orders show fulfillment type clearly
Pickup orders show fulfillment type clearly
Delivery orders show delivery location and map link
Delivery action buttons appear only when valid
Pickup action buttons appear only when valid
Cancel button is not shown for already cancelled/closed orders
Ready-to-pickup works from web admin UI
On-the-way works from admin lifecycle
Closed/cancelled orders are separated correctly

## Repo cleanliness note

Expected untracked verification folders may remain local:

verification/android/
verification/ios/

Only committed files should be added intentionally.
