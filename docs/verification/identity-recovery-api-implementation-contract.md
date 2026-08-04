# Identity and Recovery API Implementation Contract

Date: 2026-07-23
Status: proposed target contract; routes are not implemented or deployed
Decision source: [ADR-0005](../decisions/ADR-0005-identity-email-and-account-recovery.md)
D1 contract: [Identity, Email, and Recovery D1 Migration Contract](../architecture/identity-email-recovery-d1-contract.md)

## Purpose

This document fixes the versioned Worker API that Web Admin, Admin Android, Admin iOS, Customer Web, Telegram Mini App, Customer Android, and Customer iOS use, plus the verified customer-identity bridge used by the Telegram Bot, for:

- guest sessions
- verified Telegram authentication
- verified-email enrollment and passwordless customer access
- staff password-plus-passkey authentication
- passkey management
- staff invitations and enrollment
- staff multi-proof recovery
- offline recovery codes
- email changes
- session listing and revocation
- explicit identity linking and customer merge authorization

It preserves the current `/api/v1` envelope while replacing the current username-, device-, and channel-specific identity decisions with one canonical Worker service.

This document does not authorize a deployment, D1 migration, email send, DNS change, environment-secret change, or production flag change.

## Normative language and base URL

The words MUST, MUST NOT, SHOULD, and MAY are normative.

Production base URL:

```text
https://crm.ayartuerk.me/api/v1
```

Identity routes are separated by realm:

```text
/api/v1/customer/auth/...
/api/v1/customer/security/...
/api/v1/admin/auth/...
/api/v1/admin/security/...
```

The route families share one backend identity service. Path separation does not permit different security rules in different clients.

## Shared protocol

### Media type and request size

- Request and response bodies use `application/json; charset=utf-8`.
- Non-empty JSON requests without `Content-Type: application/json` return `415 unsupported_media_type`.
- Malformed JSON returns `400 invalid_json`.
- Identity request bodies are limited to 64 KiB.
- Unknown JSON fields are rejected with `400 invalid_request`; security operations do not silently ignore misspelled fields.

### Correlation IDs

Every response includes a server-generated opaque request ID:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2"
}
```

The same value is returned in:

```text
X-Request-ID: 3c4d5e6f7890a1b2c3d4e5f67890a1b2
```

A syntactically valid client `X-Request-ID` may be recorded as an untrusted parent correlation value, but the server still creates its own ID.

### Success and error envelopes

The existing Worker shape remains:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "session": {}
}
```

Every `/api/v1` success keeps route-specific fields at the top level beside `ok` and `request_id`; there is no `data` wrapper. New identity clients MUST decode by named field, not by field order.

Errors remain:

```json
{
  "ok": false,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "error": {
    "code": "invalid_or_expired_challenge",
    "message": "The verification request is invalid or expired."
  }
}
```

`error.code` is the stable contract. `error.message` is diagnostic English and MUST NOT be displayed as final user-facing copy. Clients localize the machine code.

Validation details may be returned only when they do not reveal account existence or security state:

```json
{
  "ok": false,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "error": {
    "code": "validation_failed",
    "message": "The request contains invalid fields.",
    "details": {
      "fields": {
        "locale": "unsupported_value"
      }
    }
  }
}
```

### Response headers

Every identity response sets:

```text
Cache-Control: no-store
Pragma: no-cache
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Request-ID: <server request ID>
```

Magic-link landing pages also set a restrictive Content Security Policy and contain no analytics, third-party scripts, external images, or referrer-producing content.

### Locales

Allowed locale values:

```text
en
de
tr
ar
ru
```

The API returns machine state and codes. All seven clients and all email templates use one shared localization-key matrix. The five languages have equivalent behavior. Arabic Web/email markup uses `dir="rtl"` and native clients use RTL layout.

Locale selection order:

1. validated body `locale`
2. authenticated account preference
3. supported `Accept-Language`
4. `en`

The fallback affects presentation only; it never changes security behavior.

### Opaque IDs and timestamps

- Authentication, challenge, attempt, session, invitation, passkey, and workflow IDs are opaque 32-character lowercase hexadecimal strings.
- Existing `customer.id` and `admin.id` remain numeric business/profile IDs.
- APIs add `account_id`; they never repurpose a business ID.
- All response times are RFC 3339 UTC strings.
- Secrets, tokens, email addresses, Telegram subjects, and device IDs are not accepted as resource IDs.

## Authentication resolver

Every protected route MUST use one canonical realm-aware resolver.

It MUST:

1. identify the session transport
2. validate and hash the token
3. reject revoked or expired sessions
4. join `auth_accounts`
5. reject a wrong realm or deleted account
6. require the issued authentication version to equal the account version
7. load the current customer or staff profile
8. load `admin_users.role` for staff authorization
9. enforce the required scope and recent-authentication age

`auth_accounts.status` is the authentication/session authority. `customers.is_blocked` remains a separate business-policy check. `admin_users.is_active` is a migration mirror, not an independent bypass.

The exact status/scope matrix is:

- `customer_guest`, `customer_verified`, and `staff_strong` require `status=active`.
- `staff_password_limited` requires `status=active`, enrollment state `required` or `in_progress`, and a null or not-yet-passed enrollment deadline. It cannot resolve after enrollment completes or expires.
- `staff_enrollment` may resolve a pending account linked to an accepted
  invitation, or an active existing staff account with enrollment state
  `required` or `in_progress`, only while its enrollment deadline is null or
  not passed. It may resolve a disabled account only when
  `disabled_reason=enrollment_expired` and enrollment state is `expired`, after
  the required fresh password proof.
- `staff_recovery_email` and `staff_recovery_authorized` require an active account. Administratively disabled, security-held, owner-disabled, pending, and deleted accounts receive the same public recovery-start response but no usable recovery session.
- `break_glass` may resolve a disabled account only under the approved owner runbook. Credential repair cannot clear `administrative`, `security_hold`, or `owner_requested`; reactivation is a separate authorized operation.
- Enrollment completion may activate a pending account linked to an accepted
  invitation or reactivate only `enrollment_expired`. It rejects every other
  disabled reason.

No environment Admin/Superadmin username may short-circuit canonical status after reconciliation.

## Session scopes and assurance

| Scope | Proof | Permitted use |
|---|---|---|
| `customer_guest` | Server-issued random session | Ordinary customer shopping and profile activity |
| `customer_verified` | Verified email, verified Telegram, or passkey | Customer security/linking operations |
| `staff_password_limited` | Legacy password during enrollment grace | Ordinary operational staff work only |
| `staff_strong` | Password plus user-verified passkey | Full role-authorized staff access |
| `staff_enrollment` | Invitation or enrollment-only continuation | Enrollment routes only |
| `staff_recovery_email` | Verified staff recovery email | Recovery second-proof routes only |
| `staff_recovery_authorized` | Email plus passkey/recovery code, or audited Superadmin-assisted Admin grant | Replacement-passkey registration when required, then recovery-only actions |
| `break_glass` | Approved offline owner process | Explicit emergency scope only |

Recent authentication:

- staff strong proof: no more than 5 minutes old
- customer verified proof: no more than 15 minutes old
- WebAuthn ceremony: no more than 5 minutes old

A restricted scope is not an ordinary logged-in session. Its server-side authorization context names the originating challenge/grant, enrollment stage, and closed allowed-action list. Middleware rejects every route/action not named there even when the broad scope matches.

## Session transport

### Native applications

Admin Android, Admin iOS, Customer Android, and Customer iOS use bearer transport:

```text
Authorization: Bearer <opaque 256-bit token>
```

Required storage:

- Android: Keystore-backed encrypted storage
- Apple: Keychain

Plain DataStore, ordinary preferences, source files, logs, and UI state are not acceptable final secret storage.

### Browsers and Telegram Mini App

Web Admin, Customer Web, and Telegram Mini App use cookie transport. Bearer tokens MUST NOT be placed in browser `localStorage` or `sessionStorage`.

Cookie names:

```text
__Host-crm_staff_session
__Host-crm_customer_session
__Host-crm_staff_enrollment
__Host-crm_staff_recovery
__Host-crm_customer_auth_initiation
```

Every session cookie is:

```text
Secure; HttpOnly; Path=/; SameSite=Lax
```

It has no `Domain` attribute.

Cookie-authenticated mutations require:

```text
X-CSRF-Token: <random session-bound token>
```

Scope-specific readable CSRF cookies are:

```text
__Host-crm_customer_csrf
__Host-crm_staff_csrf
__Host-crm_staff_enrollment_csrf
__Host-crm_staff_recovery_csrf
```

Each carries the raw token with `Secure; Path=/; SameSite=Strict` and no `Domain`. The request header, selected cookie, and `auth_sessions` hash must all match in constant time. Routing is deterministic:

- `/api/v1/admin/security/...`, ordinary business APIs, and `/api/v1/admin/auth/logout` read only the ordinary staff pair
- `/api/v1/admin/auth/enrollment/...` reads only the enrollment pair, except `/api/v1/admin/auth/enrollment/start`, which reads only a `staff_password_limited` ordinary pair; `/api/v1/admin/auth/enrollment/resume/start`, `/api/v1/admin/auth/enrollment/resume/resend`, and `/api/v1/admin/auth/enrollment/resume/complete` are public and ignore every ambient cookie
- recovery second-proof/status/logout/password/replacement/email-change-authorization routes read only the recovery pair; public recovery start/resend/email completion ignore all ambient sessions
- customer protected routes read only the customer pair

Issuing an enrollment cookie clears/revokes any recovery pair; issuing recovery clears/revokes any enrollment pair. Enrollment start also revokes/clears the limited ordinary pair. An unrelated ordinary staff cookie may coexist with an invitation-bound enrollment pair, but restricted routes ignore it and ordinary routes ignore restricted cookies. No endpoint accepts multiple scope alternatives. `GET .../auth/session` may rotate and reissue only the ordinary pair; restricted status routes own their CSRF rotation.

“Own their CSRF rotation” does not require rotation on every restricted status
GET. `GET /api/v1/admin/auth/enrollment` is read-only, does not echo the CSRF
token, and does not set or rotate cookies. A restricted status route rotates
its own pair only for a separately specified state transition or key-policy
event; it never delegates that work to the ordinary `/auth/session` route.

`__Host-crm_customer_auth_initiation` is an HttpOnly, Secure, SameSite=Lax, Path=/ cookie containing a one-time 256-bit nonce for customer email sign-in confirmation. It is not a session or CSRF token.

### Requested transport

An operation that may issue a session accepts:

```json
{
  "session_transport": "bearer",
  "client": {
    "platform": "customer_android",
    "app_version": "1.0.0",
    "device_label": "Pixel"
  }
}
```

Allowed platforms:

```text
admin_web
admin_android
admin_ios
customer_web
telegram_mini_app
customer_android
customer_ios
```

Allowed combinations:

- `admin_web`, `customer_web`, `telegram_mini_app`: `cookie`
- Android/iOS platforms: `bearer`

An invalid combination returns `400 invalid_session_transport`. In addition, any request carrying an `Origin` header or any `Sec-Fetch-*` browser metadata MUST use cookie transport and a web/Mini App platform; it can never receive an access token, even if its JSON claims Android/iOS. These browser-controlled headers are evaluated before the requested platform.

Bearer issuance would additionally require a platform-attestation wire protocol,
replay state, and verified application identities. Those details are not fixed
by ADR-0005, so contract version 1 keeps every native-bearer capability
normatively disabled. A syntactically valid Android/iOS bearer request returns
`503 capability_disabled` before credential/account lookup; it never falls back
to a cookie. The server rejects ad hoc attestation headers or body fields.

Enabling bearer issuance requires an approved amendment that fixes the complete
Google Play Integrity and Apple App Attest challenge/attestation protocol,
allowed package or application IDs, signing certificates/team IDs, request
binding, counters/replay storage, verdict policy, minimum builds, and exact
errors. Until that amendment and its D1 migration/tests ship, Android/iOS use
the legacy compatibility transport only and their canonical-auth
`client_readiness` values remain false. `client.platform` and app version are
metadata, never proof by themselves. The bearer request/response examples in
this document reserve the post-amendment target shape; they do not authorize
issuance under contract version 1.

