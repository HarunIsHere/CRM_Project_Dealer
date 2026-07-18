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

## Immediate next implementation target

Admin Android Phase 1:

1. Create semantic theme tokens.
2. Create reusable Compose components.
3. Replace the prototype bottom button rows.
4. Add five-item bottom navigation:
   - Dashboard
   - Orders
   - Requests
   - Customers
   - More
5. Add role-aware More screen.
6. Apply safe-area handling.
7. Rebuild and test on the emulator.
