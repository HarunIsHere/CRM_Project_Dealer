# Android Apps Roadmap — CRM Delivery

This roadmap defines the production plan for building two Android apps from the existing CRM Delivery project.

Apps:

1. Admin Android App
2. Customer Android App

The existing Cloudflare Worker + D1 backend remains the source of truth.

Telegram, the current admin website, the Admin Android App, and the Customer Android App are clients of the same backend.

---

## 1. Mandatory language support

Supported languages from the start:

- English
- German
- Turkish
- Arabic
- Russian

Rules:

- Customer-facing text must exist in all 5 languages.
- Customer app UI must support all 5 languages from the first production version.
- Admin app UI must support all 5 languages from the first production version.
- Push notifications must support all 5 languages.
- Backend/API error messages intended for app display must support all 5 languages.
- Arabic must be handled with RTL-ready UI design.
- New buttons/statuses/messages must not be added in English only.

---

## 2. Core production principle

Backend stays source of truth.

Business logic must not live only inside Android.

The Android apps must call backend APIs for authentication, role checks, products, basket, checkout, customer locations, meeting points, open requests, orders, messages, admin actions, superadmin actions, audit logs, and notification registration.

---

## 3. Target architecture

Admin Android App + Customer Android App + Current Admin Website + Telegram Bot -> Cloudflare Worker API -> Cloudflare D1.

Current active backend:

    cloudflare-worker/src/index.js

Current production:

    https://crm.ayartuerk.me

Current bot:

    @SpecialDeliveryBerlinBot

---

## 4. Admin Android App

The Admin App will include all current website-admin and Telegram-admin functionality.

Admin App users:

- admin
- superadmin

Admin App must support:

- login
- dashboard
- open requests
- orders
- closed orders
- customers
- customer detail
- message customer
- products
- product aliases
- product categories
- meeting points
- AI info / learned patterns
- working-hours settings
- fulfillment/location settings
- delivery city settings
- Telegram-admin replacement features
- superadmin admin management
- audit logs
- push notifications

---

## 5. Customer Android App

The Customer App will include all customer ordering functions.

Customer App must support:

- language selection
- product catalog
- product search
- product detail
- add to basket
- basket view
- basket edit/remove
- checkout
- typed address
- shared device location
- meeting point selection
- meeting point approval
- contact admin / support message
- order status tracking
- messages
- saved locations
- preferred location
- order history
- push notifications

---

## 6. Backend API foundation

Add versioned API endpoints under:

    /api/v1/...

Do not remove current web or Telegram routes.

The current admin website and Telegram bot must continue working while mobile APIs are added.

---

## 7. Admin API roadmap

Required API groups:

- admin auth: login, logout, me
- dashboard
- open requests: list, done, all done
- orders: list, detail, status, ETA, no delivery, delivered
- closed orders: list, return
- customers: list, detail, messages
- products: list, create, update, delete/deactivate
- product categories
- product aliases
- meeting points
- settings
- AI / learned patterns
- superadmin admins and audit logs
- admin device-token registration

---

## 8. Customer API roadmap

Required API groups:

- customer auth/session
- language selection
- product catalog
- product search
- basket add/update/remove/clear
- checkout start
- typed address and address suggestions
- meeting point select and approval
- contact admin
- cancel location entry
- saved locations and preferred location
- current order
- order history
- messages
- customer device-token registration

---

## 9. Database additions for mobile apps

Recommended additive tables:

- admin_sessions
- customer_sessions
- admin_device_tokens
- customer_device_tokens
- notification_events
- customer_app_profiles
- api_audit_logs

Already created:

- admin_users
- admin_audit_logs

Rules:

- Do not rename current production tables until API is stable.
- Do not break Telegram.
- Do not break current admin website.
- Keep migrations additive when possible.

---

## 10. Android technical stack

Recommended stack:

