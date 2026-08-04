# OpenCode Handoff: CRM Delivery

Last verified: 2026-07-24  
Repository: `/Users/harun/Developer/CRM_Project_Dealer`

## Purpose

This file transfers the current project state and the decisions made in prior
ChatGPT work into the repository so a new OpenCode session can continue safely.

OpenCode must read, in this order:

1. `AGENTS.md`
2. this file
3. only the task-relevant ADR, contract, and verification files linked below

The repository and live read-only checks are the source of truth. Some document
status headers predate the latest rollout and are explicitly identified below.

## First-session operating rules

- Preserve the dirty working tree. Do not reset, checkout, stash, clean, move,
  or overwrite existing changes.
- Do not use `git add -A`; generated and unrelated artifacts are present.
- Do not deploy a Worker, apply a migration, change a production flag, change
  DNS, configure email sending, alter secrets, or write to production D1 unless
  the user explicitly requests that exact action.
- Keep every `CRM_AUTH_*` rollout and client-readiness flag disabled until its
  documented gate and tests pass.
- Never read, print, copy, or commit secrets, raw passwords, bearer tokens,
  recovery codes, email-link tokens, `.env`, or `.dev.vars` content.
- Use `cloudflare-worker/` as the active backend. The old `app/` FastAPI/SQLite
  implementation is deprecated unless the user explicitly asks for it.
- Preserve one canonical backend and business model across all clients.
- English, German, Turkish, Arabic, and Russian are equal first-class
  languages. Arabic must receive appropriate RTL behavior.
- Do not add project-local model routing. OpenCode routing is configured
  globally.

## Git and working-tree snapshot

- Branch: `unified-order-v2`
- HEAD: `ab26397cdd5e8ebf735ea3992949db8207cfdeb6`
  (`Update project-wide architecture instructions`)
- Local branch versus the existing local `origin/unified-order-v2` ref: 0 ahead,
  0 behind. No fresh fetch was performed for this handoff.
- The working tree is intentionally dirty.

Modified tracked files:

- `apps/admin-android/app/src/main/java/me/ayartuerk/crmadmin/ui/AdminApp.kt`
- `cloudflare-worker/src/index.js`
- `cloudflare-worker/wrangler.toml`

Important untracked source and decision files:

- `cloudflare-worker/migrations/0014_identity_email_recovery_foundation.sql`
- `cloudflare-worker/src/identity/config.js`
- `cloudflare-worker/src/identity/crypto.js`
- `cloudflare-worker/src/identity/http.js`
- `cloudflare-worker/src/identity/repository.js`
- `cloudflare-worker/src/identity/service.js`
- `docs/architecture/identity-email-recovery-d1-contract.md`
- `docs/decisions/ADR-0005-identity-email-and-account-recovery.md`
- `docs/verification/identity-recovery-api-implementation-contract.md`
- this handoff file

Artifacts or unrelated evidence that must not be staged automatically:

- `android/.kotlin/`
- `docs/verification/2026-06-30/`
- `docs/verification/admin-android-api-audit.txt`
- `verification/android/`
- `verification/ios/`

Known local Git defect:

- `.git/refs/remotes/origin/worker-next 2` is an invalid ref name and causes
  repository-wide commands such as `git log --all`, `git show-ref`, and
  `git fsck` to error.
- Do not delete or rewrite it without targeted inspection and explicit approval.
- Normal operations on `unified-order-v2` still work.

## Active production architecture

- Worker: `crm-delivery-worker`
- Production route: `crm.ayartuerk.me/*`
- Admin: `https://crm.ayartuerk.me/admin/`
- API base: `https://crm.ayartuerk.me/api/v1`
- Active Worker entry: `cloudflare-worker/src/index.js`
- D1 binding: `DB`
- D1 database: `crm-delivery-db`
- D1 database ID: `14103291-eb66-4a3d-9f84-585832a4b015`
- Telegram Bot logic remains primarily in the Worker.
- Admin Android uses Kotlin and Jetpack Compose under `apps/admin-android/`.
- Apple clients use Swift and SwiftUI under `apple/`.
- Customer Android/shared code is under `android/`.
- Telegram Mini App code is under `telegram/mini-app/`.

See `AGENTS.md` for the canonical order/cart/location architecture, client
inventory, Admin Web parity rules, and five-language standard.

## Live production snapshot

These facts were rechecked read-only on 2026-07-24:

- Production deployment sends 100% of traffic to Worker version:
  `aababe45-00ca-4924-9779-858df17ea019`
- Deployment created: `2026-07-23T15:58:18.895Z`
- D1 migration tracking contains:
  `0014_identity_email_recovery_foundation.sql`
- Canonical authentication accounts: 33
  - customer realm: 31
  - staff realm: 2
