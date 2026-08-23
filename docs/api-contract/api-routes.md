# API Route Inventory

Base path for all routes below: `/api/v1`. Routing is done via exact `url.pathname` matches plus regex patterns in `handleApiV1` (`cloudflare-worker/src/index.js:13338`). Methods are enforced inside each handler.

Verification source: `cloudflare-worker/src/index.js` (branch `unified-order-v2`).

## Auth & identity

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| POST | `/api/v1/admin/login` | — | `handleApiAdminLogin` (`:9489`) | Login, returns bearer token + admin session |
| POST | `/api/v1/admin/logout` | admin | `handleApiAdminLogout` (`:9532`) | Logout / token revocation |
| POST | `/api/v1/admin/password` | admin | `handleApiAdminPasswordChange` (`:9836`) | Change admin password |
| GET | `/api/v1/admin/me` | admin | `handleApiAdminMe` (`:9902`) | Current admin session |
| * | `/api/v1/admin/(auth\|security)/...` | varies | `handleIdentityApi` (`identity/service.js:160`) | Identity service: recovery, enrollment, passkeys. Feature-gated (`feature_disabled` → 503 when unconfigured) |

## Superadmin

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/superadmin` | superadmin | `handleApiAdminSuperadminOverview` (`:9633`) | Managed admins + audit logs + current admin |
| POST | `/api/v1/admin/superadmin/admins` | superadmin | `handleApiAdminSuperadminCreate` (`:9647`) | Create DB-backed admin/superadmin |
| PATCH/POST | `/api/v1/admin/superadmin/admins/{id}/toggle` | superadmin | `handleApiAdminSuperadminToggle` (`:9734`) | Grant/deny access |
| DELETE | `/api/v1/admin/superadmin/admins/{id}` | superadmin | `handleApiAdminSuperadminDelete` (`:9785`) | Delete DB credential |

## Dashboard & AI

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | admin | `handleApiAdminDashboard` (`:10007`) | Dashboard summary |
| GET | `/api/v1/admin/ai-info` | admin | `handleApiAdminAiInfo` (`:10741`) | AI usage/info |
| POST | `/api/v1/admin/learned-patterns/{id}/{action}` | admin | `handleApiAdminLearnedPatternAction` (`:10776`) | Learned-pattern action |

## Orders (legacy admin)

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/orders` | admin | `handleApiAdminOrders(..., false)` (`:10054`) | Open orders |
| GET | `/api/v1/admin/closed-orders` | admin | `handleApiAdminOrders(..., true)` (`:10054`) | Closed orders |
| PATCH/POST | `/api/v1/admin/orders/{id}/status` | admin | `handleApiAdminOrderStatus` (`:10627`) | Update legacy order status |
| POST | `/api/v1/admin/orders/{id}/delivered` | admin | `handleApiAdminOrderDelivered` (`:10668`) | Mark delivered |
| POST | `/api/v1/admin/orders/{id}/return` | admin | `handleApiAdminOrderReturn` (`:10694`) | Mark returned |

Legacy orders are being superseded by the canonical V2 lifecycle; do not build new work on these.

`admin/orders/{id}/status`, `admin/orders/{id}/delivered`, and `admin/orders/{id}/return` are legacy-compat routes retained for Web Admin form actions; Admin mobile uses the canonical V2 fulfillment routes in the next section.

