# Admin DTO Contract

Wire representation of the Cloudflare Worker admin API. Field names are `snake_case` in JSON; Android maps them with explicit `@SerialName`, iOS with explicit `CodingKeys`. Verification source: `cloudflare-worker/src/index.js` (branch `unified-order-v2`).

## Envelopes

### Success (`apiOk`, `:9309`)

```json
{ "ok": true, ...payload }
```

### Error (`apiError`, `:9381`)

```json
{
  "ok": false,
  "error": {
    "code": "authentication_required",
    "message": "Authentication is required.",
    "details": null
  }
}
```

`details` is omitted unless provided. HTTP status is carried on the response (401/403/404/405/409…). Clients should rely on `error.code`/`error.message`, not parsing status text.

Android type: `ApiErrorEnvelope { code: String?, message: String? }` (`AdminApi.kt:568`).

## Auth model

- **Token**: base64url payload + HMAC-SHA256 signature using `env.ADMIN_JWT_SECRET` (`createAdminToken`, `:3558`).
- **Claims**: `{ sub: username, role, scope: "admin", iat, jti, exp: iat + 43200 }` (12h expiry).
- **Verification** (`verifyAdminToken`, `:3599`): checks HMAC, `scope === "admin"`, expiry, and the `admin_token_revocations` table; DB admins must have `is_active = 1`.
- **Roles**: `admin`, `superadmin`. Flag `is_superadmin` is derived from role (or from env superadmin identity) and sent in every session payload.
- **Credential sources**: env `ADMIN_USERNAME`/`ADMIN_PASSWORD`, env `SUPERADMIN_USERNAME`/`SUPERADMIN_PASSWORD`, and DB table `admin_users`.
- **Transport**: `Authorization: Bearer <token>` or cookie `ADMIN_COOKIE_NAME` (`getApiAdminSession`, `:9415`).
- Current password storage is `sha256(ADMIN_JWT_SECRET:password)` in `admin_users.password_hash` (`authenticateAdmin`, `:3658`).

## DTO schemas

### AdminSession

Returned by `POST /login` and `GET /me`.

```json
{ "username": "admin", "role": "admin", "is_superadmin": false }
```

Android: `AdminUser` (`AdminApi.kt:574`) with `@SerialName("is_superadmin")`.

### LoginResponse (`POST /api/v1/admin/login`, `:9519`)

```json
{
  "token_type": "Bearer",
  "access_token": "<jwt>",
  "expires_in": 43200,
  "admin": { "username": "admin", "role": "admin", "is_superadmin": false }
}
```

### MeResponse (`GET /api/v1/admin/me`, `:9913`)

```json
{ "admin": { "username": "admin", "role": "admin", "is_superadmin": false } }
```

### SuperadminOverview (`GET /api/v1/admin/superadmin`)

Built by `buildApiSuperadminOverview` (`:9591`).

```json
{
  "current_admin": { "username": "admin", "role": "superadmin", "is_superadmin": true },
  "admins": [
    {
      "id": 1,
      "username": "staff",
      "email": "staff@example.com",
      "role": "admin",
      "is_active": true,
      "source": "db",
      "created_at": "2026-08-19 10:00:00",
      "last_login_at": "2026-08-19 11:00:00",
      "protected": false
    }
  ],
  "audit_logs": [
    {
      "id": 10,
      "username": "staff",
      "role": "admin",
      "action_type": "login",
      "action_detail": "Logged in",
      "method": "POST",
      "path": "/api/v1/admin/login",
      "ip": "1.2.3.4",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-08-19 10:00:00"
    }
  ]
}
```

`is_active` and `protected` are serialized as JSON booleans by the backend mapper (`mapApiManagedAdmin`, `:9566`/`:9570`); the raw SQL integer is never exposed on the overview wire. Android pairs them with `@SerialName("is_active") isActive: Boolean` and `protected: Boolean`.

Timestamps: `created_at`/`last_login_at` are SQLite `CURRENT_TIMESTAMP` strings (`YYYY-MM-DD HH:MM:SS`), not ISO-8601 (notably, the audit select at `:3823` orders by `datetime('now', '-30 days')`). Clients must treat both as opaque strings unless/until the backend emits ISO-8601.

