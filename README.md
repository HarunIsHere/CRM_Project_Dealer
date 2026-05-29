# CRM Delivery

Telegram-first CRM automation system for customer message handling, product requests, meeting-point/location replies, admin notifications, working-hours restrictions, admin-side request tracking, and admin-to-customer replies through Telegram.

Public admin URL:

https://crm.ayartuerk.me/admin/

The root domain https://ayartuerk.me is not used for this app because it already serves another website. The CRM runs separately through the subdomain crm.ayartuerk.me.

## Repository

https://github.com/HarunIsHere/CRM_Project_Dealer.git

## Current status

The system is currently deployed from a local Mac using FastAPI, Telegram polling, SQLite, and Cloudflare Tunnel.

Public path:

    crm.ayartuerk.me -> Cloudflare Tunnel -> 127.0.0.1:8001 -> FastAPI app

The app and tunnel are started automatically on macOS login through LaunchAgents.

## Telegram bot

Current bot display name:

    Delivery Bot

Current bot username:

    @SpecialDeliveryBerlinBot

Direct bot link:

    https://t.me/SpecialDeliveryBerlinBot

The FastAPI app uses the Telegram bot token from `.env`. The Telegram username itself is not used by the code.

If the bot token changes, update:

    TELEGRAM_BOT_TOKEN=

Then restart the app service.

## Main features

- Telegram customer message intake
- Rule-based replies
- Multilingual intent recognition
- English, German, Turkish, Arabic, and Russian support
- Language selection buttons on unresolved messages
- Product list replies
- Specific product request detection
- Product aliases for better matching
- Automatic product alias generation
- Manual product alias editing from admin dashboard
- Quantity extraction from customer messages
- Product request notifications to admin
- Admin reply button inside Telegram notifications
- Admin can reply to customers directly through the bot
- Meeting-point/location replies with Google Maps links
- Location availability and change notification logic
- Working-hours restrictions
- Admin Telegram notifications for unresolved messages
- Admin Telegram notifications when location is needed
- Admin dashboard protected by JWT-cookie login
- Product add/update/delete from admin dashboard
- Meeting point add/update/delete/default management
- Admin reply panel on customer detail page
- Structured customer request logging
- Open Requests dashboard table
- AJAX refresh for Open Requests only
- Request status management: new, in_progress, done
- Grouped open requests with summed quantities/request counts
- Done button per grouped request
- All Done button for clearing all open requests
- Customer conversation history
- Telegram inline buttons for unresolved messages:
  - Products
  - Location
  - Contact admin
  - Language choices

## Tech stack

- Python
- FastAPI
- SQLAlchemy
- SQLite
- Jinja2 templates
- python-telegram-bot
- RapidFuzz
- Lingua language detection
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
    ADMIN_SETUP_CODE=

The app refuses to start if admin credentials, JWT secret, or admin setup code are missing or weak.

## Admin authentication

Admin login:

    https://crm.ayartuerk.me/admin/login

Authentication uses a JWT stored in an HTTP-only cookie.

The admin dashboard is protected. Admin routes check authentication before allowing access.

## Telegram admin setup

The admin notification receiver can be set directly from Telegram.

Command:

    /setadmin <ADMIN_SETUP_CODE>

Example:

    /setadmin Selchower

When successful, the bot replies:

    You are now set as the admin notification receiver.

This saves the sender's Telegram chat ID into:

    admin_telegram_chat_id

The admin does not need to manually find or copy the Telegram chat ID.

Security rule:

- `/setadmin` only works if the provided setup code matches `ADMIN_SETUP_CODE` from `.env`.

## Admin dashboard

Admin dashboard URL:

    https://crm.ayartuerk.me/admin/

Dashboard sections include:

- Open Requests
- Admin Language
- Notification Settings
- Working Hours
- Products
- Meeting Points
- Customers

The Open Requests table auto-refreshes through AJAX every 10 seconds.

Only the Open Requests table refreshes. The full page does not reload. This prevents product/meeting-point forms from losing typed input while admin is editing.

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

## Conversation history logic

Customer conversation history is shown on the customer detail page.

Newest messages are shown at the top.

The conversation history includes:

- incoming customer messages
- outgoing bot replies
- outgoing admin replies

Admin replies sent through the web dashboard or Telegram bot are saved into customer history.

## Admin reply through Telegram

Admin notifications include a button:

    Reply to customer

Flow:

1. Customer sends a product/location/contact/admin/unresolved message.
2. Admin receives a Telegram notification.
3. Admin clicks Reply to customer.
4. Bot asks admin to type the reply.
5. Admin types the reply in the bot chat.
6. Bot sends that reply to the customer.
7. Bot saves the reply into the customer's conversation history.
8. Bot confirms to admin:

    Reply sent to customer.

Only the saved admin notification receiver can use the Telegram reply button.

If another Telegram user presses the admin reply button, the bot rejects the action.

## Product list request logic

When the customer asks for product list, for example:

    products
    product
    ürünler
    urunler
    produkte
    товар
    منتجات
    1

The bot sends the active product list.

Product list requests are logged in the customer's Structured Requests table as product_list.

Product list requests do not appear in Open Requests because they usually do not require admin action.

