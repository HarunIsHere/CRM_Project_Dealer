Master Project Handoff Document  
Repository: `/Users/harun/Developer/CRM_Project_Dealer`

1. Global System Topology

Production truth

- Live production is the Cloudflare Worker stack, not the old FastAPI stack.
- Public flow is:

  `crm.ayartuerk.me/* -> Cloudflare Worker (crm-delivery-worker) -> Cloudflare D1 (crm-delivery-db)`

Core live backend

- Main backend root: `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker`
- Main Worker entrypoint: [index.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/index.js)
- Identity API router: [service.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/service.js)
- Identity capability gates: [config.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/config.js)
- Infra config: [wrangler.toml](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/wrangler.toml)

Mail topology

- Outbound auth/security mail is designed around Cloudflare Email Sending.
- Dedicated sender: `security@auth.ayartuerk.me`
- Email pipeline layers:
  - provider binding + recipient policy: `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/email/provider.js`
  - template policy: `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/email/policy.js`
  - template rendering: `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/email/templates.js`
  - encrypted outbox persistence: `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/email/outbox-repository.js`
  - dispatch/queue worker: `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/email/dispatcher.js`

Client layout layers

- Live web admin UI is still rendered directly by the Worker monolith in:
  - [index.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/index.js)
- Current admin Android app:
  - `/Users/harun/Developer/CRM_Project_Dealer/apps/admin-android`
- Apple client/shared layer:
  - `/Users/harun/Developer/CRM_Project_Dealer/apple/shared`
  - `/Users/harun/Developer/CRM_Project_Dealer/apple/admin-app`
  - `/Users/harun/Developer/CRM_Project_Dealer/apple/customer-app`
- Legacy/parallel Android tree still exists:
  - `/Users/harun/Developer/CRM_Project_Dealer/android`
- Customer/public Python app layer still exists:
  - `/Users/harun/Developer/CRM_Project_Dealer/app`
- Telegram channel layers:
  - `/Users/harun/Developer/CRM_Project_Dealer/telegram/bot`
  - `/Users/harun/Developer/CRM_Project_Dealer/telegram/mini-app`

Practical reading of that topology

- `cloudflare-worker/` is the live system.
- `apps/admin-android/` is the current admin Android implementation.
- `apple/shared/` is the mobile Swift contract layer.
- `android/` and `app/` are useful reference/history layers, but not the production source of truth.

2. State & Sync Boundaries

Business-state source of truth

- Backend owns all business logic and persistent state.
- Clients must not implement their own order, cart, auth, location, or permission logic locally.
- Every channel is supposed to converge on one canonical backend model.

E-commerce / request / order convergence

- Customer traffic can originate from:
  - Telegram bot
  - Telegram mini app
  - customer mobile clients
  - public/catalog flows
- Admin operations can originate from:
  - web admin
  - admin Android
  - later admin iOS
- All of those are supposed to hit the same Worker + D1 state.

Order handling boundary

- Canonical direction is the V2-style cart/order/location architecture.
- Long-term truth belongs to dedicated cart/order/location concepts, not legacy mixed models.
- Important consequence:
  - do not split future work into “legacy orders” vs “new orders” as permanent parallel systems.
  - migrate toward one canonical lifecycle.

Authentication/session boundary

- Canonical identity state now lives under `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity`
- Important session scopes already exist in the schema:
  - `staff_enrollment`
  - `staff_recovery_email`
  - `staff_recovery_authorized`
  - `staff_password_limited`
  - `staff_strong`
- Cookie/bearer transport rules are centralized in:
  - `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/transport.js`

Where the new `staff_recovery` slice fits

- New recovery route implementation is anchored at:
  - [recovery-http.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/staff/recovery-http.js)
- Route wiring is anchored at:
  - [service.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/service.js)
- Schema foundations are already in:
  - [0014_identity_email_recovery_foundation.sql](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/migrations/0014_identity_email_recovery_foundation.sql)
  - [0015_auth_account_locale.sql](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/migrations/0015_auth_account_locale.sql)
- It plugs into:
  - `auth_challenges`
  - `auth_sessions`
  - `auth_email_outbox`
  - `auth_password_credentials`
- It uses the existing auth mail outbox pipeline, not a separate mail system.
- Current status: implementation code exists, but capability activation is still gated in `config.js`.

3. Hidden Engineering Rules

Rule 1: Do not treat the Worker monolith as dead

- `cloudflare-worker/src/index.js` is large and ugly, but it is still live production.
- The web admin, legacy login, Telegram reset flow, and many admin pages still run through it.
- Breaking `index.js` can break the live website immediately.

Rule 2: Backend is authoritative; clients are thin

- Mobile and web must call backend contracts.
- Do not move business rules into Android/iOS just because it is faster.

Rule 3: Respect the split between legacy auth and canonical auth

- The repository is in transition.
- Old admin login/reset behavior still exists in the monolith.
- New canonical identity behavior lives under `src/identity/`.
- Do not casually merge them without understanding which path is live for which screen.

Rule 4: Do not blindly enable feature flags

- `wrangler.toml` and `src/identity/config.js` together determine whether a capability is actually live.
- A route existing in code does not mean it is safe or reachable.
- For identity work, flag logic is part of the architecture, not just deployment config.

Rule 5: `shared/i18n/` is canonical for generated localization

- Canonical catalogs:
  - `/Users/harun/Developer/CRM_Project_Dealer/shared/i18n/admin_texts.json`
  - `/Users/harun/Developer/CRM_Project_Dealer/shared/i18n/customer_texts.json`
- New user-facing/admin-facing strings should be driven from there, not hardcoded ad hoc per client.

Rule 6: There are duplicate platform trees; pick the current one intentionally

