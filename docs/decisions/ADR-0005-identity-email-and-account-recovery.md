# ADR-0005: Identity, Verified Email, and Account Recovery

Date: 2026-07-23
Status: accepted

## Context

The CRM has three account roles:

- customer
- admin
- superadmin

They do not currently share one identity and recovery model.

Current privileged authentication is split between:

- environment-defined Admin and Superadmin credentials
- database-backed rows in `admin_users`
- password overrides stored in `app_settings`

Environment-defined privileged accounts do not have stable database identity rows. Existing privileged accounts do not store email addresses. Database-backed passwords use a fast SHA-256 construction rather than a password-specific, costed password hash.

The current public Admin forgot-password flow stores one global plaintext five-digit code in `app_settings` and sends it to the configured Admin Telegram chat. It is not account-bound, does not provide sufficient attempt and abuse controls, and cannot provide different recovery assurance for Admin and Superadmin accounts.

Customer identity is also transitional:

- `customers.telegram_user_id` contains both real Telegram user IDs and synthetic `app:<uuid>` values.
- `POST /api/v1/customer/session/start` can locate an existing customer from a caller-supplied `device_id` and issue a new 90-day bearer token.
- A device identifier is therefore acting as an identity credential even though it is not secret or verified.
- The Telegram Mini App derives identity from client-visible Telegram data without sending the raw signed `initData` to the Worker for server-side verification.

The project needs:

- a verified email address capability for customers, Admins, and Superadmins
- secure recovery for privileged accounts
- state-of-the-art but low-friction authentication and recovery for customers
- one canonical backend identity model used by every client
- equal behavior and localization across English, German, Turkish, Arabic, and Russian

Email recovery must not be built on top of an identity boundary that allows a caller to claim another customer through a device ID or an unverified Telegram ID.

## Decision summary

The project will adopt one canonical D1-backed identity foundation for customers, Admins, and Superadmins.

The following rules are accepted:

1. Every customer, Admin, and Superadmin maps to one stable database authentication account.
2. An email address is trusted only after proof of control. Existing addresses are never invented, guessed, or automatically marked as verified.
3. Verified email is mandatory for Admin and Superadmin accounts.
4. Privileged recovery requires more than email possession.
5. Customer email enrollment is progressive and optional for ordinary guest use. Customers will not be forced to create a password.
6. Customer cross-device login and recovery will be passwordless, using verified email and optionally passkeys.
7. Device IDs are metadata only and can never prove identity or restore an account.
8. Telegram identity must be cryptographically verified by the Worker before it is bound to an account or used to issue an authenticated customer session.
9. Recovery, identity linking, credential changes, and session revocation are backend security responsibilities. Clients must not implement competing local rules.
10. Identity migration will be staged, but the final system will not retain permanent parallel legacy and canonical authentication models.
11. Retirement of the existing Telegram recovery path is a separate owner-controlled decision. Building or activating verified-email recovery does not itself authorize disabling or removing Telegram recovery.

## Canonical identity model

The planned first schema migration for this work is:

    cloudflare-worker/migrations/0014_identity_email_recovery_foundation.sql

The migration will be additive initially and will introduce the following conceptual tables. Exact D1 column types and indexes will be reviewed in the implementation contract before the migration is applied.

### `auth_accounts`

One stable authentication root for each customer or staff identity.

Required concepts:

- stable account ID
- realm: `customer` or `staff`
- status: pending, active, disabled, or deleted
- session/authentication version
- preferred locale for authentication and security messages
- enrollment state and deadline where applicable
- creation, update, disable, and deletion timestamps

The authentication version is incremented when credentials are recovered, compromise is suspected, or the account signs out everywhere. Protected requests must reject sessions issued against an older version.

`auth_accounts.status` is the authoritative authentication/session disable state. During migration, `admin_users.is_active` is a transactional compatibility mirror and is later deprecated for authentication decisions. A write that cannot update both states atomically fails closed. Existing customer business controls such as `customers.is_blocked` remain separate from proof of identity.

