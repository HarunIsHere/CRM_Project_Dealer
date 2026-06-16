# Admin User Manual — CRM Delivery

This manual explains how admins use the CRM Delivery system from Telegram and from the website.

Production website:

    https://crm.ayartuerk.me/admin/

Telegram bot:

    @SpecialDeliveryBerlinBot

Direct bot link:

    https://t.me/SpecialDeliveryBerlinBot

---

## 1. Admin roles

### Normal admin

A normal admin can:

- receive Telegram notifications
- reply to customers
- use the admin website
- manage products
- manage meeting points
- manage open requests
- manage orders
- mark deliveries as delivered
- view customers and customer history

### Superadmin

A superadmin can do everything a normal admin can do.

Additionally, superadmin can:

- create admins
- create other superadmins
- deny/grant access for database-backed admins
- delete database-backed admin credentials
- view website login/action audit logs

Superadmin page:

    https://crm.ayartuerk.me/admin/superadmin

Env-protected admin accounts are visible but cannot be deleted from the website.

The currently logged-in superadmin cannot deny or delete their own access.

---

## 2. Telegram admin setup

### Set normal admin receiver

Use this command in Telegram:

    /setadmin <ADMIN_SETUP_CODE>

Example:

    /setadmin Selchower

This saves your Telegram chat as the active admin notification receiver.

Only the active admin receiver receives customer/admin notifications.

### Superadmin takeover

Use this command in Telegram:

    /setsuperadmin <SUPERADMIN_BOT_SETUP_CODE>

This lets the superadmin take over the active admin Telegram receiver.

Use it when the current admin phone/chat should be replaced.

---

## 3. Telegram admin commands

### Open web admin panel

Use:

    /w

The bot sends buttons to open:

- Admin web panel
- Open Requests

### Show closable orders

Use:

    /o

The bot lists orders that can be marked delivered from Telegram.

The `/o` list includes:

- all orders with status `on_the_way`
- orders with status `ready_to_delivery` only when the customer approved one of our own meeting points

Each listed order has a button:

    Delivered #<order_id>

Pressing it:

- marks only that order as delivered
- moves it to Closed Orders
- notifies the customer
- refreshes the Telegram order list

---

## 4. Telegram admin notifications

Admins may receive Telegram notifications for:

- unresolved customer messages
- customer product requests
- customer delivery locations
- customer contact-admin requests
- customer location descriptions

### Delivery-location notification

When a customer sends or confirms a delivery location, the admin Telegram message includes:

- customer name
- Telegram ID
- customer basket
- order total
- location text
- Google Maps link
- ETA buttons

ETA buttons usually include options such as:

- 15 min
- 30 min
- 45 min
- 60 min
- No delivery

When admin presses an ETA button:

- customer receives an automatic multilingual delivery message
- order becomes `on_the_way`

When admin presses `No delivery`:

- customer receives a no-delivery message
- order becomes `not_delivered`

---

## 5. Website login

Admin login page:

    https://crm.ayartuerk.me/admin/login

Login supports:

- normal admin credentials
- superadmin credentials
- database-backed admin credentials created by superadmin

Admin password can be changed from the website.

Change password page:

    https://crm.ayartuerk.me/admin/change-password

---

## 6. Website navigation

Main admin website:

    https://crm.ayartuerk.me/admin/

Main pages:

- General
- Open Requests
- Orders
- Closed Orders
- Products
- Meeting Points
- AI Info
- Customers
- Superadmin, visible only for superadmin

---

## 7. Open Requests

Open Requests page:

    https://crm.ayartuerk.me/admin/openrequests/

Open Requests shows customer requests that need admin attention.

Examples:

- customer asks to contact admin
- customer requests a specific product
- customer sends a delivery location
- customer sends a location description
- customer approves delivery at our meeting point

Product-list requests are not shown because they do not need admin action.

### Done button

Use `Done` to clear one grouped request row.

### All Done button

Use `All Done` to clear all currently open requests.

Only admins clear requests. Customer approval does not clear a request.

### Meeting-point location timing

For our-location / meeting-point flow:

1. Customer asks for location.
2. Bot shows the location and asks customer to approve.
3. Open Request is not created yet.
4. Customer presses `Approve delivery at this location`.
5. Open Request appears.
6. Admin clears it with `Done` or `All Done`.

---

## 8. Orders

Orders page:

    https://crm.ayartuerk.me/admin/orders

Orders page shows active non-delivered orders.

It includes:

- order ID
- customer
- status
- basket/items
- total
- location/map
- created/updated time
- status controls
- delivered button

### Order statuses

Order statuses:

- `in_progress`
- `waiting_location`
- `ready_to_delivery`
- `on_the_way`
- `not_delivered`
- `delivered`

### Change order status

Admins can manually change order status from the Orders page.

When status changes, the customer receives a matching multilingual message.

### Mark delivered

Use the delivered button when the delivery is completed.

Delivered orders move to Closed Orders.

---

## 9. Closed Orders

Closed Orders page:

    https://crm.ayartuerk.me/admin/closedorders

Closed Orders shows delivered orders.

A closed order can be returned to active orders.

Returning a closed order:

- changes status to `not_delivered`
- moves it back to Orders
- notifies the customer

---

## 10. Products

Products page:

    https://crm.ayartuerk.me/admin/products

Admins can:

- add products
- update products
- delete/deactivate products
- set price
- assign product categories
- edit manual aliases

Products appear to customers in product menus and product request flows.

### Product aliases

Aliases help the bot recognize customer product messages.

Example:

Product:

    Güllü Dogan

Possible aliases:

    güllü dogan
    gullu dogan
    güllü
    gullu
    dogan

