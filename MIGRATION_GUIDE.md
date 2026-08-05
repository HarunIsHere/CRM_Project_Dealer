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

## 🎯 Global Refactoring Roadmap & Non-Negotiable Principles
- **One Backend Identity Route Registry**
- **One Backend Feature Gate Registry**
- **One Backend Transport Validator**
- **One Backend Session Resolver**
- **One Backend Response Schema**
- *Rule:* All client surfaces (Web, Android, iOS, Telegram) must only render and submit; zero business logic duplication is allowed.


I’m converting the roadmap into a client-by-client execution sequence tied directly to the confirmed Worker and contract files.

## Step 2 — Concrete client-by-client implementation sequence

The architectural target remains fixed:

- the Worker identity slice is the single source of truth,
- every client sends the same request shapes and consumes the same response semantics,
- client code keeps only UX and transport glue,
- no client redefines auth/session rules independently.

---

## Priority 0 — Backend contract hardening first

These are the backend files that must become the canonical reference before any client refactor begins.

### 1) Central identity route registry
- service.js
  - Make this the only route registry for identity entrypoints.
  - Ensure every auth/recovery/session route is routed through one stable mapping.
  - Keep the feature gate lookup and handler selection in this file only.

### 2) Capability matrix
- config.js
  - Keep all rollout gates in one place.
  - Remove any client-side readiness checks or hidden fallback conditions.
  - Treat the feature matrix as the approval source for:
    - staff recovery,
    - customer email/session capabilities,
    - Telegram init-data verification.

### 3) Session transport rules
- transport.js
  - Centralize cookie, CSRF, bearer, and origin enforcement here.
  - Web, Android, iOS, and Telegram must all conform to this transport contract.

### 4) Recovery HTTP handlers
- recovery-http.js
  - This becomes the authoritative recovery implementation.
  - All admin recovery request/response semantics must be defined here and consumed by clients as-is.

### 5) Shared identity error and protocol normalization
- http.js
- protocol.js
  - Require one common identity error envelope and one common protocol validation path.

> This is the “single backend truth” layer. No client surface should be allowed to drift from it.

---

## Priority 1 — Web Admin sequence

### Target files
- index.js
- service.js
- http.js

### Refactor tasks
1. Replace legacy duplicated admin auth flow branches in index.js with calls into the centralized identity handlers.
2. Keep web admin UI rendering in index.js, but remove any “special” auth/recovery rules from the page layer.
3. Enforce that the browser-facing web admin flow uses the same session transport and cookie scope rules defined in transport.js.
4. Ensure all reset/start/verify/password/logout browser responses return the same JSON schema and error shape from http.js.
5. The web admin should become a pure consumer of the identity slice, not a parallel implementation.

### Web deliverable
- Web Admin login, forgot-password, reset-password, and change-password all use the same backend identity rules as every other surface.

---

## Priority 2 — Android sequence

### Target files
- AdminApi.kt
- AdminApi.kt for request and response models
- recovery-http.js

### Refactor tasks
1. Make the Android admin API layer consume only the canonical Worker recovery route names:
   - start
   - verify
   - password
   - logout

2. Remove any local Android-only assumptions about:
   - response envelope shape,
   - challenge format,
   - session cookie semantics,
   - success/error mapping.

3. Update the Android request model to match the Worker contract exactly.
   - If the Worker changes the contract, the Android request model must change only as a direct translation layer.

4. Ensure Android never performs its own session validation or recovery policy decisions.
   - All validation should be backend-side in recovery-http.js.

### Android deliverable
- Android gets the same admin identity behavior and data schema as the Worker, with no second source of truth.

---

## Priority 3 — iOS sequence

### Target files
- ApiModels.swift
- AdminIdentityApiClient.swift
- recovery-http.js

### Refactor tasks
1. Make the iOS shared model layer a strict mirror of the backend contract defined in recovery-http.js.
2. Keep the shared Swift models in ApiModels.swift synchronized with the Worker response envelope:
   - request body keys,
   - response fields,
   - state transitions,
   - error payload shape.
3. Restrict the iOS client API wrapper in AdminIdentityApiClient.swift to:
   - endpoint wiring,
   - HTTP transport,
   - local UX plumbing.
4. Remove any iOS-side custom logic that tries to infer recovery state or transport semantics.

### iOS deliverable
- iOS performs no backend rule derivation; it only transmits and renders canonical Worker truth.

---

## Priority 4 — Telegram sequence

### Target files
- main.ts
- api.ts
- index.js
- index.js
- index.js

### Refactor tasks
1. Telegram Mini App:
   - Keep Telegram identity extraction in main.ts.
   - Keep the request wrappers in api.ts.
   - But move all actual auth/session decision-making to the Worker customer session endpoints in index.js.

2. Customer session flow:
   - Mini App must use only the Worker-owned routes for:
     - customer session start,
     - verify,
     - logout,
     - me,
     - locations,
     - cart and checkout.

3. Telegram webhook bot:
   - Keep the bot webhook entry in index.js.
   - Keep its secret-token verification in index.js.
   - Keep bot message routing as a Worker-owned bot transport layer, not a parallel auth layer.

4. Enforce a strict separation:
   - Telegram bot webhook traffic remains bot transport.
   - Telegram Mini App customer session remains customer identity transport.
   - Staff recovery remains its own identity slice under recovery-http.js.

### Telegram deliverable
- Telegram bot and Telegram Mini App stay isolated from the staff recovery slice, while both still consume the same centralized Worker source-of-truth where the route semantics are concerned.

---

## Priority 5 — Contract alignment pass across all clients

### Target files
- AdminApi.kt
- ApiModels.swift
- AdminIdentityApiClient.swift
- api.ts
- index.js

### Refactor tasks
1. Normalize naming and status fields across all requests and responses.
2. Standardize the error object structure so every client receives the same actionable failure payload.
3. Make Android, iOS, and Telegram clients reflect only Worker-issued state, never local state invented from partial data.

---

## Recommended rollout order

1. Backend canonical routing and gate layer  
   - service.js  
   - config.js  
   - transport.js

2. Staff recovery contract ownership  
   - recovery-http.js

3. Web Admin consumer alignment  
   - index.js

4. Android contract consumer alignment  
   - AdminApi.kt

5. iOS contract consumer alignment  
   - ApiModels.swift  
   - AdminIdentityApiClient.swift

6. Telegram Mini App session alignment  
   - main.ts  
   - api.ts

---

## Final rule for the whole program

Every client must be reduced to this formula:

- gather user input,
- call the stable Worker route,
- render the Worker response,
- cache tokens only for convenience,
- never invent auth/session semantics.

That is the cleanest path to making the Web, Android, iOS, and Telegram layers completely align with the centralized Worker identity core.