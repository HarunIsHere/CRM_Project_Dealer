# Admin Android API Implementation Contract

## Purpose

This document defines the backend API surface currently verified for the future Admin Android App.

The Admin Android App must use the Cloudflare Worker backend and Cloudflare D1 database through /api/v1/... endpoints.

## Current branch

unified-order-v2

## Latest verified commits

545dcda Document Admin Android open request API verification
fb50e9c Add admin open request mutation APIs
e39fbad Document Admin Android customer reply verification
ddb5cdb Document Admin Android settings restore verification
d4aea4f Document Admin Android meeting point mutation verification
acc762f Document Admin Android product mutation verification
178f6e1 Document Admin Android API contract verification
36bf5ce Add admin product category detail API

## Base URL

https://crm.ayartuerk.me/api/v1

## Authentication

### Login

Method: POST

Path: /admin/login

Body fields:

- username
- password

Success response includes:

- ok
- token_type
- access_token
- expires_in
- admin

Android usage:

- Store access_token for authenticated requests.
- Send authenticated requests with Authorization: Bearer <access_token>.

### Current admin/session check

Method: GET

Path: /admin/me

Auth required: yes

Success response includes:

- ok
- admin

### Logout

Method: POST

Path: /admin/logout

Auth required: yes

Status:

- endpoint exists
- low-risk route available
- Android can call it when logging out locally

## Dashboard

Method: GET

Path: /admin/dashboard

Auth required: yes

Success response includes:

- ok
- summary
- latest_orders
- latest_requests

Android usage:

- Admin home dashboard
- Recent orders/requests preview

## V2 customer-app orders

### List V2 customer-app orders

Method: GET

Path: /admin/customer-app-orders

Auth required: yes

Success response includes:

- ok
- orders
- count

Verified:

- production read contract passed
- live lifecycle tested

### V2 customer-app order detail

Method: GET

Path: /admin/customer-app-orders/{order_id}

Auth required: yes

Success response includes:

- ok
- order

Verified:

- production read contract passed

### Generic V2 order status update

Method: POST or PATCH

Path: /admin/customer-app-orders/{order_id}/status

Auth required: yes

Body fields:

- status
- note optional

Status:

- endpoint exists
- use only after Android UI status model is finalized

### Delivery on-the-way

Method: POST

Path: /admin/customer-app-orders/{order_id}/on-the-way

Auth required: yes

Verified:

- live production lifecycle passed
- customer sees delivery_status = on_the_way

### Pickup ready-to-pickup

Method: POST

Path: /admin/customer-app-orders/{order_id}/ready-to-pickup

Auth required: yes

Verified:

- live API lifecycle passed
- web admin parity patched and verified
- customer sees pickup_status = ready_to_pickup

### Cancel order

Method: POST

Path: /admin/customer-app-orders/{order_id}/cancel

Auth required: yes

Body fields:

- reason optional

Verified:

- live production lifecycle passed

### Approve addition group

Method: POST

Path: /admin/customer-app-orders/{order_id}/groups/{group_id}/approve

Auth required: yes

Status:

- endpoint exists
- verify later with controlled grouped order

### Reject addition group

Method: POST

Path: /admin/customer-app-orders/{order_id}/groups/{group_id}/reject

Auth required: yes

Body fields:

- reason optional

Status:

- endpoint exists
- verify later with controlled grouped order

## Legacy orders

### Active legacy orders

Method: GET

Path: /admin/orders

Auth required: yes

Success response includes:

- ok
- orders
- count
- closed

### Closed legacy orders

Method: GET

Path: /admin/closed-orders

Auth required: yes

Success response includes:

- ok
- orders
- count
- closed

### Legacy status mutation

Paths:

- /admin/orders/{order_id}/status
- /admin/orders/{order_id}/delivered
- /admin/orders/{order_id}/return

Status:

- endpoints exist
- do not prioritize for Android v1 unless legacy order UI is required

## Products

### List products

Method: GET

Path: /admin/products

Auth required: yes

Success response includes:

- ok
- products
- categories
- count

Verified:

- read contract passed

### Product detail

Method: GET

Path: /admin/products/{product_id}

Auth required: yes

Success response includes:

- ok
- product

Verified:

- read contract passed

### Create product

Method: POST

Path: /admin/products

Auth required: yes

Verified:

- safe production mutation test passed with TEST_ANDROID_API_ record
- test record deleted

### Update product

Method: PATCH or PUT

Path: /admin/products/{product_id}

Auth required: yes

Verified:

- safe production mutation test passed with TEST_ANDROID_API_ record

### Delete product

Method: DELETE

Path: /admin/products/{product_id}

Auth required: yes

Verified:

- safe production mutation test passed
- cleanup confirmed

## Product categories

### List categories

Method: GET

Path: /admin/product-categories

Auth required: yes

Success response includes:

- ok
- categories
- count

Verified:

- read contract passed

