# API Contract Source (Backend-first)

Canonical contract documentation for the Cloudflare Worker backend that drives Admin Web, Admin Android, Admin iOS, and the customer channel. The Worker backend is the production source of truth; these files document what it actually exposes so clients stop guessing JSON shapes.

## Status

- Documents the current production Worker on branch `unified-order-v2`.
- All six vertical slices (login/superadmin, products/categories, meeting points/location search, orders (V2), customers/customer detail, superadmin/change password) were reconciled against the Worker and the Android DTOs on 2026-08-19. One Android bug was fixed during reconciliation (`CustomerMessage` now reads `content`). Open alignment items are tracked in `admin-dto-contract.md`.
- No formal OpenAPI document exists yet; this directory is the starting point and the JSON Schema file provides the machine-readable core.
- Contract must be updated whenever the backend changes; each vertical-slice migration updates the relevant schema and checks the affected clients.

## Files

| File | Purpose |
|---|---|
| `api-routes.md` | Route inventory: method, path, auth, handler, purpose |
| `admin-dto-contract.md` | Envelope, auth model, error format, pagination, DTO schemas |
| `lifecycle-state-transitions.md` | Order and open-request lifecycle / state transitions |
| `localization-keys.md` | Five-language i18n architecture and rules |
| `admin-api.schema.json` | Machine-readable JSON Schema for the shared core DTOs |

## Wire conventions

- JSON keys are `snake_case` on the wire in the Worker responses.
- Success envelope (`apiOk`): `{ "ok": true, ...payload }`.
- Error envelope (`apiError`): `{ "ok": false, "error": { "code", "message", "details"? } }`.
- Admin auth: `Authorization: Bearer <token>` or the admin cookie (`ADMIN_COOKIE_NAME`).
- New or changed user-facing/admin-facing text keys must be added to `shared/i18n/admin_texts.json` in all five languages (en, de, tr, ar, ru), the generated file regenerated, and Android/iOS mirrors updated. See `localization-keys.md`.