### ManagedAdmin `{ id, username, email, role, is_active, source, created_at, last_login_at, protected }`

`protected` is true for accounts that must not be deny/delete'd through the API (env-managed identities, self-protection).

### AdminAuditLog `{ id, username, role, action_type, action_detail, method, path, ip, user_agent, created_at }`

Backend: `getAdminAuditLogs` (`:3820`) reads `admin_audit_logs` and `mapApiAdminAuditLog` rewrites the DB column `admin_username` → wire key `username` (and `admin_role` → `role`). Retention: rows older than 30 days are purged (`cleanupOldAdminAuditLogs`); the select returns up to 500 rows ordered newest-first.

## Password change

`POST /api/v1/admin/password` (`handleApiAdminPasswordChange`, `:9836`). Body:

```json
{ "current_password": "old", "new_password": "new-secret", "confirm_password": "new-secret" }
```

(`confirm_password` is optional and defaults to `new_password` when absent. No `message` key is returned.)

Success response:

```json
{ "ok": true, "password_changed": true, "current_token_revoked": true, "login_required": true }
```

Error codes: `unauthorized` 401, `invalid_json` 400, `missing_password` 400, `password_mismatch` 400, `weak_password` 400 (<8 chars), `invalid_current_password` 401, `admin_not_found` 404.

The current token is revoked server-side (`revokeAdminToken`, `:9891`); the Android client also clears its local token and shows the recovery notice. Android decodes the success via `BasicResponse` (`ok` + `error`); extra keys are ignored (`ignoreUnknownKeys = true` in `ApiClient.kt:13`).

## Product DTOs

Wire shape is produced by `mapProductForApi` (`:11009`) and `mapProductCategoryForApi` (`:11022`).

### Product

```json
{
  "id": 1,
  "name": "Croissant",
  "price": 3.5,
  "price_formatted": "3,50 €",
  "is_active": true,
  "category_id": null,
  "category_name": "Bakery",
  "aliases": ["croissant", "buttercroissant"]
}
```

| Key | Type | Notes |
|---|---|---|
| `id` | number | always emitted |
| `name` | string | `""` fallback |
| `price` | number (float) | `Number(price \|\| 0)` |
| `price_formatted` | string | formatted server-side |
| `is_active` | boolean | coerced from DB integer |
| `category_id` | number \| null | null when uncategorized |
| `category_name` | string | `""` fallback (never null) |
| `aliases` | string[] | from `product_aliases` |

Not emitted (do not add to new clients): `description`, `currency`, `unit`, `status`, `image_url`, `sort_order`, `created_at`. Existing Android `Product` carries these as nullable extras that always decode null — candidates for later cleanup, not blockers.

### ProductCategory

```json
{ "id": 2, "name": "Bakery", "is_active": true }
```

Only `id`, `name`, `is_active` (boolean). `description`, `status`, `sort_order`, `created_at` are never emitted.

### List responses

- `GET /api/v1/admin/products` → `{ ok: true, products: Product[], categories: ProductCategory[], count: number }`
- `GET /api/v1/admin/product-categories` → `{ ok: true, categories: ProductCategory[], count: number }`

### Mutation responses

- `POST /api/v1/admin/products` → 201 `{ ok: true, product_id: number }`
- `PATCH /api/v1/admin/products/{id}` → `{ ok: true, product_id: number }`
- `DELETE /api/v1/admin/products/{id}` → `{ ok: true, product_id: number, deleted: true }`
- `POST /api/v1/admin/product-categories` → 201 `{ ok: true, name: string }`
- `PATCH /api/v1/admin/product-categories/{id}` → `{ ok: true, category_id: number }`
- `DELETE /api/v1/admin/product-categories/{id}` → `{ ok: true, category_id: number, deleted: true }`

Android models these as `BasicResponse` (`ok`, `error`); the mutation id/name keys are currently discarded.

Detail GET endpoints exist on the Worker (`GET /api/v1/admin/products/{id}` → `{ ok, product }`, `GET /api/v1/admin/product-categories/{id}` → `{ ok, category }`) but no Android client wires them.

## Meeting Point DTOs

Wire shape is produced by `mapMeetingPointForApi` (`:11280`).

### MeetingPoint

