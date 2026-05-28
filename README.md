# CRM Project Dealer

Telegram-first CRM automation system for customer message handling, product requests, meeting-point/location replies, admin notifications, working-hours restrictions, and admin-side request tracking.

Public admin URL:

https://crm.ayartuerk.me/admin/

The root domain https://ayartuerk.me is not used for this app because it already serves another website. The CRM runs separately through the subdomain crm.ayartuerk.me.

## Repository

https://github.com/HarunIsHere/CRM_Project_Dealer.git

## Current status

The system is currently deployed from a local Mac using FastAPI, Telegram polling, and Cloudflare Tunnel.

Public path:

    crm.ayartuerk.me -> Cloudflare Tunnel -> 127.0.0.1:8001 -> FastAPI app

The app and tunnel are started automatically on macOS login through LaunchAgents.

## Main features

- Telegram customer message intake
- Rule-based replies
- Fuzzy product and keyword matching with RapidFuzz
- Product list replies
- Specific product request detection
- Quantity extraction from customer messages
- Product request notifications to admin
- Meeting-point/location replies with Google Maps links
- Location availability and change notification logic
- Working-hours restrictions
- Admin Telegram notifications for unresolved messages
- Admin Telegram notifications when location is needed
- Admin dashboard protected by JWT-cookie login
- Product add/update/delete from admin dashboard
- Meeting point add/update/delete/default management
- Admin reply panel for replying directly to Telegram customers
- Structured customer request logging
- Open Requests dashboard table
- Request status management: new, in_progress, done
- Grouped open requests with summed quantities/request counts
- Done button per grouped request
- All Done button for clearing all open requests
- Customer conversation history
- Telegram inline buttons for unresolved messages:
  - 1. Products
  - 2. Location
  - 3. Contact admin

## Tech stack

- Python
- FastAPI
- SQLAlchemy
- SQLite
- Jinja2 templates
- python-telegram-bot
- RapidFuzz
- Cloudflare Tunnel
- macOS LaunchAgents

## Local app

The FastAPI app runs locally on:

    http://127.0.0.1:8001

Manual start:

    ~/bin/run_crm_app.sh

Project startup script:

    scripts/run_crm_app.sh

Direct Uvicorn command:

    uvicorn app.main:app --host 127.0.0.1 --port 8001

## Cloudflare Tunnel

Public hostname:

    crm.ayartuerk.me

Tunnel name:

    crm-dealer

Tunnel config:

    ~/.cloudflared/crm-dealer.yml

Manual start:

    ~/bin/run_crm_tunnel.sh

Project startup script:

    scripts/run_crm_tunnel.sh

## macOS auto-start

The app and tunnel run through LaunchAgents.

App LaunchAgent:

    ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist

Tunnel LaunchAgent:

    ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist

Check status:

    launchctl print gui/$(id -u)/com.harun.crm-dealer-app | grep state
    launchctl print gui/$(id -u)/com.harun.crm-dealer-tunnel | grep state

Expected:

    state = running
    state = running

Restart app:

    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist

Restart tunnel:

    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist

## Logs

App logs:

    /tmp/crm-dealer-app.out.log
    /tmp/crm-dealer-app.err.log

Tunnel logs:

    /tmp/crm-dealer-tunnel.out.log
    /tmp/crm-dealer-tunnel.err.log

Check latest app errors:

    tail -120 /tmp/crm-dealer-app.err.log

## Environment variables

Required in `.env` and not committed:

    TELEGRAM_BOT_TOKEN=
    ADMIN_USERNAME=
    ADMIN_PASSWORD=
    ADMIN_JWT_SECRET=

The app refuses to start if admin credentials or JWT secret are missing or weak.

## Admin authentication

Admin login:

    https://crm.ayartuerk.me/admin/login

Authentication uses a JWT stored in an HTTP-only cookie.

The admin dashboard is protected. Admin routes check authentication before allowing access.

## Admin dashboard

Admin dashboard URL:

    https://crm.ayartuerk.me/admin/

Dashboard sections include:

- Open Requests
- Notification Settings
- Working Hours
- Products
- Meeting Points
- Customers

The Open Requests table auto-refreshes every 10 seconds so new requests become visible without manual browser refresh.

