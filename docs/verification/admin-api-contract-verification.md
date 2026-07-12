# Admin API Contract Verification

Mode: read-only production verification

Base: https://crm.ayartuerk.me/api/v1

## Summary

- Total checked: 17
- Passed: 17
- Failed: 0

## Results

### PASS admin login

- Method: POST
- Path: /admin/login
- Status: 200
- Time: 1053 ms
- Top-level keys: ok, token_type, access_token, expires_in, admin

### PASS admin me

- Method: GET
- Path: /admin/me
- Status: 200
- Time: 206 ms
- Top-level keys: ok, admin

### PASS admin dashboard

- Method: GET
- Path: /admin/dashboard
- Status: 200
- Time: 274 ms
- Top-level keys: ok, summary, latest_orders, latest_requests

### PASS legacy active orders

- Method: GET
- Path: /admin/orders
- Status: 200
- Time: 217 ms
- Top-level keys: ok, orders, count, closed

### PASS legacy closed orders

- Method: GET
- Path: /admin/closed-orders
- Status: 200
- Time: 213 ms
- Top-level keys: ok, orders, count, closed

### PASS v2 customer app orders

- Method: GET
- Path: /admin/customer-app-orders
- Status: 200
- Time: 1220 ms
- Top-level keys: ok, orders, count

### PASS open requests

- Method: GET
- Path: /admin/open-requests
- Status: 200
- Time: 253 ms
- Top-level keys: ok, open_requests, count

### PASS products

- Method: GET
- Path: /admin/products
- Status: 200
- Time: 270 ms
- Top-level keys: ok, products, categories, count

### PASS product categories

- Method: GET
- Path: /admin/product-categories
- Status: 200
- Time: 236 ms
- Top-level keys: ok, categories, count

### PASS meeting points

- Method: GET
- Path: /admin/meeting-points
- Status: 200
- Time: 234 ms
- Top-level keys: ok, meeting_points, count

### PASS customers

- Method: GET
- Path: /admin/customers
- Status: 200
- Time: 233 ms
- Top-level keys: ok, customers, count

### PASS settings

- Method: GET
- Path: /admin/settings
- Status: 200
- Time: 775 ms
- Top-level keys: ok, settings

### PASS v2 customer app order detail

- Method: GET
- Path: /admin/customer-app-orders/16
- Status: 200
- Time: 235 ms
- Top-level keys: ok, order

### PASS product detail

- Method: GET
- Path: /admin/products/3
- Status: 200
- Time: 231 ms
- Top-level keys: ok, product

### PASS product category detail

- Method: GET
- Path: /admin/product-categories/2
- Status: 200
- Time: 210 ms
- Top-level keys: ok, category

### PASS meeting point detail

- Method: GET
- Path: /admin/meeting-points/1
- Status: 200
- Time: 195 ms
- Top-level keys: ok, meeting_point

### PASS customer detail

- Method: GET
- Path: /admin/customers/39
- Status: 200
- Time: 282 ms
- Top-level keys: ok, customer, messages, requests, locations
