# CRM Delivery

Telegram-first CRM and delivery coordination system for customer message handling, product requests, delivery/location requests, admin notifications, working-hours control, admin-side request tracking, and admin-to-customer replies.

Public admin URL:

    https://crm.ayartuerk.me/admin/

Open Requests URL:

    https://crm.ayartuerk.me/admin/openrequests/

Bot:

    Delivery Bot
    @SpecialDeliveryBerlinBot

Direct bot link:

    https://t.me/SpecialDeliveryBerlinBot

## Current status

The system is currently deployed from a local Mac using:

- FastAPI
- SQLite
- SQLAlchemy
- Jinja2 templates
- python-telegram-bot
- Cloudflare Tunnel
- macOS LaunchAgents

Public path:

    crm.ayartuerk.me -> Cloudflare Tunnel -> 127.0.0.1:8001 -> FastAPI app

The app and tunnel start automatically on macOS login through LaunchAgents.

## Main features

- Telegram customer message intake
- Rule-based replies
- Multilingual support
- Supported languages:
  - English
  - German
  - Turkish
  - Arabic
  - Russian
- Language selection buttons on unresolved messages
- Product list replies
- Specific product request detection
- Product aliases
- Automatic product alias generation
- Manual product alias editing from admin dashboard
- Quantity extraction from customer messages
- Product request notifications to admin
- Admin reply button in Telegram notifications
- Admin can reply to customers directly through Telegram bot
- Admin can reply to customers from web dashboard
- Customer conversation history
- Structured customer requests
- Open Requests page with AJAX table refresh
- Working-hours restrictions
- Auto working-hours message mode
- Custom free-text closed-hours message mode
- Closed-hours buttons:
  - Product List
  - Contact admin
- Meeting point/location management
- Customer can choose active meeting point
- Default meeting point shown as Preferred
- If only one active meeting point exists, it is sent directly
- Customer can type address
- Address search offers up to 7 selectable location results
- Customer can share Telegram location
- Admin receives clickable Google Maps link
- Delivery ETA buttons for admin:
  - 15 min
  - 30 min
  - 45 min
  - 1h
  - 1h 15 min
  - 1h 30 min
  - No delivery
  - Free text reply
- Admin ETA button feedback:
  - clicked buttons marked
  - latest clicked option marked
- Admin dashboard login
- Change password page
- Forgot password flow with 5-digit Telegram reset code
- Superadmin web login
- Superadmin Telegram takeover command
- Responsive admin UI for desktop and mobile
- Shared admin CSS styling

## Admin URLs

Admin login:

    https://crm.ayartuerk.me/admin/login

Admin dashboard:

    https://crm.ayartuerk.me/admin/

Open Requests:

    https://crm.ayartuerk.me/admin/openrequests/

Change password:

    https://crm.ayartuerk.me/admin/change-password

Forgot password:

    https://crm.ayartuerk.me/admin/forgot-password

Reset password:

    https://crm.ayartuerk.me/admin/reset-password

Customer detail pages:

    https://crm.ayartuerk.me/admin/customers/<customer_id>

## Telegram admin setup

Normal admin setup command:

    /setadmin <ADMIN_SETUP_CODE>

Example:

    /setadmin Selchower

This saves the sender's Telegram chat ID as the active admin notification receiver.

Superadmin takeover command:

    /setsuperadmin <SUPERADMIN_BOT_SETUP_CODE>

This allows the superadmin to take over the active admin Telegram receiver.

## Environment variables

Required in `.env`:

    TELEGRAM_BOT_TOKEN=
    ADMIN_USERNAME=
    ADMIN_PASSWORD=
    ADMIN_JWT_SECRET=
    ADMIN_SETUP_CODE=
    SUPERADMIN_USERNAME=
    SUPERADMIN_PASSWORD=
    SUPERADMIN_BOT_SETUP_CODE=

Do not commit `.env`.

## Authentication

Admin login supports:

1. Normal admin credentials:

       ADMIN_USERNAME + current admin password

2. Superadmin credentials:

       SUPERADMIN_USERNAME + SUPERADMIN_PASSWORD

