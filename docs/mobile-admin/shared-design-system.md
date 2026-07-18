# Shared Admin Mobile Design System

## Scope

This design system applies to:

- Admin Android
- Admin iOS

It does not apply to customer-facing mobile apps.

Native implementations:

- Android: Kotlin and Jetpack Compose
- iOS: Swift and SwiftUI

Both apps must preserve the admin website's:

- workflows
- terminology
- information hierarchy
- primary blue actions
- destructive red actions
- status meanings
- grouped panels
- direct navigation
- operational behavior

The mobile apps must use native controls and layouts adapted for phone and tablet screens.

## Design principles

1. Preserve website workflows.
2. Adapt desktop tables into mobile cards and detail screens.
3. Keep important operational actions easy to reach.
4. Do not place controls under status bars, cameras, notches, or system navigation.
5. Keep destructive actions visually distinct and confirmed.
6. Use the backend as the source of business logic and status truth.
7. Use identical terminology across website, Android, and iOS.
8. Hide unavailable role-based sections rather than showing unusable controls.
9. Support loading, empty, error, success, and retry states on every data screen.
10. Use responsive layouts based on available width.

## Website-derived color tokens

| Token | Value | Use |
|---|---:|---|
| Background | #F4F6F8 | Main page background |
| Surface | #FFFFFF | Cards, forms, panels |
| Primary | #2563EB | Main actions, selected navigation |
| Primary pressed | #1D4ED8 | Pressed and hover equivalent |
| Danger | #DC2626 | Delete, cancel, deny access |
| Success | #16A34A | Delivered, approved, active |
| Warning | #D97706 | Pending, in progress |
| Text primary | #1F2937 | Main text |
| Text secondary | #6B7280 | Supporting text |
| Border | #D9DEE7 | Card and control borders |
| Information background | #EEF2FF | Explanatory information panels |
| Information text | #1E3A8A | Information panel text |

Platform implementations may adjust contrast slightly to meet accessibility requirements.

## Spacing tokens

| Token | Size |
|---|---:|
| XXS | 4 |
| XS | 8 |
| S | 12 |
| M | 16 |
| L | 24 |
| XL | 32 |

Phone page horizontal padding:

- 16 dp on Android
- 16 pt on iOS

Tablet page horizontal padding:

- 24 dp on Android
- 24 pt on iOS

## Shape tokens

| Component | Radius |
|---|---:|
| Main panel/card | 14 |
| Input | 10 |
| Button | 10 |
| Status chip | 999 |
| Modal sheet top corners | 20 |

## Touch targets

Minimum interactive size:

- Android: 48 dp
- iOS: 44 pt

Important operational actions should use at least 48 dp/pt height where practical.

## Typography hierarchy

Use native platform fonts.

| Role | Android | iOS |
|---|---|---|
| Screen title | headlineSmall | title2 |
| Section title | titleMedium | headline |
| Card title | titleSmall | subheadline semibold |
| Body | bodyMedium | body |
| Supporting text | bodySmall | footnote |
| Button label | labelLarge | headline/button |
| Status chip | labelMedium | caption semibold |

## Surfaces and cards

Cards should use:

- white surface
- 14 dp/pt corner radius
- light border
- subtle elevation or shadow
- 16 dp/pt internal padding
- 12 to 16 dp/pt spacing between cards

Cards should contain one clear information group.

Avoid placing a desktop table row directly into a horizontally scrolling phone table.

## Buttons

### Primary

Use for the main action:

- blue background
- white label
- minimum 48 dp/pt height
- one primary action per section where practical

Examples:

- Save
- Create Product
- Send Reply
- Mark Delivered

### Secondary

Use for alternative actions:

- blue outline or neutral surface
- primary-colored label

Examples:

- Refresh
- Open Map
- Cancel form
- Clear Filters

### Destructive

Use for irreversible or damaging actions:

- red background or red outline
- explicit confirmation dialog

Examples:

- Delete
- Cancel Order
- Deny Access
- Delete Credential

## Status chips

Recommended status colors:

