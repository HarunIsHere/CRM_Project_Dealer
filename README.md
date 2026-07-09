# CRM Delivery

Telegram-first CRM and delivery coordination system for customer message handling, product requests, customer delivery locations, admin notifications, working-hours control, admin-side request tracking, and admin-to-customer replies.

Production admin URL:

    https://crm.ayartuerk.me/admin/

Orders URL:

    https://crm.ayartuerk.me/admin/orders

Closed Orders URL:

    https://crm.ayartuerk.me/admin/closedorders

Open Requests URL:

    https://crm.ayartuerk.me/admin/openrequests/

Superadmin URL:

    https://crm.ayartuerk.me/admin/superadmin

Bot:

    Delivery Bot
    @SpecialDeliveryBerlinBot

Direct bot link:

    https://t.me/SpecialDeliveryBerlinBot

## Current status

The current production system is deployed as a Cloudflare Worker with Cloudflare D1.

Current public path:

    crm.ayartuerk.me -> Cloudflare Worker -> Cloudflare D1

Current Worker:

    crm-delivery-worker

Current D1 database:

    crm-delivery-db

Current Telegram webhook:

    https://crm.ayartuerk.me/telegram/webhook

The old local FastAPI + SQLite + Cloudflare Tunnel version is deprecated. The active system is the Cloudflare Worker implementation.

## Stack

- Cloudflare Workers
- Cloudflare D1
- JavaScript Worker runtime
- Telegram Bot API
- Nominatim / OpenStreetMap geocoding for typed address search
- Admin web UI rendered by the Worker
- Optional OpenAI fallback / AI learning features

## Main features

- Telegram customer message intake
- Rule-based replies
- Optional AI fallback replies
- AI Info page
- AI learned-pattern approval/rejection/deletion
- Multilingual support:
  - English
  - German
  - Turkish
  - Arabic
  - Russian
- Language selection buttons when language is unclear
- Product list replies
- Specific product request detection
- Product aliases
- Automatic product alias generation
- Manual product alias editing from admin dashboard
- Product fuzzy matching
- Product admin page with add/update/delete controls
- Product categories
- Quantity extraction from customer messages
- Shopping basket/cart flow
- Basket view with item totals and order total
- Basket item quantity change/remove flow
- Checkout flow from basket
- Order status tracking from basket to delivery/closure
- Admin Orders page
- Admin Closed Orders page
- Admin can change order status from web dashboard
- Admin can mark delivered orders from web dashboard
- Admin can return closed orders back to active order list as not delivered
- Telegram admin `/o` command for closable orders
- Product request notifications to admin
- Admin reply button in Telegram notifications
- Admin can reply to customers directly through Telegram bot
- Admin can reply to customers from web dashboard
- Customer conversation history
- Customer detail page
- Message Customer popup on Customers page
- Structured customer requests
- Customer Locations tab
- Open Requests page with AJAX table refresh
- Working-hours restrictions
- Auto working-hours message mode
- Custom free-text closed-hours message mode
- Fulfillment / Location Options in General settings
- Delivery city allow-list in General settings
- Meeting point/location management
- Customer can choose active meeting point
- Customer can type address
- Address search is restricted to admin-approved delivery cities
- Address search supports German street typo correction/fallback search
- Address search filters by postal code when present
- Customer can share Telegram location
- Customer can mark a saved location as preferred
- Admin receives clickable Google Maps link
- Delivery ETA buttons for admin
- Admin dashboard login
- Change password page
- Forgot password flow with 5-digit Telegram reset code
- Superadmin web login
- Superadmin admin-management page
- Superadmin can create, deny/grant access, and delete database-backed admin credentials
- Superadmin audit logs for website login/action data, kept for 30 days
- Superadmin Telegram takeover command
- Responsive admin UI for desktop and mobile

## Admin URLs

Admin login:

    https://crm.ayartuerk.me/admin/login

Admin dashboard / General settings:

    https://crm.ayartuerk.me/admin/

Open Requests:

    https://crm.ayartuerk.me/admin/openrequests/

Orders:

    https://crm.ayartuerk.me/admin/orders

Closed Orders:

    https://crm.ayartuerk.me/admin/closedorders

Products:

    https://crm.ayartuerk.me/admin/products

Meeting Points:

    https://crm.ayartuerk.me/admin/meeting-points

AI Info:

    https://crm.ayartuerk.me/admin/ai

Customers:

    https://crm.ayartuerk.me/admin/customers

Superadmin:

    https://crm.ayartuerk.me/admin/superadmin

Customer detail pages:

    https://crm.ayartuerk.me/admin/customers/<customer_id>

## Telegram admin setup

Normal admin setup command:

    /setadmin <ADMIN_SETUP_CODE>

Example:

    /setadmin Selchower

This saves the sender's Telegram chat ID as the active admin notification receiver.

