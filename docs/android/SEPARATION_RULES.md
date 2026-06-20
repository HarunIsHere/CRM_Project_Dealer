# Android Project Separation Rules

## Protected production system

The existing production system lives here:

- `cloudflare-worker/`

It currently powers:

- Telegram bot
- Web admin panel
- Superadmin panel
- Open Requests
- Orders
- Customers
- Meeting Points
- AI admin pages
- Existing D1-backed production workflow

This system must not be broken by Android development.

## Separate Android project layer

Android-related work lives here:

- `cloudflare-worker/`
- `android/admin-app/`
- `android/customer-app/`
- `android/shared/`

## API domain plan

- Existing production web/admin: `https://crm.ayartuerk.me`
- Android API: `https://crm.ayartuerk.me/api/v1`

## Rule

Do not add new Android-only features directly into `cloudflare-worker/`.

Android app features should be added to `cloudflare-worker/` under `/api/v1/...`.

The Android API may read/write the same D1 database only through explicit, controlled API endpoints.

## Apps

Admin Android App:
- Admin login
- Dashboard
- Open Requests
- Orders
- Closed Orders
- Customers
- Products
- Meeting Points
- AI pages
- Superadmin functions
- Telegram-admin replacement features

Customer Android App:
- Language selection
- Product catalog
- Basket
- Checkout
- Delivery location
- Meeting point approval
- Order status
- Messages/contact admin

## Languages

All Android and Android API features must support:

- English
- German
- Turkish
- Arabic
- Russian

Arabic must be RTL-ready.