- Customer profiles linked to canonical accounts: 31 of 31
- Staff profiles linked to canonical accounts: 2 of 2
- Legacy customer sessions linked to canonical accounts: 54 of 54
- `pragma_foreign_key_check`: 0 violations
- The live `/api/v1/capabilities` response reports every identity,
  email, passkey, recovery, merge, native-bearer, and client-readiness
  capability as false.
- Legacy customer session start and legacy Admin login remain enabled.
- No minimum client versions or legacy cutoff are active.

Pre-`0014` backup still present locally when this handoff was written:

```text
/private/tmp/crm-d1-0014.zvC0md/crm-delivery-db-before-0014.sql
SHA-256: d99f1f50832fbd9c2c45611cbbc3ac00f77dd380bf3d5b0dd6d18cc5bddedc22
```

`/private/tmp` is not durable storage. Do not assume this is a permanent backup.
Before relying on it for rollback, move a verified copy to an approved durable,
access-controlled location without committing it to Git.

No application test suite was run for the identity foundation during the
rollout because the user explicitly requested migration and deployment without
testing. The migration integrity queries above passed, but functional identity
and recovery behavior is not test-validated.

## Identity and recovery decision

`docs/decisions/ADR-0005-identity-email-and-account-recovery.md` is accepted.

The non-negotiable direction is:

- one stable D1-backed authentication account for every customer and staff
  profile
- customer and staff realms remain separate
- `admin_users.role` remains the Admin/Superadmin authorization source
- email is trusted only after proof of control
- verified email is mandatory for Admin and Superadmin accounts
- customer email is progressive and optional for ordinary guest use
- customers remain passwordless, using verified email and optional passkeys
- privileged recovery requires verified email plus a bound passkey or unused
  offline recovery code; email alone is insufficient
- Admin loss without authenticators requires audited Superadmin assistance
- Superadmin loss requires an owner-controlled offline break-glass process
- device IDs are metadata and never identity credentials
- Telegram identity must be verified from raw signed `initData` by the Worker
- recovery and security-sensitive changes revoke sessions through
  `auth_version`
- clients consume one backend policy and do not duplicate recovery rules
- customer merging is explicit and never silent

## What `0014` and the deployed Worker foundation implement

Migration `0014` is additive and creates 18 strict canonical identity/security
tables covering:

- accounts and verified email addresses
- external identities
- password and passkey credentials
- sessions
- recovery-code sets and codes
- challenges and proofs
- staff invitations and email-change requests
- security events and export receipts
- email outbox
- idempotency, replay, and rate-limit state

It also:

- adds canonical account links and compatibility fields to legacy profiles,
  sessions, token revocations, and audit rows
- backfills customer and database-backed staff accounts
- registers existing database staff hashes as legacy credentials requiring
  upgrade
- links existing customer sessions to account/authentication versions
- adds uniqueness, realm/link, protected-account, and last-Superadmin guards
- adds temporary legacy-write compatibility triggers
- runs zero-violation assertions

It deliberately does not:

- infer, insert, or verify an email address
- trust existing Telegram IDs as verified external identities
- reconcile environment-defined Admin/Superadmin credentials
- copy environment passwords into D1
- merge customers
- enable any identity feature

The deployed Worker foundation:

- publishes derived identity capabilities through `GET /api/v1/capabilities`
- intercepts `/api/v1/{customer|admin}/{auth|security}/...`
- returns `503 feature_disabled` while a required capability is disabled
- still returns `503 feature_not_ready` if someone accidentally enables a flag
  before a reviewed handler replaces the guard
- contains an initial canonical-session resolver and security-event append
  helper
- keeps every identity flag explicitly false in `wrangler.toml`

## What is not implemented

Do not mistake the deployed foundation for a working authentication/recovery
system.

Missing or incomplete work includes:

- canonical resolver integration into existing protected routes
- complete status, enrollment-deadline, profile, and staff-role checks
- security-event integration into real authentication flows
- secure customer guest-session replacement
- raw Telegram `initData` verification and replay protection
- environment staff reconciliation and protected Superadmin bootstrap
- costed/versioned staff password hashing and legacy hash upgrade
- provider-neutral email adapter and Cloudflare binding
- challenge/outbox dispatcher, retries, rate limits, and replay controls
- staff invitations, enrollment, passkeys, recovery codes, and recovery
- customer verified-email login, passkeys, email changes, and session management
- explicit customer account linking/merge
- native application secure credential storage and attestation contract
- five-language email/UI copy and Arabic RTL verification
- break-glass, verified-recipient email, and cross-client test runbooks

Known active legacy security gaps that must be closed before enabling flags:

- customer `session/start` can still restore an account from caller-controlled
  `device_id`
- the current customer-session resolver does not enforce canonical account
  status or `issued_auth_version`
- Telegram Mini App still relies on client-visible `initDataUnsafe`, derives a
  device ID, and stores bearer tokens in browser `localStorage`
