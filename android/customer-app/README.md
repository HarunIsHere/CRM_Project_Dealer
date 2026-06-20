# Customer Android App

Purpose:

Customer ordering app for CRM Delivery.

Primary backend:

`https://crm.ayartuerk.me/api/v1`

Initial screens:

1. Language selection
2. Customer session start
3. Product catalog
4. Product detail
5. Cart
6. Checkout
7. Pickup / delivery location
8. Orders
9. Order detail
10. Profile
11. Logout

Authentication:

- `POST /api/v1/customer/session/start`
- Store token securely on device
- Use `Authorization: Bearer <token>`
- `POST /api/v1/customer/session/logout`

Profile:

- `GET /api/v1/customer/me`
- `PATCH /api/v1/customer/me`