### Existing business-profile links

Existing domain IDs remain stable:

- `customers.id` remains the customer/business foreign key used by orders, locations, messages, and requests.
- `admin_users.id` remains the staff profile and authorization record.

Both tables will gain a nullable `auth_account_id` link, followed by unique indexes after backfill. D1/SQLite cannot add a unique column directly with `ALTER TABLE ... ADD COLUMN`. This approach avoids destructive rewrites of current business relationships while giving authentication one canonical root.

Backfill verification and application invariants must prove:

- every migrated profile has exactly one authentication account
- a customer profile can reference only a customer-realm account
- a staff profile can reference only a staff-realm account
- no authentication account is linked to multiple profiles of the same realm

The `admin_users.role` field remains the source of the Admin/Superadmin authorization role. Authentication and role authorization remain separate concerns.

### `auth_email_addresses`

Required concepts:

- authentication account ID
- denormalized realm used for uniqueness enforcement
- normalized email used for comparison
- display email used for communication
- primary-address flag
- verification timestamp
- replacement, revocation, and deletion timestamps

Rules:

- Only a verified active address may be a recovery destination.
- A partial unique index permits only one active primary email per account.
- A partial unique index makes an active verified normalized email unique within its realm.
- The stored email realm must always match the owning authentication account; the migration and application enforce and test this invariant.
- The same person may use the same email once in the customer realm and once in the staff realm without coupling customer access to privileged access.
- Normalization must not invent provider-specific equivalence rules such as removing dots or `+tag` suffixes.
- Email addresses are masked in ordinary logs, audit detail, and UI confirmations.

### `auth_external_identities`

Verified third-party identities are represented separately from customer profiles.

Required concepts:

- authentication account ID
- provider, such as Telegram
- provider subject/user ID
- verification and link timestamps
- revocation timestamp
- minimally necessary provider metadata

A partial unique index ensures that an active `(provider, provider subject)` pair can be linked to only one account. `customers.telegram_user_id` remains compatibility/display data during migration and must stop acting as the canonical authentication identifier.

### Credentials

Credentials are stored by type:

- `auth_password_credentials` for privileged-account passwords
- `auth_passkey_credentials` for WebAuthn/passkeys
- `auth_recovery_codes` for privileged offline recovery codes

Password hashes must be versioned and use a costed password hashing construction supported and benchmarked for the Worker runtime. The current fast SHA-256 password construction is transitional and must be upgraded on authenticated login or controlled credential enrollment. Raw passwords and legacy environment password values are never copied into D1.

Passkey records contain public credential material only. Offline recovery codes are high-entropy, shown once, stored only through a server-secret keyed verifier, individually single-use, and replaced as a complete set when regenerated.

### `auth_challenges`

Email verification, passwordless login, recovery, and destination-change challenges use one purpose-bound challenge model.

Required concepts:

- account ID when known
- purpose
- destination/email reference
- cryptographic magic-link token hash, or keyed code verifier and key version
- expiry
- maximum attempts and failed-attempt count
- consumption and invalidation timestamps
- safe request context and correlation ID

Magic-link tokens have at least 256 bits of entropy and may be stored using a cryptographic hash. Lower-entropy emailed codes and human-entered recovery codes require a server-secret HMAC/pepper bound to challenge-specific context, key-version metadata, and constant-time verification. Raw links, tokens, and codes are never stored or logged.

### `auth_sessions`

The target state uses one server-verifiable session model with:

- authentication account ID
- hashed opaque token or server-verifiable token identifier
- issued authentication/session version
- authentication method and assurance
- client, platform, device label, and app version metadata
- created, last-seen, expiry, and revocation timestamps

Existing customer sessions and Admin token-revocation storage may be bridged during rollout, then retired after every client has migrated.

Session storage rules:

- browser sessions use `Secure`, `HttpOnly`, appropriately scoped `SameSite` cookies and CSRF protection where cookies authorize state changes
- long-lived bearer tokens are not stored in browser `localStorage`
- Android secrets use Android Keystore-backed storage
- Apple secrets use Keychain
- session identifiers rotate after authentication, recovery, privilege elevation, and account linking
- magic-link tokens are exchanged immediately, removed from the visible URL, and excluded from browser history, referrers, analytics, and crash reports

### `auth_email_outbox`

Authentication email uses a durable, idempotent delivery boundary.

Required concepts:

- challenge and destination reference
- template and locale
- encrypted short-lived delivery payload and encryption-key version
- idempotency/deduplication key
- attempt count, next-attempt time, expiry, and safe provider status

Challenge state and the outbox item are persisted atomically. A Queue or scheduled outbox dispatcher performs bounded retries and checks that the challenge is still valid before every send. Encrypted delivery payloads are deleted after success or expiry. Raw links, codes, and complete rendered message bodies are never written to ordinary logs.

### `auth_security_events`

Security events are separate from ordinary business activity.

Events include:

- email enrollment and verification
- login and failed login
- recovery request, failure, and completion
- passkey and recovery-code changes
- email changes
- identity linking and merging
- session revocation
- break-glass activity

Records contain stable subject and actor account IDs, role, outcome, timestamp, correlation ID, and minimally necessary risk metadata. They never contain passwords, raw tokens, recovery codes, passkey secrets, or full email addresses.

Security events are append-only by application policy. If later threat analysis requires tamper evidence against a compromised Worker or D1 administrator, events will also be hash-chained or exported to a separately controlled security-log system.

Only the authentication/security service may append events. No ordinary Admin or Superadmin API may update or delete them. Security events are retained for at least 365 days unless a stricter legal or privacy requirement applies. Break-glass and Superadmin recovery events are exported to a separately controlled, tamper-evident archive before any D1 retention cleanup.

Existing `admin_audit_logs` may continue for operational Admin actions, but authentication and recovery events use the canonical security-event model and stable account IDs.

## Admin and Superadmin policy

Admin and Superadmin accounts use a privileged assurance tier.

### Enrollment

- New privileged accounts require a verified email before activation.
- New privileged accounts must enroll a passkey and receive offline recovery codes before full access is enabled.
- A short-lived, scope-restricted invitation/enrollment session permits only
  the enrollment checklist: email verification, canonical password creation,
  passkey registration, recovery-code generation and acknowledgement, final
  enrollment completion, and safe checklist/logout operations. It does not
  authorize ordinary Admin APIs.
- A Superadmin creates a pending invitation by supplying role, username, and destination email; the recipient verifies the email and chooses their own password/passkey.
- Creating or resending an invitation never upserts by username, overwrites credentials, changes a role, or reactivates an existing account.
- Existing privileged accounts receive a 30-day enrollment window after the feature is enabled.
- During the enrollment window, authenticated staff can add and verify their own email.
- An existing address is never prefilled as verified from Telegram settings, documentation, environment variables, or guessed ownership.
- Failure to enroll by the deadline disables ordinary privileged login until an approved recovery/enrollment process is completed.

### Normal authentication

The target privileged login is AAL2-equivalent:

- password plus a user-verified passkey; or
- a future explicitly approved passkey-first flow that preserves equivalent assurance

Multiple passkeys are supported so the loss of one device does not automatically become an account-recovery event.

Before any passkey is issued, an implementation record must fix:

- the canonical RP ID
- exact allowed production and development web origins
- stable, non-username WebAuthn user handles
- a globally unique credential-ID constraint
- Android package/signing-certificate Digital Asset Links
- Apple application identifiers and associated web-credential domains

The proposed production RP ID is `ayartuerk.me`, with `https://crm.ayartuerk.me` as an allowed Web origin, subject to validation against the final Android and Apple application identities. These trust values must be verified before enrollment because changing them later can strand passkeys.

Privileged password policy for every new or changed password:

- minimum 15 characters
- support at least 64 characters
- permit paste and password managers
- no mandatory composition rules
- no scheduled rotation without evidence of compromise
- reject known-compromised/common passwords
- use a versioned, costed password hash rather than raw SHA-256

