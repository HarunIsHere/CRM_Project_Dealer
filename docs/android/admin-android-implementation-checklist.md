# Admin Android Implementation Checklist

## Goal

Build the Admin Android App against the verified backend API contract.

Backend contract source:

    docs/verification/admin-android-api-implementation-contract.md

Base URL:

    https://crm.ayartuerk.me/api/v1

## Implementation order

### Phase A - App foundation

Status: ready

Tasks:

- Create Android app project structure
- Add API client layer
- Add auth token storage
- Add global loading/error handling
- Add environment config for production base URL
- Add basic navigation shell

Done when:

- App starts
- API base URL is configured
- Login screen can call backend

### Phase B - Authentication

Status: ready

Endpoints:

- POST /admin/login
- GET /admin/me
- POST /admin/logout

Tasks:

- Login screen
- Save bearer token
- Restore session on app start
- Logout clears token
- Unauthorized API response returns to login

Done when:

- Admin can log in
- App survives restart with valid session
- Logout works

### Phase C - Dashboard

Status: ready

Endpoint:

- GET /admin/dashboard

Tasks:

- Dashboard summary cards
- Latest orders preview
- Latest requests preview
- Pull-to-refresh

Done when:

- Dashboard renders production data

### Phase D - V2 customer-app orders

Status: ready

Endpoints:

- GET /admin/customer-app-orders
- GET /admin/customer-app-orders/{order_id}
- POST /admin/customer-app-orders/{order_id}/on-the-way
- POST /admin/customer-app-orders/{order_id}/ready-to-pickup
- POST /admin/customer-app-orders/{order_id}/cancel

Tasks:

- Order list
- Order detail
- Delivery status actions
- Pickup status actions
- Cancel with optional reason
- Show customer/location/map data
- Show items/addition groups

Done when:

- Android can view V2 orders
- Android can run verified lifecycle actions

Deferred:

- approve/reject addition groups until controlled grouped-order verification

### Phase E - Products and categories

Status: ready

Endpoints:

- GET /admin/products
- POST /admin/products
- GET /admin/products/{product_id}
- PATCH /admin/products/{product_id}
- DELETE /admin/products/{product_id}
- GET /admin/product-categories
- POST /admin/product-categories
- GET /admin/product-categories/{category_id}
- PATCH /admin/product-categories/{category_id}
- DELETE /admin/product-categories/{category_id}

Tasks:

- Category list/create/edit/delete
- Product list/create/edit/delete
- Product detail form
- Category picker
- Basic validation

Done when:

- Android product/category CRUD works

### Phase F - Meeting points

Status: ready except default/preferred action

Endpoints:

- GET /admin/meeting-points
- POST /admin/meeting-points
- GET /admin/meeting-points/{point_id}
- PATCH /admin/meeting-points/{point_id}
- DELETE /admin/meeting-points/{point_id}

Tasks:

- Meeting point list
- Create/edit/delete
- Active/inactive flag
- Google Maps link preview

Done when:

- Android meeting point CRUD works

Deferred:

- set preferred/default meeting point

### Phase G - Customers

Status: ready

Endpoints:

- GET /admin/customers
- GET /admin/customers/{customer_id}
- POST /admin/customers/{customer_id}/reply

Tasks:

- Customer list
- Customer detail
- Message history
- Requests section
- Locations section
- Send reply text box

Done when:

- Android can send a controlled customer reply

### Phase H - Settings

Status: partially ready

Endpoints:

- GET /admin/settings
- PATCH or PUT /admin/settings

Tasks:

- Read settings
- Show settings form
- Preserve unrelated values on update
- Add save confirmation

Allowed first write setting:

- ai_response_mode

Deferred/high-care settings:

- working hours
- delivery location flags
- pickup flags
- delivery city list
- admin Telegram chat ID

Done when:

- Android can read settings
- Android can safely update one verified setting

### Phase I - Open requests

Status: ready

Endpoints:

- GET /admin/open-requests
- PATCH /admin/open-requests/{request_id}/status
- POST /admin/open-requests/group/done

Tasks:

- Open request list
- Mark single request new/in_progress/done
- Group done action
- Customer/request filtering

Done when:

- Android can manage open requests without global all-done

Not allowed in Android v1:

- global all-done

## Backend rule

Android must not duplicate backend business logic.

Android should:

- call verified API endpoints
- display server response data
- show API errors clearly
- avoid local-only order/customer/request assumptions

## First build target

Minimum useful Admin Android App:

1. Login
2. Dashboard
3. V2 orders list/detail
4. Product/category management
5. Customer detail/reply
6. Open requests list/status

## Next code step

Create Android project skeleton and API models from:

    docs/verification/admin-android-api-implementation-contract.md