## Specific product request logic

When the customer asks for a specific product, for example:

    I want 3 gullu
    2 güllü gönder
    gullu istiyorum
    güllü istiyom
    GÜLLÜ İSTİYOM

The system:

1. Detects the product using product aliases and fuzzy matching.
2. Extracts quantity if present.
3. Sends the product price to the customer.
4. Logs a structured request as product_specific.
5. Stores the matched product name in item_name.
6. Stores the extracted quantity if available.
7. Sends a Product request notification to admin.
8. Adds a Reply to customer button to the admin notification.

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

## Product aliases

The app uses product aliases to recognize products more reliably.

Product aliases are stored in:

    product_aliases

When a product is created or updated, the system can automatically generate basic aliases from the product name.

Example product:

    Güllü Dogan

Auto aliases include:

    güllü dogan
    gullu dogan
    güllü
    gullu
    dogan

Admin can also edit aliases manually in the Products table on the admin dashboard.

Manual aliases should be comma-separated.

Example:

    gullu, güllü, غولو, гюллю

Product matching checks aliases first, then product names.

This allows the bot to recognize product requests even when the customer uses spelling variations, missing Turkish characters, uppercase/lowercase variants, or manually configured transliterations.

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

    I want 1 kavunlu

Bot:

    Güllü Dogan: 2 x 350 = 700
    Kavunlu Aron: 1 x 1000 = 1000
    Total: 1700

    Do you need anything else?

This logic is planned and should be implemented as a cumulative customer request/basket layer on top of product_specific structured requests.

## Location request logic

When a customer asks for location, for example:

    location
    address
    adres
    konum
    mekan
    standort
    adresse
    location
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
3. Adds a Reply to customer button to the admin notification.
4. Replies to the customer in the active/preferred language.

English reply:

    I received your message. I will help you shortly.

Open Requests groups contact_admin requests by customer.

Admin can click Answer in the dashboard or Reply to customer in Telegram.

## Unresolved message logic

If the system cannot understand a customer message, it replies with action buttons and language buttons.

The unresolved message is sent in the best available language.

If the language is unknown, the fallback is English.

The message includes:

- Products
- Location
- Contact admin
- English
- Deutsch
- Türkçe
- العربية
- Русский

When customer clicks a language:

1. The selected language is saved as preferred_language.
2. The unresolved message is repeated in that language.
3. The same action buttons and language buttons are shown again.

Important rule:

Unresolved messages must always include action buttons and language buttons.

## Menu option architecture

Menu options are centralized.

Typed numbers and inline buttons use the same menu source.

Current options:

- 1 = Products
- 2 = Location
- 3 = Contact admin

This avoids future bugs when adding menu options 4, 5, etc.

Future menu options should be added in the central menu definition so both typed input and button input work automatically.

## Language logic

Supported languages:

- English
- German
- Turkish
- Arabic
- Russian

The app uses a combination of:

- explicit multilingual keyword dictionaries
- Lingua language detection
- stored customer preferred_language
- language buttons

Preferred language rules:

- Do not permanently overwrite preferred_language from weak automatic detection.
- Only update preferred_language when:
  - customer explicitly clicks a language button, or
  - message contains strong language-specific keywords.
- If a message is random/unknown, reply in English with action + language buttons.

This avoids false detection of random Latin text as German or another language.

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

## Database models

Important models:

- Customer
- Message
- MeetingPoint
- Product
- ProductAlias
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

ProductAlias fields:

- id
- product_id
- alias

## Common commands

Check Git status:

    git status

Compile important Python files:

    python3 -m py_compile app/admin/routes.py
    python3 -m py_compile app/core/config.py
    python3 -m py_compile app/main.py
    python3 -m py_compile app/models/product_alias.py
    python3 -m py_compile app/services/admin_reply_service.py
    python3 -m py_compile app/services/customer_request_service.py
    python3 -m py_compile app/services/language_service.py
    python3 -m py_compile app/services/meeting_point_service.py
    python3 -m py_compile app/services/product_alias_service.py
    python3 -m py_compile app/services/rule_engine.py
    python3 -m py_compile app/services/telegram_bot.py

Do not run `py_compile` on HTML templates.

Restart app service:

    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist
    sleep 5
    launchctl print gui/$(id -u)/com.harun.crm-dealer-app | grep state

Check public status:

    curl -L -s -o /dev/null -w "%{http_code}\n" https://crm.ayartuerk.me/admin/

Expected result:

    200

Check latest app errors:

    tail -120 /tmp/crm-dealer-app.err.log

## Deployment notes

This deployment currently depends on the Mac being online.

If the Mac is off, asleep, or disconnected, the public CRM URL will not work.

Production-grade next step would be moving the app and database to a cloud server or managed platform.

## Security notes

- `.env` must not be committed
- Telegram bot token must remain secret
- Admin setup code must remain secret
- Admin JWT secret must remain secret
- Admin password must remain secret
- Cloudflare tunnel credential JSON must remain secret
- Admin dashboard is protected by JWT-cookie authentication
- App refuses to start if admin credentials, JWT secret, or setup code are missing or weak
- If a Telegram bot token is exposed, revoke/regenerate it in BotFather and update `.env`

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