### Privileged recovery

Email alone cannot recover an Admin or Superadmin account.

Normal recovery requires:

- a verified email challenge; and
- an already-bound passkey or one unused offline recovery code

If all authenticators and recovery codes are lost:

- Admin recovery requires an audited Superadmin-assisted process with deliberate identity verification.
- Superadmin recovery requires an owner-controlled offline break-glass process.
- A helper may initiate or approve recovery but must never choose or learn the replacement password.
- Break-glass events receive prominent security logging and notification.

Successful privileged recovery:

- increments the account authentication/session version
- revokes every active session and outstanding challenge
- requires a normal fresh login rather than automatically authenticating the recovery browser
- notifies the verified security destination
- creates an append-only security event

The same account-wide revocation is required after:

- a privileged recovery-email change
- a privileged password change
- removal of a passkey
- recovery-code regeneration
- suspected account compromise

### Privileged email changes

Changing a privileged recovery email requires:

- recent strong reauthentication
- verification of the new address
- notification to the old address
- invalidation of competing recovery and email-change challenges

The new address remains pending while the old address remains active.
Activation normally requires approval through the old address; elapsed time
alone never activates a privileged email change. When the old address is
unavailable, the appropriate privileged recovery procedure and a 24-hour
security delay both apply.

Removing the final passkey or final viable recovery method requires recent strong reauthentication and must not leave an account, especially a Superadmin account, without a safe recovery path.

## Customer policy

Customer authentication is designed for low friction.

### Guest and progressive enrollment

- Customers may browse, start a cart, use Telegram, and complete ordinary purchasing flows without first creating a password.
- Customer email begins as absent and is requested progressively when it provides a clear benefit, such as cross-device access, order-history continuity, or account recovery.
- Customers are not required to create or remember a password.
- A customer without a verified recovery channel is clearly informed that the account cannot be recovered across lost devices.

### Passwordless access

The primary customer email flow is a magic link. An eight-digit code is available when opening a link on the same device is inconvenient.

After a successful verified login, the customer may add a passkey as an optional low-friction upgrade. Multiple passkeys are supported.

Ordinary repeat use should not repeatedly prompt for security factors. Recent authentication or step-up verification is required for higher-impact actions such as:

- changing the recovery email
- linking or unlinking Telegram or another external identity
- merging customer records
- deleting the account
- exposing sensitive account history from a new or suspicious device
- future stored-payment or similarly sensitive actions

Risk-based controls may add a challenge, delay, or CAPTCHA after suspicious velocity or account-takeover signals. They must not become routine friction for normal customers.

Changing a customer recovery email requires recent authentication, verification of the new address, and notification to the old address. A suspicious device, unavailable old address, or other takeover signal may trigger an additional proof or a temporary security hold.

### Customer linking and merging

A matching email address never silently merges two customer records.

Linking or merging requires:

- proof of control of the identities being combined
- clear confirmation of which records are affected
- deterministic rules for orders, locations, language, and profile conflicts
- a transactional database operation
- precondition checks and an idempotency key
- an auditable security event

Email uniqueness and concurrent merge races must be enforced at the database layer. The implementation must use a D1-supported atomic operation such as a validated `batch()` sequence rather than assuming a long-lived interactive SQL transaction is available in the Worker.

### Customer sessions after recovery

Passwordless login and account recovery are distinct:

- a routine valid magic-link login may create a new session without revoking all other sessions
- recovery after suspected loss or compromise defaults to revoking other sessions
- changing credentials, changing the recovery email, or explicitly choosing “sign out everywhere” increments the authentication/session version

Recovery completion does not silently bypass any required post-recovery confirmation.

## Customer identity security prerequisite

The existing device-ID restoration behavior must be removed before customer recovery becomes authoritative.

Rules:

- `device_id` is platform metadata only.
- A device or installation identifier may label a session but cannot locate an account, prove account ownership, or authorize a new session.
- New guest sessions are issued by the server with cryptographically random credentials and persisted securely by the client.
- Losing a guest credential does not permit restoration from a guessed device identifier.

For the Telegram Mini App:

- the client sends the raw Telegram `initData` payload to the Worker
- the Worker validates the signature/hash using the Telegram bot secret
- the Worker validates `auth_date` freshness against a short configurable maximum age
- the Worker applies replay protection before binding the Telegram subject or issuing a Telegram-authenticated session
- a caller-provided Telegram ID or `initDataUnsafe` value is never accepted as proof

Trusted Telegram identities originating from authenticated webhook updates may be migrated only when their provenance is unambiguous.

Typed telephone numbers are identifiers only until a separate ownership-verification flow proves control.

## Recovery challenge security

Initial security defaults:

- email-link token: at least 256 bits of cryptographically secure randomness
- privileged link lifetime: 15 minutes
- customer link lifetime: 30 minutes
- manual fallback code: eight digits, 10-minute lifetime
- maximum failed code attempts: five
- resend cooldown: 60 seconds
- initial send limit: five per hour and 20 per day per account
- additional IP, device, destination, and system-wide abuse limits

All challenge endpoints must:

- return a generic response for valid, unknown, disabled, and ineligible accounts
- have comparable practical response timing
- perform email delivery asynchronously
- bind a challenge to its account, purpose, and destination
- invalidate the previous active challenge when a replacement is issued
- be single-use and reject replay
- allow-list post-verification redirect targets
- avoid changing or locking an account merely because recovery was requested
- avoid revealing provider delivery errors or account existence
- silently suppress account/destination throttling behind the same generic accepted response used for unknown accounts

Provider delivery failures, guessing, destination flooding, credential stuffing, and unusual recovery volume must be observable without logging secrets.

Authenticated enrollment and account-management screens may show safe retry guidance because account existence is already established. Public recovery endpoints must not return a distinguishable `429`, body, or timing only for existing accounts.

Challenge issuance is ordered as follows:

1. persist the challenge, safe audit state, and encrypted outbox item atomically
2. commit the response-independent security state
3. dispatch email asynchronously through a Queue or scheduled outbox worker; `waitUntil` may accelerate but is not the sole durability mechanism
4. retry only while the challenge remains valid
5. record a safe delivery status or error class without deleting the challenge or exposing account existence

## Email delivery

Transactional authentication email is sent through a provider-neutral backend adapter.

The initial provider is Cloudflare’s native Worker email binding because it fits the existing Worker architecture and avoids storing a separate email-provider API key in application code. Provider-specific behavior must remain behind the adapter so a different transactional provider can be adopted without changing recovery policy or API contracts.

The intended isolated sender is:

    security@auth.ayartuerk.me

The exact Cloudflare plan, sending-domain onboarding state, and current public-beta limitations must be verified before production enablement.

Development and preproduction rules:

- restrict real sends to destination addresses manually added and verified in the Cloudflare dashboard
- use those verified external recipients for controlled testing before general rollout
- do not enable arbitrary-recipient delivery merely to simplify development
- keep local development in simulated/logged delivery mode unless a controlled real-send test is intentional

Production rules:

- arbitrary-recipient sending is enabled only after explicit rollout approval and confirmation of the required Cloudflare plan
- sender authentication and DNS records are verified
- production Email Preview or equivalent message-body retention is disabled after setup validation
- both plain-text and HTML versions are provided
- delivery failures are handled without exposing account existence
- only minimal provider message status and safe error classification are audited
- recovery links, codes, and complete message bodies are not retained in application logs

Authentication mail is not used for marketing.

## API and client contract

All identity and recovery APIs are versioned under `/api/v1/...` and separated by realm where assurance differs.

The API contract must provide capabilities for:

- email enrollment and verification
- email change
- customer passwordless login
- privileged recovery
- passkey registration, authentication, listing, and revocation
- offline recovery-code generation and consumption
- Telegram Mini App verification and linking
- session listing and revocation
- account linking/merge confirmation
- security-event recording