### Session response

Bearer response:

```json
{
  "session": {
    "id": "10a1b2c3d4e5f67890a1b2c3d4e5f678",
    "transport": "bearer",
    "token_type": "Bearer",
    "access_token": "<returned only at creation/rotation>",
    "scope": "customer_verified",
    "expires_at": "2026-10-21T12:00:00.000Z",
    "assurance": {
      "level": 1,
      "methods": ["email"],
      "authenticated_at": "2026-07-23T12:00:00.000Z",
      "strong_authenticated_at": null
    }
  }
}
```

Cookie response omits `access_token`, sets the cookie, and includes `csrf_token`.

Default limits:

| Session | Absolute lifetime | Idle limit |
|---|---:|---:|
| Customer guest/verified | 90 days | 30 days |
| Staff strong/limited | 12 hours | 30 minutes |
| Staff enrollment | 30 minutes | 15 minutes |
| Staff recovery | 15 minutes | 10 minutes |

Long-lived customer sessions rotate on sensitive authentication/linking events. Staff sessions rotate after login, step-up, and privilege changes.

## CORS and origin policy

The current global `Access-Control-Allow-Origin: *` MUST NOT be used for an identity route or any protected business API that accepts a cookie-authenticated Web Admin, Customer Web, or Telegram Mini App session.

For an allowed browser origin:

```text
Access-Control-Allow-Origin: <exact request Origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: content-type,authorization,idempotency-key,x-csrf-token,x-request-id,accept-language
Vary: Origin
```

Production allow-list:

```text
https://crm.ayartuerk.me
```

Development origins are explicit environment configuration; wildcard, reflected-unvalidated origins, `null`, and arbitrary subdomains are forbidden.

Every cookie-authenticated state change—identity or business—requires both an allowed `Origin` and valid CSRF proof. Route-scoped CORS middleware replaces the current global wildcard. Native bearer requests do not require CSRF, but they still receive no permissive credentialed CORS response.

## Idempotency

`Idempotency-Key` is required for:

- guest creation
- challenge creation, resend, and completion
- Telegram authentication/linking
- invitation creation, resend, acceptance, and cancellation
- email enrollment/change operations
- passkey registration completion and deletion
- recovery-code generation/acknowledgement
- password replacement/change
- session-wide revocation
- customer merge preview/commit

Rules:

- 16–128 URL-safe ASCII characters
- clients SHOULD use a UUID
- scoped to the authenticated account or a keyed anonymous subject fingerprint
- same key + same method/path/canonical request hash returns the original status and response
- same key + different request returns `409 idempotency_key_reused`
- concurrent unfinished duplicate returns `409 request_in_progress`
- secret-bearing encrypted replay data expires after 10 minutes
- other receipts expire after 24 hours

Missing required header returns `400 idempotency_key_required`.

## Challenge rules

Initial defaults:

| Property | Customer | Staff |
|---|---:|---:|
| Magic-link entropy | 256 bits | 256 bits |
| Link lifetime | 30 minutes | 15 minutes |
| Manual code | 8 digits | 8 digits |
| Code lifetime | 10 minutes | 10 minutes |
| Failed code attempts | 5 | 5 |
| Resend cooldown | 60 seconds | 60 seconds |
| Send limit | 5/hour, 20/day | 5/hour, 20/day |

Every challenge is bound to:

- account when one exists
- realm
- purpose
- destination
- locale
- return target
- expiry
- request correlation

A deliverable replacement invalidates the previous pending challenge for the same account/purpose and destination/purpose only in the same D1 transaction that creates the replacement and outbox item. A resend suppressed by cooldown/rate policy returns the generic accepted response and leaves the previous usable challenge unchanged.

Magic-link tokens are hashed. Human-entered email and recovery codes use independent server-secret HMAC verifiers with key versions. Comparison is constant-time. Raw tokens/codes are never logged or stored.

Completion accepts exactly one proof form:

```json
{
  "token": "<opaque token>"
}
```

or:

```json
{
  "attempt_id": "20a1b2c3d4e5f67890a1b2c3d4e5f678",
  "code": "12345678"
}
```

Supplying both or neither returns `400 invalid_request`.

All wrong, expired, consumed, invalidated, or attempts-exhausted public completions return:

```text
400 invalid_or_expired_challenge
```

The response does not reveal which condition occurred or attempts remaining.

## Enumeration-resistant accepted response

Public customer email start/resend, staff recovery start/resend, and staff
enrollment-resume start/resend return the same practical response for:

- known accounts
- unknown accounts
- disabled accounts
- accounts without a verified destination
- ineligible accounts
- account/destination throttling
- suppressed delivery
- asynchronous provider failure

Customer:

```http
HTTP/1.1 202 Accepted
```

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "accepted": true,
  "attempt_id": "20a1b2c3d4e5f67890a1b2c3d4e5f678",
  "code_expires_in": 600,
  "link_expires_in": 1800,
  "resend_after": 60
}
```

Staff uses `link_expires_in: 900`.

Unknown/ineligible requests receive a persisted decoy attempt so shape and database work are comparable. Account/destination throttling is silently suppressed. A uniform IP/system emergency limit MAY return `429 rate_limited` only when it is independent of account existence.

## Customer authentication

### Create guest

```text
POST /api/v1/customer/auth/guest
Authentication: public
Idempotency-Key: required
Success: 201 Created
```

Request:

```json
{
  "locale": "en",
  "full_name": "",
  "username": "",
  "session_transport": "bearer",
  "client": {
    "platform": "customer_android",
    "app_version": "1.0.0",
    "device_label": "Pixel"
  }
}
```

Response:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "account": {
    "id": "40a1b2c3d4e5f67890a1b2c3d4e5f678",
    "realm": "customer",
    "recovery_ready": false
  },
  "customer": {
    "id": 42,
    "account_id": "40a1b2c3d4e5f67890a1b2c3d4e5f678",
    "full_name": "",
    "username": "",
    "preferred_language": "en"
  },
  "session": {}
}
```

The server creates a new customer profile, account, and random session atomically. While the legacy `customers.telegram_user_id NOT NULL UNIQUE` column remains, the server writes exactly `app:<auth_account_id>` to that column. This compatibility-only synthetic value is generated from the new canonical 32-hex account ID, is never accepted from a client, and is never Telegram identity or authentication proof. The route does not accept `device_id`. Installation/device metadata may label the new session but can never locate an account.

### Customer email login/recovery

```text
POST /api/v1/customer/auth/email/start
POST /api/v1/customer/auth/email/resend
POST /api/v1/customer/auth/email/complete
POST /api/v1/customer/auth/email/confirm
```

Start:

```json
{
  "email": "person@example.com",
  "intent": "sign_in",
  "locale": "en",
  "return_to": "orders",
  "initiation_nonce": null,
  "session_transport": "cookie",
  "client": {
    "platform": "customer_web",
    "app_version": "1.0.0"
  }
}
```

`intent`:

- `sign_in`: routine passwordless login; other sessions remain active
- `recover`: lost/compromised-account recovery; other sessions/challenges are revoked

Allowed `return_to` values:

```text
home
orders
profile
security
```

Arbitrary URLs are rejected.

For a browser start, the Worker generates a 256-bit nonce, stores only its keyed hash on the challenge, and sets `__Host-crm_customer_auth_initiation`. For a native start, the app generates the nonce, sends its unpadded base64url value in `initiation_nonce`, and retains it only in secure ephemeral storage until completion. Values must decode to exactly 32 bytes. The nonce is not placed in the email link.

Resend:

```json
{
  "attempt_id": "20a1b2c3d4e5f67890a1b2c3d4e5f678"
}
```

Complete accepts a token or attempt/code plus `session_transport`, `client`, and the native `initiation_nonce` when applicable. Browser completion reads the initiation cookie.

When the initiation hash matches, completion consumes the challenge and may issue the session immediately. When a valid link/code is exchanged without matching initiation state—including a forwarded or cross-device link—the server verifies the first proof but does not create or replace a session. It returns:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "confirmation_required": true,
  "destination_masked": "p***@example.com",
  "confirmation_token": "<one-time 256-bit continuation token>",
  "expires_in": 300
}
```

The UI clearly says that continuing will sign in as the masked destination. It must not imply that the currently displayed profile initiated the request. Confirmation is an explicit POST:

```json
{
  "confirmation_token": "<one-time continuation token>",
  "confirmation": "continue",
  "session_transport": "cookie",
  "client": {
    "platform": "customer_web",
    "app_version": "1.0.0"
  }
}
```

The challenge transition is `pending -> verified -> consumed`; only the final compare-and-set may issue/rotate a session. Cancelling or expiry leaves the existing browser/app session untouched. A successful sign-in to a different account replaces the customer cookie only after this explicit confirmation.

On `sign_in`, success issues a `customer_verified` session and does not revoke other sessions.

On `recover`, success atomically:

1. increments `auth_version`
2. sets the legacy-session revocation boundary
3. revokes canonical and legacy sessions/challenges
4. rotates the recovery challenge
5. records a security event
6. issues one replacement `customer_verified` session
7. notifies the verified address

A matching email never silently merges customer profiles.

### Customer passkey login

```text
POST /api/v1/customer/auth/passkey/options
POST /api/v1/customer/auth/passkey/complete
```

Options use discoverable credentials:

```json
{
  "session_transport": "cookie",
  "client": {
    "platform": "customer_web",
    "app_version": "1.0.0"
  }
}
```

Response:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "ceremony_id": "50a1b2c3d4e5f67890a1b2c3d4e5f678",
  "public_key": {
    "challenge": "<base64url>",
    "timeout": 300000,
    "rpId": "ayartuerk.me",
    "allowCredentials": [],
    "userVerification": "required"
  }
}
```

Complete:

```json
{
  "ceremony_id": "50a1b2c3d4e5f67890a1b2c3d4e5f678",
  "credential": {
    "id": "<base64url>",
    "rawId": "<base64url>",
    "type": "public-key",
    "response": {
      "clientDataJSON": "<base64url>",
      "authenticatorData": "<base64url>",
      "signature": "<base64url>",
      "userHandle": "<required unpadded base64url>"
    },
    "clientExtensionResults": {}
  },
  "session_transport": "cookie",
  "client": {
    "platform": "customer_web",
    "app_version": "1.0.0"
  }
}
```

For this username-less discoverable ceremony, `userHandle` MUST be present. The server resolves the globally unique credential ID, decodes the returned handle, and requires it to equal the 16 raw bytes represented by that account's 32-hex `webauthn_user_handle`. It never compares against the UTF-8 hexadecimal text and never accepts an account ID from the caller. In one compare-and-set batch it binds the accountless challenge to that account, verifies origin/RP ID/user verification/signature/counter, consumes the challenge, updates the credential counter, and issues the session.

### Telegram Mini App authentication

```text
POST /api/v1/customer/auth/telegram
Authentication: public
Idempotency-Key: required
Success: 200 existing identity; 201 new identity
```

Request:

```json
{
  "init_data": "<raw Telegram.WebApp.initData query string>",
  "session_transport": "cookie",
  "client": {
    "platform": "telegram_mini_app",
    "app_version": "1.0.0"
  }
}
```

No caller-supplied Telegram ID, `initDataUnsafe`, username, or device ID is accepted as proof.

The Worker MUST:

1. reject malformed encoding, duplicate security-significant keys, or an oversized payload
2. extract but not trust `hash`/`signature`
3. build the Telegram data-check string from the remaining decoded fields in sorted key order joined with LF
4. derive the HMAC-SHA-256 secret using key `WebAppData` and the configured bot token as the message
5. HMAC-SHA-256 the data-check string and constant-time compare the result
6. require `auth_date` no more than 300 seconds old and no more than 30 seconds in the future
7. insert a keyed replay fingerprint before issuing/linking a session
8. parse Telegram user ID as a digit string, never a JavaScript number
9. bind or resolve through `auth_external_identities`

