# Admin Android App

Purpose:

Operational admin app for CRM Delivery.

Primary backend:

`https://crm.ayartuerk.me/api/v1`

Initial screens:

1. Login
2. Dashboard
3. Open orders
4. Closed orders
5. Open requests
6. Customers
7. Products
8. Product categories
9. Meeting points
10. Settings
11. Password change
12. Logout

Authentication:

- `POST /api/v1/admin/login`
- Store token securely on device
- Use `Authorization: Bearer <token>`
- `POST /api/v1/admin/logout`
- `POST /api/v1/admin/password`

Roles:

- admin
- superadmin
