# CRM Delivery

Telegram-first CRM and delivery coordination system for customer message handling, product requests, customer delivery locations, admin notifications, working-hours control, admin-side request tracking, and admin-to-customer replies.

Production admin URL:

    https://crm.ayartuerk.me/admin/

Open Requests URL:

    https://crm.ayartuerk.me/admin/openrequests/

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
- Quantity extraction from customer messages
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
- Superadmin Telegram takeover command
- Responsive admin UI for desktop and mobile

## Admin URLs

Admin login:

    https://crm.ayartuerk.me/admin/login

Admin dashboard / General settings:

    https://crm.ayartuerk.me/admin/

Open Requests:

    https://crm.ayartuerk.me/admin/openrequests/

Products:

    https://crm.ayartuerk.me/admin/products

Meeting Points:

    https://crm.ayartuerk.me/admin/meeting-points

AI Info:

    https://crm.ayartuerk.me/admin/ai

Customers:

    https://crm.ayartuerk.me/admin/customers

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

Main tables:

- app_settings
- customers
- messages
- products
- product_aliases
- meeting_points
- customer_requests
- learned_patterns
- customer_locations

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

## Product logic

Product list requests are allowed even outside working hours.

Product list requests are not stored in Structured Requests.

Specific product requests are detected through:

- product names
- product aliases
- automatic aliases
- manual aliases
- spelling variants
- fuzzy matching

Product request notifications include:

- customer name
- Telegram ID
- requested product
- quantity
- original message

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

Admin receives delivery ETA buttons.

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

## Known active development items

Next planned work:

- product-order delivery choice flow:
  - use preferred location
  - enter new location
  - collect from our location
- customer order approval button
- order closed / added-order handling
- admin approval for added orders
- stronger full fuzzy matching for addresses if local street datasets are added later