Any validation failure returns:

```text
401 invalid_telegram_authorization
```

After proof and before creating a profile, the continuity bridge runs exactly once:

1. Resolve an active `provider='telegram'` identity by the verified digit-string subject.
2. If none exists, query legacy `customers.telegram_user_id` for that exact digit string, excluding `app:*` synthetic values.
3. If exactly one linked customer row exists and its account has no conflicting active Telegram identity, atomically attach the identity to that existing account.
4. If no row exists, atomically create the customer/account/identity.
5. If more than one row, an unlinked row, a wrong-realm identity, or any conflict exists, fail closed with a recorded security event; never guess or create a duplicate.

The legacy lookup occurs only after valid Mini App `initData` or a trusted bot-webhook signature/path has proved the Telegram subject. `provider='telegram'` linking is customer-only in this contract; staff Telegram identity is forbidden and would require a new ADR. The existing `/telegram/webhook` remains externally unchanged, but on the next trusted interaction it uses this bridge rather than treating `customers.telegram_user_id` as authentication authority.

## Staff authentication

### Password step

```text
POST /api/v1/admin/auth/password
Authentication: public
Idempotency-Key: required
```

Request:

```json
{
  "identifier": "admin-name",
  "password": "<password>",
  "session_transport": "bearer",
  "client": {
    "platform": "admin_android",
    "app_version": "1.0.0"
  }
}
```

`identifier` may be a normalized staff username or verified staff email. Invalid identifier/password always returns:

```text
401 invalid_credentials
```

For an unknown, disabled, ineligible, or otherwise non-verifiable identifier, the Worker runs one precomputed dummy Argon2id PHC verification with the same canonical parameters before returning. Successful and failed account lookups follow comparable query and response-padding paths. Credential-stuffing controls use keyed per-identifier, per-IP, and system buckets; account-dependent suppression never reveals existence, and only an account-independent IP/system emergency limit may return `429`.

For an enrolled account, password success does not issue an ordinary session. It returns a five-minute authentication flow:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "authentication": {
    "flow_token": "<short-lived opaque secret>",
    "expires_at": "2026-07-23T12:05:00.000Z",
    "next": "passkey",
    "ceremony_id": "50a1b2c3d4e5f67890a1b2c3d4e5f678",
    "public_key": {
      "challenge": "<base64url>",
      "timeout": 300000,
      "rpId": "ayartuerk.me",
      "allowCredentials": [
        {
          "type": "public-key",
          "id": "<active staff credential ID>",
          "transports": ["internal", "hybrid"]
        }
      ],
      "userVerification": "required"
    }
  }
}
```

Routes:

```text
POST /api/v1/admin/auth/passkey/options
POST /api/v1/admin/auth/passkey/complete
```

Options request:

```json
{
  "flow_token": "<password-step flow token>"
}
```

Completion request:

```json
{
  "flow_token": "<password-step flow token>",
  "ceremony_id": "50a1b2c3d4e5f67890a1b2c3d4e5f678",
  "credential": {
    "id": "<base64url>",
    "rawId": "<base64url>",
    "type": "public-key",
    "response": {
      "clientDataJSON": "<base64url>",
      "authenticatorData": "<base64url>",
      "signature": "<base64url>",
      "userHandle": "<base64url-or-null>"
    },
    "clientExtensionResults": {}
  },
  "session_transport": "bearer",
  "client": {
    "platform": "admin_android",
    "app_version": "1.0.0"
  }
}
```

Completion verifies password flow, challenge, origin/RP ID, user verification, signature, credential ownership, credential state, and sign counter policy. It rotates the flow and issues `staff_strong`.

During the approved 30-day grace period:

- an existing unenrolled staff account before its deadline may receive `staff_password_limited`
- `staff_password_limited` may call ordinary operational routes plus only `POST /api/v1/admin/auth/enrollment/start`
- enrollment start atomically revokes/rotates the limited session into `staff_enrollment` with stage `email_required`; for cookies it clears the ordinary pair before setting the enrollment pair
- completed enrollment or expiry disables password-only ordinary login
- sensitive staff/security/Superadmin routes always require `staff_strong`

After the enrollment deadline, password success for an account disabled solely with `disabled_reason=enrollment_expired` issues only `staff_enrollment` at `email_required`. Until email proof succeeds it may call only enrollment email/status/logout routes; password, passkey, recovery-code, and completion routes remain locked. An administratively disabled or security-held account receives no session. Invitation acceptance starts at `email_verified`, so password, passkey, and recovery-code enrollment routes are available.

### Legacy hash upgrade

When a database-backed legacy password succeeds, the Worker atomically:

1. verifies the current legacy row
2. creates a canonical costed password verifier
3. revokes the legacy credential
4. disables legacy password fallback for that account
5. records a security event

Environment values and plaintext overrides are never written to D1. Environment staff choose a new canonical password during enrollment.

## Staff recovery

Routes:

```text
POST /api/v1/admin/auth/recovery/start
POST /api/v1/admin/auth/recovery/resend
POST /api/v1/admin/auth/recovery/email/complete
GET  /api/v1/admin/auth/recovery
POST /api/v1/admin/auth/recovery/logout
POST /api/v1/admin/auth/recovery/passkey/options
POST /api/v1/admin/auth/recovery/passkey/complete
POST /api/v1/admin/auth/recovery/recovery-code/complete
POST /api/v1/admin/auth/recovery/passkey/registration/options
POST /api/v1/admin/auth/recovery/passkey/registration/complete
PUT  /api/v1/admin/auth/recovery/password
```

Start:

```json
{
  "identifier": "username-or-email",
  "locale": "en",
  "session_transport": "cookie",
  "client": {
    "platform": "admin_web",
    "app_version": "1.0.0"
  }
}
```

It always returns the enumeration-resistant `202`. The requested transport/platform is retained only as initiation/risk metadata; it cannot force the transport used on another device.

Email completion verifies only the first proof. Its request includes the proof plus the `session_transport` and `client` for the device currently performing the exchange. The normal browser/native transport gate is re-evaluated at completion; a bearer is never returned to a browser. A staff recovery magic-link page removes the fragment, displays an explicit “Continue recovery on this device” action, and posts only after that action. Manual-code entry is already explicit. Success issues a fresh `staff_recovery_email` token/CSRF pair and returns:

```json
{
  "next_methods": ["passkey", "recovery_code"]
}
```

`GET .../recovery` reads only the recovery session and returns its safe stage, expiry, and required next actions. `POST .../recovery/logout` revokes that exact session and clears only the recovery pair.

Passkey completion verifies a previously bound user-verified passkey. Recovery-code completion accepts one unused offline code. Either successful second proof conditionally revokes `staff_recovery_email` and issues a new `staff_recovery_authorized` token/CSRF pair; token and CSRF values are never retained across the assurance elevation.

Recovery-code completion body:

```json
{
  "code": "ABCD-EFGH-JKMN-PQRS-TVWX-YZ23"
}
```

Passkey options/complete use the recovery cookie or bearer flow session and the same WebAuthn assertion shape as staff login; they do not accept an account ID.

Recovery-code success consumes that code in the same compare-and-set batch that records the proof and rotates the session. An abandoned later password step does not restore it. Because the code path is specifically for a lost second factor, it sets `replacement_passkey_required=true`; password replacement is blocked until a new passkey is registered. The registration options/complete routes use the normal attestation request shape but accept only that recovery-authorized session. Completion records the newly created passkey, revokes/rotates the prior recovery-authorized token/CSRF pair, and returns a new context with the replacement gate satisfied.

Every Superadmin-assisted Admin grant or owner-controlled Superadmin
break-glass grant issued because all authenticators are lost also sets
`replacement_passkey_required=true` and snapshots the sorted, duplicate-free
IDs of every active passkey as `pre_recovery_passkey_ids` in the restricted
authorization context. The Admin path uses the restricted recovery registration
routes. The Superadmin path invokes the same credential-service transition
from the non-public owner runbook; it does not expose a break-glass registration
HTTP route. Successful replacement revokes every snapshotted passkey while
preserving exactly the newly registered replacement. The password step,
ordinary session issuance, and break-glass completion all remain blocked until
this replacement transaction succeeds. If the account has no usable passkey
for any other reason, the same replacement gate applies.

Calling password replacement before that gate is satisfied returns `409 replacement_passkey_required`.

Password replacement:

```json
{
  "new_password": "<new password>"
}
```

Success:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "password_changed": true,
  "all_sessions_revoked": true,
  "login_required": true
}
```

It atomically:

- consumes the recovery challenge; a recovery code, when used, was already consumed at second-proof completion
- replaces the password credential
- on every path with `replacement_passkey_required=true`, revokes every
  passkey predating the recorded recovery grant while preserving the newly
  registered replacement
- increments `auth_version`
- sets the legacy-session revocation boundary
- revokes every canonical and legacy session
- invalidates other challenges
- records a security event
- queues a security notification

It never creates an ordinary login session.

The final active staff passkey can never be deleted through an ordinary or recovery endpoint. Recovery codes are an offline recovery proof only; they never satisfy the passkey step of a normal staff login.

If all second proofs are lost:

- Admin recovery uses the separately approved Superadmin-assisted runbook and
  must replace its passkey before recovery can complete
- Superadmin recovery uses the owner-controlled offline break-glass runbook and
  must complete the same passkey-replacement invariant
- no public endpoint can bypass those processes

## Staff invitations and enrollment

### Environment-account bootstrap

Environment-defined Admin/Superadmin accounts have no reusable canonical password and therefore cannot self-start through the password endpoint. The controlled reconciliation tool—not a public HTTP route—requires an explicit destination email for each one and atomically creates the protected pending profile/account, pending email, invitation challenge, invitation, encrypted outbox item, and security event specified by the D1 contract. It records a non-PII owner runbook receipt instead of fabricating an inviter and never marks the email verified.

This is the sole bootstrap path for the first protected environment Superadmin. The emailed acceptance route below proves the destination and issues only `staff_enrollment`; the recipient/account owner chooses the new canonical password, and the maintenance operator or helper never chooses, receives, or learns it. `CRM_AUTH_STAFF_RECONCILED` remains false until a protected Superadmin completes password, passkey, and recovery-code enrollment and the offline break-glass drill succeeds. This maintenance carve-out cannot target an existing database-backed staff row, alter a collision, re-role/reactivate an account, or be exposed through the Worker API.

During only this first-account window,
`CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT=true` enables invitation
acceptance/dedicated enrollment for that exact protected owner-bootstrap
invitation even though ordinary `staff_enrollment` remains false. The
capabilities section defines its fail-closed eligibility and shutdown
transition.

### Superadmin management

```text
GET    /api/v1/admin/security/invitations
POST   /api/v1/admin/security/invitations
GET    /api/v1/admin/security/invitations/{invitation_id}
POST   /api/v1/admin/security/invitations/{invitation_id}/resend
POST   /api/v1/admin/security/invitations/{invitation_id}/reauthorize-enrollment
DELETE /api/v1/admin/security/invitations/{invitation_id}
```

Requirements:

- `staff_strong`
- current Superadmin role
- strong authentication within 5 minutes
- `Idempotency-Key` on mutations

Create:

```json
{
  "username": "new-admin",
  "role": "admin",
  "email": "person@example.com",
  "locale": "en"
}
```

Allowed roles:

```text
admin
superadmin
```

Success `201`:

```json
{
  "invitation": {
    "id": "60a1b2c3d4e5f67890a1b2c3d4e5f678",
    "username": "new-admin",
    "role": "admin",
    "email_masked": "p***@example.com",
    "status": "pending",
    "expires_at": "2026-07-24T12:00:00.000Z",
    "created_at": "2026-07-23T12:00:00.000Z"
  }
}
```

Creation MUST NOT:

- accept a password
- upsert by username
- overwrite a credential
- change another role
- reactivate a disabled account
- merge accounts

