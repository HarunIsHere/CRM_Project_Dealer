# Android API Contract

Base URL:

https://crm.ayartuerk.me

## Auth

### Admin login

POST /api/v1/admin/login

Request:
{
  "username": "admin_username",
  "password": "admin_password"
}

Use returned token:

Authorization: Bearer <admin_token>

### Customer session

POST /api/v1/customer/session/start

Request:
{
  "full_name": "Customer Name",
  "username": "optional_username",
  "language": "en",
  "device_id": "android-device-id",
  "platform": "android",
  "app_version": "0.1.0"
}

Use returned token:

Authorization: Bearer <customer_token>

## Public endpoints

GET /api/v1/health
GET /api/v1/capabilities
GET /api/v1/public/catalog
GET /api/v1/public/meeting-points

## Customer Android endpoints

POST   /api/v1/customer/session/start
POST   /api/v1/customer/session/verify
GET    /api/v1/customer/me

GET    /api/v1/customer/cart
POST   /api/v1/customer/cart/items
PATCH  /api/v1/customer/cart/items/{item_id}
DELETE /api/v1/customer/cart/items/{item_id}
DELETE /api/v1/customer/cart

POST   /api/v1/customer/checkout/address
POST   /api/v1/customer/checkout/pickup

GET    /api/v1/customer/orders
GET    /api/v1/customer/orders/{order_id}

## Customer cart add item

POST /api/v1/customer/cart/items

Headers:
Authorization: Bearer <customer_token>
Content-Type: application/json

Request:
{
  "product_id": 3,
  "quantity": 2
}

## Customer checkout address

POST /api/v1/customer/checkout/address

Headers:
Authorization: Bearer <customer_token>
Content-Type: application/json

Request:
{
  "address": "Customer address text",
  "latitude": "52.5200",
  "longitude": "13.4050",
  "google_maps_link": "https://www.google.com/maps?q=52.5200,13.4050",
  "delivery_note": "optional note"
}

At least one of location_label, address, description, google_maps_link, or coordinates must be provided.

## Customer checkout pickup

POST /api/v1/customer/checkout/pickup

Headers:
Authorization: Bearer <customer_token>
Content-Type: application/json

Request:
{
  "meeting_point_id": 1
}

## Admin Android endpoints

POST   /api/v1/admin/login
GET    /api/v1/admin/me
GET    /api/v1/admin/dashboard

GET    /api/v1/admin/orders
GET    /api/v1/admin/closed-orders
PATCH  /api/v1/admin/orders/{order_id}/status
POST   /api/v1/admin/orders/{order_id}/delivered
POST   /api/v1/admin/orders/{order_id}/return

GET    /api/v1/admin/open-requests

GET    /api/v1/admin/products
POST   /api/v1/admin/products
GET    /api/v1/admin/products/{product_id}
PATCH  /api/v1/admin/products/{product_id}
DELETE /api/v1/admin/products/{product_id}

GET    /api/v1/admin/product-categories
POST   /api/v1/admin/product-categories
PATCH  /api/v1/admin/product-categories/{category_id}
DELETE /api/v1/admin/product-categories/{category_id}

GET    /api/v1/admin/meeting-points
POST   /api/v1/admin/meeting-points
PATCH  /api/v1/admin/meeting-points/{meeting_point_id}
DELETE /api/v1/admin/meeting-points/{meeting_point_id}

GET    /api/v1/admin/customers
GET    /api/v1/admin/customers/{customer_id}
DELETE /api/v1/admin/customers/{customer_id}
POST   /api/v1/admin/customers/{customer_id}/reply

GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings


## Admin dashboard

GET /api/v1/admin/dashboard

Headers:
Authorization: Bearer <admin_token>

Returns:

- open_orders_count
- closed_orders_count
- open_requests_count
- active_customers_count
- active_products_count
- active_meeting_points_count
- latest_orders
- latest_requests

## Admin order status update

PATCH /api/v1/admin/orders/{order_id}/status

Headers:
Authorization: Bearer <admin_token>
Content-Type: application/json

Allowed statuses:
in_progress
waiting_location
ready_to_delivery
on_the_way
not_delivered
delivered

Request:
{
  "order_status": "on_the_way",
  "admin_status_note": "Optional note"
}

## Notes

Telegram webhook remains:

/telegram/webhook

Android apps do not use Telegram webhook. Android apps use /api/v1/...

Both Android apps use the same Cloudflare Worker and D1 database as the Telegram bot and admin web panel.