Start and resend endpoints return generic accepted responses. Complete endpoints validate a purpose-bound challenge and never accept raw account IDs, email addresses, Telegram IDs, or device IDs as proof of ownership.

The Worker and D1 remain the source of truth. Web Admin, Admin Android, Admin iOS, Customer Android, Customer iOS, Telegram Mini App, and Telegram Bot consume the same backend identity rules. Clients may adapt presentation natively but may not weaken, duplicate, or reinterpret recovery assurance.

All user-facing and Admin-facing identity text must ship with equivalent English, German, Turkish, Arabic, and Russian localization. Arabic layouts must support RTL behavior.

## Migration and rollout

### Phase 1: Additive identity foundation

- Create the canonical authentication tables.
- Add nullable `auth_account_id` links to `customers` and `admin_users`.
- Add unique indexes only after successful backfill and duplicate checks.
- Backfill one authentication account per existing customer and database-backed privileged account.
- Verify account/profile cardinality and realm correctness before enabling canonical authentication.
- Preserve existing customer and Admin IDs and authorization roles.
- Add stable account references to new sessions, tokens, and security events.
- Leave every existing email unverified and absent until the owner enrolls it.

### Phase 2: Close the customer identity boundary

- Stop account lookup and restoration from arbitrary `device_id`.
- Issue and persist server-generated guest credentials.
- Implement Telegram `initData` signature, freshness, and replay validation.
- Bind Telegram subjects through `auth_external_identities`.
- Add forgery, staleness, replay, and device-ID takeover tests.

Customer email recovery must not become authoritative before this phase passes verification.

### Phase 3: Reconcile environment privileged accounts

- Run a complete preflight for username, role, and identity collisions before creating or linking records.
- Abort the reconciliation without partial changes on any collision; never merge, re-role, reactivate, or overwrite credentials automatically.
- Create protected `admin_users` profiles and authentication accounts for the environment-defined Admin and Superadmin.
- Resolve the current `admin_users.password_hash NOT NULL` constraint through an explicit table migration/cutover or a deliberately non-authenticating sentinel; a sentinel must never be accepted as a credential.
- Map transitional environment login to the new stable account IDs.
- Do not copy raw environment passwords into D1.
- Prevent self-disable, self-deletion, or Superadmin lockout during migration.

Environment credentials become bootstrap/transitional credentials and are removed from ordinary authentication after enrollment is verified.

### Phase 4: Email adapter and controlled delivery

- Add the provider-neutral transactional email adapter.
- Add the Cloudflare Worker email binding only in the appropriate environment.
- Configure the dedicated authentication sender after domain verification.
- Test only with manually verified Cloudflare destination addresses.
- Verify five-language plain-text and HTML templates and delivery-failure behavior.

### Phase 5: Privileged enrollment and recovery

- Begin the 30-day verified-email enrollment window.
- Enroll at least one passkey and issue offline recovery codes.
- Do not enforce the enrollment cutoff until at least one Superadmin has completed all enrollment steps and the offline break-glass procedure has been tested; two recovery-capable Superadmins are preferred when operationally possible.
- During the grace period, password-only staff may continue ordinary operational work, but Superadmin/account-management and other security-sensitive actions require completed strong enrollment.
- Every legacy staff session expires no later than the enrollment deadline. At cutoff, remaining sessions are revoked and non-enrolled accounts receive only the restricted enrollment/recovery flow.
- Upgrade legacy password hashes after authenticated proof.
- Enable privileged multi-proof recovery and account-wide session revocation.
- Keep the global Telegram/app-settings forgot-password path available until the project owner explicitly approves its retirement; isolate and monitor it as a legacy recovery path in the meantime.
- Use only the documented audited break-glass process for non-enrolled or fully locked-out privileged accounts.

### Phase 6: Progressive customer identity

- Add optional customer email enrollment.
- Add verified-email magic-link/code login.
- Offer optional passkeys after a verified login.
- Add explicit identity-link and merge flows.
- Add step-up behavior only for high-impact or suspicious actions.