While the legacy `admin_users.password_hash` column remains `NOT NULL`, creation writes exactly `!canonical-auth-disabled!`. The canonical and legacy verifiers reject that sentinel as a credential; no random/default/invitation password is created.

Authenticated conflicts may safely return `409 username_unavailable` or `409 staff_email_unavailable`.

Resend applies only while `status IN ('pending', 'expired')`; it rotates the
invitation challenge and invalidates the old link. For an expired invitation it
returns the same immutable row to `pending`, clears `expired_at`, and fixes a
new 24-hour expiry. It never resends an accepted invitation.

`reauthorize-enrollment` applies only to an accepted invitation whose linked
account is still `status='pending'`, was never activated, and still has the same
username, role, and verified primary email. It sets a new 72-hour enrollment
deadline and atomically creates a `staff_enrollment_resume` challenge, outbox
item, and security event; it never creates a new profile/invitation or changes
role. Before the first protected Superadmin exists, the owner-controlled
non-public maintenance runbook is the only caller that may perform this exact
transition.

Delete applies only to an unprotected pending invitation. It revokes that
invitation and pending challenge without erasing security history. A protected
invitation returns `409 protected_account`; it can be rotated/reissued only by
the owner bootstrap runbook before first activation or by a strong Superadmin
after reconciliation.

### Public acceptance

Because the magic-link token is carried in the URL fragment, the first-party
landing page cannot obtain safe invitation context from the initial document
request. It uses this non-consuming, token-protected preview before showing the
explicit acceptance action:

```text
POST /api/v1/admin/auth/invitations/preview
Authentication: public invitation proof
Idempotency-Key: not used (non-mutating)
```

```json
{
  "token": "<invitation token>"
}
```

Success `200` returns only `username`, `role`, `email_masked`, `locale`,
`status`, and `expires_at`. The endpoint performs no invitation, account,
email, session, cookie, or outbox mutation; rate-limit accounting is the only
persistence side effect. It ignores ambient cookies. Malformed, unknown,
expired, revoked, consumed, and ineligible tokens all return the same
`400 invalid_or_expired_invitation` response without account enumeration.

```text
POST /api/v1/admin/auth/invitations/accept
Authentication: public
Idempotency-Key: required
```

```json
{
  "token": "<invitation token>",
  "session_transport": "cookie",
  "client": {
    "platform": "admin_web",
    "app_version": "1.0.0"
  }
}
```

Invalid/expired/revoked tokens return `400 invalid_or_expired_invitation`.

Success verifies the invited email, marks the account enrollment state
`in_progress`, fixes a 72-hour enrollment deadline for the linked pending
account, marks the invitation accepted, and issues only `staff_enrollment`.

Acceptance ignores any ambient ordinary staff cookie and never changes that account. It revokes/clears an existing enrollment or recovery cookie before issuing the invitation-bound enrollment pair, and the page displays the invited username/email mask before the explicit POST.

Bootstrap contract version 1 deliberately fixes public invitation rate-limit
fingerprints to `fingerprint_key_version=1`. It fails closed unless
`CRM_AUTH_FINGERPRINT_KEY_V1` is configured with valid key material and, when
`CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION` is present, its value is exactly
`1`. Fingerprint-key rotation must not occur while this bootstrap capability is
enabled; retained-version overlap evaluation must be implemented before that
rotation or broader identity rollout.

### Restricted enrollment

```text
POST /api/v1/admin/auth/enrollment/start
POST /api/v1/admin/auth/enrollment/resume/start
POST /api/v1/admin/auth/enrollment/resume/resend
POST /api/v1/admin/auth/enrollment/resume/complete
GET  /api/v1/admin/auth/enrollment
POST /api/v1/admin/auth/enrollment/logout
POST /api/v1/admin/auth/enrollment/email/start
POST /api/v1/admin/auth/enrollment/email/resend
POST /api/v1/admin/auth/enrollment/email/complete
PUT  /api/v1/admin/auth/enrollment/password
POST /api/v1/admin/auth/enrollment/passkeys/registration/options
POST /api/v1/admin/auth/enrollment/passkeys/registration/complete
POST /api/v1/admin/auth/enrollment/recovery-code-sets
POST /api/v1/admin/auth/enrollment/recovery-code-sets/{set_id}/acknowledge
POST /api/v1/admin/auth/enrollment/complete
```

`start` accepts only `staff_password_limited` and atomically replaces it with `staff_enrollment` at `email_required`.

The three `resume` routes are public, ignore ambient cookies, and recover only a
restricted enrollment session. Start accepts exactly:

```json
{
  "identifier": "username-or-verified-email",
  "locale": "en",
  "session_transport": "cookie",
  "client": {
    "platform": "admin_web",
    "app_version": "1.0.0"
  }
}
```

Resend accepts exactly `{ "attempt_id": "<opaque attempt ID>" }`. Start/resend
use the enumeration-resistant accepted response and send only to the verified
staff primary address. A deliverable attempt is eligible only when the account
is still `status='pending'`, was never activated, is linked to an accepted
invitation, has a verified primary email, and its fixed enrollment deadline has
not passed. Every active, disabled, deleted, expired-deadline, grace-period, or
previously activated account is suppressed. Existing staff must resume with
fresh password proof through the limited/enrollment password path or use the
normal multi-proof recovery/runbook; public email proof is never privileged
recovery.

Resume completion accepts the shared token or attempt/code proof plus
`session_transport` and `client` for the current device. A magic-link landing
requires an explicit “Continue enrollment on this device” POST; manual-code
entry is already explicit. It consumes `purpose='staff_enrollment_resume'`,
rechecks the account version/status and verified destination, and issues a fresh
`staff_enrollment` session only. Its stage/checklist is reconstructed from
durable canonical facts: verified primary email, active canonical password,
active passkey, and active acknowledged recovery-code set. Any unacknowledged
generated code set is revoked so the user must generate and safely record a new
set. No invitation is recreated, no role/status is elevated, and no ordinary
session is issued.

Every non-public route in this block reads only the enrollment bearer token or
the enrollment cookie/CSRF pair. It never falls back to an ordinary or recovery
cookie; an ambient ordinary staff session for another account is ignored.

Email start/resend require `email_required`. Email completion requires the same initiating enrollment session plus proof, rotates the enrollment token/CSRF pair, and advances to `email_verified`. Password, passkey registration, and recovery-code generation/acknowledgement require at least `email_verified`. The dedicated passkey and recovery-code paths use the request/response shapes specified in their corresponding security sections. `logout` revokes only the enrollment session and clears only its cookies.

Enrollment password accepts exactly:

```json
{
  "new_password": "<new password>"
}
```

It never accepts or requires `current_password`; invitation and environment
bootstrap accounts have none. The new value must pass the staff password policy.
Success conditionally revokes any prior canonical/legacy password credential,
creates the new costed canonical verifier, increments `auth_version`, sets the
legacy revocation boundary, revokes every ordinary/legacy and other restricted
session/challenge, and rotates only the exact initiating enrollment session at
its current stage. It issues no ordinary session and returns:

```json
{
  "ok": true,
  "request_id": "3c4d5e6f7890a1b2c3d4e5f67890a1b2",
  "enrollment": {
    "stage": "email_verified",
    "password_set": true,
    "passkey_registered": false,
    "recovery_codes_acknowledged": false
  },
  "session": {}
}
```

For cookie transport the rotated enrollment/CSRF pair accompanies that
response; for the currently disabled native bearer target, the route remains
capability-disabled.

Completion succeeds only when:

- the invited email is verified
- a compliant canonical password exists
- at least one passkey is registered
- a recovery-code set is acknowledged

Completion always increments `auth_version`, sets
`legacy_sessions_revoked_before` and `legacy_login_disabled_at`, revokes every
canonical/legacy session (including limited and enrollment sessions), and
invalidates outstanding authentication/recovery challenges. It then activates
a pending account linked to an accepted invitation or an account disabled only
for `enrollment_expired`, records a security event, and requires fresh normal
login. For an already active grace-period account it marks enrollment complete
without a status change.
Administrative, security-hold, owner-requested, and deleted states are never
cleared by enrollment.

## Realm session APIs

Customer:

```text
GET    /api/v1/customer/auth/session
POST   /api/v1/customer/auth/logout
GET    /api/v1/customer/security/sessions
DELETE /api/v1/customer/security/sessions/{session_id}
POST   /api/v1/customer/security/sessions/revoke-others
POST   /api/v1/customer/security/sessions/revoke-all
```

Staff:

```text
GET    /api/v1/admin/auth/session
POST   /api/v1/admin/auth/logout
GET    /api/v1/admin/security/sessions
DELETE /api/v1/admin/security/sessions/{session_id}
POST   /api/v1/admin/security/sessions/revoke-others
POST   /api/v1/admin/security/sessions/revoke-all
```

Session listing returns:

- opaque session ID
- platform and safe device label
- authentication methods
- created, last-seen, and expiry times
- current-session flag
- approximate location only when privacy-safe

It never returns token hashes, raw installation IDs, or complete IP addresses.

`revoke-others` increments the account version and atomically rotates/reissues the current session. `revoke-all` revokes the current session too and returns `login_required: true`.

Browser logout always server-revokes the cookie session before clearing cookies.

## Recent-authentication step-up

Customer:

```text
POST /api/v1/customer/auth/step-up/email/start
POST /api/v1/customer/auth/step-up/email/complete
POST /api/v1/customer/auth/step-up/passkey/options
POST /api/v1/customer/auth/step-up/passkey/complete
```

Staff:

```text
POST /api/v1/admin/auth/step-up/passkey/options
POST /api/v1/admin/auth/step-up/passkey/complete
```

Every step-up starts from a valid ordinary session, binds its challenge to that session's account and realm, and cannot switch accounts. Customer email uses the existing verified primary; customer passkey and staff passkey use a bound allow-list. Staff step-up requires an existing `staff_strong` session and user verification. Recovery codes are never a step-up method.

Success conditionally revokes and rotates the current session—preserving its scope, absolute expiry ceiling, client platform, and transport—and updates `authenticated_at`; passkey proof also updates `strong_authenticated_at`. It creates no second concurrently active session and does not increment `auth_version`. For cookies the replacement is returned in the same response with its matching CSRF token. Sensitive action middleware then re-resolves that replacement session and applies the five- or fifteen-minute freshness rule.

## Email enrollment

Customer:

```text
GET  /api/v1/customer/security/email
POST /api/v1/customer/security/email/enrollment
POST /api/v1/customer/security/email/enrollment/resend
POST /api/v1/customer/security/email/enrollment/complete
```

For ordinary staff, `GET /api/v1/admin/security/email` is a
`staff_strong`-only masked status route. Staff email enrollment never uses a
generic `/api/v1/admin/security/email/enrollment*` route: it uses the dedicated
`/api/v1/admin/auth/enrollment/email/start`, `/resend`, and `/complete` routes
defined under Restricted enrollment.

Start:

```json
{
  "email": "person@example.com",
  "locale": "en"
}
```

Status is always masked:

```json
{
  "email": {
    "present": true,
    "masked": "p***@example.com",
    "verified": true,
    "verified_at": "2026-07-23T12:00:00.000Z"
  }
}
```

Customer behavior:

- enrollment is optional
- successful proof creates a verified recovery identity
- completion requires the same ordinary customer session that started the enrollment; a cross-device link cannot attach the address or issue a session, and the user can enter the manual code on the initiating device
- if the verified email belongs to another customer account, return `409 merge_required` and a short-lived merge authorization
- do not link or merge automatically
- successful first enrollment increments `auth_version`, revokes other canonical/legacy sessions and outstanding recovery challenges, and replaces the current session with `customer_verified`

Staff behavior:

