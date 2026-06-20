# Agent Instructions for CRM Delivery

## Project overview

This repository contains a Telegram-first CRM and delivery/order coordination system.

The active production implementation is the Cloudflare Worker app in:

    cloudflare-worker/

The old local FastAPI/SQLite implementation is deprecated unless explicitly requested.

Production URLs:

    Admin: https://crm.ayartuerk.me/admin/
    Orders: https://crm.ayartuerk.me/admin/orders
    Closed Orders: https://crm.ayartuerk.me/admin/closedorders
    Open Requests: https://crm.ayartuerk.me/admin/openrequests/
    Superadmin: https://crm.ayartuerk.me/admin/superadmin
    Telegram webhook: https://crm.ayartuerk.me/telegram/webhook

Bot:

    @SpecialDeliveryBerlinBot

## Active stack

- Cloudflare Worker
- Cloudflare D1
- JavaScript Worker runtime
- Telegram Bot API
- Admin web UI rendered from `cloudflare-worker/src/index.js`
- Nominatim/OpenStreetMap address search
- Optional OpenAI fallback/AI learning

## Main source files

Primary active file:

    cloudflare-worker/src/index.js

Cloudflare config:

    cloudflare-worker/wrangler.toml

D1 migrations:

    cloudflare-worker/migrations/

README:

    README.md

## Important workflow rules

- Keep all current functionality working.
- Preserve multilingual customer-facing messages:
  - English
  - German
  - Turkish
  - Arabic
  - Russian
- When adding or changing customer-facing text/buttons, update all supported languages.
- Preserve multilingual admin web-page text/buttons when the page already supports admin-view language, especially English, German, Turkish, Arabic, and Russian.
- Do not create or keep new backup files in Git. Temporary backup files may be created locally during patching, but remove them before committing.
- Do not delete deprecated old backend files unless explicitly instructed.
- Do not change Telegram bot token, Worker name, D1 binding, or custom domain route unless explicitly instructed.

## Worker commands

Run syntax check from Worker folder:

    cd cloudflare-worker
    node --check src/index.js

Deploy from Worker folder:

    cd cloudflare-worker
    npm run deploy

Tail logs:

    cd cloudflare-worker
    npx wrangler tail crm-delivery-worker

Apply D1 migrations:

    cd cloudflare-worker
    npx wrangler d1 migrations apply crm-delivery-db --remote

If migration import fails, run SQL with:

    npx wrangler d1 execute crm-delivery-db --remote --command="..."

## Current order model

`shopping_carts` is also the order-status base.

Important statuses:

- `in_progress`
- `waiting_location`
- `ready_to_delivery`
- `on_the_way`
- `not_delivered`
- `delivered`

Delivered orders must not be reopened by new customer product messages. New product messages after delivery must create a new basket/order.

## Admin order pages

Active orders:

    /admin/orders

Closed delivered orders:

    /admin/closedorders
    /admin/superadmin

Admin Telegram quick command:

    /o

`/o` should list:

- all `on_the_way` orders
- `ready_to_delivery` orders only when `delivery_note` indicates our meeting point / pickup approval:
  - `our_meeting_point`
  - `our_meeting_point_approved`

The `/o` command should not list customer-address `ready_to_delivery` orders unless explicitly requested.

## Testing expectations

After code changes, always run:

    cd cloudflare-worker
    node --check src/index.js

For user-facing flow changes, test with Telegram manually after deploy.

For admin page changes, test:

    https://crm.ayartuerk.me/admin
    https://crm.ayartuerk.me/admin/orders
    https://crm.ayartuerk.me/admin/closedorders

## Git workflow

Main branch:

    main

Mirror branch used during Worker development:

    cloudflare-worker-d1

Current solo-developer branch rule:

- `main`, `cloudflare-worker-d1`, and `worker-next` should stay identical for now.
- Push confirmed production updates to all 3 branches.
- No pull request workflow is needed while Harun is the only developer.
- When a team member joins, `worker-next` can become the active development branch and `main` stays production/stable.

After local changes:

    git add -A
    git commit -m "<clear message>"
    git push origin main
    git push origin main:cloudflare-worker-d1
    git push origin main:worker-next


## Superadmin

Superadmin web page:

    /admin/superadmin

Superadmin can:

- view env-protected admin/superadmin accounts
- create database-backed admins
- create database-backed superadmins
- deny/grant access for database-backed admins
- delete database-backed credentials
- view website login/action audit logs from the last 30 days

Do not allow the currently logged-in superadmin to deny or delete their own access.

Audit logs are stored in `admin_audit_logs` and old logs are deleted during admin page access.

## Open Requests timing

Open Requests should list admin-actionable items only.

For customer choosing our meeting point/location:

- asking for location must show the approval prompt but must not create an Open Request yet
- Open Request should be created only after the customer presses "Approve delivery at this location"
- only admin clears Open Requests with Done or All Done

For customer delivery location messages sent to admin, include the customer's basket directly in the Telegram admin notification before ETA buttons.


## Current Android / domain direction

- Build two Android apps in parallel with the existing Telegram bot and admin web UI.
- Do not replace Telegram.
- Do not create a separate Android webhook.
- Keep the existing Telegram webhook unchanged:

    https://crm.ayartuerk.me/telegram/webhook

- Android apps, Telegram, and admin web must use the same Cloudflare Worker backend and the same D1 database.
- Add versioned mobile/backend API routes under:

    /api/v1/...

- Backend remains the source of truth. Android apps must call backend APIs and must not duplicate business logic locally.
- Carry/expose the admin system on horizend.com, but keep crm.ayartuerk.me/admin working during the transition.
- Do not break current production routes while adding Android APIs.

## Android app roadmap

The production Android app roadmap is documented in:

    docs/ANDROID_APPS_ROADMAP.md

Two apps are planned:

- Admin Android App
- Customer Android App

Both apps must support English, German, Turkish, Arabic, and Russian from the start.

Backend remains the source of truth. Android apps must call backend APIs and should not duplicate business logic locally.