```json
{
  "id": 1,
  "name": "Shop Berlin",
  "address": "Friedrichstraße 100, 10117 Berlin",
  "google_maps_link": "https://www.google.com/maps?q=52.52,13.39",
  "is_default": true,
  "is_active": true
}
```

| Key | Type | Notes |
|---|---|---|
| `id` | number | |
| `name` | string | `""` fallback |
| `address` | string | `""` fallback |
| `google_maps_link` | string | `""` fallback |
| `is_default` | boolean | coerced from DB integer (`Number(...) === 1`) |
| `is_active` | boolean | coerced from DB integer |

Not emitted: `title`, `description`, `maps_url`, `google_maps_url`, `latitude`, `longitude`, `sort_order`, `created_at`. Existing Android `MeetingPoint` carries these as nullable extras (always null) — cleanup candidates. Latent hazard: the location-search payload sends `latitude`/`longitude` as strings; if meeting-point rows ever gain coordinate fields serialized as strings, the Android `Double?` fields would throw on decode — keep coordinate fields string-typed if added later.

### Location search result

```json
{
  "name": "Friedrichstraße 100, Berlin",
  "address": "Friedrichstraße 100, 10117 Berlin, Germany",
  "postal_code": "10117",
  "latitude": "52.51999",
  "longitude": "13.38973",
  "google_maps_link": "https://www.google.com/maps?q=52.51999,13.38973"
}
```

`latitude`/`longitude` are Nominatim strings. Search response: `{ ok: true, locations: [...], count: number }` (`searchLocations`, `:3119`; handler `:11291`).

### List / detail / mutation responses

- `GET /api/v1/admin/meeting-points` → `{ ok: true, meeting_points: MeetingPoint[], count: number }`
- `GET /api/v1/admin/meeting-points/{id}` → `{ ok: true, meeting_point: MeetingPoint }`
- `POST /api/v1/admin/meeting-points` → 201 `{ ok: true, meeting_point_id: number }`
- `PATCH /api/v1/admin/meeting-points/{id}` → `{ ok: true, meeting_point_id: number }` (PATCH accepts `is_active`, requires boolean `is_default`)
- `DELETE /api/v1/admin/meeting-points/{id}` → `{ ok: true, meeting_point_id: number, deleted: true }`
- `GET /api/v1/admin/search-location?query=...` → `{ ok: true, locations: LocationSearchResult[], count: number }`

## Order DTOs (canonical V2)

Wire shape is produced by `mapV2OrderForApi` (`:12531`), `mapV2OrderItemForApi` (`:12460`), `mapV2OrderGroupForApi` (`:12505`). These are the admin + customer order payloads.

### CustomerAppOrder

```json
{
  "id": 1,
  "public_order_code": "ABCDE",
  "session_token": "",
  "customer": { "id": 42, "full_name": "Jane Doe", "username": "jane", "telegram_user_id": 123, "preferred_language": "en" },
  "status": "submitted",
  "order_status": "submitted",
  "order_status_label": "Submitted",
  "fulfillment_type": "delivery",
  "delivery_status": "",
  "delivery_status_label": "",
  "pickup_status": "",
  "pickup_status_label": "",
  "delivery_location_id": null,
  "delivery_location_label": "Friedrichstraße 100, 10117 Berlin",
  "delivery_google_maps_link": "https://www.google.com/maps?q=52.52,13.39",
  "delivery_address": "Friedrichstraße 100, 10117 Berlin",
  "scheduled_for_next_online_order": 0,
  "next_online_order_at": "",
  "active_shop_id": null,
  "admin_status_note": "",
  "cancelled_at": "",
  "cancel_reason": "",
  "currency": "EUR",
  "total_amount": 12.5,
  "total_formatted": "12,50 €",
  "section_totals": {
    "confirmed": { "item_count": 2, "total_amount": 10.0, "total_formatted": "10,00 €" },
    "pending_admin_approval": { "item_count": 1, "total_amount": 2.5, "total_formatted": "2,50 €" },
    "waiting_ready_to_pickup": { "item_count": 0, "total_amount": 0, "total_formatted": "0,00 €" },
    "rejected": { "item_count": 0, "total_amount": 0, "total_formatted": "0,00 €" },
    "scheduled_for_next_online_order": { "item_count": 0, "total_amount": 0, "total_formatted": "0,00 €" },
    "cancelled": { "item_count": 0, "total_amount": 0, "total_formatted": "0,00 €" }
  },
  "groups": [],
  "items": [],
  "created_at": "2026-08-19 10:00:00",
  "updated_at": "2026-08-19 10:00:00"
}
```