- verified email is mandatory
- a staff-realm collision returns `409 staff_email_unavailable`
- email proof alone does not grant an ordinary staff session
- only `staff_enrollment` at `email_required` may call the dedicated start/resend/complete routes; `staff_password_limited` must first use `/api/v1/admin/auth/enrollment/start`
- completion requires that exact initiating enrollment session; the email link alone cannot create a new staff enrollment session
- successful proof rotates that enrollment token/CSRF pair and advances it to `email_verified`; it never issues `staff_strong`

## Email changes

Customer:

```text
POST   /api/v1/customer/security/email-changes
GET    /api/v1/customer/security/email-changes/current
POST   /api/v1/customer/security/email-changes/verify-new
POST   /api/v1/customer/security/email-changes/approve-old
POST   /api/v1/customer/security/email-changes/cancel
DELETE /api/v1/customer/security/email-changes/current
```

Staff uses the same suffixes under:

```text
/api/v1/admin/security/email-changes
```

Start:

```json
{
  "new_email": "new@example.com",
  "locale": "en"
}
```

Requirements:

- customer: recent `customer_verified`
- staff: recent `staff_strong`

`POST .../email-changes` and `GET .../current` are authenticated; the POST requires the recent scope above. `DELETE .../current` is the authenticated cancellation operation and requires CSRF for cookies. `verify-new`, `approve-old`, and `cancel` are public, token-based, idempotent POST exchanges. They ignore ambient session cookies and return only generic invalid/expired errors. Their bodies contain exactly `{ "token": "<opaque token>" }`.

Deterministic transition rules:

1. The old verified primary remains active until activation.
2. Start atomically persists the request, pending new address, mandatory new-verification challenge/outbox item, and mandatory old-address approve/cancel challenge/outbox item; any missing write aborts the entire start. Contract version 1 always persists `risk_level='standard'`; `low` and `elevated` are reserved for a separately reviewed classifier and cannot be selected by configuration or client input.
3. New-address proof is always required.
4. For staff, old-address approval after new verification permits immediate activation. A staff request without old-address approval cannot activate merely because time elapsed.
5. The no-approval path is treated as unavailable-old-address recovery. An Admin needs a `staff_recovery_authorized` session whose recorded method is the separate Superadmin-assisted grant and calls `POST /api/v1/admin/auth/recovery/email-change-authorizations`; that dedicated route reads only the recovery credential. A Superadmin needs the owner-issued `break_glass` runbook, whose non-public maintenance transition applies the same checks without exposing a break-glass HTTP route. Either transition stores the durable purpose-bound challenge/session references, sets `old_address_unavailable`, and imposes at least 24 hours from authorization. Ordinary `staff_strong` alone cannot authorize it.
6. A customer request waits at least 24 hours after new-address proof unless old-address approval arrives first. Any old-address cancellation permanently cancels it. There is no low-risk immediate-activation path in contract version 1.
7. A scheduled job and an authenticated status-read lazy path may attempt due activation. They claim the request by conditional transition marker and re-check: expected status, due time, no cancellation, account status/version, old-primary identity, new-address proof, realm uniqueness, and the applicable approval/hold rule. If any check changed, no dependent row mutates.
8. Activation atomically replaces the primary email and invalidates competing email/recovery challenges. It increments `auth_version` and the legacy revocation boundary. Both staff and customer lose all sessions and must log in again. Public token exchanges and scheduled activation never return or preserve a replacement session.
9. Both addresses receive event-backed completion notifications. Old-address cancellation sends a notification to the pending new address without exposing the old address.

The Admin recovery authorization route accepts exactly
`{ "confirmation": "authorize_old_address_unavailable" }`, selects the sole
active email-change request for the authenticated recovery account, and rejects
an absent, already authorized, cancelled, activated, or different-account
request. It never accepts an account ID, email address, request ID, or grant ID
from the client.

## Passkey management

Customer:

```text
GET    /api/v1/customer/security/passkeys
POST   /api/v1/customer/security/passkeys/registration/options
POST   /api/v1/customer/security/passkeys/registration/complete
PATCH  /api/v1/customer/security/passkeys/{passkey_id}
DELETE /api/v1/customer/security/passkeys/{passkey_id}
```

Ordinary staff uses the same suffixes under:

```text
/api/v1/admin/security/passkeys
```

Every ordinary staff route in that namespace requires `staff_strong`; mutations
require S5. Enrollment and recovery never send their restricted credentials to
that namespace. They use only the dedicated
`/api/v1/admin/auth/enrollment/passkeys/registration/*` and
`/api/v1/admin/auth/recovery/passkey/registration/*` routes.

Registration options:

```json
{
  "name": "Personal MacBook"
}
```

Registration completion body:

```json
{
  "ceremony_id": "50a1b2c3d4e5f67890a1b2c3d4e5f678",
  "name": "Personal MacBook",
  "credential": {
    "id": "<unpadded-base64url>",
    "rawId": "<same credential ID>",
    "type": "public-key",
    "response": {
      "clientDataJSON": "<base64url>",
      "attestationObject": "<base64url>",
      "transports": ["internal", "hybrid"]
    },
    "clientExtensionResults": {}
  }
}
```

`PATCH .../{passkey_id}` accepts exactly `{ "name": "<1-120 character label>" }`; it cannot alter credential material, ownership, RP ID, counters, or backup flags.

The registration `user.id` is the account's 32-hex `webauthn_user_handle` decoded to 16 raw bytes and encoded as unpadded base64url. It is stable for the account and is never the UTF-8 hexadecimal text, email, username, customer ID, or staff ID.

Authorization:

- customer list: `customer_verified`; customer register/rename/delete: recent `customer_verified`
- staff ordinary list: `staff_strong`; ordinary register/rename/delete: recent `staff_strong`
- enrollment registration: `staff_enrollment` after verified-email stage, only through the dedicated enrollment routes
- recovery replacement registration: `staff_recovery_authorized` only through the dedicated recovery registration routes

Response:

```json
{
  "ceremony_id": "50a1b2c3d4e5f67890a1b2c3d4e5f678",
  "public_key": {
    "challenge": "<at least 32 random bytes, base64url>",
    "rp": {
      "id": "ayartuerk.me",
      "name": "CRM Delivery"
    },
    "user": {
      "id": "<stable random user handle, base64url>",
      "name": "<display identifier>",
      "displayName": "<display name>"
    },
    "pubKeyCredParams": [
      { "type": "public-key", "alg": -7 },
      { "type": "public-key", "alg": -257 }
    ],
    "timeout": 300000,
    "excludeCredentials": [],
    "authenticatorSelection": {
      "residentKey": "required",
      "requireResidentKey": true,
      "userVerification": "required"
    },
    "attestation": "none"
  }
}
```

The server verifies:

- credential type
- exact challenge
- allowed origin
- RP-ID hash
- user presence and required user verification
- registration/authentication signature
- global credential-ID uniqueness
- credential ownership/state
- sign-counter and backup-state policy

Proposed production RP ID:

```text
ayartuerk.me
```

Allowed Web origin:

```text
https://crm.ayartuerk.me
```

Passkey enrollment remains disabled until the final Android packages/signing certificates and Apple application IDs/associated domains are fixed and their Digital Asset Links/AASA associations are verified.

Deleting a staff passkey:

- requires recent strong authentication
- cannot remove the final active staff passkey under any circumstances
- increments the account version
- revokes all sessions
- sends a notification

Staff passkey addition/removal increments the account version, sets the legacy
revocation boundary, and revokes all ordinary/legacy sessions and outstanding
challenges. Ordinary management requires fresh login. Enrollment initial
registration and recovery replacement registration reissue only the exact
purpose-bound restricted session in that same transition, with its stage/gate
preserved; every other session is revoked. Customer passkey addition/removal
also increments the account version, revokes all other canonical/legacy
sessions and challenges, and rotates the current verified session so the
customer remains signed in. A label-only rename does not change `auth_version`.

## Offline recovery codes

Staff only:

```text
GET    /api/v1/admin/security/recovery-codes
POST   /api/v1/admin/security/recovery-code-sets
POST   /api/v1/admin/security/recovery-code-sets/{set_id}/acknowledge
DELETE /api/v1/admin/security/recovery-code-sets/{set_id}
```

The ordinary namespace requires recent `staff_strong`. Enrollment generation
and acknowledgement use only the dedicated
`/api/v1/admin/auth/enrollment/recovery-code-sets*` routes after the
verified-email stage.

It returns ten codes exactly once:

```json
{
  "recovery_code_set": {
    "id": "70a1b2c3d4e5f67890a1b2c3d4e5f678",
    "expires_at": "2026-07-23T12:10:00.000Z",
    "acknowledgement_required": true
  },
  "codes": [
    "7K3M-9Q2V-W4XT-6N8P-R5YD-H2CF"
  ]
}
```

Each code contains 24 uniformly random symbols from the 32-symbol Crockford alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, formatted as six groups of four. This provides 120 bits of entropy before formatting. Input comparison removes hyphens and uppercases ASCII; it does not apply fuzzy character substitutions. D1 stores only context-bound HMAC verifiers.

Generation creates an unactivated `generated` set and does not change
`auth_version`, revoke an active set, or revoke a session. Acknowledgement
atomically:

- activates the new set
- revokes the previous set
- invalidates the one-time encrypted idempotency response after its short retry window

Normal acknowledgement/regeneration increments the account version, sets the
legacy revocation boundary, revokes all sessions, sends a notification, and
returns `login_required: true`. During initial enrollment, the dedicated
acknowledgement performs the same version/revocation boundary but atomically
reissues only the exact generating enrollment session with its checklist
updated; every other canonical/legacy session is revoked. Final account
activation remains the enrollment-complete transition.

## Staff password change

```text
PUT /api/v1/admin/security/password
Authentication: recent staff_strong
Idempotency-Key: required
```

```json
{
  "current_password": "<current>",
  "new_password": "<new>"
}
```

Policy:

- minimum 15 Unicode characters
- accepts at least 64; implementation accepts up to 128
- permits spaces, paste, and password managers
- no mandatory composition rule
- no scheduled rotation without compromise evidence
- rejects known-compromised/common values

The initial compromised/common-password provider is the free Pwned Passwords
range API behind the local password-policy interface. The Worker hashes the
complete, unnormalized UTF-8 password with SHA-1 solely for this screening
lookup, sends only the first five uppercase hexadecimal characters to
`https://api.pwnedpasswords.com/range/`, requests response padding with
`Add-Padding: true`, and compares the remaining 35 characters locally. It never
sends the plaintext or complete SHA-1 hash and never performs incremental
lookups while the user types. Any transport, status, media-type, size, or
response-validation failure fails closed with `503 temporarily_unavailable`;
it never treats provider failure as a clean password.

Success replaces the canonical verifier, disables legacy fallback, increments the account version, revokes all sessions/challenges, sends a notification, and requires login.

## External identity management

```text
GET    /api/v1/customer/security/external-identities
POST   /api/v1/customer/security/external-identities/telegram
DELETE /api/v1/customer/security/external-identities/telegram
```

Link request:

```json
{
  "init_data": "<fresh raw Telegram.WebApp.initData>"
}
```

The same Telegram verification rules apply.

- already linked to this account: idempotent success
- linked to another customer: `409 merge_required` with short-lived merge authorization
- linked to staff or wrong realm: generic conflict, never reassign
- at most one active Telegram identity may belong to an account; the database enforces account/provider and provider/subject uniqueness

Unlinking requires recent customer verification and returns `409 last_recovery_method` if it would leave the account without a viable continuation/recovery method.

A successful new link or unlink increments `auth_version`, revokes other canonical/legacy sessions and challenges, and replaces the current verified session. Routine authentication with an already-linked Telegram identity does not.

## Customer account merge

Reserved routes:

```text
POST /api/v1/customer/security/account-merges/preview
POST /api/v1/customer/security/account-merges
```

Until a separate customer-merge data contract and its migration tests are accepted, `CRM_AUTH_CUSTOMER_MERGE` remains false and both routes return:

```text
503 capability_disabled
```

This gate is mandatory because a merge must deterministically handle:

