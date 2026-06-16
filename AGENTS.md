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
- Admin UI can be English-only unless the existing UI already has localized labels nearby.
- Do not remove backup files unless explicitly instructed.
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

After local changes:

    git add -A
    git commit -m "<clear message>"
    git push origin main
    git push origin main:cloudflare-worker-d1