Admin password can be changed from the web dashboard.

Changed admin password is stored as a database setting:

    admin_password_override

If no override exists, the app uses `ADMIN_PASSWORD` from `.env`.

## Forgot password flow

Login page includes:

    I forgot my password

Flow:

1. Admin clicks forgot-password link.
2. System generates a random 5-digit code.
3. Code is sent to active Admin Telegram Chat ID.
4. Admin enters code and new password.
5. If valid, `admin_password_override` is updated.
6. Admin can log in with the new password.

Reset codes expire after 10 minutes.

## Working hours

Admin can enable/disable working-hours restrictions.

Settings:

- timezone
- start time
- end time
- message mode
- custom closed message

Message modes:

### Auto mode

Uses configured working hours and replies in:

- customer language
- English

Example:

    Şu anda kapalıyız. Çalışma saatlerimiz 13:00 - 23:00 (Europe/Berlin).

    We are currently closed. Our working hours are 13:00 - 23:00 (Europe/Berlin).

### Custom mode

Sends the custom free-text message exactly as written.

Useful for vacation, special closure, temporary unavailability, etc.

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

Closed-hours replies include buttons:

- Product List
- Contact admin

## Product logic

Product list requests are allowed even outside working hours.

Product list requests are no longer stored in Structured Requests.

Specific product requests are detected through:

- product names
- product aliases
- automatic aliases
- manual aliases
- spelling variants
- fuzzy matching

Product request notification example:

    Product request:

    Customer: Harun
    Telegram ID: 8874326241
    Product: Güllü Dogan
    Quantity: 2
    Message: 2 güllü

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

## Location and delivery logic

There are two different location concepts:

1. Business/meeting points configured by admin
2. Customer delivery location shared/selected by customer

### Business meeting points

Admin manages meeting points from the dashboard.

Each meeting point has:

- name
- address
- Google Maps link
- active/inactive status
- default/preferred status

Customer location option shows active locations.

If there is more than one active location:

- customer receives buttons
- default location is marked Preferred

If there is only one active location:

- customer receives it directly

### Customer delivery location

Customer can send delivery location in two ways:

1. Share Telegram location directly
2. Use Type address flow

Typed address flow:

1. Customer chooses Type address.
2. Bot asks customer to type address.
3. System searches locations.
4. Bot shows up to 7 address choices.
5. Customer selects one.
6. Admin receives clickable Google Maps location.
7. Open Requests and Structured Requests show the map link.

Admin receives delivery ETA buttons.

When admin clicks an ETA button, customer receives an automatic message.

Example:

    Delivery will be done to your location in 30 min.

No delivery example:

    Sorry, delivery is not possible for this location.

## Open Requests

Open Requests moved to a separate page:

    /admin/openrequests/

Main admin dashboard has an Open Requests button.

Open Requests page uses AJAX refresh.

It does not reload the whole page.

Partial AJAX endpoint:

    /admin/open-requests

Open Requests table is generated from grouped customer requests.

Open Requests contains active operational items only.

Grouped request logic:

- grouped by customer
- grouped by request type
- grouped by item/product/location where applicable
- done requests are hidden
- quantities are summed when available
- request counts are shown

Open Requests actions:

- Open Customer
- Answer
- Done
- All Done

Open Customer and Answer buttons have equal visual width.

## Structured Requests

Customer detail page contains raw request history.

Structured Requests include:

- ID
- Type
- Status
- Item
- Quantity
- Text
- Created At
- Action

Location-related rows include clickable Open Map links.

Request statuses:

- new
- in_progress
- done

## Conversation history

Customer detail page includes conversation history.

Newest messages are shown first.

Stored message types include:

- customer text
- bot reply
- admin reply
- typed address location
- Telegram shared location
- delivery ETA message

## Admin reply through Telegram

Admin notification buttons include:

    Reply to customer

Flow:

1. Admin clicks Reply to customer.
2. Bot asks admin to type the reply.
3. Admin sends text in bot chat.
4. Bot forwards it to the customer.
5. Reply is saved in conversation history.