- `messages`
- `customer_requests`
- legacy and V2 locations
- legacy carts and cart items
- customer shop memberships
- customer payment methods
- preferred providers
- checkouts and shop order parts
- legacy customer sessions
- V2 cart sessions/items
- V2 orders and their deterministic `app_customer_<customers.id>` session tokens
- email/passkey/Telegram identity conflicts
- duplicate preferences and two non-empty active carts

The future preview request accepts only a proof-derived `merge_authorization_token`. It returns survivor/source numeric customer IDs, affected counts, blockers, effects, expiry, and a precondition token.

Commit requires:

```json
{
  "merge_plan_id": "80a1b2c3d4e5f67890a1b2c3d4e5f678",
  "precondition_token": "<opaque state hash>",
  "confirmation": "merge_accounts"
}
```

It additionally requires recent customer verification and `Idempotency-Key`. Any data drift returns `409 merge_precondition_failed`. No merge crosses realms or merges staff accounts. No cart/order/history is discarded.

## Normative route matrix

This matrix overrides ambiguous prose. `R` means `Idempotency-Key` is required; `V15` means `customer_verified` proof no more than 15 minutes old; `S5` means `staff_strong` proof no more than 5 minutes old. Every cookie-authenticated mutation requires the exact allowed Origin and matching scope-specific CSRF pair. Public token/continuation routes ignore ambient cookies. Every success uses the shared top-level JSON envelope. Listed success results assume an enabled transport/capability; under contract version 1, a native bearer request instead receives the pre-lookup `503 capability_disabled` result fixed above.

### Customer routes

| Method and exact path | Authentication / freshness | Idem | Success/result |
|---|---|---:|---|
| `POST /api/v1/customer/auth/guest` | public | R | `201`; `customer_guest` |
| `POST /api/v1/customer/auth/email/start` | public | R | `202`; generic attempt |
| `POST /api/v1/customer/auth/email/resend` | public | R | `202`; generic attempt |
| `POST /api/v1/customer/auth/email/complete` | public proof | R | `200`; verified session or confirmation required |
| `POST /api/v1/customer/auth/email/confirm` | public continuation | R | `200`; `customer_verified` |
| `POST /api/v1/customer/auth/passkey/options` | public | R | `200`; ceremony |
| `POST /api/v1/customer/auth/passkey/complete` | public proof | R | `200`; `customer_verified` |
| `POST /api/v1/customer/auth/telegram` | verified `initData` | R | `200` existing / `201` new; `customer_verified` |
| `GET /api/v1/customer/auth/session` | ordinary customer | — | `200`; current session |
| `POST /api/v1/customer/auth/logout` | ordinary customer | — | `200`; revoked; intrinsically idempotent |
| `POST /api/v1/customer/auth/step-up/email/start` | ordinary customer with primary email | R | `202`; bound challenge |
| `POST /api/v1/customer/auth/step-up/email/complete` | same session + proof | R | `200`; rotated fresh session |
| `POST /api/v1/customer/auth/step-up/passkey/options` | ordinary customer with passkey | R | `200`; bound ceremony |
| `POST /api/v1/customer/auth/step-up/passkey/complete` | same session + proof | R | `200`; rotated fresh session |
| `GET /api/v1/customer/security/sessions` | `customer_verified` | — | `200`; safe session list |
| `DELETE /api/v1/customer/security/sessions/{session_id}` | V15 | R | `200`; target revoked |
| `POST /api/v1/customer/security/sessions/revoke-others` | V15 | R | `200`; current rotated, others revoked |
| `POST /api/v1/customer/security/sessions/revoke-all` | V15 | R | `200`; all revoked, login required |
| `GET /api/v1/customer/security/email` | ordinary customer | — | `200`; masked state |
| `POST /api/v1/customer/security/email/enrollment` | ordinary customer | R | `202`; bound attempt |
| `POST /api/v1/customer/security/email/enrollment/resend` | same account/session | R | `202`; bound attempt |
| `POST /api/v1/customer/security/email/enrollment/complete` | initiating ordinary session + proof | R | `200`; verified email/rotated session, or `409 merge_required` |
| `POST /api/v1/customer/security/email-changes` | V15 | R | `201`; pending workflow |
| `GET /api/v1/customer/security/email-changes/current` | `customer_verified` | — | `200`; workflow state |
| `POST /api/v1/customer/security/email-changes/verify-new` | public token | R | `200`; verified/held, or activated with login required |
| `POST /api/v1/customer/security/email-changes/approve-old` | public token | R | `200`; approved, or activated with login required |
| `POST /api/v1/customer/security/email-changes/cancel` | public token | R | `200`; cancelled |
| `DELETE /api/v1/customer/security/email-changes/current` | V15 | R | `200`; cancelled |
| `GET /api/v1/customer/security/passkeys` | `customer_verified` | — | `200`; credentials |
| `POST /api/v1/customer/security/passkeys/registration/options` | V15 | R | `200`; ceremony |
| `POST /api/v1/customer/security/passkeys/registration/complete` | same V15 session | R | `201`; credential/current rotation |
| `PATCH /api/v1/customer/security/passkeys/{passkey_id}` | V15 | R | `200`; label |
| `DELETE /api/v1/customer/security/passkeys/{passkey_id}` | V15 | R | `200`; revoked/current rotation |
| `GET /api/v1/customer/security/external-identities` | `customer_verified` | — | `200`; identities |
| `POST /api/v1/customer/security/external-identities/telegram` | V15 + verified `initData` | R | `200` linked/already linked, or `409 merge_required` |
| `DELETE /api/v1/customer/security/external-identities/telegram` | V15 | R | `200`; unlinked/current rotation |
| `POST /api/v1/customer/security/account-merges/preview` | V15 + merge authorization | R | currently `503`; future `200` plan |
| `POST /api/v1/customer/security/account-merges` | V15 + approved plan | R | currently `503`; future `200` merged |

### Staff authentication, recovery, and enrollment

| Method and exact path | Authentication / freshness | Idem | Success/result |
|---|---|---:|---|
| `POST /api/v1/admin/auth/password` | public password proof | R | `200`; passkey flow, limited session, or enrollment session |
| `POST /api/v1/admin/auth/passkey/options` | password-flow token | R | `200`; ceremony |
| `POST /api/v1/admin/auth/passkey/complete` | password flow + passkey | R | `200`; `staff_strong` |
| `POST /api/v1/admin/auth/recovery/start` | public | R | `202`; generic attempt |
| `POST /api/v1/admin/auth/recovery/resend` | public attempt | R | `202`; generic attempt |
| `POST /api/v1/admin/auth/recovery/email/complete` | public proof + explicit current-device continuation + transport gate | R | `200`; fresh `staff_recovery_email` |
| `GET /api/v1/admin/auth/recovery` | recovery session | — | `200`; safe stage/expiry/actions |
| `POST /api/v1/admin/auth/recovery/logout` | recovery session | — | `200`; exact recovery session revoked |
| `POST /api/v1/admin/auth/recovery/passkey/options` | `staff_recovery_email` | R | `200`; assertion ceremony |
| `POST /api/v1/admin/auth/recovery/passkey/complete` | same recovery session + passkey | R | `200`; email session revoked/fresh `staff_recovery_authorized` |
| `POST /api/v1/admin/auth/recovery/recovery-code/complete` | same `staff_recovery_email` + code | R | `200`; code consumed/email session revoked/fresh authorized session/replacement required |
| `POST /api/v1/admin/auth/recovery/passkey/registration/options` | authorized; replacement required | R | `200`; attestation ceremony |
| `POST /api/v1/admin/auth/recovery/passkey/registration/complete` | same authorized session | R | `201`; replacement passkey/authorized session rotated |
| `POST /api/v1/admin/auth/recovery/email-change-authorizations` | authorized Superadmin-assisted Admin grant | R | `200`; exact pending change bound to grant/24-hour hold |
| `PUT /api/v1/admin/auth/recovery/password` | authorized; replacement gate satisfied | R | `200`; all sessions revoked/login required |
| `POST /api/v1/admin/auth/invitations/preview` | public invitation proof | — | `200`; safe masked context; non-consuming |
| `POST /api/v1/admin/auth/invitations/accept` | public invitation proof | R | `200`; `staff_enrollment` |
| `POST /api/v1/admin/auth/enrollment/start` | `staff_password_limited` only | R | `200`; limited session revoked/fresh `staff_enrollment` at `email_required` |
| `POST /api/v1/admin/auth/enrollment/resume/start` | public identifier | R | `202`; generic resume attempt |
| `POST /api/v1/admin/auth/enrollment/resume/resend` | public attempt | R | `202`; generic resume attempt |
| `POST /api/v1/admin/auth/enrollment/resume/complete` | public proof + explicit current-device continuation + transport gate | R | `200`; reconstructed restricted enrollment session |
| `GET /api/v1/admin/auth/enrollment` | `staff_enrollment` | — | `200`; checklist/state |
| `POST /api/v1/admin/auth/enrollment/logout` | `staff_enrollment` | — | `200`; exact enrollment session revoked |
| `POST /api/v1/admin/auth/enrollment/email/start` | enrollment at `email_required` | R | `202`; session-bound attempt |
| `POST /api/v1/admin/auth/enrollment/email/resend` | same enrollment session | R | `202`; bound replacement attempt |
| `POST /api/v1/admin/auth/enrollment/email/complete` | initiating enrollment session + proof | R | `200`; enrollment session rotated to `email_verified` |
| `PUT /api/v1/admin/auth/enrollment/password` | enrollment at least `email_verified` | R | `200`; canonical password/checklist/enrollment session rotated |
| `POST /api/v1/admin/auth/enrollment/passkeys/registration/options` | enrollment at least `email_verified` | R | `200`; ceremony |
| `POST /api/v1/admin/auth/enrollment/passkeys/registration/complete` | same enrollment session | R | `201`; credential/checklist/enrollment session rotated |
| `POST /api/v1/admin/auth/enrollment/recovery-code-sets` | enrollment at least `email_verified` | R | `201`; unactivated set/raw codes once |
| `POST /api/v1/admin/auth/enrollment/recovery-code-sets/{set_id}/acknowledge` | same generating enrollment session | R | `200`; first set active/checklist/enrollment session rotated |
| `POST /api/v1/admin/auth/enrollment/complete` | enrollment with all gates | R | `200`; version advanced/all sessions revoked/complete/login required |
| `GET /api/v1/admin/auth/session` | ordinary staff | — | `200`; current session |
| `POST /api/v1/admin/auth/logout` | ordinary staff | — | `200`; revoked; intrinsically idempotent |
| `POST /api/v1/admin/auth/step-up/passkey/options` | `staff_strong` | R | `200`; ceremony |
| `POST /api/v1/admin/auth/step-up/passkey/complete` | same strong session + passkey | R | `200`; rotated S5 session |

### Staff security routes