| Status | Color role |
|---|---|
| New | Primary |
| In progress | Warning |
| Submitted | Primary |
| Ready to pick up | Purple/indigo |
| On the way | Indigo |
| Delivered | Success |
| Picked up | Success |
| Cancelled | Danger |
| Not delivered | Danger |
| Pending | Warning |
| Approved | Success |
| Rejected | Danger |
| Active | Success |
| Inactive | Neutral gray |

The backend-provided status text must remain unchanged unless a documented localized label is used.

## Forms

Mobile forms must use vertical layout:

1. Label
2. Input
3. Helper or validation text
4. Space before next field

Long forms should use:

- scrollable content
- sticky Save action at the bottom
- keyboard-safe layout
- disabled Save while submitting
- explicit success feedback

Password fields must:

- hide characters by default
- include show/hide control
- support password managers
- avoid displaying saved password values in plain text

## Lists and tables

Desktop tables become:

- cards for operational records
- compact list rows for simple records
- dedicated detail screens for full content
- expandable sections for secondary information

Tablet layouts may use:

- two-column list/detail
- wider compact tables
- navigation rail
- permanent side navigation

## Navigation

### Phone bottom navigation

Primary destinations:

1. Dashboard
2. Orders
3. Requests
4. Customers
5. More

### More screen

Contains:

- Closed Orders
- Products and Categories
- Meeting Points
- AI Information
- General Settings
- Superadmin, role dependent
- Change Password
- Logout

### Tablet navigation

Use:

- navigation rail, or
- permanent side drawer

Tablet list/detail screens should use split layouts when space allows.

## Top app bar

The app bar should contain:

- back action when needed
- page title
- refresh or contextual overflow action

Do not place all page actions in the top bar.

All app bars must respect:

- status bar
- camera cutout
- device notch
- landscape insets

## Action placement

Use:

- floating action button for create actions
- sticky bottom action area for order lifecycle
- bottom sheet for multiple contextual actions
- overflow menu for uncommon or destructive actions
- confirmation dialog for destructive changes

## Filters

Filters should open in a modal bottom sheet on phones.

The sheet should contain:

- filter controls
- Clear action
- Apply action
- current active-filter count

Tablet layouts may show a persistent filter panel.

## Feedback states

Every data screen must include:

### Loading

- skeleton cards or native progress state
- preserve current content during refresh where practical

### Empty

- clear empty-state title
- short explanation
- relevant create or refresh action

### Error

- readable message
- Retry action
- preserve previously loaded data where possible

### Success

- native snackbar, toast, banner, or inline message
- identify what changed

### Confirmation

Required for:

- delete
- cancel order
- deny access
- delete credential
- bulk status mutation
- replacing a preferred meeting point

## Accessibility

Required:

- minimum touch targets
- dynamic text support
- semantic labels
- visible focus state
- sufficient color contrast
- status meaning not communicated by color alone
- screen-reader descriptions for icons
- keyboard navigation for tablet/external keyboard
- reduced-motion compatibility

## Orientation and responsive behavior

Recommended:

- phones: portrait-first
- tablets: portrait and landscape
- layouts respond to available width, not named device models

Width categories:

| Width | Layout |
|---|---|
| Compact | Single-column phone layout |
| Medium | Wider cards and optional two-column sections |
| Expanded | Navigation rail and list/detail split |

## Dark mode

Dark mode is not required for the first release.

All colors must still be implemented as semantic tokens so dark mode can be added later without redesigning every screen.

## Shared component inventory

Both platforms need equivalent native components:

- AdminPageScaffold
- AdminTopBar
- AdminBottomNavigation
- AdminMoreMenu
- AdminCard
- AdminSectionHeader
- AdminPrimaryButton
- AdminSecondaryButton
- AdminDangerButton
- AdminStatusChip
- AdminInfoPanel
- AdminSearchField
- AdminFilterSheet
- AdminTextField
- AdminPasswordField
- AdminToggleRow
- AdminPickerRow
- AdminDateTimeField
- AdminLoadingState
- AdminEmptyState
- AdminErrorState
- AdminConfirmationDialog
- AdminStickyActionBar
- AdminMapAction