### Phase 7: Session convergence and legacy retirement

- Move every client to stable account IDs and authentication/session versions.
- Migrate or expire legacy sessions safely.
- Retire username-only token identity, device-ID restoration, global reset settings, password overrides, and redundant session/revocation tables.
- Remove synthetic `app:<uuid>` identity semantics after no live client depends on them.

Legacy structures are removed only after cross-client verification and an approved rollback checkpoint. They do not remain as permanent parallel identity systems.

## Security acceptance criteria

Implementation is not complete until automated and end-to-end tests demonstrate:

- enumeration-resistant recovery responses and practical timing
- token/code expiry, single use, replacement invalidation, and replay rejection
- code attempt limits and layered rate limits
- no raw token, code, password, or full email in logs
- account-wide privileged session revocation
- authentication/session-version enforcement on every protected request
- passkey RP ID, origin, challenge, user verification, signature, and credential-state checks
- one-time hashed recovery-code behavior
- safe privileged email changes and notifications
- Telegram forgery, stale-payload, and replay rejection
- rejection of customer restoration from a device ID
- transactional email uniqueness and account-link/merge conflict handling
- Admin/Superadmin role and self-lockout protections
- authorization boundaries between customer and staff realms
- equivalent security behavior in all affected clients
- equivalent localized behavior in all five supported languages
- Arabic RTL presentation where applicable
- backup/restore verification, delivery monitoring, abuse monitoring, and a tested break-glass runbook before production enablement

## Rollback

Rollout is feature-flagged by environment and principal type.

A safe rollback can:

- stop issuing new verification/recovery challenges
- invalidate outstanding challenges
- disable email delivery
- require fresh login
- revert clients to the last verified login UI during the migration window

Rollback must not:

- mark an unverified email as verified
- restore insecure device-ID account recovery
- re-enable the global plaintext reset-code path
- delete canonical identity or security-event data
- require a destructive D1 downgrade

## Consequences

Positive consequences:

- every account obtains a stable identity independent of username, device, or channel
- privileged recovery has appropriate assurance
- customers receive convenient passwordless access without mandatory passwords
- Telegram and native customer clients converge on the same identity
- recovery policy and email delivery provider remain decoupled
- account-wide session revocation and security auditing become reliable

Costs and risks:

- privileged users must complete a deliberate enrollment step
- the system will store additional personal data and must protect, minimize, and retain it appropriately
- passkeys, email delivery, session migration, and customer merging add implementation and support complexity
- Cloudflare email availability, plan requirements, and beta behavior remain an operational dependency until verified
- customer identity cleanup must be coordinated across Telegram, Mini App, Android, and iOS

These costs are accepted because continuing the current split identity model would make secure email recovery unreliable and preserve known account-takeover and privileged-reset weaknesses.

## Out of scope

This ADR does not:

- enable production email sending or change DNS
- deploy a Worker or apply a D1 migration
- introduce customer passwords
- add marketing email
- silently merge customer records
- change Admin/Superadmin business permissions
- change production domains, Worker name, D1 binding, Telegram webhook, or bot token

## Implementation records to create next

Before code implementation, create and review:

1. the exact D1 schema and migration/backfill contract
2. the versioned identity/recovery API contract
3. the Cloudflare email-domain and verified-recipient test runbook
4. the privileged enrollment and break-glass runbook
5. the five-language identity/recovery copy matrix
6. the cross-client security verification plan

## Security baseline references

- NIST SP 800-63B: <https://pages.nist.gov/800-63-4/sp800-63b.html>
- OWASP Forgot Password Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html>
- OWASP Authentication Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- OWASP Password Storage Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html>
- W3C Web Authentication Level 3: <https://www.w3.org/TR/webauthn-3/>
- Telegram Mini App validation: <https://core.telegram.org/bots/webapps>
- Cloudflare Email Service: <https://developers.cloudflare.com/email-service/>