- Current admin Android work is under:
  - `/Users/harun/Developer/CRM_Project_Dealer/apps/admin-android`
- There is also an older Android tree:
  - `/Users/harun/Developer/CRM_Project_Dealer/android`
- An AI that mixes those two casually will drift architecture fast.

Rule 7: Cloudflare deployment on this machine has local quirks

- Use repo-local Wrangler if needed:
  - `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/node_modules/.bin/wrangler`
- This machine has a known Wrangler log-path quirk:
  - set `WRANGLER_LOG_PATH=/private/tmp/wrangler.log`
- Low-disk deploy workaround already matters in this repo:
  - use `--outdir /private/tmp/... --upload-source-maps=false`
  - preserve dashboard vars with `--keep-vars`

Rule 8: Mail recipient policy is intentionally constrained

- Recovery/security email work is designed around controlled Cloudflare sending.
- Test-recipient rules matter.
- Do not assume arbitrary-recipient sending behavior without re-checking the current Cloudflare product state.

4. AI Context Onboarding & Indexing Map

Parse first, in this order:

A. Production control plane

- [README.md](/Users/harun/Developer/CRM_Project_Dealer/README.md)
- [AGENTS.md](/Users/harun/Developer/CRM_Project_Dealer/AGENTS.md)
- [wrangler.toml](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/wrangler.toml)
- [package.json](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/package.json)

B. Live backend entrypoints

- [index.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/index.js)
- [service.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/service.js)
- [config.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/config.js)

C. Identity core

- `/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/`
- Read these first inside that tree:
  - `http.js`
  - `protocol.js`
  - `transport.js`
  - `repository.js`
  - `crypto.js`
  - `challenge-token.js`
  - `session-keyring.js`
  - `idempotency.js`

D. Recovery-specific slice

- [recovery-http.js](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/src/identity/staff/recovery-http.js)
- `email/provider.js`
- `email/policy.js`
- `email/templates.js`
- `email/outbox-repository.js`
- `email/dispatcher.js`

E. Schema foundations

- [0014_identity_email_recovery_foundation.sql](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/migrations/0014_identity_email_recovery_foundation.sql)
- [0015_auth_account_locale.sql](/Users/harun/Developer/CRM_Project_Dealer/cloudflare-worker/migrations/0015_auth_account_locale.sql)

F. Existing staff identity reference slices

- `staff/invitation-http.js`
- `staff/invitation-acceptance.js`
- `staff/enrollment-http.js`
- `staff/enrollment-password-http.js`
- `staff/enrollment-password.js`
- `staff/enrollment-recovery-code-http.js`
- `staff/enrollment-recovery-code-sets.js`
- `staff/password-profile.js`
- `staff/pwned-passwords.js`
- `staff/bootstrap.js`

G. Current admin mobile contract layers

Android first:

- [AdminApi.kt](/Users/harun/Developer/CRM_Project_Dealer/apps/admin-android/app/src/main/java/me/ayartuerk/crmadmin/api/AdminApi.kt)
- [ApiClient.kt](/Users/harun/Developer/CRM_Project_Dealer/apps/admin-android/app/src/main/java/me/ayartuerk/crmadmin/api/ApiClient.kt)

Apple first:

- [AdminIdentityApiClient.swift](/Users/harun/Developer/CRM_Project_Dealer/apple/shared/Sources/AdminIdentityApiClient.swift)
- [ApiModels.swift](/Users/harun/Developer/CRM_Project_Dealer/apple/shared/Sources/ApiModels.swift)
- [PublicApiClient.swift](/Users/harun/Developer/CRM_Project_Dealer/apple/shared/Sources/PublicApiClient.swift)
- [CustomerApiClient.swift](/Users/harun/Developer/CRM_Project_Dealer/apple/shared/Sources/CustomerApiClient.swift)
- [ApiConfig.swift](/Users/harun/Developer/CRM_Project_Dealer/apple/shared/Sources/ApiConfig.swift)

H. Localization truth

- `/Users/harun/Developer/CRM_Project_Dealer/shared/i18n/admin_texts.json`
- `/Users/harun/Developer/CRM_Project_Dealer/shared/i18n/customer_texts.json`

I. Documentation for mobile/admin parity

- `/Users/harun/Developer/CRM_Project_Dealer/docs/mobile-admin/`
- `/Users/harun/Developer/CRM_Project_Dealer/docs/architecture/`
- `/Users/harun/Developer/CRM_Project_Dealer/docs/decisions/`
- `/Users/harun/Developer/CRM_Project_Dealer/docs/runbooks/`

5. Migration-safe operating assumptions for the next AI

- Assume `cloudflare-worker/` is the only live backend.
- Assume `apps/admin-android/` is the active admin Android app.
- Assume `apple/shared/` is the Swift contract layer to extend first.
- Assume `index.js` still contains live legacy website behavior and must be edited surgically.
- Assume `src/identity/` is the canonical auth future.
- Assume feature gates must stay coherent with route wiring and schema readiness.
- Assume localization must stay five-language complete.
- Assume backend state must remain single-source-of-truth across Telegram, web, Android, and iOS.

6. Current handoff status of the recovery rollout

Implemented in repo

- Staff recovery backend route file exists.
- Route registration in identity service exists.
- Minimal Android recovery API models/endpoints exist.
- Minimal iOS recovery API models/client exist.
- Recovery uses the existing auth email outbox architecture.

Not part of this handoff document

- No `config.js` toggle instructions here, per your request.

Operational implication

- The next AI should begin from the recovery/backend slice, not re-audit the whole repository.
- Its first responsibility is to verify gate coherence, deployment readiness, and live-path interaction with the still-active legacy web admin flow.