### Category detail

Method: GET

Path: /admin/product-categories/{category_id}

Auth required: yes

Success response includes:

- ok
- category

Verified:

- backend gap fixed in commit 36bf5ce
- read contract passed after fix

### Create category

Method: POST

Path: /admin/product-categories

Auth required: yes

Verified:

- safe production mutation test passed with TEST_ANDROID_API_ record

### Update category

Method: PATCH or PUT

Path: /admin/product-categories/{category_id}

Auth required: yes

Verified:

- safe production mutation test passed

### Delete category

Method: DELETE

Path: /admin/product-categories/{category_id}

Auth required: yes

Verified:

- safe production mutation test passed
- cleanup confirmed

## Meeting points

### List meeting points

Method: GET

Path: /admin/meeting-points

Auth required: yes

Success response includes:

- ok
- meeting_points
- count

Verified:

- read contract passed

### Meeting point detail

Method: GET

Path: /admin/meeting-points/{point_id}

Auth required: yes

Success response includes:

- ok
- meeting_point

Verified:

- read contract passed

### Create meeting point

Method: POST

Path: /admin/meeting-points

Auth required: yes

Verified:

- safe production mutation test passed with inactive TEST_ANDROID_API_ record

### Update meeting point

Method: PATCH or PUT

Path: /admin/meeting-points/{point_id}

Auth required: yes

Verified:

- safe production mutation test passed

### Delete meeting point

Method: DELETE

Path: /admin/meeting-points/{point_id}

Auth required: yes

Verified:

- safe production mutation test passed
- cleanup confirmed

### Set preferred/default meeting point

Status:

- not verified for Android v1
- do not implement Android UI action until restore logic is defined
- this touches customer-facing meeting point behavior

## Customers

### List customers

Method: GET

Path: /admin/customers

Auth required: yes

Success response includes:

- ok
- customers
- count

Verified:

- read contract passed

### Customer detail

Method: GET

Path: /admin/customers/{customer_id}

Auth required: yes

Success response includes:

- ok
- customer
- messages
- requests
- locations

Verified:

- read contract passed

### Customer reply

Method: POST

Path: /admin/customers/{customer_id}/reply

Auth required: yes

Body fields:

- message

Verified:

- controlled production test passed
- controlled customer ID: 10
- Telegram delivery confirmed by user

## Settings

### Read settings

Method: GET

Path: /admin/settings

Auth required: yes

Success response includes:

- ok
- settings

Verified settings keys include:

- admin_telegram_chat_id
- working_hours_enabled
- working_hours_timezone
- working_hours_start
- working_hours_end
- working_hours_closed_message
- working_hours_message_mode
- admin_view_language
- allow_preferred_customer_location
- allow_new_customer_location
- allow_customer_pickup
- allowed_delivery_cities
- ai_response_mode
- ai_custom_instructions

### Update settings

Method: PATCH or PUT

Path: /admin/settings

Auth required: yes

Verified:

- ai_response_mode update/restore passed
- final restored value confirmed: ai_fallback

Android rule:

- Settings UI must read current values first.
- Any settings update must preserve unrelated existing values.
- High-impact settings should use restore-safe verification before Android write UI.

## Open requests

### List open requests

Method: GET

Path: /admin/open-requests

Auth required: yes

Success response includes:

- ok
- open_requests
- count

Verified:

- read contract passed

### Single request status update

Method: PATCH or PUT

Path: /admin/open-requests/{request_id}/status

Auth required: yes

Body fields:

- status

Allowed status values:

- new
- in_progress
- done

Verified:

- route exists
- nonexistent request returns not_found
- no real open requests mutated during route verification

### Group done

Method: POST

Path: /admin/open-requests/group/done

Auth required: yes

Body fields:

- customer_id
- request_type
- item_name optional

Verified:

- route exists
- no-match test with controlled customer ID 10 updated 0 rows
- no real open requests mutated

### Global all-done

Status:

- intentionally not exposed for Android v1

Reason:

- current web behavior marks every non-done customer request as done globally
- Android-safe bulk done must require scope/filter/confirmation before implementation

## Current Android readiness

Admin Android API is ready for read-only UI planning and core safe mutation UI planning.

Ready for Android UI planning:

- login/session
- dashboard
- V2 order list/detail
- V2 order lifecycle actions already verified
- product/category management
- meeting point management except preferred/default
- customer list/detail
- customer reply
- settings read and limited restore-safe update
- open requests read
- open request single status and group done

Not ready or deferred:

- global all-done
- preferred/default meeting point mutation
- V2 group approve/reject without controlled grouped order verification
- legacy order mutation UI unless legacy order support is explicitly required

## Required Android implementation rule

Android must not duplicate business logic locally.

Android should:

- call /api/v1 endpoints
- render server response data
- submit explicit admin actions
- handle API errors directly
- avoid local-only order/status assumptions

Backend remains the source of truth.
