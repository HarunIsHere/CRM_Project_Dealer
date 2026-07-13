# Admin Android Mutation API Verification Plan

## Purpose

This document defines the safe verification order for Admin Android write/action API endpoints.

The read-only Admin API contract is already verified:

- 17 checked
- 17 passed
- 0 failed

Latest verified read-only API commit:

- 178f6e1 Document Admin Android API contract verification

Latest API gap fixed:

- 36bf5ce Add admin product category detail API

Latest verified production deploy:

- a8c63c8a-de70-460c-a009-a46f89831e19

## Important rule

Do not run destructive production mutation tests blindly.

Mutation tests must either:

- use test-only records,
- restore the previous value,
- or delete only records created by the test itself.

## Already live-verified mutation flows

These are already verified in production:

- V2 customer-app delivery on-the-way
- V2 customer-app pickup ready-to-pickup
- V2 customer-app cancel delivery order
- Web admin pickup ready-to-pickup form route

## Safe mutation verification order

### Phase 1: Low-risk session/action checks

These can be tested safely:

- POST /api/v1/admin/logout
- POST /api/v1/admin/customers/{customer_id}/reply only with a controlled test customer

Do not test password change yet unless there is a guaranteed restore flow.

### Phase 2: Test-only product records

Create, update, read, and delete test-only records:

- POST /api/v1/admin/product-categories
- GET /api/v1/admin/product-categories/{category_id}
- PATCH /api/v1/admin/product-categories/{category_id}
- DELETE /api/v1/admin/product-categories/{category_id}
- POST /api/v1/admin/products
- GET /api/v1/admin/products/{product_id}
- PATCH /api/v1/admin/products/{product_id}
- DELETE /api/v1/admin/products/{product_id}

Rules:

- Use names starting with TEST_ANDROID_API_
- Delete test records after verification
- Do not touch existing production products/categories

### Phase 3: Test-only meeting point records

Create, update, read, and delete a test-only meeting point:

- POST /api/v1/admin/meeting-points
- GET /api/v1/admin/meeting-points/{point_id}
- PATCH /api/v1/admin/meeting-points/{point_id}
- DELETE /api/v1/admin/meeting-points/{point_id}

Rules:

- Use name starting with TEST_ANDROID_API_
- Do not set as preferred in first pass
- Do not touch existing production meeting points
- Test preferred/default only later with restore logic

### Phase 4: Settings update with restore

Settings mutation must first read current values, then update one safe value, then restore the original value.

Candidate low-risk settings:

- admin language
- AI response mode
- fulfillment options

Do not test delivery cities or working-hours settings until restore logic is confirmed.

### Phase 5: Open requests

Open request mutation should only be tested after creating a controlled test request.

Potential endpoints/actions to verify:

- mark one test request done
- mark all matching test requests done

Do not run all-done on production data without a test-only filter or controlled setup.

### Phase 6: Legacy order mutations

Legacy order mutation endpoints exist, but they affect old shopping_carts order model.

Verify only after deciding whether Admin Android v1 needs legacy order control.

Endpoints:

- PATCH /api/v1/admin/orders/{order_id}/status
- POST /api/v1/admin/orders/{order_id}/delivered
- POST /api/v1/admin/orders/{order_id}/return

### Phase 7: V2 customer-app order mutations

Already verified for main live lifecycle.

Later contract tests can cover:

- POST /api/v1/admin/customer-app-orders/{order_id}/status
- POST /api/v1/admin/customer-app-orders/{order_id}/groups/{group_id}/approve
- POST /api/v1/admin/customer-app-orders/{order_id}/groups/{group_id}/reject

Only test approve/reject using a controlled test order with controlled addition groups.

## Android readiness decision

Admin Android API is ready for read-only UI planning now.

Before write UI implementation, verify these mutation groups in this order:

1. product categories
2. products
3. meeting points
4. customer reply with controlled test customer
5. settings with restore
6. open requests with controlled test request
7. legacy order mutations only if needed
8. V2 group approve/reject only after controlled grouped order setup

## Next concrete task

Create a safe production mutation verification script for Phase 2 only:

- create test product category
- update test product category
- create test product under that category
- update test product
- delete test product
- delete test category
- verify no test records remain