| Method and exact path | Authentication / freshness | Idem | Success/result |
|---|---|---:|---|
| `GET /api/v1/admin/security/invitations` | S5 Superadmin | — | `200`; list |
| `POST /api/v1/admin/security/invitations` | S5 Superadmin | R | `201`; pending invitation |
| `GET /api/v1/admin/security/invitations/{invitation_id}` | S5 Superadmin | — | `200`; invitation |
| `POST /api/v1/admin/security/invitations/{invitation_id}/resend` | S5 Superadmin; pending/expired only | R | `200`; challenge replaced/expiry renewed |
| `POST /api/v1/admin/security/invitations/{invitation_id}/reauthorize-enrollment` | S5 Superadmin; accepted/never-active pending account | R | `200`; new bounded enrollment deadline/resume challenge |
| `DELETE /api/v1/admin/security/invitations/{invitation_id}` | S5 Superadmin; unprotected pending only | R | `200`; revoked, or `409 protected_account` |
| `GET /api/v1/admin/security/sessions` | `staff_strong` | — | `200`; safe session list |
| `DELETE /api/v1/admin/security/sessions/{session_id}` | S5 | R | `200`; target revoked |
| `POST /api/v1/admin/security/sessions/revoke-others` | S5 | R | `200`; current rotated, others revoked |
| `POST /api/v1/admin/security/sessions/revoke-all` | S5 | R | `200`; all revoked/login required |
| `GET /api/v1/admin/security/email` | `staff_strong` | — | `200`; masked state |
| `POST /api/v1/admin/security/email-changes` | S5 | R | `201`; pending workflow |
| `GET /api/v1/admin/security/email-changes/current` | `staff_strong` | — | `200`; workflow state |
| `POST /api/v1/admin/security/email-changes/verify-new` | public token | R | `200`; verified/awaiting approval, or activated with login required |
| `POST /api/v1/admin/security/email-changes/approve-old` | public token | R | `200`; approved, or activated with login required |
| `POST /api/v1/admin/security/email-changes/cancel` | public token | R | `200`; cancelled |
| `DELETE /api/v1/admin/security/email-changes/current` | S5 | R | `200`; cancelled |
| `GET /api/v1/admin/security/passkeys` | `staff_strong` | — | `200`; credentials |
| `POST /api/v1/admin/security/passkeys/registration/options` | S5 | R | `200`; ceremony |
| `POST /api/v1/admin/security/passkeys/registration/complete` | same S5 session | R | `201`; credential/all sessions revoked/login required |
| `PATCH /api/v1/admin/security/passkeys/{passkey_id}` | S5 | R | `200`; label |
| `DELETE /api/v1/admin/security/passkeys/{passkey_id}` | S5; more than one active | R | `200`; revoked/all sessions revoked |
| `GET /api/v1/admin/security/recovery-codes` | `staff_strong` | — | `200`; metadata only |
| `POST /api/v1/admin/security/recovery-code-sets` | S5 | R | `201`; unactivated set/raw codes once |
| `POST /api/v1/admin/security/recovery-code-sets/{set_id}/acknowledge` | same generating `staff_strong` session | R | `200`; active set/all sessions revoked/login required |
| `DELETE /api/v1/admin/security/recovery-code-sets/{set_id}` | S5 | R | `200`; revoked/login required |
| `PUT /api/v1/admin/security/password` | S5 | R | `200`; changed/all sessions revoked |

`GET /api/v1/capabilities` is public, does not require an idempotency key, and returns `200`. Legacy adapters keep their current response shape until cutoff; they are governed by the sunset section rather than this matrix.

## Security events

There is no client-writable security-event endpoint.

Authentication middleware/services append events in the same atomic state transition where practical. No Admin or Superadmin API may create, edit, or delete them.

Events include:

- login success/failure
- email enrollment/change
- recovery start/failure/completion
- passkey registration/removal
- recovery-code generation/consumption
- invitation activity
- Telegram verification/linking
- session revocation
- merge attempt/completion
- break-glass action

Metadata never contains raw passwords, tokens, codes, full email addresses, raw IPs, raw Telegram payloads, or passkey private material.

## Error registry

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `invalid_json` | Malformed JSON |
| 400 | `invalid_request` | Invalid shape, unknown field, or mutually exclusive proof violation |
| 400 | `validation_failed` | Safe field validation details |
| 400 | `idempotency_key_required` | Required header missing |
| 400 | `invalid_session_transport` | Platform/transport mismatch |
| 405 | `method_not_allowed` | Path exists but HTTP method is unsupported |
| 400 | `invalid_or_expired_challenge` | Generic challenge completion failure |
| 400 | `invalid_or_expired_invitation` | Generic invitation token failure |
| 400 | `webauthn_verification_failed` | Generic WebAuthn failure |
| 400 | `weak_password` | Password policy failure |
| 401 | `unauthorized` | Missing or invalid ordinary session |
| 401 | `invalid_credentials` | Staff identifier/password failure |
| 401 | `invalid_telegram_authorization` | Telegram proof failure |
| 403 | `forbidden` | Role denial |
| 403 | `insufficient_assurance` | Valid session lacks required proof |
| 403 | `enrollment_required` | Staff account restricted to enrollment |
| 403 | `account_disabled` | Previously authenticated account is disabled |
| 404 | `not_found` | Authenticated owned resource absent |
| 409 | `idempotency_key_reused` | Same key, different request |
| 409 | `request_in_progress` | Same operation still executing |
| 409 | `username_unavailable` | Authenticated invitation conflict |
| 409 | `staff_email_unavailable` | Authenticated staff-realm email conflict |
| 409 | `email_in_use` | Safe only after proof/authentication |
| 409 | `identity_already_linked` | Verified external identity belongs elsewhere |
| 409 | `last_recovery_method` | Unsafe credential removal |
| 409 | `replacement_passkey_required` | Recovery path must register a new passkey |
| 409 | `protected_account` | Protected staff mutation is forbidden |
| 409 | `last_superadmin` | Mutation would remove the final active Superadmin |
| 409 | `merge_required` | Proof succeeded but profiles differ |
| 409 | `merge_conflict` | Unsafe business-record conflict |
| 409 | `merge_precondition_failed` | Previewed state changed |
| 410 | `resource_expired` | Authenticated management resource expired |
| 410 | `legacy_route_retired` | Legacy adapter is past its cutoff |
| 415 | `unsupported_media_type` | JSON content type required |
| 426 | `client_upgrade_required` | Legacy client cannot complete the required assurance flow |
| 429 | `rate_limited` | Uniform IP/system limit only |
| 503 | `temporarily_unavailable` | System-wide auth/email disable before lookup |
| 503 | `capability_disabled` | Reserved feature intentionally off |

Public start/resend routes never return account-dependent `404`, `409`, or `429`.

## Magic-link browser contract

Email links use a URL fragment:

```text
https://crm.ayartuerk.me/auth/customer/continue#token=<opaque-token>
https://crm.ayartuerk.me/auth/admin/recovery#token=<opaque-token>
```

Purpose mapping is fixed:

| Realm/purpose | First-party landing path | POST exchange |
|---|---|---|
| customer `customer_login` / `customer_recovery` | `/auth/customer/continue` | `/api/v1/customer/auth/email/complete` |
| customer `email_enrollment` | `/auth/customer/email/enrollment` | `/api/v1/customer/security/email/enrollment/complete` |
| customer `email_change_new` | `/auth/customer/email-change/new` | `/api/v1/customer/security/email-changes/verify-new` |
| customer `email_change_old_approval` | `/auth/customer/email-change/old` | approve or cancel endpoint chosen by explicit button |
| staff `staff_invitation` | `/auth/admin/invitation` | preview, then `/api/v1/admin/auth/invitations/accept` after explicit confirmation |
| staff `email_enrollment` | `/auth/admin/enrollment/email` | `/api/v1/admin/auth/enrollment/email/complete` |
| staff `staff_enrollment_resume` | `/auth/admin/enrollment/resume` | `/api/v1/admin/auth/enrollment/resume/complete` after explicit current-device confirmation |
| staff `staff_recovery` | `/auth/admin/recovery` | `/api/v1/admin/auth/recovery/email/complete` |
| staff `email_change_new` | `/auth/admin/email-change/new` | `/api/v1/admin/security/email-changes/verify-new` |
| staff `email_change_old_approval` | `/auth/admin/email-change/old` | approve or cancel endpoint chosen by explicit button |

The old-address landing page never performs approval or cancellation on GET. It displays masked context and requires an explicit button, then posts the fragment token to `/approve-old` or `/cancel`.

Email-enrollment landing pages exchange only when the initiating customer or staff flow session is present. If it is absent, they remove the fragment and instruct the user to enter the manual code on the device where enrollment started; they do not create a session from the link alone.

The fragment is not sent in the initial HTTP request. The first-party
continuation page:

1. reads the fragment
2. immediately calls `history.replaceState` to remove it
3. exchanges it through the correct POST completion route only when that
   purpose permits immediate exchange; staff recovery and enrollment resume
   first display their explicit current-device continuation action, and
   old-address approval/cancellation always waits for its explicit button
4. never writes it to storage, analytics, logs, crash reports, or DOM text
5. navigates only to an allow-listed internal target

Native universal/app links follow the same one-time exchange rule.

## Legacy compatibility and sunset

### Legacy customer routes

Current:

```text
POST /api/v1/customer/session/start
GET|POST /api/v1/customer/session/verify
POST /api/v1/customer/session/logout
GET|PATCH|PUT /api/v1/customer/me
```

Bridge:

- `session/verify`, `session/logout`, and protected business APIs resolve the bridged stable account and authentication version.
- As soon as `CRM_AUTH_CUSTOMER_BOUNDARY` is enabled, `session/start` MUST stop looking up a customer by `device_id`.
- During the short client migration window, `session/start` may adapt to guest creation and preserve the current response fields, but `device_id` is ignored as identity and stored only as metadata.
- After minimum client versions are enforced, `session/start` returns `410 legacy_route_retired`.

Customer email authentication MUST remain disabled until:

- secure guest-token persistence ships in Android and Apple apps
- Mini App sends raw `initData`
- Mini App no longer stores a bearer in `localStorage`
- device-ID takeover tests pass

### Staff JSON routes

Current:

```text
POST /api/v1/admin/login
POST /api/v1/admin/logout
POST|PATCH|PUT /api/v1/admin/password
GET /api/v1/admin/me
```

Bridge:

- `/admin/login` remains a grace-period adapter.
- It may issue `staff_password_limited` only to an eligible unenrolled legacy account before its deadline.
- It preserves the existing immediate-token success shape; it never inserts a passkey continuation object into a decoder that expects a token.
- An enrolled account or any account requiring passkey assurance returns `426 client_upgrade_required` with no account-dependent detail. The client must use `/api/v1/admin/auth/password`.
- Updated Admin Android/iOS clients must use the canonical route only after the
  separately approved native-attestation amendment defines and enables their
  bearer transport. Ordinary staff enrollment cannot be enabled before that
  amendment, the minimum native builds, and the native readiness gates. Under
  contract version 1 the sole protected bootstrap account is explicitly
  Admin-Web-only; no other enrolled staff account may be created, and native
  clients continue using the bounded legacy adapter only for eligible
  unenrolled accounts.
- `/admin/logout` server-revokes bearer or cookie sessions.
- `/admin/password` delegates to canonical password change and requires the canonical assurance policy.
- `/admin/me` adds opaque `account_id`, scope, assurance, and enrollment state.

After client convergence, the adapter routes return `410 legacy_route_retired`.

### Staff Web routes

Current HTML routes such as `/admin/login`, `/logout`, `/change-password`, `/forgot-password`, and `/reset-password` render the canonical API flows.

The global Telegram/app-settings reset path remains available as an isolated,
monitored legacy recovery path until the project owner explicitly approves its
retirement. Canonical email-recovery activation or rollback does not implicitly
enable, disable, or remove Telegram recovery.

### Legacy Superadmin management routes

Before canonical staff authentication is enabled, every existing `/admin/superadmin/admins` create/upsert, role change, active toggle, password reset, and delete route is disabled or delegated to the canonical service:

- creation delegates to invitation creation and never accepts/creates a password
- role changes require recent `staff_strong`, explicit target, and last-Superadmin/protected-account guards; a successful role change increments the target account's `auth_version`, sets its legacy revocation boundary, revokes every target canonical/legacy session and challenge, updates `admin_users.role` in that same CAS batch, records/notifies the change, and requires the target to log in again
- disable is a soft canonical account disable with account-wide revocation
- reactivation never occurs as an upsert side effect
- hard delete is retired
- protected staff and the last active Superadmin cannot be disabled, demoted, or deleted

An unconverted mutation returns `503 capability_disabled`; after the legacy cutoff it returns `410 legacy_route_retired`. No legacy route may write `admin_users` directly once `CRM_AUTH_CANONICAL_RESOLVER` is on.

There is no direct compatibility bridge for `admin_users.role`. From the
`0014` rollout onward, every role mutation is disabled until it delegates to
the canonical account-wide transition above; an already-authenticated target
never inherits a promotion.

### Privileged Telegram Bot commands

