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
      "is_active": 1,
      "source": "db",
      "created_at": "2026-08-19T10:00:00Z",
      "last_login_at": "2026-08-19T11:00:00Z",
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
      "created_at": "2026-08-19T10:00:00Z"
    }
  ]
}
```

`is_active` is a 0/1 integer; Android maps it to `Boolean` via `@SerialName("is_active")`.

### ManagedAdmin `{ id, username, email, role, is_active, source, created_at, last_login_at, protected }`

`protected` is true for accounts that must not be deny/delete'd through the API (env-managed identities, self-protection).

### AdminAuditLog `{ id, username, role, action_type, action_detail, method, path, ip, user_agent, created_at }`

Audit retention is handled backend-side; the overview returns what the backend provides.

## Pagination

- **No** page/offset pagination exists yet.
- Only `/api/v1/admin/customers` supports `?limit=` (default 100, clamp 1–250, in-memory slice).
- All other admin list endpoints return full result sets. If pagination is added later, it must be added backend-first with a documented convention (e.g. `page`/`per_page`/`total`/`next`).

## Mutation responses

Successful mutations return the `apiOk` envelope; some return the refreshed aggregate (e.g. superadmin mutations return the full overview). Per-slice mutation payloads are completed as each vertical slice is migrated to this contract.