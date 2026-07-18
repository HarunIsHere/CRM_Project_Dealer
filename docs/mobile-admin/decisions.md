# Admin Mobile Design Decisions

## Confirmed

### Product scope

The admin website is the reference for:

- Admin Android
- Admin iOS

Customer-facing mobile apps will receive a separate customer-focused design process later.

### Visual direction

Confirmed direction:

- preserve website workflows
- preserve terminology
- preserve colors
- preserve information hierarchy
- preserve status meanings
- use native mobile controls
- adapt layout for phone and tablet screens

### Cross-platform design system

Confirmed:

- one shared documented design system
- native Jetpack Compose implementation
- native SwiftUI implementation

### Navigation recommendation

Phone:

- Dashboard
- Orders
- Requests
- Customers
- More

Tablet:

- navigation rail or side navigation

### Table adaptation

Confirmed direction:

- cards and list rows on phones
- list/detail layouts where practical
- tables only on sufficiently wide tablet screens

### Customer apps

Customer Android, Customer iOS, and customer Mini App are excluded from this admin design mapping.

## Pending decisions

- phone landscape support
- first-release dark mode
- push notifications
- biometric unlock
- product image upload
- final legacy-order scope
- final tablet minimum width targets