Only the active admin Telegram receiver can use this.

## Admin UI

Admin web pages use shared CSS:

    app/static/admin.css

Static files are mounted under:

    /static

Styled pages:

- login
- admin dashboard
- open requests
- customer detail
- change password
- forgot password
- reset password

The UI supports desktop and mobile.

Tables scroll horizontally on small screens.

## Important files

App entrypoint:

    app/main.py

Admin routes:

    app/admin/routes.py

Telegram bot:

    app/services/telegram_bot.py

Admin auth:

    app/services/admin_auth_service.py

Working hours:

    app/services/working_hours_service.py

Meeting points:

    app/services/meeting_point_service.py

Products/rules:

    app/services/rule_engine.py
    app/services/product_alias_service.py

Customer requests:

    app/models/customer_request.py
    app/services/customer_request_service.py

Templates:

    app/templates/admin_dashboard.html
    app/templates/open_requests_page.html
    app/templates/open_requests_table.html
    app/templates/customer_detail.html
    app/templates/admin_login.html
    app/templates/change_password.html
    app/templates/forgot_password.html
    app/templates/reset_password.html

CSS:

    app/static/admin.css

## Local app

Local URL:

    http://127.0.0.1:8001

Manual start:

    ~/bin/run_crm_app.sh

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

## macOS LaunchAgents

App LaunchAgent:

    ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist

Tunnel LaunchAgent:

    ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist

Check app:

    launchctl print gui/$(id -u)/com.harun.crm-dealer-app | grep state

Check tunnel:

    launchctl print gui/$(id -u)/com.harun.crm-dealer-tunnel | grep state

Restart app:

    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist
    sleep 5
    launchctl print gui/$(id -u)/com.harun.crm-dealer-app | grep state

Restart tunnel:

    launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist 2>/dev/null || true
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist
    sleep 5
    launchctl print gui/$(id -u)/com.harun.crm-dealer-tunnel | grep state

## Logs

App logs:

    /tmp/crm-dealer-app.out.log
    /tmp/crm-dealer-app.err.log

Tunnel logs:

    /tmp/crm-dealer-tunnel.out.log
    /tmp/crm-dealer-tunnel.err.log

Check latest errors:

    tail -120 /tmp/crm-dealer-app.err.log

## Compile checks

Do not run `py_compile` on HTML templates.

Useful compile command:

    python3 -m py_compile \
    app/core/config.py \
    app/main.py \
    app/admin/routes.py \
    app/models/customer_request.py \
    app/models/product_alias.py \
    app/services/admin_auth_service.py \
    app/services/customer_request_service.py \
    app/services/language_service.py \
    app/services/meeting_point_service.py \
    app/services/product_alias_service.py \
    app/services/rule_engine.py \
    app/services/startup_checks.py \
    app/services/telegram_bot.py \
    app/services/working_hours_service.py

## Public status check

    curl -L -s -o /dev/null -w "%{http_code}\n" https://crm.ayartuerk.me/admin/

Expected when reachable:

    200

## Security notes

Do not commit:

- `.env`
- Telegram bot token
- admin password
- superadmin password
- admin setup code
- superadmin bot setup code
- JWT secret
- Cloudflare tunnel credential JSON

If Telegram bot token is exposed:

1. Open BotFather.
2. Revoke/regenerate token.
3. Update `.env`.
4. Restart app.

## Deployment limitation

Current deployment depends on the Mac being online.

If the Mac is off, asleep, disconnected, or Cloudflare Tunnel is stopped, the public CRM URL will not work.

Production-grade next step:

- move app to a cloud server
- move SQLite to managed PostgreSQL
- use real migrations with Alembic
- configure secure secret management
- enable proper backups

## Known next milestones

1. Product basket / cumulative cart total
2. Cleaner product ordering flow
3. Admin dashboard filters
4. Better analytics dashboard
5. Alembic migration system
6. PostgreSQL deployment
7. Multi-admin roles
8. WhatsApp integration
9. Instagram integration
10. Voice message transcription