## Open Requests logic

Open Requests is a grouped operational table for unresolved or active customer needs.

It is not the raw request history. Raw history remains visible in each customer's Structured Requests table.

Open Requests grouping rules:

- product_list is hidden from Open Requests
- product_specific is grouped by customer + product name
- location is grouped by customer
- contact_admin is grouped by customer
- done requests are hidden from Open Requests

For product_specific:

- same customer + same product appears once
- quantities are summed
- latest text and latest timestamp are shown
- Answer button is available
- Done button marks all matching open product rows as done

For location:

- same customer appears once
- request count is summed
- Answer button is available
- Done button marks all matching open location rows as done
- once marked done, customer no longer receives future location-change notifications for that request group

For contact_admin:

- same customer appears once
- request count is summed
- Answer button is available
- Done button marks all matching open contact_admin rows as done

The All Done button next to the Open Requests headline marks all open customer requests as done and clears the table.

## Customer Structured Requests logic

Each customer page contains a Structured Requests table.

Customer detail page:

    /admin/customers/<customer_id>

Structured Requests stores raw request rows and keeps historical visibility.

Tracked fields include:

- ID
- Type
- Item
- Status
- Quantity
- Text
- Created At
- Action/status update

Request statuses:

- new
- in_progress
- done

Admin can update request status manually from the customer page.

When a grouped request is marked done from Open Requests, all matching raw structured request rows are also marked done.

## Product list request logic

When the customer asks for product list, for example:

    products
    product
    ürünler
    1

The bot sends the active product list.

Product list requests are logged in the customer's Structured Requests table as product_list.

Product list requests do not appear in Open Requests because they usually do not require admin action.

## Specific product request logic

When the customer asks for a specific product, for example:

    I want 3 gullu
    2 güllü gönder
    gullu lazim

The system:

1. Detects the product using fuzzy matching.
2. Extracts quantity if present.
3. Sends the product price to the customer.
4. Logs a structured request as product_specific.
5. Stores the matched product name in item_name.
6. Stores the extracted quantity.
7. Sends a Product request notification to admin.

Admin notification example:

    Product request:

    Customer: Aron
    Telegram ID: 8180717054
    Product: Güllü Dogan
    Quantity: 3
    Message: 3 güllü gönder

Open Requests behavior:

- repeated requests for the same customer + same product are grouped
- quantity is summed
- one row stays visible until admin marks it done

Example:

Customer sends:

    I want 2 güllü
    I want 5 güllü

Open Requests shows one Güllü Dogan row with quantity 7.

## Product basket / cumulative total logic

Planned/next-stage logic:

When a customer requests multiple products in the same message or consecutive product messages, the bot should maintain an open basket-like request summary.

Expected future behavior:

Customer:

    I want 2 güllü

Bot:

    Güllü Dogan: 2 x 350 = 700
    Total: 700

    Do you need anything else?

Customer:

    I want 1 saglam

Bot:

    Güllü Dogan: 2 x 350 = 700
    Saglam Aron: 1 x 1000 = 1000
    Total: 1700

    Do you need anything else?

This logic is planned and should be implemented as a cumulative customer request/basket layer on top of product_specific structured requests.

## Location request logic

When a customer asks for location, for example:

    location
    address
    adres
    where
    2

The system checks if an active default meeting point exists.

### Case A - active default location exists

The bot sends the current default location:

    We can meet here:

    <meeting point name>
    <address>
    <Google Maps link>

The system logs an open location request for the customer.

This request remains open until admin marks it done.

While the request is open, the customer can receive automatic location-change notifications.

### Case B - admin changes default location

If admin sets a different active meeting point as default, the system sends this to customers with open location requests:

    Location changed (became available), please come to the new location:

    <new meeting point name>
    <new address>
    <new Google Maps link>

Only customers with open location requests receive this.

Customers whose location request was marked done do not receive future location-change messages.

### Case C - admin disables the current/default active location

If the default active meeting point is made inactive, the system sends this to customers with open location requests:

    Sorry, dealer is not at the location anymore. We will inform you shortly when a new location is available.

The location request remains open.

This allows the customer to receive the new location later when admin activates/sets a new default location.

