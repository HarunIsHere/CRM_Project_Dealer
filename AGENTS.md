# Agent Instructions for CRM Delivery

## Project overview

This repository contains a multi-client CRM, customer ordering, delivery/pickup coordination, messaging, and administration platform.

The active production backend is the Cloudflare Worker implementation in:

    cloudflare-worker/

The old local FastAPI/SQLite implementation is deprecated unless explicitly requested.

The system must converge on one shared backend and one canonical business model used by every client.

## Current platform architecture

### Customer-facing clients

- Telegram Bot
- Telegram Mini App
- Customer Android App
- Customer iOS App

### Administration clients

- Existing Web Admin
- Admin Android App
- Admin iOS App

### Shared backend

All clients must use:

- the same Cloudflare Worker backend
- the same Cloudflare D1 database
- the same canonical business logic
- the same customer/order/location state
- versioned API routes under `/api/v1/...` where appropriate

Backend remains the source of truth.

Clients must not duplicate backend business logic locally.

## Product-development priority

Development does not need to preserve legacy and replacement implementations live in parallel merely for backward compatibility during the development period.

Priority order:

1. final system quality
2. clean architecture
3. development speed and efficiency
4. standardization
5. maintainability
6. cross-client consistency

Do not keep duplicate legacy and new implementations simply because an older implementation was previously live.

When a new canonical implementation is clearly superior:

- migrate required functionality to it
- update all relevant clients
- verify the migration
- remove obsolete duplication when safe

Avoid unnecessary compatibility layers that make the final architecture more complex.

## Canonical cart / order / location architecture

The dedicated V2-style customer cart/order/location architecture is the canonical direction for the final system.

The long-term system must converge on dedicated concepts/tables such as:

- customer cart sessions
- customer cart items
- customer orders
- customer order items
- customer order status history
- customer locations

The old model in which `shopping_carts` also acts as the order-status base is legacy architecture and must not remain the permanent parallel order system.

Important rule:

- Do not maintain “legacy orders” and “V2 orders” as two permanent business models.
- Consolidate functionality onto the canonical cart/order/location architecture.
- Telegram Bot, Telegram Mini App, Customer Android, Customer iOS, Web Admin, Admin Android, and Admin iOS must ultimately use the same canonical lifecycle.
- Once required functionality and data migration are verified, obsolete legacy order logic should be retired.

The term “V2” currently identifies the newer architecture but should not imply that two permanent systems must coexist.

## Customer application direction

Customer-facing clients are:

- Telegram Bot
- Telegram Mini App
- Customer Android
- Customer iOS

They share the same canonical backend model but must have customer-focused UX.

Do not copy the Admin Web UI into customer applications.

Customer UI/UX should later be designed and validated specifically around:

- discovering products
- cart management
- checkout
- delivery vs pickup
- saved/preferred/new locations
- order status
- customer communication
- ease of purchase
- clear mobile navigation

Telegram must remain a supported customer channel unless explicitly changed.

Do not create a separate Android/iOS webhook.

Keep the existing Telegram webhook architecture unless intentionally redesigned.

## Admin application direction

Administration clients are:

- Existing Web Admin
- Admin Android
- Admin iOS

The established Telegram-era Web Admin is the current functional and UX/workflow reference for Admin mobile applications.

Do not use the abandoned/experimental V2-style website/dashboard concept as the Admin UI reference.

Admin mobile applications should preserve the Web Admin's:

- workflows
- terminology
- functional hierarchy
- status meanings
- colors/design language
- operational behavior

Layouts and controls must be adapted natively for phone/tablet screens.

Native implementations:

- Android: Kotlin + Jetpack Compose
- iOS: Swift + SwiftUI

Admin Android and Admin iOS must share one documented design system and equivalent workflows.

Current shared Admin mobile design documents:

    docs/mobile-admin/shared-design-system.md
    docs/mobile-admin/screen-inventory.md
    docs/mobile-admin/website-mobile-parity-matrix.md
    docs/mobile-admin/implementation-roadmap.md
    docs/mobile-admin/decisions.md

## Admin Web reference structure

The established Web Admin navigation/workflow includes:

- General
- Open Requests
- Orders
- Closed Orders
- Products
- Meeting Points
- AI Info
- Customers
- Superadmin

Related authentication/account flows include:

- Login
- Forgot Password
- Reset Password
- Change Password
- Logout

The `General` page is the first authenticated Admin destination and contains configuration such as:

- Admin Language
- Notification Settings
- Working Hours
- Fulfillment / Location Options
- Delivery Cities
- Bot Response Mode
- AI Project Instructions

Admin Android and Admin iOS should map these workflows into native mobile layouts rather than inventing an unrelated dashboard.

## Equal five-language standard

The project has five equal first-class languages:

- English
- German
- Turkish
- Arabic
- Russian

No language has superiority over another.

Rules:

- All five languages must be handled as equal supported languages.
- New or changed user-facing text/buttons must be implemented for all five languages.
- New or changed admin-facing localized text/buttons must be implemented for all five languages where localization applies.
- Use one standardized localization architecture across all five languages.
- Use the same translation keys, persistence model, API representation, validation rules, and fallback strategy across languages.
- Avoid language-specific architectural exceptions unless technically required.
- Arabic may require RTL layout behavior, but this must not make its functional implementation structurally inferior or inconsistent.
- When reviewing the project later, equivalent functionality should show no unnecessary structural difference between languages.
- Do not implement a feature in one language first and leave other languages structurally incomplete as a permanent state.

## Active production implementation

Primary active backend:

    cloudflare-worker/

Primary active Worker source:

    cloudflare-worker/src/index.js

Cloudflare config:

    cloudflare-worker/wrangler.toml

D1 migrations:

    cloudflare-worker/migrations/

Repository README:

    README.md

## Active stack

- Cloudflare Workers
- Cloudflare D1
- JavaScript Worker runtime
- Telegram Bot API
- Admin Web UI rendered primarily from Worker/backend templates and styles
- Versioned `/api/v1/...` APIs
- Nominatim/OpenStreetMap address search
- Optional OpenAI fallback/AI learning
- Kotlin + Jetpack Compose for Android
- Swift + SwiftUI for Apple/iOS clients

## Production URLs

Admin:

    https://crm.ayartuerk.me/admin/

Orders:

    https://crm.ayartuerk.me/admin/orders

Closed Orders:

    https://crm.ayartuerk.me/admin/closedorders

Open Requests:

    https://crm.ayartuerk.me/admin/openrequests/

Superadmin:

    https://crm.ayartuerk.me/admin/superadmin

Telegram webhook:

    https://crm.ayartuerk.me/telegram/webhook

Bot:

    @SpecialDeliveryBerlinBot

Do not change production domains, Worker name, Telegram webhook, D1 binding, or Bot token unless explicitly instructed.

## Important workflow rules

- Keep required final functionality working across the canonical architecture.
- Backend is the source of truth.
- Do not duplicate order, customer, fulfillment, pricing, or status logic independently in clients.
- When changing lifecycle behavior, verify all clients/routes that consume that lifecycle.
- Do not create or keep new backup files in Git.
- Temporary backups may be created locally during patching but remove them before committing.
- Do not delete deprecated files solely for cleanup unless the migration/removal is intentional and verified.

## Worker commands

Syntax check:

    cd cloudflare-worker
    node --check src/index.js

Deploy:

    cd cloudflare-worker
    npm run deploy

Tail logs:

    cd cloudflare-worker
    npx wrangler tail crm-delivery-worker

Apply D1 migrations:

    cd cloudflare-worker
    npx wrangler d1 migrations apply crm-delivery-db --remote

Fallback SQL execution:

    npx wrangler d1 execute crm-delivery-db --remote --command="..."

## Canonical order lifecycle guidance

Customer/mobile/new ordering work must use the canonical dedicated customer cart/order/location architecture.

Current dedicated tables include:

- customer_cart_sessions
- customer_cart_items_v2
- customer_orders_v2
- customer_order_items_v2
- customer_order_status_history_v2
- customer_locations_v2

The `_v2` naming reflects migration history; do not interpret it as a requirement to maintain two permanent order systems.

Admin API customer-app order routes live under:

    /api/v1/admin/customer-app-orders

Admin Web and Admin mobile lifecycle actions must remain behaviorally aligned with canonical backend lifecycle APIs.

If one lifecycle path changes:

- verify Web Admin
- verify Admin Android/API
- verify Admin iOS/API where implemented
- verify customer-visible order state
- verify Telegram/Mini App where affected

## Customer application lifecycle status

The newer customer cart/order/location lifecycle has already been exercised across:

- backend cart/order/location tables
- Telegram customer flows
- Telegram Mini App
- Android shared customer API
- Apple/iOS shared customer API
- Admin API
- Admin Web lifecycle paths

Existing verified capabilities include substantial foundations for:

- product catalogue
- cart
- checkout
- delivery/pickup
- customer locations
- saved/preferred/new location selection
- order creation
- order detail/status
- admin-visible order lifecycle

Do not assume that API parity means final customer UI is complete.

Customer Android and Customer iOS UI will receive separate customer-focused UX design work.

## Telegram-specific behavior

Telegram remains one customer channel using the shared backend.

Admin Telegram quick command:

    /o

Existing `/o` behavior must be reconsidered as legacy order logic is consolidated, but until migrated it should continue to follow its verified production behavior.

Open Requests should contain admin-actionable requests only.

For customer selection of an admin/meeting-point location:

- requesting/viewing the location should not itself create an Open Request
- create the Open Request when the customer completes the intended approval/request action
- admin clears actionable requests through supported status actions

When legacy Telegram-specific workflows are migrated to the canonical model, preserve intended business behavior rather than blindly preserving old database implementation details.

## Superadmin

Web page:

    /admin/superadmin

Superadmin capabilities include:

- view protected admin/superadmin accounts
- create database-backed admins
- create database-backed superadmins
- grant/deny access where supported
- delete database-backed credentials
- view website login/action audit logs

Do not allow a currently authenticated superadmin to accidentally deny/delete their own required access unless an explicitly designed safe workflow permits it.

Audit behavior and retention must remain consistent with the implemented backend.

Admin mobile Superadmin functions should eventually reach equivalent functional parity, with role-based visibility.

## Admin Android current direction/status

Active Admin Android application:

    apps/admin-android/

Current active development branch:

    unified-order-v2

Admin Android currently has foundations/screens for:

- authentication/session
- General-first navigation
- orders
- order detail
- products/categories
- customers
- customer detail/reply
- open requests
- meeting points
- settings
- shared design system
- native responsive navigation foundation

Recent design direction:

- Existing Web Admin is the source of truth for Admin workflows.
- `General` is the first authenticated destination.
- Mobile UI should adapt Web Admin functionality to native mobile controls.
- Hamburger/navigation-drawer structure should expose the complete Admin hierarchy.
- Admin Android and iOS must follow the shared design specification.

Latest known Android build verification:

- `compileDebugKotlin`: passed
- `assembleDebug`: passed

Do not treat every partially implemented screen as functionally complete merely because it compiles.

Continue website-to-mobile parity verification screen by screen.

## Admin Android API verified areas

Verified/founded Admin API areas include:

- admin login/me
- admin dashboard/general-related API foundations
- V2 customer-app orders
- products
- product categories
- meeting points
- customers
- customer reply
- settings
- open requests read
- open request single-status mutation
- open request group-done mutation

Existing verification documentation:

    docs/verification/admin-android-api-implementation-contract.md
    docs/verification/v2-customer-order-location-admin-lifecycle.md

Do not rely only on old commit IDs in documentation to determine current truth; inspect current code and latest verification when necessary.

## Open Request API rule

Admin mobile supports safe scoped mutations such as:

- single request status update
- group done

Do not expose dangerous unscoped bulk mutations merely because an old Web Admin action exists.

A future bulk action should have:

- explicit scope
- visible affected set/count
- confirmation
- safe API semantics

## Testing expectations

After Worker code changes:

    cd cloudflare-worker
    node --check src/index.js

After Android source changes:

    cd apps/admin-android
    ./gradlew :app:compileDebugKotlin --no-daemon
    ./gradlew :app:assembleDebug --no-daemon

For backend lifecycle changes, test the affected end-to-end flow rather than only syntax.

Relevant verification may include:

- Telegram
- Telegram Mini App
- Customer Android
- Customer iOS
- Web Admin
- Admin Android
- Admin iOS

Test only the clients affected by the change, but do not ignore cross-client lifecycle consequences.

For Admin Web changes, verify the relevant production pages/routes.

For mobile UI changes, verify on an emulator/simulator or physical device where practical.

## Git workflow

Current active development branch:

    unified-order-v2

Do not follow the old rule that `main`, `cloudflare-worker-d1`, and `worker-next` must always remain identical.

Use the currently active branch for ongoing consolidated development unless explicitly instructed otherwise.

Typical workflow:

    git add <intended files>
    git commit -m "<clear message>"
    git push origin unified-order-v2

Do not use `git add -A` when unrelated local verification artifacts or intentionally untracked files exist.

Commit only the intended files.

Current intentionally local/untracked verification material may include:

    docs/verification/2026-06-30/
    docs/verification/admin-android-api-audit.txt
    verification/android/
    verification/ios/

Do not commit these automatically unless explicitly requested.

Before destructive branch restructuring, merging, deleting branches, or changing production branch strategy, inspect current repository state first.

## Documentation rules

Keep architecture/status documentation current as major decisions change.

Important documents include:

    AGENTS.md
    README.md
    docs/mobile-admin/shared-design-system.md
    docs/mobile-admin/screen-inventory.md
    docs/mobile-admin/website-mobile-parity-matrix.md
    docs/mobile-admin/implementation-roadmap.md
    docs/mobile-admin/decisions.md
    docs/verification/admin-android-api-implementation-contract.md
    docs/verification/v2-customer-order-location-admin-lifecycle.md

Do not leave stale documentation describing abandoned architecture as the active target.

Historical verification notes may retain historical commit/deployment IDs, but current project instructions should describe the current architecture rather than presenting stale IDs as latest truth.

## Final architectural goal

The final system should present one coherent product:

Customer side:

    Telegram Bot
    Telegram Mini App
    Customer Android
    Customer iOS

Shared core:

    Cloudflare Worker
    D1
    Canonical customer/cart/order/location model
    Shared business rules
    Shared multilingual model

Admin side:

    Web Admin
    Admin Android
    Admin iOS

All clients should operate on the same canonical backend truth.

Admin clients should have equivalent workflows adapted natively to each platform.

Customer clients should have equivalent capabilities where appropriate but customer-focused UX.

All five supported languages must be treated equally and standardized throughout the system.