- Kotlin
- Jetpack Compose
- Material 3
- Kotlinx Serialization
- Ktor or Retrofit
- DataStore
- Firebase Cloud Messaging
- Google Maps intent / maps integration
- Crash reporting hooks
- Modular architecture

Suggested repo structure:

    android/
      admin-app/
      customer-app/
      shared/

Shared module should contain API client, models, auth/session handling, language/i18n models, design system, formatting utilities, status enums, and common UI components.

---

## 11. Production UI standards

Both apps must include from the start:

- professional UI
- loading states
- empty states
- error states
- confirmation dialogs
- role-safe screens
- accessible touch targets
- proper color contrast
- RTL readiness for Arabic
- status colors
- consistent typography
- reusable components
- responsive phone layouts
- clear navigation

Admin App UI style: compact, operational, fast action buttons, clear order status, clear customer context, visible map/location, basket visible before ETA/delivery decisions.

Customer App UI style: simple, product-first, clear basket, simple checkout, easy location approval, obvious order status.

---

## 12. Push notifications

Include architecture from the start.

Admin notifications:

- new open request
- new delivery location
- order ready to delivery
- customer message
- order status needing action

Customer notifications:

- admin replied
- ETA sent
- order on the way
- no delivery
- delivered
- order status changed

Backend must store device tokens and notification events.

---

## 13. Security requirements

Admin App:

- secure token storage
- HTTPS only
- role-based API access
- superadmin-only endpoints
- audit sensitive actions
- prevent superadmin self-deny/self-delete
- session expiration
- no secrets in app code

Customer App:

- customer sees only own data
- no admin data exposed
- protected customer session
- safe location handling
- clear privacy behavior

Backend:

- strict auth middleware
- validate all input
- sanitize user/admin text
- audit admin actions
- never expose Telegram bot token
- never expose Worker secrets

---

## 14. Development milestones

Milestone 1 — API foundation:

- API route structure
- admin auth API
- customer auth/session plan
- shared response format
- API error format
- language-aware API text strategy

Milestone 2 — Admin API:

- open requests API
- orders API
- customer API
- products API
- meeting points API
- superadmin API
- audit logs API

Milestone 3 — Customer API:

- products/catalog API
- basket API
- checkout API
- location API
- order status API
- messages API

Milestone 4 — Android project setup:

- android/admin-app
- android/customer-app
- android/shared
- design system base
- networking layer
- secure token storage
- language framework

Milestone 5 — Admin App v1:

- login
- dashboard
- open requests
- orders
- ETA/no delivery
- closed orders
- customers
- products
- meeting points
- superadmin

Milestone 6 — Customer App v1:

- language selection
- product catalog
- basket
- checkout
- location methods
- order status
- messages
- saved locations

Milestone 7 — Push notifications:

- FCM setup
- admin notifications
- customer notifications
- device token management
- notification logs

Milestone 8 — Production hardening:

- crash reporting
- staging/prod split
- Play Store assets
- privacy policy
- terms/support contact
- monitoring
- QA test checklist

---

## 15. Include from the start

Include these immediately because they should not break the project if designed correctly:

- multilingual support
- API versioning
- shared models
- shared design system
- secure token storage
- role-based access
- audit logging
- push notification data model
- device token registration endpoints
- proper loading/error/empty states
- RTL-ready UI structure
- crash reporting hooks
- staging/prod environment separation
- accessibility basics

---

## 16. Keep ready, implement later if risky

Keep architecture ready for these, but do not block initial app creation:

- full analytics dashboard
- advanced reporting
- advanced offline mode
- biometric unlock
- deep address dataset matching
- full Telegram replacement
- public Play Store release
- advanced admin permission matrix
- advanced customer loyalty/profile features

---

## 17. First implementation step

Start with backend APIs.

First API work should define JSON response format, auth/session helpers, admin API auth, role checks, language-aware API responses, and reusable DB mapping helpers.

Do not start Android UI before the first API contract is stable.
