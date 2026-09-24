# Admin Mobile Implementation Roadmap

## Goal

Build Admin Android and Admin iOS with the same workflows and design language as the admin website, adapted for native mobile use.

## Phase 1 — Shared foundation

Deliverables:

- shared design-system document
- semantic color tokens
- typography tokens
- spacing tokens
- reusable cards
- reusable buttons
- reusable status chips
- reusable form controls
- safe-area handling
- keyboard-safe forms
- loading, empty, error, and success components
- confirmation dialog component
- role-aware navigation model
- phone bottom navigation
- tablet navigation rail/side navigation

Android work:

- replace prototype navigation
- create Compose theme and component package
- create page scaffold
- create More screen
- create safe-area and responsive layout helpers

iOS work:

- create SwiftUI design tokens
- create reusable component package
- create tab navigation and More screen
- create responsive tablet navigation

## Phase 2 — Core operations

Screens:

- Dashboard
- Orders
- Order Detail
- Open Requests
- Customers
- Customer Detail
- Customer Conversation

Requirements:

- website terminology
- status chips
- pull to refresh
- filters
- context-aware actions
- map links
- confirmations
- error feedback

## Phase 3 — Catalogue and locations

Screens:

- Products
- Product Filter
- Create/Edit Product
- Categories
- Create/Edit Category
- Meeting Points
- Create/Edit Meeting Point
- Location Search

Requirements:

- complete CRUD parity
- delete confirmations
- active/preferred status
- external map opening

## Phase 4 — General settings and AI

Screens:

- Settings Overview
- Admin Language
- Notification Receiver
- Working Hours
- Fulfillment Options
- Delivery Cities
- Bot Response Mode
- AI Project Instructions
- AI Information Dashboard
- Learned Patterns
- Learned Pattern Detail

Requirements:

- preserve unrelated settings during updates
- server-confirmed values after save
- explanatory information panels
- mutation feedback

## Phase 5 — Administration

Screens:

- Closed Orders
- Closed Order Detail
- Superadmin Accounts
- Create Admin
- Audit Log
- Audit Detail
- Change Password
- Forgot Password
- Reset Password

Requirements:

- role-based visibility
- confirmation for account changes
- 30-day audit retention explanation
- secure password controls

## Phase 6 — Quality and release preparation

Tasks:

- tablet layouts
- screen-reader testing
- dynamic text testing
- keyboard testing
- emulator/device matrix
- API error testing
- session-expiry handling
- lifecycle action verification
- controlled mutation verification
- Android UI tests
- iOS UI tests
- release builds

## Current Admin Android checkpoint

The current Android implementation includes:

- login, token restoration, logout, and recovery-email initiation
- dashboard summary and latest-record rendering
- complete general settings editing
- active and closed order lists and details
- delivery and pickup lifecycle actions
- group approval and rejection
- safe cancelled-order recreation with one active successor
- open-request actions, including the confirmed all-done operation
- customer filters, details, messaging, replies, and confirmed deletion
- product, category, and meeting-point management
- AI counters and learned-pattern actions
- superadmin account management and audit-log listing
- administrator password change
- English, German, Turkish, Arabic, and Russian shared localization

## Immediate next implementation target

Admin Android parity closure and safety:

1. Manually verify dashboard response mapping, empty states, and errors.
2. Complete the recovery-code verification and password-reset screens.
3. Add confirmations for destructive catalogue, meeting-point, AI-pattern, and superadmin actions.
4. Add audit-log detail and the 30-day retention explanation.
5. Replace the drawer-only phone navigation with the planned five-item bottom navigation and role-aware More screen.
6. Add the planned tablet navigation rail or side navigation.
7. Run accessibility, dynamic-text, session-expiry, and Android UI-test coverage.