Key facts:
- There is **no `order_number`** — the public identifier is `public_order_code`.
- `total_amount` and all money fields are JSON numbers (can be fractional EUR); `total_formatted` is the display string.
- `scheduled_for_next_online_order` is a 0/1 integer in the payload (JS `Number(...) === 1` is used internally but the raw numeric value is emitted).
- **`status_history` is never emitted in JSON responses** — the V2 history table (`customer_order_status_history_v2`) is only rendered by the Web Admin HTML template (`:5741`). Do not design client DTOs that expect it.
- **No `locations` array** — location data is flat (`delivery_location_id`, `delivery_location_label`, `delivery_google_maps_link`, `delivery_address`).

### CustomerAppOrderItem

`id, customer_order_id, group_id, product_id, name, product_name, quantity, unit_price, line_total, item_status, added_phase, requires_admin_approval (boolean), admin_decision, admin_decision_note, decided_at, created_at`

### CustomerAppOrderGroup

`id, customer_order_id, group_type, group_status, group_status_label, fulfillment_type, requires_admin_approval, scheduled_for_next_online_order, next_online_order_at, admin_decision, admin_decision_note, decided_at, total_amount, total_formatted, item_count, items[], created_at, updated_at`

### List / detail / mutation responses

- `GET /api/v1/admin/customer-app-orders` → `{ ok: true, orders: CustomerAppOrder[], count: number }`
- `GET /api/v1/admin/customer-app-orders/{id}` → `{ ok: true, order: CustomerAppOrder }` (404 `not_found`)
- `PATCH/POST /api/v1/admin/customer-app-orders/{id}/status` — body `{ status | order_status, note | admin_status_note }`; allowed statuses: `submitted, preparing, scheduled_for_next_online_order, cancelled, closed` (`:10258`) → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/on-the-way` — requires `fulfillment_type = "delivery"` → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/ready-to-pickup` — requires `fulfillment_type = "pickup"` → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/delivered` — body `{ note | admin_status_note }`; marks `delivered` (delivery) / `picked_up` (pickup) final state → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/not-delivered` — body `{ note | admin_status_note | reason }`; marks `not_delivered` final state → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/cancel` — body `{ reason | cancel_reason | note }` → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/groups/{groupId}/approve` — group must be `pending_admin_approval` → `{ ok: true, order }`
- `POST /api/v1/admin/customer-app-orders/{id}/groups/{groupId}/reject` — body `{ note | admin_decision_note }`; group must be `pending_admin_approval` → `{ ok: true, order }`

### Open alignment items (verified 2026-08-19)

1. **Android final-state mutations now use canonical V2 routes (resolved 2026-08-19).** Added `POST /api/v1/admin/customer-app-orders/{id}/delivered` and `POST /api/v1/admin/customer-app-orders/{id}/not-delivered`. `AdminRepository.performOrderAction` re-pointed: `DELIVERY_DELIVERED`/`PICKUP_PICKED_UP` → `delivered`; `DELIVERY_NOT_DELIVERED` → `not-delivered` (with note); `RETURN_NOT_DELIVERED` → `not-delivered` (note `"Returned from closed orders"`). Legacy `admin/orders/{id}/...` compat routes retained only for Web Admin.
2. **Group approve/reject is unimplemented on Android** (no Retrofit methods). Pending-delivery groups can only be actioned via Web Admin today.
3. **iOS has no admin order models.** The customer-side `CustomerOrder.totalAmount` is a non-optional `Int` while the worker emits fractional floats — a decode-crash risk for the customer app when totals are non-integer. Must be fixed to `Double` on the customer iOS side.

## Customer DTOs

Wire shapes from `mapCustomerForApi` (`:11474`), `mapMessageForApi` (`:11488`), `mapCustomerRequestForApi` (`:11500`), `mapCustomerLocationForApi` (`:11517`).

### Customer