After successful setup, the bot sends clickable buttons for:

- Open Admin Web Panel
- Open Requests

Admin web shortcut command:

    /w

Only the active admin Telegram receiver can use this command.

Admin closable-orders command:

    /o

Only the active admin Telegram receiver can use this command.

`/o` lists orders that can be quickly closed from Telegram:

- all orders with status `on_the_way`
- orders with status `ready_to_delivery` only when the customer chose/approved one of our own meeting points

Each listed order has a `Delivered #<order_id>` button. Pressing it marks only that order as `delivered`, moves it to Closed Orders, notifies the customer, and refreshes the Telegram order list.

Superadmin takeover command:

    /setsuperadmin <SUPERADMIN_BOT_SETUP_CODE>

This allows the superadmin to take over the active admin Telegram receiver.

## Cloudflare configuration

`cloudflare-worker/wrangler.toml` defines:

    name = "crm-delivery-worker"
    main = "src/index.js"
    compatibility_date = "2026-06-01"

Custom domain route:

    crm.ayartuerk.me/*

Required D1 binding:

    DB -> crm-delivery-db

Current public admin URL variable:

    ADMIN_WEB_URL = "https://crm.ayartuerk.me/admin"

## Required Worker secrets

Set these with `wrangler secret put`:

    TELEGRAM_BOT_TOKEN
    TELEGRAM_WEBHOOK_SECRET
    ADMIN_USERNAME
    ADMIN_PASSWORD
    ADMIN_JWT_SECRET
    ADMIN_SETUP_CODE
    SUPERADMIN_USERNAME
    SUPERADMIN_PASSWORD
    SUPERADMIN_BOT_SETUP_CODE

Optional, only if AI fallback is used:

    OPENAI_API_KEY

## Deployment

From the Worker project directory:

    cd cloudflare-worker
    node --check src/index.js
    npm run deploy

Apply D1 migrations remotely:

    npx wrangler d1 migrations apply crm-delivery-db --remote

Tail production logs:

    npx wrangler tail crm-delivery-worker

Expected Telegram webhook log line:

    POST https://crm.ayartuerk.me/telegram/webhook - Ok

## Telegram webhook

Current webhook target:

    https://crm.ayartuerk.me/telegram/webhook

Check webhook info:

    curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

Set webhook:

    curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
      -d "url=https://crm.ayartuerk.me/telegram/webhook" \
      -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

## Database schema

Current migration files:

    cloudflare-worker/migrations/0001_initial_schema.sql
    cloudflare-worker/migrations/0002_ai_learning_patterns.sql
    cloudflare-worker/migrations/0003_customer_locations.sql
    cloudflare-worker/migrations/0004_product_categories_cart_orders.sql
    cloudflare-worker/migrations/0005_shopping_cart.sql
    cloudflare-worker/migrations/0006_order_status_fields.sql
    cloudflare-worker/migrations/0007_admin_users_and_audit_logs.sql

Main tables:

- app_settings
- customers
- messages
- products
- product_categories
- product_aliases
- meeting_points
- customer_requests
- learned_patterns
- customer_locations
- shopping_carts
- shopping_cart_items
- admin_users
- admin_audit_logs

`shopping_carts` is also the order-status base. It tracks basket/order lifecycle with:

- `status`
- `order_status`
- `delivery_location_label`
- `delivery_google_maps_link`
- `delivery_note`
- `delivered_at`
- `closed_at`
- `admin_status_note`

## Authentication

Admin login supports:

1. Normal admin credentials:

       ADMIN_USERNAME + current admin password

2. Superadmin credentials:

       SUPERADMIN_USERNAME + SUPERADMIN_PASSWORD

Admin password can be changed from the web dashboard.

Changed admin password is stored as a database setting:

    admin_password_override

If no override exists, the app uses `ADMIN_PASSWORD` from Worker secrets.

Superadmin page:

    /admin/superadmin

Superadmin can manage database-backed admin credentials:

- create admin
- create superadmin
- deny/grant access
- delete credential

Env-protected admin accounts are visible but not editable/deletable from the web UI.

The currently logged-in superadmin cannot deny or delete their own access.

Website login/action audit logs are stored in:

    admin_audit_logs

Only the last 30 days are kept. Older records are deleted during admin page access.

## Working hours

Admin can enable/disable working-hours restrictions.

Settings:

- timezone
- start time
- end time
- message mode
- custom closed message

Outside working hours:

Allowed:

- Product List
- Contact admin

Blocked:

- product-specific orders
- delivery location
- meeting point choice
- typed address
- customer shared location

## Product and basket logic

Product list requests are allowed even outside working hours.

Product list requests are not stored in Structured Requests.

Specific product requests are detected through:

- product names
- product aliases
- automatic aliases
- manual aliases
- spelling variants
- fuzzy matching

Product request / basket behavior:

1. Customer sends a product name or alias.
2. If no quantity is detected, bot asks for quantity.
3. When quantity is known, product is added to the customer's active basket.
4. Bot replies with unit price, quantity, line total, basket options, and checkout option.
5. Basket view shows products, quantities, per-line totals, and order total.
6. Customer can continue shopping, checkout, clear basket, or edit/remove an item.
7. After a delivered order, new product messages create a new basket/order instead of reopening the delivered one.

## Product aliases

Product aliases are stored in:

    product_aliases

Automatic aliases are generated from product names.

Example product:

    Güllü Dogan

Generated aliases include:

    güllü dogan
    gullu dogan
    güllü
    gullu
    dogan

Admin can edit aliases manually in the product section.

Manual aliases are comma-separated.

## Fulfillment and location options

General settings include fulfillment/location options:

- allow delivery to preferred customer location
- allow delivery to a new customer location
- allow customer pickup from business/meeting point

These settings are used by the product-order delivery flow.

## Delivery cities

General settings include a Delivery Cities section.

Default city:

    Berlin

Address suggestions are restricted to the admin-approved delivery city list.

If the customer clearly enters another city, the bot replies that delivery is not possible in that city yet and offers:

- Contact admin to describe location
- Cancel location entry

## Order statuses

Order statuses are stored in `shopping_carts.order_status`.

Statuses:

- `in_progress`
- `waiting_location`
- `ready_to_delivery`
- `on_the_way`
- `not_delivered`
- `delivered`

Status flow:

1. `in_progress`
   - starts when customer adds the first item to the basket
   - remains while there is at least one item in the basket and checkout has not progressed

2. `waiting_location`
   - starts when customer presses checkout
   - customer can type address, contact admin to describe location, see our meeting points, or cancel location entry

3. `ready_to_delivery`
   - starts after customer chooses or confirms a location
   - typed address, Telegram shared location, free-text location description, and approved meeting-point pickup can all lead here

4. `on_the_way`
   - starts when admin sends an ETA

5. `not_delivered`
   - starts when admin selects no delivery or returns a closed order to active list

6. `delivered`
   - starts when admin marks order delivered
   - delivered orders move from `/admin/orders` to `/admin/closedorders`

## Admin Orders page

Orders page:

    /admin/orders

Shows non-delivered orders with:

- order ID
- customer
- status
- items
- total
- location/map
- created/updated time
- status update controls
- delivered button

Admin can change order status from this page. When status is changed, the customer receives a matching multilingual message and relevant next-step buttons when applicable.

## Closed Orders page

Closed Orders page:

    /admin/closedorders

Shows delivered orders with the full order information.

Closed orders can be returned to the active Orders page. Returning a closed order changes its status to `not_delivered` and notifies the customer.

## Checkout location flow

Checkout starts from the basket.

Customer receives options to:

- type delivery address
- contact admin to describe location
- see our locations
- cancel location entry

Typed address flow:

1. Customer types address.
2. System searches locations through Nominatim.
3. Search is restricted to allowed delivery cities.
4. If a postal code is present, results must match that postal code.
5. German street typo variants are corrected before fallback search.
6. Bot shows up to 7 address choices.
7. Customer selects one.
8. Location is stored in `customer_locations`.
9. Order becomes `ready_to_delivery`.
10. Bot asks whether to save it as preferred location.
11. Admin receives clickable Google Maps location.

Contact-admin location description flow:

1. Customer presses Contact admin to describe location.
2. Bot asks customer to type location description.
3. Open request is created when the customer sends the description.
4. Admin receives the description.
5. Order becomes `ready_to_delivery` after customer sends the description.

Our-location / meeting-point flow:

1. Customer presses See our locations.
2. Bot shows active meeting points or directly shows the only active meeting point.
3. Customer must approve delivery/pickup at our location.
4. No Open Request is created before approval.
5. After approval, Open Request is created, order becomes `ready_to_delivery`, and `delivery_note = our_meeting_point_approved`.
6. These pickup-ready orders are visible through admin Telegram `/o`.

Cancel location entry:

- customer returns to `in_progress`
- order remains active

## Location and delivery logic

There are two different location concepts:

1. Business/meeting points configured by admin
2. Customer delivery locations shared/selected by customer

### Business meeting points

Admin manages meeting points from the dashboard.

Each meeting point has:

- name
- address
- Google Maps link
- active/inactive status
- preferred status

Customer location option shows active locations.

If there is more than one active location:

- customer receives buttons
- preferred location is marked Preferred

If there is only one active location:

- customer receives it directly

### Customer delivery locations

Customer can send delivery location in two ways:

1. Share Telegram location directly
2. Use Type address flow

Typed address flow:

1. Customer chooses Type address.
2. Bot asks customer to type address.
3. System searches locations through Nominatim.
4. Search is restricted to allowed delivery cities.
5. If a postal code is present, results must match that postal code.
6. German street typo variants are corrected before fallback search.
7. Bot shows up to 7 address choices.
8. Customer selects one.
9. Location is stored in `customer_locations`.
10. Bot asks whether to save it as preferred location.
11. Admin receives clickable Google Maps location.
12. Open Requests and Structured Requests show the map link.

Customer shared Telegram location flow:

1. Customer shares Telegram location.
2. Location is stored in `customer_locations`.
3. Bot asks whether to save it as preferred location.
4. Admin receives clickable Google Maps location.

Admin receives the customer's basket directly in the Telegram delivery-location notification, followed by location/map and delivery ETA buttons.

When admin clicks an ETA button, customer receives an automatic message.

Example:

    Delivery will be done to your location in 30 min.

No delivery example:

    Sorry, delivery is not possible for this location.

## Open Requests

Open Requests page:

    /admin/openrequests/

Partial AJAX endpoint:

    /admin/open-requests

Open Requests page uses AJAX refresh and does not reload the whole page.

Open Requests are admin-actionable rows only. For our-location / meeting-point flow, the row is created only after the customer approves delivery at that location. Asking for location alone should not create an Open Request.

Individual Done and All Done both mark matching requests as `done` and keep the admin on `/admin/openrequests/`.

## Customer detail page

Customer detail page includes:

- compact customer info section
- Structured Requests tab
- Customer Locations tab
- Conversation History tab
- Message Customer action

Customer Locations tab shows:

- stored location ID
- description/address
- latitude
- longitude
- Google Maps link
- source
- preferred status
- created time



## Current Android and domain direction

Two Android apps are now part of the active project direction:

1. Admin Android App
2. Customer Android App

The Android apps must be built in parallel with the existing Telegram bot and current admin web UI.

Production rule:

- Telegram must continue working.
- The current admin web system must continue working.
- Do not create a separate Android webhook.
- Do not create a separate Android backend/database.
- Telegram, admin web, Admin Android App, and Customer Android App must use the same Cloudflare Worker backend and the same Cloudflare D1 database.
- Add versioned API endpoints under `/api/v1/...` for Android and future clients.
- Keep the current Telegram webhook unchanged:

    https://crm.ayartuerk.me/telegram/webhook

Domain direction:

- Keep `crm.ayartuerk.me/admin` working during transition.
- Carry/expose the admin system on `horizend.com`.
- Do not move Telegram to a separate webhook while building Android apps.

Implementation order:

1. Build backend API foundation first.
2. Add Admin App APIs.
3. Add Customer App APIs.
4. Start Android UI only after the first API contract is stable.

Android roadmap:

    docs/ANDROID_APPS_ROADMAP.md

## Development notes

Current active implementation:

    cloudflare-worker/src/index.js

Deployment target:

    crm-delivery-worker

D1 database:

    crm-delivery-db

Current known cleanup item:

- Do not commit temporary backup files. Remove `cloudflare-worker/src/index.js.backup_*` before committing.

Potential future work:

- stronger full fuzzy matching for addresses if local street datasets are added later
- optional analytics dashboard
- optional richer order filtering/search on admin order pages

## V2 customer app order/location lifecycle

The active customer ordering implementation now uses the V2 customer cart/order/location model.

V2 tables:

- customer_cart_sessions
- customer_cart_items_v2
- customer_orders_v2
- customer_order_items_v2
- customer_order_status_history_v2
- customer_locations_v2

Current verified V2 lifecycle commit:

    97500fe Align web admin pickup lifecycle with API

Current verification documentation commit:

    73db513 Document V2 customer lifecycle verification

Latest verified Worker deployment:

    b32f5ee3-04d5-4b6d-8591-b84054ab0eb6

Verified live production lifecycle:

- public catalog
- customer session start
- cart item add
- saved customer delivery location creation
- delivery checkout with saved_location_id
- pickup checkout
- admin API customer-app order list/detail
- admin API delivery on-the-way
- customer sees delivery_status = on_the_way
- admin web ready-to-pickup form route
- customer sees pickup_status = ready_to_pickup after web admin action
- admin API cancel delivery order

Latest live production test result:

    delivery_order_id: 16
    pickup_order_id: 17
    location_id: 10
    api_admin_lifecycle_verification: passed
    web_admin_pickup_lifecycle_verification: passed

Detailed verification note:

    docs/verification/v2-customer-order-location-admin-lifecycle.md

Important implementation rule:

- Telegram, Telegram Mini App, Android shared API, Apple shared API, admin API, and admin web must stay aligned on the same V2 backend lifecycle.
- Admin web routes under /admin/orders and API routes under /api/v1/admin/customer-app-orders must remain behaviorally consistent.