- legacy Admin API identity still resolves from username/role JWT claims
- the global five-digit Telegram reset code and `app_settings` password
  override remain active
- the new `resolveCanonicalSession` and `appendSecurityEvent` helpers are not
  used by existing protected flows

Therefore: do not enable `CRM_AUTH_SCHEMA_READY`,
`CRM_AUTH_CANONICAL_RESOLVER`, `CRM_AUTH_CUSTOMER_BOUNDARY`,
`CRM_AUTH_LEGACY_LOGIN_DISABLED`, or any dependent capability merely because
the schema and scaffolding exist.

## Recovery email direction

When email delivery work begins:

- use Cloudflare's native Worker email binding behind a provider-neutral adapter
- prefer `security@auth.ayartuerk.me` as the isolated authentication sender
- initially send only to external destination addresses manually added and
  verified in the Cloudflare dashboard
- use those verified destinations for controlled testing before general rollout
- keep `CRM_AUTH_EMAIL_DELIVERY=false` until the adapter, templates, outbox,
  retry behavior, privacy controls, and monitoring pass review
- recheck the current Cloudflare product status, plan requirements,
  arbitrary-recipient rules, and service limits immediately before production
  enablement because they can change

No production recovery email sending is configured or enabled at this snapshot.

## Unrelated Admin Android working-tree change

`AdminApp.kt` currently adds:

- drawer navigation and a page-title header
- Russian to the displayed language list
- an `I forgot my password` button

This change is incomplete and must be reviewed separately from identity work:

- the forgot-password action is a TODO and does nothing
- visible strings are hardcoded English and do not satisfy the five-language rule
- `Scaffold` and `TopAppBar` imports appear unused
- it was not verified as part of the identity rollout

Do not mix this file into an identity-foundation commit without explicit review.

## Documentation drift

These status statements are stale:

- `docs/architecture/identity-email-recovery-d1-contract.md` says `0014` is not
  implemented or applied
- `docs/verification/identity-recovery-api-implementation-contract.md` says
  routes are not implemented or deployed
- ADR-0005 still describes `0014` as planned

Correct interpretation:

- the additive schema is implemented and applied
- the fail-closed Worker capability/routing foundation is deployed
- functional identity, enrollment, passkey, email, and recovery routes are not
  implemented
- all rollout capabilities remain disabled

The README and some Android status documents also lag behind the canonical V2
architecture and later Admin Android work. Prefer `AGENTS.md`, current code,
current migrations, accepted ADRs, and dated live verification.

## Recommended immediate sequence

1. Preserve the production-relevant working tree. Compare the local Worker,
   migration, and identity modules with the deployed rollout evidence before
   changing them.
2. Create a focused identity-foundation commit containing only the migration,
   Worker scaffolding, flags, ADR, contracts, and a dated rollout verification
   record. Do not include generated artifacts or unrelated Android UI work.
3. Update the stale identity document status headers without rewriting their
   accepted security requirements.
4. Review the Admin Android changes independently; either complete/localize and
   verify them in a separate commit or leave them untouched.
5. Implement the canonical dual-read resolver and security-event integration
   while every production capability remains disabled.
6. Add focused automated/disposable-D1 tests for resolver status, realm,
   authentication-version, enrollment, role, legacy revocation, and
   fail-closed behavior.
7. Close the customer device-ID/Telegram identity boundary and replace unsafe
   browser token storage before enabling customer identity.
8. Continue the accepted rollout order: staff reconciliation/bootstrap,
   simulated then verified-destination email delivery, protected Superadmin
   enrollment and break-glass drill, native attestation amendment, ordinary
   staff recovery, progressive customer email/passkeys, and final legacy
   retirement.

## Relevant files

- `AGENTS.md`
- `README.md`
- `cloudflare-worker/src/index.js`
- `cloudflare-worker/wrangler.toml`
- `cloudflare-worker/migrations/0014_identity_email_recovery_foundation.sql`
- `cloudflare-worker/src/identity/`
- `docs/decisions/ADR-0005-identity-email-and-account-recovery.md`
- `docs/architecture/identity-email-recovery-d1-contract.md`
- `docs/verification/identity-recovery-api-implementation-contract.md`
- `docs/decisions/ADR-0003-unified-order-lifecycle-v2.md`
- `docs/decisions/ADR-0004-telegram-bot-migrates-to-v2.md`
- `docs/CURRENT/order-lifecycle-v2.md`
- `docs/mobile-admin/`

## Suggested first OpenCode prompt

```text
Read AGENTS.md and docs/project-handoff.md. Inspect the current branch and
working tree without modifying anything. Treat the live snapshot and warnings
in the handoff as current. Do not deploy, migrate, change flags, touch secrets,
clean generated files, or stage anything. Give me a brief report that separates
the deployed identity foundation from unimplemented recovery functionality,
then recommend exactly one safe next action and wait for my decision.
```
