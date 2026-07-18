# Admin Website to Mobile Screen Inventory

## Scope

This inventory maps the current admin website to Admin Android and Admin iOS.

## Authentication

### Login

Website functions:

- username
- password
- login
- forgot password

Mobile screens:

- Admin Login
- Forgot Password
- Reset Password

### Change Password

Website functions:

- current/new password flow
- password update

Mobile screen:

- Change Password

## Dashboard and General

### General

Website sections:

- Admin Language
- Notification Settings
- Working Hours
- Fulfillment and Location Options
- Delivery Cities
- Bot Response Mode
- AI Project Instructions
- Change Password
- Logout

Mobile mapping:

- More
  - General Settings
    - Admin Language
    - Notification Receiver
    - Working Hours
    - Fulfillment Options
    - Delivery Cities
    - Bot Response Mode
    - AI Project Instructions
  - Change Password
  - Logout

## Open Requests

Website functions:

- grouped request list
- customer
- request type
- item
- quantity
- request count
- status
- latest text
- created time
- map link
- open customer
- answer
- done
- group done
- all done

Mobile screens:

- Open Requests List
- Request Filter Sheet
- Answer Composer
- Customer Detail
- Map external action

Mobile v1 exclusions:

- global All Done

## Orders

Website functions:

- active orders
- order detail
- delivery/pickup statuses
- customer
- items
- total
- location
- timestamps
- admin note
- on the way
- delivered
- not delivered
- ready to pick up
- picked up/delivered
- cancel

Mobile screens:

- Orders List
- Order Filter Sheet
- Order Detail
- Order Action Sheet
- Cancel Confirmation
- Location external map action

## Closed Orders

Website functions:

- closed/cancelled order list
- detail
- status
- items
- total
- location
- timestamps
- notes

Mobile screens:

- Closed Orders List
- Closed Order Detail
- Closed Order Filter Sheet

## Products

Website functions:

- product search and filters
- create product
- edit product
- save
- delete
- active status
- category
- price
- aliases

Mobile screens:

- Products List
- Product Filter Sheet
- Create Product
- Edit Product
- Delete Product Confirmation

## Categories

Website functions:

- create
- edit
- active status
- save
- delete

Mobile screens:

- Categories List
- Create Category
- Edit Category
- Delete Category Confirmation

Products and Categories should use a segmented tab structure within one catalogue section.

## Meeting Points

Website functions:

- list
- create
- edit
- active
- preferred
- set preferred
- delete
- location search
- address
- Google Maps link
- open map

Mobile screens:

- Meeting Points List
- Create Meeting Point
- Edit Meeting Point
- Location Search
- Replace Preferred Confirmation
- Delete Confirmation

## AI Information

Website functions:

- AI response counters
- learned patterns
- pattern
- intent
- product
- response
- status
- hits
- approve
- reject
- delete

Mobile screens:

- AI Information Dashboard
- Learned Patterns List
- Learned Pattern Detail
- Pattern Filter Sheet
- Delete Pattern Confirmation

## Customers

Website functions:

- search by ID
- search by name/username
- language filter
- last-seen date range
- open customer
- message customer
- delete

Mobile screens:

- Customers List
- Customer Filter Sheet
- Customer Detail
- Customer Conversation
- Customer Locations
- Customer Requests
- Delete Customer Confirmation

## Superadmin

Website functions:

- admin account list
- roles
- active status
- source
- creation time
- last login
- deny access
- delete credential
- create admin
- website/API action audit logs

Mobile screens:

- Admin Accounts List
- Admin Account Detail
- Create Admin
- Audit Log
- Audit Log Detail
- Audit Filter Sheet
- Deny Access Confirmation
- Delete Credential Confirmation

Superadmin screens must only be visible to superadmin users.

## Navigation mapping

### Phone bottom navigation

- Dashboard
- Orders
- Requests
- Customers
- More

### More

- Closed Orders
- Products and Categories
- Meeting Points
- AI Information
- General Settings
- Superadmin, permission dependent
- Change Password
- Logout

## Tablet mapping

Use navigation rail or side drawer.

Recommended split views:

- Orders list and detail
- Customers list and detail
- Products list and editor
- AI patterns list and detail
- Admin accounts list and detail