## Customer-app orders (canonical V2)

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/customer-app-orders` | admin | `handleApiAdminCustomerAppOrders` (`:10224`) | List V2 orders |
| GET | `/api/v1/admin/customer-app-orders/{id}` | admin | `handleApiAdminCustomerAppOrderDetail` (`:10205`) | V2 order detail |
| PATCH/POST | `/api/v1/admin/customer-app-orders/{id}/status` | admin | `handleApiAdminCustomerAppOrderStatus` (`:10243`) | Update V2 order status |
| POST | `/api/v1/admin/customer-app-orders/{id}/on-the-way` | admin | `handleApiAdminV2DeliveryOnTheWay` (`:10297`) | Delivery: on-the-way |
| POST | `/api/v1/admin/customer-app-orders/{id}/ready-to-pickup` | admin | `handleApiAdminV2ReadyToPickup` (`:10338`) | Pickup: ready |
| POST | `/api/v1/admin/customer-app-orders/{id}/delivered` | admin | `handleApiAdminV2OrderDelivered` (`:10404`) | Mark delivered / picked up (final) |
| POST | `/api/v1/admin/customer-app-orders/{id}/not-delivered` | admin | `handleApiAdminV2OrderNotDelivered` (`:10436`) | Mark not delivered (final) |
| POST | `/api/v1/admin/customer-app-orders/{id}/cancel` | admin | `handleApiAdminV2CancelOrder` (`:10587`) | Cancel V2 order |
| POST | `/api/v1/admin/customer-app-orders/{id}/groups/{gid}/approve` | admin | `handleApiAdminV2ApproveGroup` (`:10468`) | Approve delivery group |
| POST | `/api/v1/admin/customer-app-orders/{id}/groups/{gid}/reject` | admin | `handleApiAdminV2RejectGroup` (`:10525`) | Reject delivery group |

## Open requests

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/open-requests` | admin | `handleApiAdminOpenRequests` (`:10883`) | List actionable requests |
| PATCH/PUT | `/api/v1/admin/open-requests/{id}/status` | admin | `handleApiAdminOpenRequestStatus` (`:10903`) | Single request status update |
| POST | `/api/v1/admin/open-requests/group/done` | admin | `handleApiAdminOpenRequestGroupDone` (`:10946`) | Mark group done |
| POST | `/api/v1/admin/open-requests/all/done` | admin | `handleApiAdminOpenRequestAllDone` (`:10987`) | Mark all done (dangerous, scoped in clients) |

## Products & categories

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET/POST | `/api/v1/admin/products` | admin | `handleApiAdminProducts` (`:11030`) | List/create products |
| PATCH/DELETE | `/api/v1/admin/products/{id}` | admin | `handleApiAdminProductDetail` (`:11089`) | Update/delete product |
| GET/POST | `/api/v1/admin/product-categories` | admin | `handleApiAdminProductCategories` (`:11174`) | List/create categories |
| PATCH/DELETE | `/api/v1/admin/product-categories/{id}` | admin | `handleApiAdminProductCategoryDetail` (`:11217`) | Update/delete category |

## Locations / meeting points

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/search-location` | admin | `handleApiAdminLocationSearch` (`:11291`) | Nominatim/OSM location search |
| GET/POST | `/api/v1/admin/meeting-points` | admin | `handleApiAdminMeetingPoints` (`:11320`) | List/create meeting points |
| PATCH/DELETE | `/api/v1/admin/meeting-points/{id}` | admin | `handleApiAdminMeetingPointDetail` (`:11377`) | Update/delete meeting point |

## Customers

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET | `/api/v1/admin/customers` | admin | `handleApiAdminCustomers` (`:11536`) | List customers (`?limit=`, default 100, 1–250) |
| GET/DELETE | `/api/v1/admin/customers/{id}` | admin | `handleApiAdminCustomerDetail` (`:11592`) | Customer detail/delete |
| POST | `/api/v1/admin/customers/{id}/reply` | admin | `handleApiAdminCustomerReply` (`:11652`) | Send customer reply |

## Settings

| Method | Path | Auth | Handler | Purpose |
|---|---|---|---|---|
| GET/PATCH | `/api/v1/admin/settings` | admin | `handleApiAdminSettings` (`:11718`) | Read/update settings |

## Notes

- ~38 admin route patterns in ~14 families.
- Method-per-handler enforcement (405 when the wrong method is used).
- A capabilities map is exposed by `getApiCapabilities()` (`:9428`).