Manual aliases are comma-separated.

---

## 11. Meeting Points

Meeting Points page:

    https://crm.ayartuerk.me/admin/meeting-points

Admins can manage business/meeting locations.

Each meeting point has:

- name
- address
- Google Maps link
- active/inactive status
- preferred status

Customers can choose active meeting points during checkout.

If only one meeting point is active, the bot shows it directly.

If multiple meeting points are active, the customer receives selection buttons.

---

## 12. Customers

Customers page:

    https://crm.ayartuerk.me/admin/customers

Admins can view:

- customer list
- customer names/usernames
- Telegram IDs
- language
- last seen time

Customer detail pages include:

- compact customer information
- structured requests
- customer locations
- conversation history
- Message Customer button

Customer detail URL format:

    https://crm.ayartuerk.me/admin/customers/<customer_id>

---

## 13. Message Customer

Admins can message customers from:

- Customers page
- Customer detail page
- Telegram admin notification buttons

Messages are sent through the Telegram bot.

The message is stored in the customer conversation history.

---

## 14. AI Info

AI Info page:

    https://crm.ayartuerk.me/admin/ai

Admins can review AI-related information, learned patterns, and approval/rejection/delete actions if AI fallback is enabled.

---

## 15. General settings

General settings are on:

    https://crm.ayartuerk.me/admin/

Admins can configure:

- admin view language
- working-hours restrictions
- working-hours timezone
- start/end time
- closed-hours message mode
- custom closed-hours message
- delivery cities
- fulfillment/location options
- AI response mode
- custom AI instructions

---

## 16. Working hours

Working-hours restrictions can block certain requests outside working hours.

Usually allowed outside working hours:

- product list
- contact admin

Usually blocked outside working hours:

- product-specific orders
- delivery location
- meeting point choice
- typed address
- shared Telegram location

The customer receives a multilingual closed-hours message.

---

## 17. Delivery city rules

Delivery cities restrict typed-address search.

Default city:

    Berlin

When customer types an address:

- address search uses Nominatim/OpenStreetMap
- suggestions are restricted to allowed delivery cities
- if postal code is present, result must match postal code
- German street typo correction/fallback search may be used

If the city is outside the allowed list, customer is offered:

- contact admin to describe location
- cancel location entry

---

## 18. Checkout flow

Typical customer order flow:

1. Customer sends product name.
2. Bot recognizes product.
3. Bot asks quantity if needed.
4. Product is added to basket.
5. Customer can view basket, continue shopping, edit basket, clear basket, or checkout.
6. Customer starts checkout.
7. Customer selects location method.
8. Order becomes ready for delivery after location is confirmed.
9. Admin receives order/location notification.
10. Admin sends ETA or marks no delivery.
11. Order becomes on the way or not delivered.
12. Admin marks delivered when completed.

---

## 19. Customer location options

During checkout customer can:

- type delivery address
- contact admin to describe location
- see our locations
- cancel location entry

### Type address

Customer types an address.

Bot searches address suggestions.

Customer selects one.

Location is stored.

Admin receives map and basket.

### Contact admin to describe location

Customer chooses contact admin.

Bot asks for location description.

Customer sends description.

Open Request is created.

Admin receives description.

### See our locations

Customer asks for our location.

Bot shows active meeting point.

Customer must approve.

Open Request is created only after approval.

---

## 20. Superadmin page

Superadmin page:

    https://crm.ayartuerk.me/admin/superadmin

Superadmin can:

- view admins
- create admins
- create superadmins
- deny access
- grant access
- delete database-backed credentials
- view website audit logs

### Deny access

Disables a database-backed admin credential.

The admin can no longer log in.

### Grant access

Re-enables a disabled database-backed admin credential.

### Delete credential

Deletes a database-backed admin credential from D1.

This removes the login from the system.

### Audit logs

Audit logs show website login/action data:

- time
- admin username
- role
- action type
- action detail
- method
- path
- IP
- user agent

Only the last 30 days are kept.

Older logs are deleted during admin page access.

---

## 21. Recommended admin workflow

Daily admin workflow:

1. Open Telegram bot admin chat.
2. Watch customer notifications.
3. Open website admin panel.
4. Check Open Requests.
5. Check Orders.
6. Send ETAs from Telegram when delivery location arrives.
7. Mark delivered from `/o` or Orders page.
8. Clear Open Requests with Done or All Done.
9. Review Customers if context is needed.

---

## 22. Troubleshooting

### Admin does not receive Telegram notifications

Check:

- correct admin receiver is set with `/setadmin`
- superadmin did not take over receiver
- bot is reachable
- Worker deployment is active

### Customer request appears too early

For meeting-point location flow, Open Request should appear only after customer approval.

If it appears before approval, check `sendMeetingPointChoiceOrDirect` for early `logCustomerRequest(..., "location", ...)`.

### Done button does not clear row

The Done form must submit the raw DB `request_type`, not translated text.

The hidden field should use:

    item.request_type

not:

    i18nRequestType(...)

### Admin cannot see Superadmin page

Only superadmin sessions can access:

    /admin/superadmin

Normal admins receive forbidden access.

### Migration says duplicate column

This may happen when a migration was applied manually before Wrangler migration tracking was updated.

Check:

    d1_migrations

and mark already-applied migrations there only after confirming the schema exists.

---

## 23. Important safety rules

- Do not share admin passwords or setup codes in public chats.
- Do not expose Telegram bot token.
- Do not delete env-protected admin credentials from the web UI.
- Do not allow current superadmin to deny/delete their own access.
- Do not commit temporary backup files.
- Test `node --check src/index.js` before deploying code changes.