```json
{
  "id": 42,
  "telegram_user_id": "123456789",
  "username": "jane",
  "full_name": "Jane Doe",
  "language": "en",
  "preferred_language": "en",
  "is_blocked": false,
  "last_seen_at": "2026-08-19 10:00:00",
  "created_at": "2026-08-19 09:00:00"
}
```

No `phone`/`address`/`location` keys are emitted. `is_blocked` is a boolean.

### CustomerMessage

```json
{ "id": 5, "direction": "outgoing", "message_type": "admin_reply", "source_label": "Admin", "content": "Hello!", "language": "en", "created_at": "2026-08-19 10:00:00" }
```

**The message text key is `content`** — Android reads it via `@SerialName("content")` (fixed 2026-08-19; previously the client expected `message`/`text`/`body` and rendered blank bubbles). `source_label` is a server-composed display label.

### CustomerRequest

`id, customer_id, request_type, request_type_label, status, status_label, item_name, description, request_text, quantity (number|null), google_maps_link, created_at`. Labels are composed server-side (currently hardcoded to `"en"` — see open items).

### CustomerLocation

`id, customer_id, session_token, request_type, label, address, description, latitude (number|null), longitude (number|null), google_maps_link, source, is_preferred (boolean), created_at, updated_at`

### List / detail / reply responses

- `GET /api/v1/admin/customers` → `{ ok: true, customers: Customer[], count: number }` (supports `?search=&language=&active=active|blocked&limit=` with limit default 100, clamp 1–250)
- `GET /api/v1/admin/customers/{id}` → `{ ok: true, customer: Customer, messages: CustomerMessage[], requests: CustomerRequest[], locations: CustomerLocation[] }`
- `DELETE /api/v1/admin/customers/{id}` → `{ ok: true, customer_id: number, deleted: true }`; hard-deletes the customer and all customer-linked cart, checkout, order, session, location, request, message, membership, and payment/preference rows in one D1 batch
- `POST /api/v1/admin/customers/{id}/reply` — body `{ reply_text | message }` → `{ ok: true, customer_id: number, sent: true }` (sends Telegram, persists as outgoing `admin_reply`)

### Open items (customers)

1. `request_type_label`/`status_label` are hardcoded to `"en"` in the Worker; clients that need multilingual labels should rely on the canonical i18n source instead.
2. iOS has no admin customer list/detail/reply/delete models at all.

Android sends `search`, `language`, `active`, and `limit=250` to the Worker. ID and last-seen date filters remain client-side because the API does not expose those query parameters.

## Slice status

All six vertical slices have been reconciled against the Worker on 2026-08-19. Remaining work is tracked per-slice in the "Open alignment items" / "Open items" sections above.

| Slice | Contract | Android DTOs | iOS | Web |
|---|---|---|---|---|
| login / me / superadmin | verified | verified — no changes needed | not started | aligned |
| products / categories | verified | verified — safe superset; no changes needed | no admin layer | aligned |
| meeting points / location search | verified | verified — exact match | public `MeetingPoint` only | aligned |
| orders / closed orders (V2) | documented | final-state mutations use canonical V2 routes; open item: no group approve/reject | no admin models; `totalAmount: Int` decode risk | aligned (Web only) |
| customers / customer detail / reply | verified | fixed: `CustomerMessage` reads `content` | no admin customer models | aligned |
| superadmin / change password | verified | verified — no changes needed (password success decodes via `BasicResponse`; mutations return full overview) | not started | aligned |

## Pagination

- **No** page/offset pagination exists yet.
- Only `/api/v1/admin/customers` supports `?limit=` (default 100, clamp 1–250, in-memory slice).
- All other admin list endpoints return full result sets. If pagination is added later, it must be added backend-first with a documented convention (e.g. `page`/`per_page`/`total`/`next`).

## Mutation responses

Successful mutations return the `apiOk` envelope. Superadmin mutations (create/toggle/delete) return the full refreshed overview, so clients can re-apply the whole state from one response. Order, product, category, meeting-point, and customer mutations return per-entity payloads (`product_id`, `category_id`, `meeting_point_id`, `customer_id`, `sent`, `deleted`) or the refreshed `{ ok, order }`. The password-change mutation returns `{ ok, password_changed, current_token_revoked, login_required }`. Request/response details are specified per slice above.