### Case D - customer asks location but no active default location exists

The customer receives:

    Currently no location is available. We will inform you shortly when it is available.

Admin receives:

    Location needed:

    Customer: <customer>
    Telegram ID: <telegram id>
    Customer asked for location, but no active default location is available.
    Message: <customer message>

The system logs an open location request.

### Case E - admin later activates/sets a default location

When admin later creates/activates/sets a default meeting point, the system sends the new location to customers with open location requests:

    Location changed (became available), please come to the new location:

    <new meeting point name>
    <new address>
    <Google Maps link>

The request remains open until admin marks it done manually.

### Case F - admin marks location request done

Once location request is marked done:

- it disappears from Open Requests
- raw row remains in Structured Requests as done
- customer no longer receives future location-change notifications for that request group

## Meeting point admin rules

Meeting points can be:

- active
- inactive
- default

Only active meeting points should be selectable as default.

If a meeting point is inactive, the Set Default button should not be shown in its row.

If the current default location is made inactive:

- it is unmarked as default
- customers with open location requests receive the location unavailable message

## Contact admin logic

If the customer chooses Contact admin by button or by typing:

    3
    admin
    contact admin

The system:

1. Logs a structured request as contact_admin.
2. Sends an admin notification.
3. Replies to the customer:

    I received your message. I will help you shortly.

Open Requests groups contact_admin requests by customer.

Admin can click Answer to open the customer page directly at the reply box.

## Unresolved message logic

If the system cannot understand a customer message, it replies with inline Telegram buttons:

    I did not understand exactly. Please choose by pressing a button or typing the number:

    1. Products
    2. Location
    3. Contact admin

The customer can either press a button or type the number.

## Working hours logic

Working hours can be configured from the admin dashboard.

Settings include:

- enabled/disabled
- timezone
- start time
- end time
- closed message

When enabled, product-specific and location requests can be restricted outside working hours.

If the customer asks for product/location outside working hours, the bot replies with the configured closed-hours message.

## Admin reply panel

Admin can reply directly to a customer from the customer detail page.

The reply is sent through Telegram and saved into Conversation History as an outgoing admin reply.

Open Requests contains Answer buttons for:

- product_specific
- location
- contact_admin

The Answer button opens the customer page at the reply form.

## Telegram inline buttons

Unresolved customer messages show three inline buttons:

- 1. Products
- 2. Location
- 3. Contact admin

Typed alternatives still work:

- 1 = products
- 2 = location
- 3 = contact admin

## Database models

Important models:

- Customer
- Message
- MeetingPoint
- Product
- AppSetting
- CustomerRequest

CustomerRequest fields:

- id
- customer_id
- request_type
- request_text
- item_name
- quantity
- status
- created_at

Important request_type values:

- product_list
- product_specific
- location
- contact_admin

## Common commands

Check Git status:

    git status

Compile important files:

    python3 -m py_compile app/admin/routes.py
    python3 -m py_compile app/services/telegram_bot.py
    python3 -m py_compile app/services/rule_engine.py

Restart app service:

    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist
    sleep 5
    launchctl print gui/$(id -u)/com.harun.crm-dealer-app | grep state

Check public status:

    curl -L -s -o /dev/null -w "%{http_code}\n" https://crm.ayartuerk.me/admin/

Expected result:

    200

## Deployment notes

This deployment currently depends on the Mac being online.

If the Mac is off, asleep, or disconnected, the public CRM URL will not work.

Production-grade next step would be moving the app and database to a cloud server or managed platform.

## Security notes

- `.env` must not be committed
- Telegram bot token must remain secret
- Admin JWT secret must remain secret
- Admin password must remain secret
- Cloudflare tunnel credential JSON must remain secret
- Admin dashboard is protected by JWT-cookie authentication
- App refuses to start if admin credentials or JWT secret are missing or weak

## Known next milestones

Recommended next milestones:

1. Product basket/cumulative total logic
2. Cleaner admin UI styling
3. Request filters on dashboard
4. Better customer language preference handling
5. Database migration system with Alembic
6. Cloud production deployment
7. Analytics dashboard
8. Multi-admin roles
9. WhatsApp/Instagram integration
10. Voice message transcription