Legacy privileged Bot commands—including order/admin replies and `/setadmin` or `/setsuperadmin`—currently rely on a global chat ID or setup code rather than a canonical staff account. They are not staff authentication or recovery. They may remain operational only during the pre-cutover compatibility window, with existing audit controls, and MUST be disabled before `CRM_AUTH_LEGACY_LOGIN_DISABLED` or canonical staff enforcement is enabled. Rollback does not re-enable them.

Restoring privileged Bot administration requires a separate ADR and migration for staff-linked Telegram identity, strong time-limited authorization, role/status re-resolution on every command, revocation, and stable security-event attribution. Customer Bot/webhook behavior remains supported under the verified customer Telegram bridge.

### Legacy session invalidation

Every security-sensitive account-wide revocation updates:

- canonical `auth_version`
- `legacy_sessions_revoked_before`
- canonical session rows
- legacy customer-session rows
- persisted Admin token revocations

The legacy resolver rejects old JWT `iat` and customer-session `created_at` values at or before that boundary. New security controls never rely only on canonical session rows while legacy tokens remain valid.

## Capabilities response

`GET /api/v1/capabilities` adds:

```json
{
  "identity": {
    "contract_version": 1,
    "schema_ready": false,
    "canonical_resolver": false,
    "customer_boundary": false,
    "staff_reconciled": false,
    "email_delivery": false,
    "customer_guest": false,
    "customer_email": false,
    "customer_passkeys": false,
    "telegram_init_data_verification": false,
    "staff_bootstrap_enrollment": false,
    "staff_enrollment": false,
    "staff_passkeys": false,
    "staff_recovery": false,
    "customer_merge": false,
    "native_bearer": {
      "admin_android": false,
      "admin_ios": false,
      "customer_android": false,
      "customer_ios": false
    },
    "legacy_customer_session_start": true,
    "legacy_admin_login": true,
    "legacy_cutoff_at": null,
    "client_readiness": {
      "telegram_bot": false,
      "telegram_mini_app": false,
      "admin_web": false,
      "admin_android": false,
      "admin_ios": false,
      "customer_web": false,
      "customer_android": false,
      "customer_ios": false
    },
    "minimum_client_versions": {
      "admin_android": null,
      "admin_ios": null,
      "customer_android": null,
      "customer_ios": null,
      "telegram_mini_app": null
    }
  }
}
```

The client list MUST include:

```text
telegram_bot
telegram_mini_app
admin_web
admin_android
admin_ios
customer_web
customer_android
customer_ios
```

Capabilities report real flags only; they never claim a client is ready because a backend route merely exists.

Boolean derivation is exact:

- the four readiness fields mirror `CRM_AUTH_SCHEMA_READY`, `CRM_AUTH_CANONICAL_RESOLVER`, `CRM_AUTH_CUSTOMER_BOUNDARY`, and `CRM_AUTH_STAFF_RECONCILED`
- `email_delivery` mirrors `CRM_AUTH_EMAIL_DELIVERY`
- `customer_guest` requires schema, resolver, and customer boundary
- `customer_email` additionally requires email delivery and `CRM_AUTH_CUSTOMER_EMAIL`
- customer passkeys additionally require their dedicated passkey flag and verified WebAuthn platform associations
- Telegram verification requires schema, resolver, customer boundary, and `CRM_AUTH_TELEGRAM_VERIFICATION`
- `staff_bootstrap_enrollment` requires schema, resolver, email delivery,
  verified staff WebAuthn associations, Admin Web readiness, and
  `CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT`; it does not require
  `staff_reconciled`
- staff enrollment requires schema, resolver, staff reconciliation, email
  delivery, `CRM_AUTH_STAFF_ENROLLMENT`, and the approved native-attestation
  amendment; while Admin Android or Admin iOS remains a supported production
  surface, its `native_bearer` and `client_readiness` values and minimum-build
  gate must also be ready
- staff passkeys require every staff-enrollment prerequisite, verified staff
  WebAuthn associations, and `CRM_AUTH_STAFF_PASSKEYS`
- staff recovery requires the staff enrollment prerequisites plus staff passkeys and `CRM_AUTH_STAFF_RECOVERY`
- customer merge mirrors `CRM_AUTH_CUSTOMER_MERGE` only after all its prerequisites
- every `native_bearer` value is hard-coded false in contract version 1; an environment flag alone cannot change it
- each `client_readiness` value is true only after that surface's required tests and minimum build gate pass

Consequently, contract version 1 cannot report ordinary `staff_enrollment`,
`staff_passkeys`, or `staff_recovery` as ready. Only the protected,
Admin-Web-only bootstrap carve-out may run before the native-attestation
amendment. Enabling any ordinary staff capability while a native staff bearer
or readiness value is false is a rollout failure, not a supported Web-only
shortcut.

The bootstrap capability is a narrow deadlock breaker, not ordinary staff
enrollment. While it is true and `staff_reconciled` is false, invitation
acceptance and dedicated enrollment routes accept only a pending protected
environment account whose invitation carries the owner bootstrap actor
reference. They reject every database-backed, unprotected, active, disabled, or
ordinary invited account. After the first protected Superadmin completes all
gates and the offline drill passes, the owner maintenance step records the
exit, disables and verifies
`CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT=false`, and only then sets
`CRM_AUTH_STAFF_RECONCILED=true`; ordinary staff capabilities are then derived
normally. The two flags are never true together.

## Client implementation gates

The four native sections below are post-amendment implementation requirements.
Their canonical-auth readiness stays false and their legacy compatibility
transport remains in place until the native-attestation amendment permits
bearer issuance.

### Telegram Mini App

- send `Telegram.WebApp.initData`
- never use `initDataUnsafe` as identity
- use HttpOnly cookie session
- remove localStorage bearer storage
- handle invalid/stale/replayed proof

### Telegram Bot

- use only trusted webhook proof for customer Telegram continuity
- resolve/link the canonical customer account after proof
- disable privileged global-chat/setup-code commands before staff cutover
- never create an `auth_sessions.client_platform` value for the Bot itself

### Customer Web

- use the customer HttpOnly cookie and customer CSRF pair
- implement guest, email confirmation, step-up, email/passkey, and session-management flows
- never switch accounts from a forwarded email link without explicit confirmation

### Customer Android

- replace `session/start` with idempotent guest creation
- persist bearer token in Keystore-backed encrypted storage
- reuse the token after process/device restart
- support email link/code and optional passkey

### Customer iOS

- replace `session/start` with idempotent guest creation
- persist bearer token in Keychain
- support universal-link exchange
- support email link/code and optional passkey

### Admin Android

- replace immediate-token-only login model with password/passkey flow model
- migrate/clear ordinary DataStore tokens
- use Keystore-backed encrypted storage
- implement enrollment, recovery, email, passkey, recovery-code, and session screens

### Admin iOS

- implement the same staff contract and assurance as Admin Android
- use Keychain and AuthenticationServices

### Web Admin

- replace insecure legacy forgot/reset pages
- use Secure HttpOnly cookies, CSRF, exact-origin CORS
- implement passkey, enrollment, recovery, and session management

All changed user-facing text ships in `en`, `de`, `tr`, `ar`, and `ru` in the same release.

## Acceptance tests

Implementation is not ready until automated tests prove:

### Resolver/session

- every protected route rejects a wrong realm
- disabled/deleted accounts fail
- stale canonical authentication versions fail
- legacy Admin/customer sessions fail at the revocation boundary
- logout revokes both bearer and cookie sessions
- logout-all covers canonical and legacy stores
- role changes and last-Superadmin protections work

### Browser/native

- exact-origin credentialed CORS
- CSRF header/cookie/hash enforcement
- ordinary/enrollment/recovery CSRF pairs cannot be substituted for one another
- Secure/HttpOnly/SameSite cookie attributes
- no browser localStorage bearer
- any `Origin` or `Sec-Fetch-*` browser metadata prevents bearer issuance even
  when the request claims a native platform
- a metadata-free native bearer request receives `503 capability_disabled`
  before credential lookup under contract version 1
- no uncontracted attestation field/header or platform metadata can bypass that
  gate
- Android Keystore and Apple Keychain persistence/migration

### Challenges

- token entropy, expiry, single use, replacement invalidation, and replay rejection
- five-attempt limit and 60-second resend
- hourly/daily and IP/device/system controls
- constant-time verifier comparison
- exactly one concurrent completion succeeds
- forwarded/cross-device customer email login cannot switch an ambient account without explicit confirmation
- unknown/disabled/throttled/provider-failure response equivalence and practical timing
- no raw token/code/full email in logs

### Staff

- password plus user-verified passkey for strong login
- legacy hash upgrades exactly once
- environment credentials are never copied
- email proof alone cannot recover staff
- recovery code is single-use
- recovery-code recovery cannot finish until a replacement passkey is registered, and preserves exactly that new credential
- the final active staff passkey cannot be removed
- recovery/password/email/passkey/code changes revoke all sessions
- invitation does not upsert, re-role, or reactivate
- enrollment resume works only for a never-activated pending accepted
  invitation before its bounded deadline; active/disabled staff receive no
  deliverable resume challenge
- expired protected bootstrap invitation/enrollment reissue preserves the exact
  account, username, role, and destination, and ordinary DELETE cannot revoke it
- self-lockout and last-Superadmin operations are blocked
- every target role change revokes target canonical/legacy sessions before the
  new role can authorize work
- enrollment reactivates only `enrollment_expired`, never an administrative/security disable

### Telegram/passkeys

- forged, stale, future, malformed, duplicate-key, wrong-bot, and replayed `initData` fail
- caller-supplied Telegram/device IDs never prove identity
- a verified legacy Telegram subject links exactly one existing customer or fails closed
- privileged global-chat/setup-code Bot commands are disabled before staff cutover
- RP ID, origin, challenge, user verification, signature, sign count, and credential uniqueness checks
- discoverable customer authentication requires the exact non-null binary WebAuthn user handle
- Android Digital Asset Links and Apple AASA association validation

### Outbox/localization

- challenge and outbox persist atomically
- D1 stores ciphertext only
- lease/retry is idempotent and skips consumed/expired challenges
- test delivery refuses non-verified recipients while that restriction is enabled
- text and HTML snapshots exist for all five languages
- Arabic uses RTL

### Cross-client

- Web Admin
- active Admin Android
- Admin iOS
- Customer Web
- Customer Android
- Customer iOS
- Telegram Mini App
- Telegram Bot

Each client must pass enrollment/login/logout/recovery/session flows applicable to its realm before the corresponding production flag is enabled.

## Rollout order

1. Back up D1 and pass production collision/data preflight.
2. Apply additive schema with every auth feature flag off.
3. Verify account/profile/session cardinality, realm, foreign keys, indexes, and triggers.
4. Deploy canonical dual-read resolver and security events.
5. Ship secure native guest persistence and Telegram raw-`initData` exchange.
6. Enable the customer identity boundary and prove device-ID takeover fails.
7. Reconcile environment staff and verify canonical-first resolution.
8. Add the simulated outbox, enable controlled email delivery only to manually
   verified Cloudflare destination addresses, and pass delivery/retry tests.
9. Use the Admin-Web-only bootstrap carve-out to enroll and test the first
   recovery-capable protected Superadmin, and test the offline break-glass
   runbook.
10. Approve the separate native-attestation amendment, implement its exact
   bearer protocol, ship minimum Admin Android/iOS builds, and pass both native
   readiness gates. Ordinary staff enrollment remains off until this step
   passes.
11. Enroll and test a second recovery-capable Superadmin when available, then
    enable ordinary staff enrollment/recovery and disable the global reset
    path.
12. Enable progressive customer email.
13. Gate remaining minimum client versions and expire legacy sessions.
14. Enable customer merge only after its separate data contract passes.
15. Retire legacy routes/tables/settings after a final rollback checkpoint.

No step in this document is executed by writing this contract.

## References

- [Telegram Mini Apps validation](https://core.telegram.org/bots/webapps)
- [Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
