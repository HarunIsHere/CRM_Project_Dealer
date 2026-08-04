# Identity, Email, and Recovery D1 Migration Contract

Date: 2026-07-23
Status: proposed implementation contract; not implemented or applied
Decision source: [ADR-0005](../decisions/ADR-0005-identity-email-and-account-recovery.md)

## Purpose

This document fixes the exact Cloudflare D1 schema, migration order, backfill rules, compatibility bridges, invariants, and verification gates for the identity system accepted in ADR-0005.

This document does not:

- create `0014_identity_email_recovery_foundation.sql`
- change Worker code
- change a local or remote D1 database
- configure email delivery
- reconcile the environment-defined Admin or Superadmin
- deploy anything

The implementation must not apply the production migration until the preflight, disposable-database migration test, backup/restore checkpoint, and explicit rollout approval in this contract have passed.

## Current schema constraints

The migration must preserve these existing facts:

- `customers.id` remains the business/customer foreign key.
- `admin_users.id` remains the staff profile and authorization foreign key.
- `customers.telegram_user_id` is currently `NOT NULL UNIQUE` and contains both real Telegram IDs and synthetic `app:<uuid>` values.
- `admin_users.password_hash` is currently `NOT NULL`.
- environment-defined Admin and Superadmin accounts may have no `admin_users` row.
- current Admin JWTs identify a username, not a stable account ID.
- current customer bearer sessions identify `customer_app_sessions.customer_id`, not an authentication account.
- many business tables depend on `customers.id`; identity backfill must not reparent, merge, renumber, or delete those rows.

## Normative conventions

The words MUST, MUST NOT, SHOULD, and MAY are normative.

### Identifiers

Every new identity row ID, except a WebAuthn credential ID, MUST be:

- a `TEXT` value
- 32 lowercase hexadecimal characters
- generated from 16 cryptographically random bytes
- opaque outside the authentication service

Worker generation:

```js
const bytes = new Uint8Array(16);
crypto.getRandomValues(bytes);
const id = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
```

SQL backfill generation:

```sql
lower(hex(randomblob(16)))
```

New tables MUST use `STRICT`. Public APIs MUST expose only these opaque IDs, never a D1 `rowid`.

### Time

- D1 stores timestamps as UTC `TEXT`.
- New Worker writes MUST use RFC 3339 UTC values from `new Date().toISOString()`.
- SQL defaults and migration backfill MAY use `CURRENT_TIMESTAMP`.
- Every comparison MUST use SQLite `datetime(...)`; code MUST NOT assume mixed legacy timestamp strings sort correctly as plain text.
- API responses normalize all times to RFC 3339 UTC.

### Booleans and JSON

- Booleans are `INTEGER NOT NULL CHECK (value IN (0, 1))`.
- JSON is canonical UTF-8 JSON in `TEXT` with `CHECK (json_valid(value))`.
- Security-sensitive logic MUST parse and validate JSON; it MUST NOT trust stored JSON merely because it is syntactically valid.

### Deletion

Authentication accounts, credentials, email addresses, and security events are soft-deleted or revoked. Ordinary application flows MUST NOT physically delete them.

Foreign keys to `auth_accounts` use `ON DELETE RESTRICT`. Customer/business deletion is a later soft-delete and pseudonymization project; it MUST NOT cascade through identity, order, or security-event history.

### Email normalization

Normalization version 1 is:

1. trim leading and trailing Unicode whitespace
2. Unicode NFC normalization
3. split at the final `@`
4. convert the domain to its lowercase ASCII IDNA form
5. lowercase the local part for this application's equality rule
6. reject control characters, internal whitespace, invalid syntax, or more than 320 characters

It MUST NOT remove dots, remove `+tag` suffixes, or add provider-specific equivalence. `display_email` preserves the validated presentation form; `normalized_email` is used for equality.

## Migration sequence

### `0014_identity_email_recovery_foundation.sql`

`0014` is additive. It executes in this exact dependency order:

1. create `auth_accounts`
2. add nullable canonical links/compatibility columns to legacy profiles,
   customer sessions, token revocations, and audit rows
3. create `ux_admin_users_id_auth_account` immediately, before any linked-row
   write
4. create `auth_email_addresses`, `auth_external_identities`,
   `auth_password_credentials`, `auth_passkey_credentials`, `auth_sessions`,
   `auth_recovery_code_sets`, and `auth_recovery_codes`
5. create `auth_challenges`, `auth_challenge_proofs`,
   `auth_staff_invitations`, and `auth_email_change_requests`
6. create `auth_security_events`, `auth_email_outbox`,
   `auth_idempotency_keys`, `auth_replay_guards`,
   `auth_rate_limit_buckets`, and `auth_security_event_exports`
7. backfill customers and database-backed staff
8. register existing database staff hashes as legacy credentials requiring
   upgrade
9. bridge existing customer sessions to stable accounts and authentication
   versions
10. add the remaining partial unique indexes and realm/link guards after
    backfill
11. add temporary compatibility triggers for legacy profile/session writes
12. run zero-violation assertions

The schema blocks below are grouped for review; their presentation order does
not override this execution order.

`0014` MUST NOT:

- infer or insert an email address
- mark any email verified
- convert `customers.telegram_user_id` into a verified external identity
- merge customer rows
- reconcile environment Admin/Superadmin accounts
- copy an environment password or an `app_settings` password override
- remove a legacy column/table
- make `auth_account_id` `NOT NULL`
- enable any authentication feature

### Controlled reconciliation after `0014`

Environment staff reconciliation is a separately reviewed maintenance operation because SQL migrations cannot read Worker environment credentials safely.

It MUST:

- compare exact and normalized usernames for collisions
- abort without partial changes on any collision
- require an explicit validated destination email for each environment-defined account; it never reads one from Telegram/settings/docs
- create protected `admin_users` and pending staff `auth_accounts` rows with `enrollment_state='required'`
- set `admin_users.is_protected = 1`
- assign the intended role without overwriting or reactivating another row
- place the deliberately non-authenticating value `!canonical-auth-disabled!` in the legacy `password_hash` column
- create no canonical password credential from an environment value
- create a pending email row, staff-invitation challenge, invitation, encrypted outbox item, and security event without marking the address verified
- record the owner-controlled bootstrap receipt in `invited_by_actor_ref` and the security event; it never fabricates a canonical inviter
- require the account owner to choose a new canonical password during enrollment

This owner-controlled invitation is the only bootstrap path for the first protected environment Superadmin. Acceptance proves the supplied email and issues `staff_enrollment`; password, passkey, and recovery-code gates are then identical to every other staff enrollment. The reconciliation flag remains off and environment fallback remains in its bounded compatibility mode until at least one protected Superadmin completes enrollment and the break-glass drill passes. Subsequent pending environment accounts may use their already-created invitations; a strong Superadmin may rotate/resend them but may not change their reconciled username, role, or protected marker through invitation APIs.

If that first protected invitation expires before acceptance, or its accepted
enrollment deadline expires before completion, the owner maintenance tool may
reauthorize only the same immutable protected account/invitation. It revalidates
the exact environment username/role and stored destination, refuses every
collision or changed field, creates a fresh purpose-appropriate challenge and
outbox item, records the owner actor receipt/security event, and fixes a new
bounded expiry/deadline. It never creates another profile/account, changes the
email or role, verifies an email, or accepts a password. This exact reissue
operation is the only collision exception for a pre-existing protected
bootstrap row.

The created account values are exactly `realm='staff'`, `status='pending'`, `auth_version=1`, `enrollment_state='required'`, and null disable/delete/deadline fields. The linked profile retains the environment role, uses `is_active=1` only as the compatibility representation of an intended active profile, and cannot authorize canonical work while the account remains pending.

Its invitation challenge is account-bound with `realm='staff'`,
`purpose='staff_invitation'`, `expected_auth_version=1`, and
`initiating_session_id=NULL`; the owner-controlled bootstrap has no canonical
session to invent.

The legacy verifier rejects any value that is not exactly 64 lowercase hexadecimal characters before hashing/comparison. When a database-backed staff account upgrades or changes its password, the same sentinel replaces its old `admin_users.password_hash` value.

### Later enforcement and cleanup

A later migration may:

- rebuild `admin_users` so the legacy password column is nullable or removed
- make canonical profile links structurally mandatory
- remove compatibility triggers
- retire `customer_app_sessions` and `admin_token_revocations`
- remove password overrides and the global reset settings

Those changes are forbidden until every client uses the canonical resolver and the rollback checkpoint has been approved.

## Exact canonical schema

The implementation migration MUST use the following column and constraint contract. Cosmetic formatting may differ; names, meanings, constraints, and indexes may not.

### `auth_accounts`

```sql
CREATE TABLE auth_accounts (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  webauthn_user_handle TEXT NOT NULL UNIQUE
    CHECK (
      length(webauthn_user_handle) = 32
      AND webauthn_user_handle NOT GLOB '*[^0-9a-f]*'
    ),
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'disabled', 'deleted')),
  auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version >= 1),
  enrollment_state TEXT NOT NULL DEFAULT 'not_required'
    CHECK (
      enrollment_state IN (
        'not_required',
        'required',
        'in_progress',
        'complete',
        'expired'
      )
    ),
  enrollment_deadline_at TEXT,
  legacy_login_disabled_at TEXT,
  legacy_sessions_revoked_before TEXT,
  last_transition_id TEXT UNIQUE,
  disabled_reason TEXT
    CHECK (
      disabled_reason IS NULL
      OR disabled_reason IN (
        'administrative',
        'enrollment_expired',
        'security_hold',
        'owner_requested'
      )
    ),
  disabled_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, realm),
  CHECK (
    (status = 'disabled' AND disabled_at IS NOT NULL AND disabled_reason IS NOT NULL)
    OR (status <> 'disabled' AND disabled_at IS NULL AND disabled_reason IS NULL)
  ),
  CHECK (
    disabled_reason <> 'enrollment_expired'
    OR enrollment_state = 'expired'
  ),
  CHECK (
    enrollment_state <> 'expired'
    OR (status = 'disabled' AND disabled_reason = 'enrollment_expired')
  ),
  CHECK (realm <> 'customer' OR enrollment_state = 'not_required'),
  CHECK (status <> 'deleted' OR deleted_at IS NOT NULL)
) STRICT;

CREATE INDEX idx_auth_accounts_realm_status
  ON auth_accounts(realm, status);

CREATE INDEX idx_auth_accounts_enrollment_deadline
  ON auth_accounts(enrollment_state, enrollment_deadline_at);
```

The additive post-foundation migration
`0015_auth_account_locale.sql` persists the account preference required by
the API locale-selection contract:

```sql
ALTER TABLE auth_accounts
  ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'
  CHECK (locale IN ('en', 'de', 'tr', 'ar', 'ru'));
```

Existing accounts receive the documented English fallback. Enrollment and
authenticated language changes update this field; every challenge and outbox
row still snapshots the selected locale so an in-flight security message cannot
change language after creation.

`auth_version` is authoritative for canonical sessions. `legacy_sessions_revoked_before` is authoritative for legacy Admin JWT `iat` and legacy customer-session `created_at`. Every account-wide revocation MUST update both mechanisms in the same D1 transaction.

### `auth_email_addresses`

```sql
CREATE TABLE auth_email_addresses (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  normalized_email TEXT NOT NULL
    CHECK (
      length(normalized_email) BETWEEN 3 AND 320
      AND normalized_email = trim(normalized_email)
    ),
  normalization_version INTEGER NOT NULL DEFAULT 1
    CHECK (normalization_version >= 1),
  display_email TEXT NOT NULL
    CHECK (
      length(display_email) BETWEEN 3 AND 320
      AND display_email = trim(display_email)
    ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'replaced', 'revoked', 'deleted')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  verified_at TEXT,
  replaced_at TEXT,
  revoked_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, auth_account_id, realm),
  FOREIGN KEY (auth_account_id, realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  CHECK (status <> 'verified' OR verified_at IS NOT NULL),
  CHECK (status <> 'replaced' OR replaced_at IS NOT NULL),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),
  CHECK (status <> 'deleted' OR deleted_at IS NOT NULL),
  CHECK (
    is_primary = 0
    OR (
      status = 'verified'
      AND verified_at IS NOT NULL
      AND replaced_at IS NULL
      AND revoked_at IS NULL
      AND deleted_at IS NULL
    )
  )
) STRICT;

CREATE UNIQUE INDEX ux_auth_email_primary_active
  ON auth_email_addresses(auth_account_id)
  WHERE is_primary = 1
    AND status = 'verified'
    AND verified_at IS NOT NULL
    AND replaced_at IS NULL
    AND revoked_at IS NULL
    AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_auth_email_verified_active_realm
  ON auth_email_addresses(realm, normalized_email)
  WHERE status = 'verified'
    AND verified_at IS NOT NULL
    AND replaced_at IS NULL
    AND revoked_at IS NULL
    AND deleted_at IS NULL;

CREATE INDEX idx_auth_email_account
  ON auth_email_addresses(auth_account_id, created_at);

CREATE INDEX idx_auth_email_pending_normalized
  ON auth_email_addresses(realm, normalized_email, created_at)
  WHERE status = 'pending';
```

Only a verified, active, primary address is a recovery destination. Staff activation requires exactly one such address. A customer may have none.

### `auth_external_identities`

```sql
CREATE TABLE auth_external_identities (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  provider TEXT NOT NULL
    CHECK (
      length(provider) BETWEEN 1 AND 40
      AND provider = lower(provider)
      AND provider NOT GLOB '*[^a-z0-9_]*'
    ),
  provider_subject TEXT NOT NULL
    CHECK (length(provider_subject) BETWEEN 1 AND 255),
  verified_at TEXT NOT NULL,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_authenticated_at TEXT,
  revoked_at TEXT,
  created_transition_id TEXT NOT NULL UNIQUE,
  revocation_transition_id TEXT UNIQUE,
  provider_metadata_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(provider_metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auth_account_id, realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  CHECK (realm = 'customer' OR provider <> 'telegram'),
  CHECK (
    (revoked_at IS NULL AND revocation_transition_id IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_transition_id IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX ux_auth_external_identity_active_provider_subject
  ON auth_external_identities(provider, provider_subject)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX ux_auth_external_identity_active_account_provider
  ON auth_external_identities(auth_account_id, provider)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_external_identities_account
  ON auth_external_identities(auth_account_id, provider, revoked_at);
```

`provider_subject` is always text. Telegram numeric IDs MUST NOT pass through a JavaScript `Number`.

### `auth_password_credentials`

```sql
CREATE TABLE auth_password_credentials (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  account_realm TEXT NOT NULL DEFAULT 'staff'
    CHECK (account_realm = 'staff'),
  verifier TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  algorithm_version INTEGER NOT NULL CHECK (algorithm_version >= 1),
  parameters_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(parameters_json)),
  pepper_key_version INTEGER NOT NULL CHECK (pepper_key_version >= 0),
  needs_upgrade INTEGER NOT NULL DEFAULT 0 CHECK (needs_upgrade IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT,
  created_transition_id TEXT UNIQUE,
  revocation_transition_id TEXT UNIQUE,
  FOREIGN KEY (auth_account_id, account_realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  CHECK (
    (revoked_at IS NULL AND revocation_transition_id IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_transition_id IS NOT NULL)
  ),
  CHECK (
    algorithm <> 'argon2id_phc_v1'
    OR created_transition_id IS NOT NULL
  )
) STRICT;

CREATE UNIQUE INDEX ux_auth_password_credentials_active_account
  ON auth_password_credentials(auth_account_id)
  WHERE revoked_at IS NULL;
```

Canonical password verifier version 1 is:

```text
algorithm            = argon2id_phc_v1
algorithm_version    = 1
parameters_json      = {"memoryKiB":19456,"iterations":2,"parallelism":1,"saltBytes":16,"hashBytes":32}
pepper_key_version   = 1
needs_upgrade        = 0
verifier             = canonical Argon2id PHC string
```

Version 1 computes `HMAC-SHA-256(PASSWORD_PEPPER_V1, UTF8(password))` and passes those 32 output bytes as the Argon2id password input. The Argon2id salt is 16 random bytes per credential. The original password is not silently truncated or normalized. The pepper is mandatory, stored outside D1, and selected by `pepper_key_version`; a missing selected version fails closed.

The audited Worker-compatible implementation MUST be benchmarked in the deployed Worker runtime and remain inside its memory/CPU budget under abuse controls. Canonical staff enrollment remains disabled until that benchmark passes. If this exact Argon2id profile cannot run safely, implementation stops for a new security decision; it does not silently fall back to fast SHA-256 or an unreviewed scheme.

Existing database-backed staff hashes are registered as:

```text
algorithm            = legacy_sha256_admin_jwt_secret_v1
algorithm_version    = 1
parameters_json      = {"digest":"SHA-256","input":"utf8_secret_colon_password","encoding":"lower_hex"}
pepper_key_version   = 0
needs_upgrade        = 1
```

The exact legacy verifier is
`lower_hex(SHA-256(UTF8(ADMIN_JWT_SECRET + ":" + password)))`: concatenate the
secret, one ASCII colon byte, and the password without normalization, encode
that complete string as UTF-8, hash those bytes, and encode the 32-byte digest
as 64 lowercase hexadecimal characters. A verified legacy login may replace
that row atomically. Environment passwords and plaintext override values are
never copied. For `legacy_sha256_admin_jwt_secret_v1`,
`pepper_key_version=0` means the exact migration-time legacy
`ADMIN_JWT_SECRET`, not the current value of that environment variable. That
secret version MUST remain retrievable from the protected keyring until no
active legacy password credential, unexpired legacy Admin token, or rollback
checkpoint depends on it. Rotation therefore adds a new active signing secret
and retains the migration-time verifier key; it never overwrites the version-0
mapping.

### `auth_passkey_credentials`

```sql
CREATE TABLE auth_passkey_credentials (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  credential_id TEXT NOT NULL UNIQUE
    CHECK (
      length(credential_id) BETWEEN 16 AND 2048
      AND credential_id NOT GLOB '*[^A-Za-z0-9_-]*'
    ),
  rp_id TEXT NOT NULL,
  public_key_cose BLOB NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  aaguid TEXT,
  transports_json TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(transports_json)),
  backup_eligible INTEGER NOT NULL DEFAULT 0
    CHECK (backup_eligible IN (0, 1)),
  backup_state INTEGER NOT NULL DEFAULT 0
    CHECK (backup_state IN (0, 1)),
  device_label TEXT CHECK (device_label IS NULL OR length(device_label) <= 120),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT,
  created_transition_id TEXT NOT NULL UNIQUE,
  revocation_transition_id TEXT UNIQUE,
  UNIQUE (id, auth_account_id, realm),
  FOREIGN KEY (auth_account_id, realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  CHECK (
    (revoked_at IS NULL AND revocation_transition_id IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_transition_id IS NOT NULL)
  )
) STRICT;

CREATE INDEX idx_auth_passkey_credentials_active_account
  ON auth_passkey_credentials(auth_account_id, created_at)
  WHERE revoked_at IS NULL;
```

`credential_id` is canonical unpadded base64url. Its global uniqueness survives revocation; a credential ID is never recycled. `webauthn_user_handle` is decoded from the account's 32 hexadecimal characters into exactly 16 raw bytes and then encoded as unpadded base64url for WebAuthn `user.id`; implementations MUST NOT base64url-encode the 32 UTF-8 hexadecimal characters.

### `auth_recovery_code_sets`

```sql
CREATE TABLE auth_recovery_code_sets (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  account_realm TEXT NOT NULL DEFAULT 'staff'
    CHECK (account_realm = 'staff'),
  generating_session_id TEXT NOT NULL,
  expected_auth_version INTEGER NOT NULL CHECK (expected_auth_version >= 1),
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'active', 'revoked', 'expired')),
  code_count INTEGER NOT NULL DEFAULT 10
    CHECK (code_count BETWEEN 1 AND 20),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledgement_expires_at TEXT NOT NULL,
  acknowledged_at TEXT,
  activated_at TEXT,
  revoked_at TEXT,
  created_transition_id TEXT NOT NULL UNIQUE,
  activation_transition_id TEXT UNIQUE,
  UNIQUE (id, auth_account_id),
  FOREIGN KEY (auth_account_id, account_realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  FOREIGN KEY (generating_session_id, auth_account_id, account_realm)
    REFERENCES auth_sessions(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  CHECK (
    status <> 'active'
    OR (activated_at IS NOT NULL AND activation_transition_id IS NOT NULL)
  ),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
) STRICT;

CREATE UNIQUE INDEX ux_auth_recovery_code_sets_active_account
  ON auth_recovery_code_sets(auth_account_id)
  WHERE status = 'active';

CREATE INDEX idx_auth_recovery_code_sets_account
  ON auth_recovery_code_sets(auth_account_id, created_at);
```

A new set begins as `generated`, records the exact strong/enrollment session and
account version that generated it, and expires after 10 minutes unless
acknowledged. Acknowledgement resolves the presented credential to that exact
session, requires the account version still to equal
`expected_auth_version`, atomically revokes the previous active set and its
unused code rows, marks the new set active, and records
`acknowledged_at`/`activated_at`. Verification always joins the code to a
currently `active` set.

### `auth_recovery_codes`

```sql
CREATE TABLE auth_recovery_codes (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  account_realm TEXT NOT NULL DEFAULT 'staff'
    CHECK (account_realm = 'staff'),
  code_set_id TEXT NOT NULL
    CHECK (
      length(code_set_id) = 32
      AND code_set_id NOT GLOB '*[^0-9a-f]*'
    ),
  code_position INTEGER NOT NULL CHECK (code_position BETWEEN 1 AND 20),
  verifier TEXT NOT NULL,
  verifier_key_version INTEGER NOT NULL CHECK (verifier_key_version >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  used_at TEXT,
  revoked_at TEXT,
  consumption_transition_id TEXT UNIQUE,
  UNIQUE (id, auth_account_id, account_realm),
  UNIQUE (auth_account_id, code_set_id, code_position),
  UNIQUE (verifier_key_version, verifier),
  FOREIGN KEY (auth_account_id, account_realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  FOREIGN KEY (code_set_id, auth_account_id)
    REFERENCES auth_recovery_code_sets(id, auth_account_id)
    ON DELETE RESTRICT,
  CHECK (
    (used_at IS NULL AND consumption_transition_id IS NULL)
    OR (used_at IS NOT NULL AND consumption_transition_id IS NOT NULL)
  )
) STRICT;

CREATE INDEX idx_auth_recovery_codes_active_set
  ON auth_recovery_codes(auth_account_id, code_set_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;
```

Raw codes are shown once. D1 stores only a context-bound HMAC verifier and key
version. Contract version 1 normalizes by removing hyphens and uppercasing
ASCII without fuzzy substitutions, then HMACs a domain-separated tuple of
`staff`, HMAC key version, account ID, code-set ID, code position, and the
24-symbol normalized code. The active key is selected by
`CRM_AUTH_RECOVERY_CODE_HMAC_ACTIVE_KEY_VERSION`; verification accepts only the
active and explicitly retained `CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V<n>` secrets.

### `auth_challenges`

```sql
CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  email_address_id TEXT,
  initiating_session_id TEXT,
  expected_auth_version INTEGER
    CHECK (expected_auth_version IS NULL OR expected_auth_version >= 1),
  purpose TEXT NOT NULL
    CHECK (
      purpose IN (
        'email_enrollment',
        'email_change_new',
        'email_change_old_approval',
        'customer_login',
        'customer_recovery',
        'customer_email_step_up',
        'customer_passkey_step_up',
        'staff_invitation',
        'staff_enrollment_resume',
        'staff_recovery',
        'staff_passkey_step_up',
        'passkey_registration',
        'passkey_authentication',
        'telegram_auth',
        'telegram_link',
        'customer_merge',
        'break_glass'
      )
    ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'verified',
        'consumed',
        'invalidated',
        'expired',
        'suppressed'
      )
    ),
  verification_method TEXT NOT NULL
    CHECK (
      verification_method IN (
        'magic_link',
        'email_code',
        'magic_link_or_email_code',
        'webauthn',
        'telegram_assertion',
        'multi_proof',
        'none'
      )
    ),
  required_proof_policy TEXT NOT NULL DEFAULT 'single'
    CHECK (
      required_proof_policy IN (
        'single',
        'staff_login',
        'staff_recovery',
        'staff_break_glass'
      )
    ),
  token_hash TEXT,
  code_verifier TEXT,
  continuation_token_hash TEXT,
  webauthn_challenge_hash TEXT,
  initiation_state_hash TEXT,
  verifier_key_version INTEGER,
  fingerprint_key_version INTEGER NOT NULL
    CHECK (fingerprint_key_version >= 1),
  destination_fingerprint TEXT,
  request_ip_hash TEXT,
  request_user_agent_hash TEXT,
  request_device_hash TEXT,
  redirect_path TEXT,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'de', 'tr', 'ar', 'ru')),
  correlation_id TEXT NOT NULL,
  transition_id TEXT UNIQUE,
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  failed_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (failed_attempts >= 0 AND failed_attempts <= max_attempts),
  resend_not_before TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT,
  consumed_at TEXT,
  invalidated_at TEXT,
  expired_at TEXT,
  UNIQUE (id, auth_account_id, realm),
  UNIQUE (id, email_address_id, auth_account_id, realm),
  FOREIGN KEY (auth_account_id, realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  FOREIGN KEY (email_address_id, auth_account_id, realm)
    REFERENCES auth_email_addresses(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (initiating_session_id, auth_account_id, realm)
    REFERENCES auth_sessions(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  CHECK (
    (auth_account_id IS NULL AND expected_auth_version IS NULL)
    OR (auth_account_id IS NOT NULL AND expected_auth_version IS NOT NULL)
  ),
  CHECK (
    initiating_session_id IS NOT NULL
    OR purpose NOT IN (
      'email_enrollment',
      'email_change_new',
      'email_change_old_approval',
      'customer_email_step_up',
      'customer_passkey_step_up',
      'staff_passkey_step_up',
      'passkey_registration',
      'telegram_link',
      'customer_merge'
    )
  ),
  CHECK (
    status = 'suppressed'
    OR auth_account_id IS NOT NULL
    OR (
      realm = 'customer'
      AND purpose = 'passkey_authentication'
      AND verification_method = 'webauthn'
      AND email_address_id IS NULL
    )
  ),
  CHECK (
    status <> 'pending'
    OR (
      token_hash IS NOT NULL
      OR code_verifier IS NOT NULL
      OR continuation_token_hash IS NOT NULL
      OR webauthn_challenge_hash IS NOT NULL
      OR initiation_state_hash IS NOT NULL
    )
  ),
  CHECK (
    (code_verifier IS NULL AND verifier_key_version IS NULL)
    OR (code_verifier IS NOT NULL AND verifier_key_version IS NOT NULL)
  ),
  CHECK (
    status <> 'suppressed'
    OR (
      verification_method = 'none'
      AND token_hash IS NULL
      AND code_verifier IS NULL
      AND continuation_token_hash IS NULL
      AND webauthn_challenge_hash IS NULL
      AND initiation_state_hash IS NULL
      AND email_address_id IS NULL
    )
  ),
  CHECK (
    auth_account_id IS NOT NULL
    OR status IN ('pending', 'invalidated', 'expired', 'suppressed')
  ),
  CHECK (
    status <> 'pending'
    OR verification_method <> 'magic_link'
    OR token_hash IS NOT NULL
  ),
  CHECK (
    status <> 'pending'
    OR verification_method <> 'email_code'
    OR code_verifier IS NOT NULL
  ),
  CHECK (
    status <> 'pending'
    OR verification_method <> 'magic_link_or_email_code'
    OR (token_hash IS NOT NULL AND code_verifier IS NOT NULL)
  ),
  CHECK (
    status <> 'pending'
    OR verification_method <> 'webauthn'
    OR webauthn_challenge_hash IS NOT NULL
  ),
  CHECK (status <> 'verified' OR verified_at IS NOT NULL),
  CHECK (status <> 'consumed' OR consumed_at IS NOT NULL),
  CHECK (status <> 'invalidated' OR invalidated_at IS NOT NULL),
  CHECK (status <> 'expired' OR expired_at IS NOT NULL)
) STRICT;

CREATE UNIQUE INDEX ux_auth_challenges_token_hash
  ON auth_challenges(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE UNIQUE INDEX ux_auth_challenges_code_verifier
  ON auth_challenges(verifier_key_version, code_verifier)
  WHERE code_verifier IS NOT NULL;

CREATE UNIQUE INDEX ux_auth_challenges_continuation_token
  ON auth_challenges(continuation_token_hash)
  WHERE continuation_token_hash IS NOT NULL;

CREATE UNIQUE INDEX ux_auth_challenges_webauthn
  ON auth_challenges(webauthn_challenge_hash)
  WHERE webauthn_challenge_hash IS NOT NULL;

CREATE UNIQUE INDEX ux_auth_challenges_initiation_state
  ON auth_challenges(initiation_state_hash)
  WHERE initiation_state_hash IS NOT NULL;

CREATE UNIQUE INDEX ux_auth_challenges_active_account_purpose
  ON auth_challenges(auth_account_id, purpose)
  WHERE auth_account_id IS NOT NULL
    AND status IN ('pending', 'verified');

CREATE UNIQUE INDEX ux_auth_challenges_active_destination_purpose
  ON auth_challenges(
    realm,
    purpose,
    fingerprint_key_version,
    destination_fingerprint
  )
  WHERE destination_fingerprint IS NOT NULL
    AND status IN ('pending', 'verified');

CREATE INDEX idx_auth_challenges_expiry
  ON auth_challenges(status, expires_at);

CREATE INDEX idx_auth_challenges_request_ip
  ON auth_challenges(request_ip_hash, created_at);
```

A deliverable start/resend invalidates the previous pending or first-proof-verified challenge only inside the same atomic batch that persists its replacement challenge and outbox item. A resend suppressed by cooldown/rate policy leaves the existing usable challenge unchanged.

Every account-bound challenge snapshots `auth_accounts.auth_version` in
`expected_auth_version`; proof or continuation completion re-reads the account
and succeeds only when the values still match. A challenge whose purpose
is created by an authenticated session also stores that session's canonical
ID. For `email_enrollment`, customer/staff step-up, passkey registration,
Telegram linking, and customer merging, completion must resolve the presented
restricted/ordinary credential to that exact ID; request/device fingerprints
are risk signals and never substitute for this equality check. Email-change
proof routes are deliberately public token exchanges: their challenge and
workflow rows retain the initiating session as provenance and baseline state,
but completion ignores ambient cookies and activation revokes every session.

Most successful proofs move directly from `pending` to `consumed`. Staff recovery and cross-device customer email login move from `pending` to `verified`, then to `consumed` only after the required continuation step. A staff password step creates `purpose='passkey_authentication'` with `required_proof_policy='staff_login'` and independent hashes for its opaque continuation token and WebAuthn challenge; that public-login flow has no initiating ordinary session. Customer email starts may store an initiation-state hash so a same-device exchange can be distinguished from a forwarded/cross-device link. Each verifier is cleared when the step it authorizes is consumed.

`staff_enrollment_resume` is an account-bound, sessionless public challenge
against the already verified staff primary address. Completion consumes it,
rechecks `expected_auth_version`, and issues only a restricted enrollment
session whose checklist is reconstructed from canonical rows. It never
recreates an invitation or issues ordinary staff scope.

Unknown, disabled, ineligible, or destination-throttled public requests create a short-lived `suppressed` row containing only keyed fingerprints and timing metadata. They create no outbox row. The caller receives the same response shape as a deliverable request.

The only non-suppressed accountless challenge is a username-less customer `passkey_authentication` ceremony. Completion resolves the account from the globally unique credential ID and verified WebAuthn user handle; it never accepts a caller-supplied account ID.

### `auth_challenge_proofs`

```sql
CREATE TABLE auth_challenge_proofs (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  challenge_id TEXT NOT NULL,
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  proof_type TEXT NOT NULL
    CHECK (
      proof_type IN (
        'password',
        'email',
        'passkey',
        'recovery_code',
        'superadmin_approval',
        'break_glass'
      )
    ),
  passkey_credential_id TEXT,
  recovery_code_id TEXT,
  approving_account_id TEXT,
  approving_actor_ref TEXT
    CHECK (
      approving_actor_ref IS NULL
      OR length(approving_actor_ref) BETWEEN 1 AND 120
    ),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (challenge_id, proof_type),
  FOREIGN KEY (challenge_id, auth_account_id, realm)
    REFERENCES auth_challenges(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (passkey_credential_id, auth_account_id, realm)
    REFERENCES auth_passkey_credentials(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (recovery_code_id, auth_account_id, realm)
    REFERENCES auth_recovery_codes(id, auth_account_id, account_realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (approving_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  CHECK (
    (
      proof_type IN ('password', 'email')
      AND passkey_credential_id IS NULL
      AND recovery_code_id IS NULL
      AND approving_account_id IS NULL
      AND approving_actor_ref IS NULL
    )
    OR (
      proof_type = 'passkey'
      AND passkey_credential_id IS NOT NULL
      AND recovery_code_id IS NULL
      AND approving_account_id IS NULL
      AND approving_actor_ref IS NULL
    )
    OR (
      proof_type = 'recovery_code'
      AND passkey_credential_id IS NULL
      AND recovery_code_id IS NOT NULL
      AND approving_account_id IS NULL
      AND approving_actor_ref IS NULL
    )
    OR (
      proof_type = 'superadmin_approval'
      AND passkey_credential_id IS NULL
      AND recovery_code_id IS NULL
      AND approving_account_id IS NOT NULL
      AND approving_actor_ref IS NULL
    )
    OR (
      proof_type = 'break_glass'
      AND passkey_credential_id IS NULL
      AND recovery_code_id IS NULL
      AND approving_account_id IS NULL
      AND approving_actor_ref IS NOT NULL
    )
  )
) STRICT;
```

This table records that a proof succeeded, never the raw proof. Every completion route requires the challenge purpose fixed for that route; a step-up challenge cannot be consumed by login, recovery, registration, or another realm's endpoint.

For a staff recovery-code path, successful code completion inserts
`proof_type='recovery_code'` and atomically marks that code used. Recovery
replacement-passkey completion inserts `proof_type='passkey'` on the same
recovery or assisted-grant challenge and points to the newly created
credential. Every recovery authorization with
`replacement_passkey_required=true` snapshots the exact active pre-recovery
passkey IDs in the restricted session's `authorization_context_json`.
Replacement completion revokes every snapshotted credential while preserving
exactly the new passkey; password replacement requires that passkey proof and a
context whose snapshot has been fully revoked. The unique
`(challenge_id, proof_type)` constraint makes each proof single-use.

An audited Superadmin-assisted Admin grant uses a separate `purpose='break_glass'`, `required_proof_policy='staff_break_glass'` challenge and `proof_type='superadmin_approval'`; it may issue only `staff_recovery_authorized` for the named Admin and named recovery action. An owner-controlled Superadmin grant records `proof_type='break_glass'` and may issue only `break_glass`. `approving_actor_ref` is a non-PII runbook key/receipt identifier, not a person's name or contact detail. Neither proof is accepted by public recovery endpoints or normal login.

### `auth_staff_invitations`

```sql
CREATE TABLE auth_staff_invitations (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  account_realm TEXT NOT NULL DEFAULT 'staff'
    CHECK (account_realm = 'staff'),
  admin_user_id INTEGER NOT NULL,
  email_address_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL UNIQUE,
  invited_by_account_id TEXT,
  invited_by_realm TEXT
    CHECK (invited_by_realm IS NULL OR invited_by_realm = 'staff'),
  invited_by_actor_ref TEXT
    CHECK (
      invited_by_actor_ref IS NULL
      OR length(invited_by_actor_ref) BETWEEN 1 AND 120
    ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  resend_count INTEGER NOT NULL DEFAULT 0 CHECK (resend_count >= 0),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  revoked_at TEXT,
  expired_at TEXT,
  UNIQUE (id, auth_account_id),
  FOREIGN KEY (auth_account_id, account_realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  FOREIGN KEY (admin_user_id, auth_account_id)
    REFERENCES admin_users(id, auth_account_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (email_address_id, auth_account_id, account_realm)
    REFERENCES auth_email_addresses(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    challenge_id,
    email_address_id,
    auth_account_id,
    account_realm
  )
    REFERENCES auth_challenges(
      id,
      email_address_id,
      auth_account_id,
      realm
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (invited_by_account_id, invited_by_realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  CHECK (
    (
      invited_by_account_id IS NOT NULL
      AND invited_by_realm = 'staff'
      AND invited_by_actor_ref IS NULL
    )
    OR (
      invited_by_account_id IS NULL
      AND invited_by_realm IS NULL
      AND invited_by_actor_ref IS NOT NULL
    )
  ),
  CHECK (status <> 'accepted' OR accepted_at IS NOT NULL),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),
  CHECK (status <> 'expired' OR expired_at IS NOT NULL)
) STRICT;

CREATE UNIQUE INDEX ux_auth_staff_invitations_active_account
  ON auth_staff_invitations(auth_account_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX ux_auth_staff_invitations_active_profile
  ON auth_staff_invitations(admin_user_id)
  WHERE status = 'pending';

CREATE INDEX idx_auth_staff_invitations_status_expiry
  ON auth_staff_invitations(status, expires_at);

CREATE INDEX idx_auth_staff_invitations_inviter
  ON auth_staff_invitations(invited_by_account_id, created_at);
```

The username and authorization role remain on the linked pending `admin_users` profile. Normal API invitations identify a canonical staff inviter. The one-time environment-account bootstrap instead records a non-PII owner runbook receipt in `invited_by_actor_ref`; it never invents an inviter account. Resend applies only to `pending` or `expired`, never `accepted`; it replaces `challenge_id` atomically, increments `resend_count`, and for an expired row restores `status='pending'`, clears `expired_at`, and fixes a new 24-hour `expires_at`. It never creates or upserts another profile. Before the first protected Superadmin exists, only the owner maintenance reissue operation may resend its protected invitation.

Invitation acceptance atomically consumes the invitation challenge, marks the
invitation accepted, verifies its pending email, sets
`enrollment_state='in_progress'`, fixes `enrollment_deadline_at` to 72 hours
after acceptance for a pending account, and issues only `staff_enrollment`.
Expiry of that short session does not consume enrollment eligibility:
`staff_enrollment_resume` may reissue restricted scope after fresh email proof
only while the never-activated account remains `status='pending'` and the fixed
deadline has not passed. Active/disabled/previously activated staff are
ineligible because email-only resume is not privileged recovery.

After the deadline, a strong Superadmin may reauthorize an accepted invitation
whose linked account is never-activated and pending for another 72 hours
without recreating its profile or changing username/role/email; that transition
creates a new resume challenge/outbox item and security event. Before the first
protected Superadmin exists, only the owner-controlled non-public bootstrap
runbook may perform the same reauthorization. A protected invitation cannot be
revoked through the ordinary DELETE API.

### `auth_email_change_requests`

```sql
CREATE TABLE auth_email_change_requests (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  old_email_address_id TEXT NOT NULL,
  new_email_address_id TEXT NOT NULL,
  initiating_session_id TEXT NOT NULL,
  expected_auth_version INTEGER NOT NULL CHECK (expected_auth_version >= 1),
  new_verification_challenge_id TEXT NOT NULL UNIQUE,
  old_approval_challenge_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_new_verification'
    CHECK (
      status IN (
        'pending_new_verification',
        'awaiting_old_approval_or_delay',
        'approved',
        'cancelled',
        'activated',
        'expired'
      )
    ),
  activation_not_before TEXT,
  risk_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (risk_level IN ('low', 'standard', 'elevated')),
  old_address_unavailable INTEGER NOT NULL DEFAULT 0
    CHECK (old_address_unavailable IN (0, 1)),
  recovery_authorized_at TEXT,
  old_unavailable_grant_session_id TEXT,
  old_unavailable_grant_challenge_id TEXT,
  transition_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  new_verified_at TEXT,
  old_approved_at TEXT,
  cancelled_at TEXT,
  activated_at TEXT,
  expired_at TEXT,
  FOREIGN KEY (auth_account_id, realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  FOREIGN KEY (old_email_address_id, auth_account_id, realm)
    REFERENCES auth_email_addresses(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (new_email_address_id, auth_account_id, realm)
    REFERENCES auth_email_addresses(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (initiating_session_id, auth_account_id, realm)
    REFERENCES auth_sessions(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    old_unavailable_grant_session_id,
    auth_account_id,
    realm
  )
    REFERENCES auth_sessions(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    old_unavailable_grant_challenge_id,
    auth_account_id,
    realm
  )
    REFERENCES auth_challenges(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (
    new_verification_challenge_id,
    new_email_address_id,
    auth_account_id,
    realm
  )
    REFERENCES auth_challenges(
      id,
      email_address_id,
      auth_account_id,
      realm
    )
    ON DELETE RESTRICT,
  FOREIGN KEY (
    old_approval_challenge_id,
    old_email_address_id,
    auth_account_id,
    realm
  )
    REFERENCES auth_challenges(
      id,
      email_address_id,
      auth_account_id,
      realm
    )
    ON DELETE RESTRICT,
  CHECK (old_email_address_id <> new_email_address_id),
  CHECK (
    status <> 'awaiting_old_approval_or_delay'
    OR new_verified_at IS NOT NULL
  ),
  CHECK (status <> 'approved' OR old_approved_at IS NOT NULL),
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),
  CHECK (status <> 'activated' OR activated_at IS NOT NULL),
  CHECK (status <> 'expired' OR expired_at IS NOT NULL),
  CHECK (
    (
      old_address_unavailable = 0
      AND recovery_authorized_at IS NULL
      AND old_unavailable_grant_session_id IS NULL
      AND old_unavailable_grant_challenge_id IS NULL
    )
    OR (
      old_address_unavailable = 1
      AND realm = 'staff'
      AND recovery_authorized_at IS NOT NULL
      AND old_unavailable_grant_session_id IS NOT NULL
      AND old_unavailable_grant_challenge_id IS NOT NULL
    )
  )
) STRICT;

CREATE UNIQUE INDEX ux_auth_email_change_active_account
  ON auth_email_change_requests(auth_account_id)
  WHERE status IN (
    'pending_new_verification',
    'awaiting_old_approval_or_delay',
    'approved'
  );

CREATE INDEX idx_auth_email_change_activation
  ON auth_email_change_requests(status, activation_not_before);
```

The old verified primary remains active until the request activates. Start
records the exact initiating session and account-version baseline. Contract
version 1 writes `risk_level='standard'` for every request; other stored values
are reserved and fail closed until a reviewed classifier amends the API
contract. The old-address approval/cancellation challenge is mandatory for
every request, and start persists that challenge plus both new- and old-address
outbox items in the same atomic batch as the request. Activation refuses a
request whose old challenge or durable old-address notification is absent.
Activation
replaces the primary address and invalidates competing email-change/recovery
challenges in one D1 transaction. The activation compare-and-set writes
`transition_id`; every address/session/event/outbox mutation in the batch is
gated on that exact request marker. It first rechecks the request status and due
time, `auth_accounts.status='active'`,
`auth_accounts.auth_version=expected_auth_version`, the unchanged old primary,
the new proof, realm uniqueness, and the applicable approval/hold rule. All
customer and staff sessions are revoked on activation and fresh login is
required; a public token exchange or scheduled job never tries to return a
replacement for the initiating session.

A staff request may set `old_address_unavailable=1` only after a
`staff_recovery_authorized` Superadmin-assisted Admin grant or owner
`break_glass` grant. The authorization transition stores both the exact
purpose-bound session and its originating challenge, verifies their account,
realm, scope/method, and active state, and then imposes at least 24 hours from
`recovery_authorized_at`.

### `auth_sessions`

```sql
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  token_hash TEXT NOT NULL UNIQUE,
  token_hash_version INTEGER NOT NULL DEFAULT 1
    CHECK (token_hash_version >= 1),
  created_transition_id TEXT NOT NULL UNIQUE,
  issued_auth_version INTEGER NOT NULL CHECK (issued_auth_version >= 1),
  scope TEXT NOT NULL
    CHECK (
      scope IN (
        'customer_guest',
        'customer_verified',
        'staff_password_limited',
        'staff_strong',
        'staff_enrollment',
        'staff_recovery_email',
        'staff_recovery_authorized',
        'break_glass'
      )
    ),
  assurance_level INTEGER NOT NULL CHECK (assurance_level BETWEEN 0 AND 2),
  auth_methods_json TEXT NOT NULL DEFAULT '[]'
    CHECK (
      json_valid(auth_methods_json)
      AND json_type(auth_methods_json) = 'array'
    ),
  authorization_context_json TEXT NOT NULL DEFAULT '{}'
    CHECK (
      json_valid(authorization_context_json)
      AND json_type(authorization_context_json) = 'object'
    ),
  session_transport TEXT NOT NULL
    CHECK (session_transport IN ('cookie', 'bearer')),
  csrf_token_hash TEXT,
  client_platform TEXT NOT NULL
    CHECK (
      client_platform IN (
        'admin_web',
        'admin_android',
        'admin_ios',
        'customer_web',
        'telegram_mini_app',
        'customer_android',
        'customer_ios'
      )
    ),
  app_version TEXT,
  device_label TEXT CHECK (device_label IS NULL OR length(device_label) <= 120),
  installation_id_hash TEXT,
  rotated_from_session_id TEXT,
  rotated_to_session_id TEXT,
  rotation_transition_id TEXT UNIQUE,
  authenticated_at TEXT NOT NULL,
  strong_authenticated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revocation_reason TEXT,
  UNIQUE (id, auth_account_id, realm),
  FOREIGN KEY (auth_account_id, realm)
    REFERENCES auth_accounts(id, realm) ON DELETE RESTRICT,
  FOREIGN KEY (rotated_from_session_id, auth_account_id, realm)
    REFERENCES auth_sessions(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (rotated_to_session_id, auth_account_id, realm)
    REFERENCES auth_sessions(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  CHECK (
    (
      realm = 'customer'
      AND scope IN ('customer_guest', 'customer_verified')
      AND client_platform IN (
        'customer_web',
        'telegram_mini_app',
        'customer_android',
        'customer_ios'
      )
    )
    OR (
      realm = 'staff'
      AND scope IN (
        'staff_password_limited',
        'staff_strong',
        'staff_enrollment',
        'staff_recovery_email',
        'staff_recovery_authorized',
        'break_glass'
      )
      AND client_platform IN ('admin_web', 'admin_android', 'admin_ios')
    )
  ),
  CHECK (
    (session_transport = 'cookie' AND csrf_token_hash IS NOT NULL)
    OR (session_transport = 'bearer' AND csrf_token_hash IS NULL)
  ),
  CHECK (
    (
      client_platform IN ('admin_web', 'customer_web', 'telegram_mini_app')
      AND session_transport = 'cookie'
    )
    OR (
      client_platform IN (
        'admin_android',
        'admin_ios',
        'customer_android',
        'customer_ios'
      )
      AND session_transport = 'bearer'
    )
  ),
  CHECK (
    (
      scope IN (
        'customer_guest',
        'customer_verified',
        'staff_password_limited',
        'staff_strong'
      )
      AND authorization_context_json = '{}'
    )
    OR (
      scope IN (
        'staff_enrollment',
        'staff_recovery_email',
        'staff_recovery_authorized',
        'break_glass'
      )
      AND authorization_context_json <> '{}'
    )
  ),
  CHECK (
    rotated_to_session_id IS NULL
    OR rotation_transition_id IS NOT NULL
  )
) STRICT;

CREATE INDEX idx_auth_sessions_active_account
  ON auth_sessions(auth_account_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_sessions_expiry
  ON auth_sessions(revoked_at, expires_at);
```

The raw 256-bit session token is returned once. D1 stores only its cryptographic hash. `installation_id_hash` is metadata and MUST NOT select an account or authorize a session. A restricted session's canonical `authorization_context_json` contains its challenge/grant ID, enrollment stage, and a closed `allowed_actions` list; middleware rejects an action not named there even when the broad scope matches. An all-authenticator-loss grant additionally stores `replacement_passkey_required=true` and a sorted, duplicate-free array of the exact active `pre_recovery_passkey_ids`; session rotation copies that context without weakening it until the replacement transaction marks the gate satisfied. Ordinary sessions always store `{}`.

A rotation first conditionally writes the old row's `rotation_transition_id`, `revoked_at`, and reason. Insertion of the replacement session is gated on that exact transition marker; a final gated update records its ID in `rotated_to_session_id`. A failed batch rolls all three statements back.

### `auth_email_outbox`

```sql
CREATE TABLE auth_email_outbox (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  challenge_id TEXT,
  security_event_id TEXT,
  email_address_id TEXT NOT NULL,
  auth_account_id TEXT NOT NULL,
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  template_key TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'de', 'tr', 'ar', 'ru')),
  payload_ciphertext BLOB,
  payload_iv BLOB,
  encryption_key_version INTEGER NOT NULL CHECK (encryption_key_version >= 1),
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'leased',
        'retry',
        'sent',
        'failed',
        'expired',
        'cancelled'
      )
    ),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0 AND attempt_count <= max_attempts),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_id TEXT,
  lease_expires_at TEXT,
  expires_at TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  discarded_at TEXT,
  FOREIGN KEY (challenge_id, email_address_id, auth_account_id, realm)
    REFERENCES auth_challenges(id, email_address_id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (email_address_id, auth_account_id, realm)
    REFERENCES auth_email_addresses(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (security_event_id, auth_account_id)
    REFERENCES auth_security_events(id, subject_account_id)
    ON DELETE RESTRICT,
  CHECK (
    (challenge_id IS NOT NULL AND security_event_id IS NULL)
    OR (challenge_id IS NULL AND security_event_id IS NOT NULL)
  ),
  CHECK (
    (status = 'leased' AND lease_id IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'leased' AND lease_id IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK (status <> 'sent' OR sent_at IS NOT NULL),
  CHECK (
    status NOT IN ('sent', 'failed', 'expired', 'cancelled')
    OR (
      discarded_at IS NOT NULL
      AND payload_ciphertext IS NULL
      AND payload_iv IS NULL
    )
  ),
  CHECK (
    status NOT IN ('pending', 'leased', 'retry')
    OR (
      payload_ciphertext IS NOT NULL
      AND payload_iv IS NOT NULL
    )
  )
) STRICT;

CREATE UNIQUE INDEX ux_auth_email_outbox_challenge
  ON auth_email_outbox(challenge_id)
  WHERE challenge_id IS NOT NULL;

CREATE INDEX idx_auth_email_outbox_dispatch
  ON auth_email_outbox(status, available_at, expires_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX idx_auth_email_outbox_lease
  ON auth_email_outbox(status, lease_expires_at)
  WHERE status = 'leased';
```

Challenge mail references `challenge_id`. Password/credential/recovery/session security notifications reference `security_event_id`. The Worker encrypts the short-lived delivery payload before inserting it. D1 provides persistence, not application-level payload encryption.

The dispatcher MUST claim work with one conditional update equivalent to:

```sql
UPDATE auth_email_outbox
SET status = 'leased',
    lease_id = ?,
    lease_expires_at = ?,
    attempt_count = attempt_count + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
  AND datetime(expires_at) > datetime('now')
  AND attempt_count < max_attempts
  AND (
    (
      status IN ('pending', 'retry')
      AND datetime(available_at) <= datetime('now')
    )
    OR (
      status = 'leased'
      AND datetime(lease_expires_at) <= datetime('now')
    )
  );
```

The transaction fails unless exactly one row is claimed. For challenge mail the dispatcher re-checks that the challenge remains pending and unexpired. For event-backed notification mail it re-checks the event/subject relationship and outbox expiry; it does not require a challenge. It tolerates at-least-once execution and clears ciphertext/IV on every terminal transition. D1 has no `SELECT FOR UPDATE`.

### `auth_idempotency_keys`

```sql
CREATE TABLE auth_idempotency_keys (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  operation TEXT NOT NULL,
  hash_key_version INTEGER NOT NULL CHECK (hash_key_version >= 1),
  subject_scope_hash TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  response_status INTEGER,
  response_payload_ciphertext BLOB,
  response_payload_iv BLOB,
  response_key_version INTEGER,
  resource_type TEXT,
  resource_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  UNIQUE (
    realm,
    operation,
    hash_key_version,
    subject_scope_hash,
    key_hash
  ),
  CHECK (
    status <> 'completed'
    OR (
      response_status IS NOT NULL
      AND response_payload_ciphertext IS NOT NULL
      AND response_payload_iv IS NOT NULL
      AND response_key_version IS NOT NULL
      AND completed_at IS NOT NULL
    )
  )
) STRICT;

CREATE INDEX idx_auth_idempotency_expiry
  ON auth_idempotency_keys(expires_at);
```

`operation` is the canonical HTTP method plus normalized route template, for example `POST /api/v1/customer/auth/guest`. Every client-visible result, including a deterministic safe 4xx result, becomes `completed` with an encrypted replayable response. An unexpected internal failure before any state transition removes/expires the `in_progress` reservation so a retry can run; state mutation and idempotency completion are one atomic batch. Secret-bearing responses are encrypted and retained for at most 10 minutes. Other mutation receipts are retained for at most 24 hours. Raw access tokens and recovery codes are never stored in plaintext.

### `auth_replay_guards`

```sql
CREATE TABLE auth_replay_guards (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  namespace TEXT NOT NULL
    CHECK (
      namespace IN (
        'telegram_init_data',
        'magic_link_exchange',
        'webauthn_ceremony'
      )
    ),
  fingerprint_key_version INTEGER NOT NULL
    CHECK (fingerprint_key_version >= 1),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  UNIQUE (namespace, fingerprint_key_version, fingerprint)
) STRICT;

CREATE INDEX idx_auth_replay_guards_expiry
  ON auth_replay_guards(expires_at);
```

Fingerprints are server-keyed. Raw Telegram `initData`, link tokens, and WebAuthn challenges are never stored here.

### `auth_rate_limit_buckets`

```sql
CREATE TABLE auth_rate_limit_buckets (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  dimension TEXT NOT NULL
    CHECK (
      dimension IN (
        'account',
        'identifier',
        'destination',
        'ip',
        'device',
        'system'
      )
    ),
  subject_key_version INTEGER NOT NULL CHECK (subject_key_version >= 1),
  subject_hash TEXT NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  blocked_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  UNIQUE (
    dimension,
    subject_key_version,
    subject_hash,
    window_seconds,
    window_started_at
  )
) STRICT;

CREATE INDEX idx_auth_rate_limit_expiry
  ON auth_rate_limit_buckets(expires_at);
```

Bucket subjects are HMAC fingerprints. Full email addresses, IP addresses, device identifiers, and Telegram payloads are forbidden.

### `auth_security_events`

```sql
CREATE TABLE auth_security_events (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  event_type TEXT NOT NULL
    CHECK (
      length(event_type) BETWEEN 3 AND 80
      AND event_type = lower(event_type)
      AND event_type NOT GLOB '*[^a-z0-9._-]*'
    ),
  outcome TEXT NOT NULL
    CHECK (outcome IN ('accepted', 'success', 'failure', 'denied', 'error')),
  subject_account_id TEXT,
  actor_account_id TEXT,
  actor_role TEXT,
  correlation_id TEXT NOT NULL,
  fingerprint_key_version INTEGER NOT NULL
    CHECK (fingerprint_key_version >= 1),
  request_ip_hash TEXT,
  request_user_agent_hash TEXT,
  request_device_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(metadata_json)),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, subject_account_id),
  FOREIGN KEY (subject_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_auth_security_events_subject
  ON auth_security_events(subject_account_id, occurred_at);

CREATE INDEX idx_auth_security_events_actor
  ON auth_security_events(actor_account_id, occurred_at);

CREATE INDEX idx_auth_security_events_type
  ON auth_security_events(event_type, occurred_at);

CREATE INDEX idx_auth_security_events_correlation
  ON auth_security_events(correlation_id);
```

Only the authentication/security service may append. There is no ordinary update/delete API.

### `auth_security_event_exports`

```sql
CREATE TABLE auth_security_event_exports (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  security_event_id TEXT NOT NULL
    CHECK (
      length(security_event_id) = 32
      AND security_event_id NOT GLOB '*[^0-9a-f]*'
    ),
  archive_system TEXT NOT NULL
    CHECK (
      length(archive_system) BETWEEN 1 AND 80
      AND archive_system = lower(archive_system)
      AND archive_system NOT GLOB '*[^a-z0-9._-]*'
    ),
  archive_record_id TEXT NOT NULL
    CHECK (length(archive_record_id) BETWEEN 1 AND 255),
  content_digest_sha256 TEXT NOT NULL
    CHECK (
      length(content_digest_sha256) = 64
      AND content_digest_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
  exported_at TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (security_event_id, archive_system)
) STRICT;

CREATE INDEX idx_auth_security_event_exports_verified
  ON auth_security_event_exports(security_event_id, verified_at);

CREATE TRIGGER trg_auth_security_event_exports_source_bi
BEFORE INSERT ON auth_security_event_exports
WHEN NOT EXISTS (
  SELECT 1
  FROM auth_security_events
  WHERE id = NEW.security_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'security event export source missing');
END;
```

`security_event_id` deliberately has no D1 foreign key: the verified receipt
must survive retention deletion of the source event. The export worker may
insert a receipt only after the source event exists, the archive write
completes, and a read-after-write integrity check matches
`content_digest_sha256`. The fixed `BEFORE INSERT` trigger also rejects a receipt
whose source event no longer exists; the controlled retention job verifies the
relationship again before deletion. An enqueue receipt is insufficient.

Retention cleanup is permitted only through the controlled process in ADR-0005. Before deleting a break-glass, Superadmin-assisted recovery, protected-account change, or security-hold event, the cleanup batch MUST find at least one verified export receipt whose digest matches the canonical exported event. Other event classes follow the approved retention schedule, but no deletion is exposed through an Admin/Superadmin API.

Because notification outbox rows retain an intentional `ON DELETE RESTRICT`
reference to their source event, the retention process first verifies terminal
outbox state and its own retention window, deletes that terminal outbox row,
then deletes the eligible event. It never weakens or disables foreign-key
checks.

## Exact legacy columns

`0014` adds:

```sql
ALTER TABLE customers
  ADD COLUMN auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

ALTER TABLE admin_users
  ADD COLUMN auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

ALTER TABLE admin_users
  ADD COLUMN username_normalized TEXT;

ALTER TABLE admin_users
  ADD COLUMN is_protected INTEGER NOT NULL DEFAULT 0
  CHECK (is_protected IN (0, 1));

ALTER TABLE customer_app_sessions
  ADD COLUMN auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

ALTER TABLE customer_app_sessions
  ADD COLUMN issued_auth_version INTEGER
  CHECK (issued_auth_version IS NULL OR issued_auth_version >= 1);

ALTER TABLE admin_token_revocations
  ADD COLUMN auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

ALTER TABLE admin_audit_logs
  ADD COLUMN actor_auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX ux_admin_users_id_auth_account
  ON admin_users(id, auth_account_id);
```

`ux_admin_users_id_auth_account` MUST exist before `auth_staff_invitations` is created and before any `admin_users.auth_account_id` update. Otherwise SQLite reports a foreign-key mismatch for the invitation composite reference.

After the backfill and assertions succeed, create the remaining indexes:

```sql
CREATE UNIQUE INDEX ux_customers_auth_account_id
  ON customers(auth_account_id)
  WHERE auth_account_id IS NOT NULL;

CREATE UNIQUE INDEX ux_admin_users_auth_account_id
  ON admin_users(auth_account_id)
  WHERE auth_account_id IS NOT NULL;

CREATE UNIQUE INDEX ux_admin_users_username_normalized
  ON admin_users(username_normalized)
  WHERE username_normalized IS NOT NULL;

CREATE INDEX idx_customer_app_sessions_auth_account
  ON customer_app_sessions(auth_account_id, is_active, expires_at);

CREATE INDEX idx_admin_token_revocations_auth_account
  ON admin_token_revocations(auth_account_id, expires_at);

CREATE INDEX idx_admin_audit_logs_actor_account
  ON admin_audit_logs(actor_auth_account_id, created_at);
```

Staff usernames use `trim`, Unicode NFC, and lowercase in Worker code. Existing usernames outside the approved ASCII syntax `[a-z0-9._-]` require an explicit migration decision; the migration MUST NOT silently rename them.

## Ordered backfill

### Staging map

`0014` creates and later drops:

```sql
CREATE TABLE _auth_0014_profile_map (
  realm TEXT NOT NULL CHECK (realm IN ('customer', 'staff')),
  profile_id INTEGER NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  webauthn_user_handle TEXT NOT NULL UNIQUE,
  profile_status TEXT NOT NULL CHECK (
    profile_status IN ('active', 'disabled')
  ),
  enrollment_state TEXT NOT NULL,
  profile_created_at TEXT NOT NULL,
  PRIMARY KEY (realm, profile_id)
) STRICT;
```

### Customer mapping

One account is created for every current `customers` row, including synthetic `app:<uuid>` profiles.

```sql
INSERT INTO _auth_0014_profile_map (
  realm,
  profile_id,
  account_id,
  webauthn_user_handle,
  profile_status,
  enrollment_state,
  profile_created_at
)
SELECT
  'customer',
  id,
  lower(hex(randomblob(16))),
  lower(hex(randomblob(16))),
  'active',
  'not_required',
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM customers;
```

`customers.is_blocked` is a business control; it MUST NOT be converted into an authentication disable state.

### Database staff mapping

```sql
INSERT INTO _auth_0014_profile_map (
  realm,
  profile_id,
  account_id,
  webauthn_user_handle,
  profile_status,
  enrollment_state,
  profile_created_at
)
SELECT
  'staff',
  id,
  lower(hex(randomblob(16))),
  lower(hex(randomblob(16))),
  CASE WHEN is_active = 1 THEN 'active' ELSE 'disabled' END,
  'required',
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM admin_users;
```

No enrollment deadline is set until the privileged enrollment feature is enabled.

### Account and profile insertion

```sql
INSERT INTO auth_accounts (
  id,
  webauthn_user_handle,
  realm,
  status,
  enrollment_state,
  disabled_reason,
  disabled_at,
  created_at,
  updated_at
)
SELECT
  account_id,
  webauthn_user_handle,
  realm,
  profile_status,
  enrollment_state,
  CASE WHEN profile_status = 'disabled' THEN 'administrative' ELSE NULL END,
  CASE WHEN profile_status = 'disabled' THEN CURRENT_TIMESTAMP ELSE NULL END,
  profile_created_at,
  CURRENT_TIMESTAMP
FROM _auth_0014_profile_map;

UPDATE customers
SET auth_account_id = (
  SELECT account_id
  FROM _auth_0014_profile_map
  WHERE realm = 'customer'
    AND profile_id = customers.id
);

UPDATE admin_users
SET auth_account_id = (
      SELECT account_id
      FROM _auth_0014_profile_map
      WHERE realm = 'staff'
        AND profile_id = admin_users.id
    ),
    username_normalized = lower(trim(username));
```

Until the legacy customer profile column is rebuilt, canonical guest creation
uses the same atomic account/profile transaction and writes exactly
`customers.telegram_user_id = 'app:' || auth_accounts.id`. The canonical
32-lowercase-hex account ID is generated first. This synthetic value satisfies
the existing `NOT NULL UNIQUE` constraint but is compatibility/display data
only: it is never treated as a Telegram subject, credential, or account lookup
input, and clients cannot supply it.

### Database staff legacy credentials

```sql
INSERT INTO auth_password_credentials (
  id,
  auth_account_id,
  account_realm,
  verifier,
  algorithm,
  algorithm_version,
  parameters_json,
  pepper_key_version,
  needs_upgrade,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))),
  auth_account_id,
  'staff',
  password_hash,
  'legacy_sha256_admin_jwt_secret_v1',
  1,
  '{"digest":"SHA-256","input":"utf8_secret_colon_password","encoding":"lower_hex"}',
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM admin_users;
```

### Legacy session, revocation, and audit bridges

```sql
UPDATE customer_app_sessions
SET auth_account_id = (
      SELECT c.auth_account_id
      FROM customers c
      WHERE c.id = customer_app_sessions.customer_id
    ),
    issued_auth_version = 1;

UPDATE admin_token_revocations
SET auth_account_id = (
  SELECT u.auth_account_id
  FROM admin_users u
  WHERE u.username_normalized = lower(trim(admin_token_revocations.username))
  LIMIT 1
)
WHERE username IS NOT NULL;

UPDATE admin_audit_logs
SET actor_auth_account_id = (
  SELECT u.auth_account_id
  FROM admin_users u
  WHERE u.username_normalized = lower(trim(admin_audit_logs.admin_username))
  LIMIT 1
)
WHERE admin_username IS NOT NULL;
```

Null mappings for environment staff are expected until controlled reconciliation.

## Exact trigger contract

SQLite cannot add a table-level composite foreign key to an existing table through `ALTER TABLE`. `0014` therefore adds `BEFORE INSERT` and corresponding link-column `BEFORE UPDATE` triggers for:

- `customers`: referenced account MUST have realm `customer`
- `admin_users`: referenced account MUST have realm `staff`
- `customer_app_sessions`: referenced account MUST match the linked customer account

Each trigger uses `SELECT RAISE(ABORT, 'auth realm/link invariant failed')` when the invariant is false. Tests MUST cover both insert and update paths.

The implementation names and timing are fixed:

| Trigger | Timing/event | Required predicate and effect |
|---|---|---|
| `trg_customers_auth_realm_bi` | `BEFORE INSERT ON customers` | A non-null link must resolve to a customer account |
| `trg_customers_auth_realm_bu` | `BEFORE UPDATE OF auth_account_id ON customers` | New non-null link must resolve to a customer account |
| `trg_admin_users_auth_realm_bi` | `BEFORE INSERT ON admin_users` | A non-null link must resolve to a staff account |
| `trg_admin_users_auth_realm_bu` | `BEFORE UPDATE OF auth_account_id ON admin_users` | New non-null link must resolve to a staff account |
| `trg_customer_sessions_auth_link_bi` | `BEFORE INSERT ON customer_app_sessions` | A non-null session link must equal the linked customer's account; a null link is allowed only when that customer already has a non-null canonical link, for the bounded legacy `AFTER INSERT` bridge |
| `trg_customer_sessions_auth_link_bu` | `BEFORE UPDATE OF customer_id, auth_account_id ON customer_app_sessions` | New session link must be non-null and exactly equal the linked customer's account |
| `trg_admin_users_username_guard_bu` | `BEFORE UPDATE OF username ON admin_users` | Reject empty, untrimmed, non-ASCII-syntax, or normalized-colliding usernames before mutation |
| `trg_admin_users_password_sentinel_guard_bu` | `BEFORE UPDATE OF password_hash ON admin_users` | A changed sentinel value is allowed only when the linked account has no active legacy password credential |

The migration implementation record MUST contain the final `sqlite_master.sql` text and SHA-256 digest of each named trigger. Review approval compares that record to this table before remote execution; an unnamed or differently timed substitute is a contract change.

### Temporary compatibility triggers

Until all writes use the canonical identity service, `0014` MUST add these narrowly scoped bridges:

1. A legacy `customers` insert with a null link creates a customer account and links it.
2. A legacy `admin_users` insert validates a non-empty, already-trimmed ASCII username matching `[A-Za-z0-9._-]+`, sets `username_normalized=lower(username)`, and aborts on a normalized collision. When its link is null, it then creates a staff account, links it, and registers a valid 64-lowercase-hex legacy verifier.
3. A changed legacy database staff password hash revokes the old legacy credential; it inserts a replacement only when the new value is a valid legacy 64-hex verifier. It also increments `auth_version`, sets `legacy_sessions_revoked_before`, and revokes canonical sessions/challenges. The bridge runs only when `OLD.password_hash IS NOT NEW.password_hash` and the new value is not `!canonical-auth-disabled!`. A separate guard permits that sentinel only after the canonical batch has already revoked every active legacy password credential for the account. Before canonical sessions are enabled, every old Web/API password route MUST delegate to the canonical service; direct `app_settings` override changes are disabled.
4. A changed legacy `admin_users.is_active` value mirrors `auth_accounts.status`, increments `auth_version`, and sets `legacy_sessions_revoked_before` only when the account does not already represent the new mirror value. A direct legacy disable is allowed only from `active` and sets `disabled_reason='administrative'`/`disabled_at`; a direct legacy reactivation is allowed only from `disabled_reason='administrative'`. Pending, deleted, protected, last-active-Superadmin, security-hold, owner-requested, and enrollment-expired reactivation paths abort unless the canonical service has already completed the separately authorized account transition.
5. A legacy profile hard delete marks the account deleted and increments `auth_version`; it does not delete the account. A `BEFORE DELETE` guard rejects a protected staff profile, self-delete at the service layer, or deletion of the last active Superadmin before any row is removed.
6. A legacy `admin_users.username` update applies the same validation and normalization only when `OLD.username IS NOT NEW.username`, increments `auth_version`, sets `legacy_sessions_revoked_before`, and revokes canonical sessions and challenges so old username-bearing Admin JWTs cannot survive the rename. No canonical username-mutation API is permitted while this compatibility trigger exists; this trigger owns the sole transition.
7. A legacy `customer_app_sessions` insert fills `auth_account_id` and `issued_auth_version` from its customer.

The triggers:

- MUST use cryptographically random SQL IDs
- MUST fail the outer write if canonical linking fails
- MUST NOT send email or write external services
- MUST be removed after canonical dual-write is verified

Their fixed names are `trg_customers_auth_bridge_ai`,
`trg_admin_users_auth_bridge_ai`, `trg_admin_users_password_bridge_au`,
`trg_admin_users_password_sentinel_guard_bu`,
`trg_admin_users_active_bridge_au`, `trg_admin_users_username_guard_bu`,
`trg_admin_users_username_bridge_au`, `trg_customers_auth_bridge_bd`,
`trg_admin_users_auth_bridge_bd`, and
`trg_customer_sessions_auth_bridge_ai`.
`trg_admin_users_auth_bridge_ai` performs the insert-time username validation
and normalization before its conditional account/credential bridge; its update
of `username_normalized` is part of the same outer statement and a unique-index
failure aborts everything. `trg_admin_users_username_bridge_au` performs the
username-update normalization and revocation transition after the
`trg_admin_users_username_guard_bu` validation.

Canonical password/account-status operations are canonical-root-first and
legacy-mirror-last in one D1 batch. A canonical password upgrade/replacement
first claims `auth_accounts.last_transition_id`, revokes the active legacy
credential, and creates the new credential; only then may it write the sentinel
to `admin_users.password_hash`. The sentinel guard proves no active legacy
credential remains, and the password bridge performs no second transition. A
canonical status operation first completes the account CAS, version/revocation
work, and safety checks; only then does it mirror `admin_users.is_active`. The
active bridge compares the already-written canonical status and performs no
second transition or disable-reason rewrite when they match. Every `UPDATE OF`
bridge additionally tests an actual null-safe `OLD ... IS NOT NEW ...` change.
Tests MUST cover both canonical no-op mirror paths and direct-legacy bridge
paths.

The session bridge is `AFTER INSERT` because SQLite does not support assignment
to `NEW` column values; it updates the just-created row and aborts the outer
statement if the customer or canonical link is missing. The two staff delete
protections run in `trg_admin_users_auth_bridge_bd`; the service-layer
self-delete check is additional and mandatory because a trigger cannot identify
the authenticated actor safely.

Before remote use, a local integration test MUST prove that trigger-internal inserts do not change the `last_row_id` observed by existing customer/profile creation code.

## Preflight

The following production read-only checks MUST be saved as a redacted artifact before applying `0014`.

```sql
PRAGMA foreign_key_check;

SELECT COUNT(*) AS invalid_admin_rows
FROM admin_users
WHERE trim(username) = ''
   OR username <> trim(username)
   OR lower(trim(username)) GLOB '*[^a-z0-9._-]*'
   OR role NOT IN ('admin', 'superadmin')
   OR is_active NOT IN (0, 1)
   OR length(password_hash) <> 64
   OR password_hash <> lower(password_hash)
   OR lower(password_hash) GLOB '*[^0-9a-f]*';

SELECT lower(trim(username)) AS folded_username, COUNT(*) AS row_count
FROM admin_users
GROUP BY lower(trim(username))
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS orphan_customer_sessions
FROM customer_app_sessions s
LEFT JOIN customers c ON c.id = s.customer_id
WHERE c.id IS NULL;

SELECT name
FROM sqlite_master
WHERE name LIKE 'auth_%'
   OR name IN (
     'ux_customers_auth_account_id',
     'ux_admin_users_auth_account_id',
     'ux_admin_users_username_normalized'
   );
```

The operator also records counts, never secret values, for:

- customers
- numeric Telegram IDs
- synthetic `app:%` identities
- active and total customer sessions
- active and inactive database staff
- Admin and Superadmin roles
- populated legacy override/reset setting keys

The reconciliation tool binds environment usernames without printing them and aborts on:

- missing or equal Admin/Superadmin usernames
- environment Admin/Superadmin usernames failing the same trimmed ASCII syntax or colliding after lowercase normalization
- exact collision
- normalized/case-folded collision
- collision with a database-backed staff row
- an unexpected role association

## In-migration assertions

Before `0014` drops its staging table, it creates a temporary ordinary assertion table:

```sql
CREATE TABLE _auth_0014_assertions (
  assertion_name TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL CHECK (failure_count = 0)
) STRICT;
```

The exact assertion inserts are:

```sql
INSERT INTO _auth_0014_assertions
SELECT 'customers_unlinked', COUNT(*)
FROM customers WHERE auth_account_id IS NULL;

INSERT INTO _auth_0014_assertions
SELECT 'staff_unlinked', COUNT(*)
FROM admin_users WHERE auth_account_id IS NULL;

INSERT INTO _auth_0014_assertions
SELECT 'customer_wrong_realm', COUNT(*)
FROM customers c
JOIN auth_accounts a ON a.id = c.auth_account_id
WHERE a.realm <> 'customer';

INSERT INTO _auth_0014_assertions
SELECT 'staff_wrong_realm', COUNT(*)
FROM admin_users u
JOIN auth_accounts a ON a.id = u.auth_account_id
WHERE a.realm <> 'staff';

INSERT INTO _auth_0014_assertions
SELECT 'duplicate_profile_links', COUNT(*)
FROM (
  SELECT auth_account_id
  FROM customers
  WHERE auth_account_id IS NOT NULL
  GROUP BY auth_account_id HAVING COUNT(*) <> 1
  UNION ALL
  SELECT auth_account_id
  FROM admin_users
  WHERE auth_account_id IS NOT NULL
  GROUP BY auth_account_id HAVING COUNT(*) <> 1
);

INSERT INTO _auth_0014_assertions
SELECT 'staff_status_mismatch', COUNT(*)
FROM admin_users u
JOIN auth_accounts a ON a.id = u.auth_account_id
WHERE (u.is_active = 1 AND a.status <> 'active')
   OR (u.is_active = 0 AND a.status <> 'disabled');

INSERT INTO _auth_0014_assertions
SELECT 'customer_session_bridge_mismatch', COUNT(*)
FROM customer_app_sessions s
JOIN customers c ON c.id = s.customer_id
JOIN auth_accounts a ON a.id = c.auth_account_id
WHERE s.auth_account_id IS NULL
   OR s.auth_account_id <> c.auth_account_id
   OR s.issued_auth_version <> a.auth_version;

INSERT INTO _auth_0014_assertions
SELECT 'staff_legacy_credential_missing', COUNT(*)
FROM admin_users u
LEFT JOIN auth_password_credentials p
  ON p.auth_account_id = u.auth_account_id
 AND p.revoked_at IS NULL
WHERE p.id IS NULL OR p.needs_upgrade <> 1;

INSERT INTO _auth_0014_assertions
SELECT 'foreign_key_violation', COUNT(*)
FROM pragma_foreign_key_check;
```

Any nonzero result violates the `CHECK`, aborting and rolling back the migration. The assertion table and staging map are dropped only after every insert succeeds.

## Post-migration verification

Each query below MUST return zero rows or a count of zero:

```sql
SELECT COUNT(*) FROM customers WHERE auth_account_id IS NULL;
SELECT COUNT(*) FROM admin_users WHERE auth_account_id IS NULL;

SELECT COUNT(*)
FROM customers c
JOIN auth_accounts a ON a.id = c.auth_account_id
WHERE a.realm <> 'customer';

SELECT COUNT(*)
FROM admin_users u
JOIN auth_accounts a ON a.id = u.auth_account_id
WHERE a.realm <> 'staff';

SELECT auth_account_id, COUNT(*)
FROM customers
GROUP BY auth_account_id
HAVING auth_account_id IS NOT NULL AND COUNT(*) <> 1;

SELECT auth_account_id, COUNT(*)
FROM admin_users
GROUP BY auth_account_id
HAVING auth_account_id IS NOT NULL AND COUNT(*) <> 1;

SELECT COUNT(*)
FROM admin_users u
JOIN auth_accounts a ON a.id = u.auth_account_id
WHERE (u.is_active = 1 AND a.status <> 'active')
   OR (u.is_active = 0 AND a.status <> 'disabled');

SELECT COUNT(*)
FROM customer_app_sessions s
JOIN customers c ON c.id = s.customer_id
JOIN auth_accounts a ON a.id = c.auth_account_id
WHERE s.auth_account_id IS NULL
   OR s.auth_account_id <> c.auth_account_id
   OR s.issued_auth_version <> a.auth_version;

SELECT COUNT(*)
FROM admin_users u
LEFT JOIN auth_password_credentials p
  ON p.auth_account_id = u.auth_account_id
 AND p.revoked_at IS NULL
WHERE p.id IS NULL OR p.needs_upgrade <> 1;

PRAGMA foreign_key_check;
```

The verifier also compares:

- customer count = linked customer-account count
- database staff count = linked staff-account count
- database staff count = active legacy-password-credential count
- legacy customer-session count = bridged session count

It inspects `PRAGMA index_list(...)`, `PRAGMA table_list`, and `sqlite_master.sql` to prove every expected `STRICT` table, partial index, and trigger exists.

## Runtime atomicity rules

All multi-row identity state transitions MUST use prepared statements in `env.DB.batch([...])`. Examples include:

- challenge replacement plus outbox creation
- credential replacement
- account-wide revocation
- email activation/replacement
- recovery-code set activation
- external-identity linking
- session rotation
- invitation activation
- customer merge

D1 documents `batch()` as a transaction: statements execute sequentially and a failing statement aborts or rolls back the sequence.

A compare-and-set transition MUST NOT rely on inspecting `meta.changes` after the batch and then assume later statements were rolled back. The Worker pre-generates a unique transition/idempotency marker. The first conditional update writes that marker only when the expected state/version still matches. Every dependent insert/update is expressed as `... SELECT ... WHERE EXISTS (...)` or an equivalent predicate gated on that exact marker and expected state. If the compare-and-set affects zero rows, every dependent statement also affects zero rows. Post-batch affected-row counts choose the response; they are not the rollback mechanism.

The writable compare-and-set marker for each operation is fixed:

| Transition | Conditional winner marker |
|---|---|
| Challenge completion/replacement | `auth_challenges.transition_id` |
| Account-wide revocation | `auth_accounts.last_transition_id` together with the expected `auth_version` |
| Password replacement | old `auth_password_credentials.revocation_transition_id`; new row uses the same value in `created_transition_id` |
| Passkey addition/removal | `auth_accounts.last_transition_id` plus new `auth_passkey_credentials.created_transition_id` / existing `revocation_transition_id` |
| Recovery-code consumption | `auth_recovery_codes.consumption_transition_id` |
| Recovery-code-set activation | new `auth_recovery_code_sets.activation_transition_id` while its status is `generated` |
| Email activation | `auth_email_change_requests.transition_id` |
| External-identity link/unlink | `auth_external_identities.created_transition_id` / `revocation_transition_id` |
| Session rotation | old `auth_sessions.rotation_transition_id`, followed by its `rotated_to_session_id` |

Challenge completion writes its marker while moving the expected `pending`/`verified` row. Session issuance, proof insertion, code consumption, and security-event creation select through that exact marker. The other transitions use the row named above in the same way. A marker is a fresh opaque 32-hex operation ID, never a client idempotency key. Canonical Worker operations pre-generate it. The temporary direct-legacy compatibility bridges are the sole exception: the owning trigger generates the marker with `lower(hex(randomblob(16)))` and performs every dependent legacy transition inside that same outer statement; canonical-root-first mirror writes take the explicit no-op paths above and never invoke that trigger-owned transition. Automated concurrency tests MUST prove one and only one transition can produce dependent state.

`withSession()` provides sequential consistency; it is not a substitute for an interactive SQL transaction. Partial indexes MUST use explicit state/tombstone columns, not non-deterministic predicates such as `datetime('now')`.

## Canonical resolver and legacy session bridge

Every protected request eventually passes through one realm-aware resolver.

For canonical sessions it MUST:

1. hash and find the opaque token
2. reject expired/revoked sessions
3. join the referenced account
4. reject a wrong realm or deleted account
5. require `issued_auth_version = auth_accounts.auth_version`
6. load the business profile and, for staff, the current `admin_users.role`

The exact status/scope matrix is:

- `customer_guest`, `customer_verified`, and `staff_strong` require `status='active'`.
- `staff_password_limited` requires `status='active'`, `enrollment_state IN ('required', 'in_progress')`, and a null or not-yet-passed `enrollment_deadline_at`; it can never resolve after enrollment is complete or expired.
- `staff_enrollment` may resolve a `pending` account linked to an `accepted`
  invitation, or an `active` account whose `enrollment_state` is `required` or
  `in_progress`, only while `enrollment_deadline_at` is null or not passed; it
  may resolve a `disabled` account only when
  `disabled_reason='enrollment_expired'` and
  `enrollment_state='expired'`, after the fresh password proof fixed by the API
  contract.
- `staff_recovery_email` and `staff_recovery_authorized` require `status='active'`. A public start for an administratively disabled or security-held account remains enumeration-resistant but produces no usable recovery session.
- `break_glass` may touch a disabled account only under the approved owner runbook. Credential repair never clears `disabled_reason='administrative'`, `security_hold`, or `owner_requested`; reactivation is a separate authorized transition.
- Enrollment completion may activate a `pending` account linked to an
  `accepted` invitation or reactivate
  `disabled_reason='enrollment_expired'`. It MUST reject every other disabled
  reason.

For a legacy Admin JWT it MUST:

1. verify the legacy signature and token revocation
2. resolve the username to exactly one stable staff account
3. reject the token when `iat <= legacy_sessions_revoked_before`
4. require `realm='staff'` and `status='active'`; pending, disabled, and deleted accounts are rejected
5. reject environment fallback after `legacy_login_disabled_at`

Before staff reconciliation is enabled, the explicitly bounded environment
fallback remains a separate compatibility branch: it is governed by its
feature flag, exact environment username, legacy cutoff, and owner bootstrap
runbook. It cannot pass through the database-backed legacy JWT resolver, cannot
turn a pending reconciled account into an active one, and is removed once the
reconciliation exit criteria are met.

For a legacy customer session it MUST:

1. resolve through `customer_app_sessions.auth_account_id`
2. reject expired/revoked sessions
3. reject when `created_at <= legacy_sessions_revoked_before`
4. require `realm='customer'` and `status='active'`; pending, disabled, and deleted accounts are rejected
5. reject a mismatched `issued_auth_version`

Staff enrollment completion, staff role change, staff password recovery/change, staff primary-email activation, staff passkey addition/removal, recovery-code-set activation, customer recovery, customer recovery-email enrollment/change, customer passkey addition/removal, customer external-identity link/unlink, suspected compromise, and sign-out-everywhere MUST:

- increment `auth_version`
- set `legacy_sessions_revoked_before`
- revoke canonical sessions
- revoke active legacy customer sessions
- revoke or blacklist outstanding legacy Admin tokens as far as their persisted form permits
- invalidate outstanding challenges

Staff enrollment completion additionally sets
`auth_accounts.enrollment_state='complete'` and
`legacy_login_disabled_at` in that same transition before it returns no session.
A staff role change updates `admin_users.role` only inside that account-wide CAS
after protected/last-Superadmin checks; there is no direct legacy role bridge,
and the target must authenticate again.

For an authenticated customer credential change completed in the initiating
request (for example passkey addition/removal or first email enrollment), the
current session may be replaced in that same transaction so the customer
remains signed in; every other session is revoked. Delayed/public-token customer
email-change activation is the exception: it revokes all sessions and requires
fresh login because that execution context cannot safely deliver a replacement
credential. Routine email/passkey/Telegram authentication with an
already-linked identity does not change `auth_version`. Restricted staff
enrollment/recovery transitions continue only in their purpose-bound session
and never preserve an ordinary staff session.

No operation may rely on incrementing `auth_version` alone while legacy sessions still exist.

## Secret and key separation

Implementation requires independent, mandatory, versioned secrets for:

- canonical password pre-hash pepper
- canonical session-token hashing
- challenge/email-code HMAC
- recovery-code HMAC
- destination/IP/device fingerprint HMAC
- idempotency-response encryption
- email-outbox payload encryption

The current `ADMIN_JWT_SECRET` MUST NOT be reused for these purposes. Missing keys fail closed. The current `"fallback-secret"` behavior is forbidden in canonical authentication.

Key versions are stored with verifiers/ciphertexts so rotation can verify/decrypt old short-lived records while new records use the current version.

During a fingerprint/HMAC-key overlap, replay, destination, IP, device, and rate-limit evaluation computes fingerprints under every retained active version, rejects or counts a match under any version, and inserts only the current version. Old keys remain available through the longest challenge, replay, and rate-window TTL; rotation never resets abuse or replay protection.

## Rollout flags

All flags default off:

```text
CRM_AUTH_SCHEMA_READY
CRM_AUTH_CANONICAL_RESOLVER
CRM_AUTH_CUSTOMER_BOUNDARY
CRM_AUTH_TELEGRAM_VERIFICATION
CRM_AUTH_STAFF_RECONCILED
CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT
CRM_AUTH_STAFF_ENROLLMENT
CRM_AUTH_CUSTOMER_PASSKEYS
CRM_AUTH_STAFF_PASSKEYS
CRM_AUTH_EMAIL_DELIVERY
CRM_AUTH_STAFF_RECOVERY
CRM_AUTH_CUSTOMER_EMAIL
CRM_AUTH_CUSTOMER_MERGE
CRM_AUTH_LEGACY_LOGIN_DISABLED
```

Schema presence alone never enables behavior.

The three ordinary staff flags `CRM_AUTH_STAFF_ENROLLMENT`,
`CRM_AUTH_STAFF_PASSKEYS`, and `CRM_AUTH_STAFF_RECOVERY` are also gated by the
native-attestation amendment, supported Admin Android/iOS minimum builds, and
client readiness fixed by the API contract. Contract version 1 cannot enable
them because native bearer issuance is deliberately disabled. The protected,
Admin-Web-only bootstrap flag is the sole pre-amendment exception.

`CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT` may be true only while
`CRM_AUTH_STAFF_RECONCILED` is false and only for the exact protected pending
owner-bootstrap account/invitation. Exit requires a completed protected
Superadmin enrollment, verified active email/password/passkey/recovery-code
facts, successful break-glass drill evidence, and zero other usable
owner-bootstrap challenges. The owner tool first commits the D1 exit event,
then disables `CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT` and verifies it reads false,
and only then sets `CRM_AUTH_STAFF_RECONCILED=true`. A failure between flag
changes leaves ordinary staff enrollment off and is safely retryable; the two
flags must never be true together.

Rollback may disable challenge issuance, email dispatch, or a client surface. It MUST NOT restore device-ID account lookup, restore the global plaintext reset-code flow, mark an email verified, or delete canonical data.

## Test gates

Before implementation is considered ready:

1. Apply migrations `0001` through `0014` to an empty disposable database.
2. Apply `0014` to a production-shaped disposable copy at `0013`.
3. Include numeric Telegram customers, synthetic app customers, inactive staff, dependent business rows, audit rows, token revocations, and active/expired customer sessions.
4. Run collision, malformed legacy hash, orphan, wrong-realm, duplicate-link, trigger, partial-index, and foreign-key fixtures.
5. Prove a rerun is rejected as already applied rather than duplicating accounts.
6. Prove every verification query and expected index plan.
7. Measure migration duration at production scale.
8. `0014` is one atomic schema/backfill/enforcement migration. If the production-shaped preview reaches 15 seconds, stop: revise and re-approve this contract with explicitly numbered schema/backfill/enforcement phases. The implementation MUST NOT split it opportunistically or risk the D1 query limit.
9. Test locally and against a disposable remote preview database.
10. Record a D1 Time Travel bookmark/export and complete a restore drill before production.
11. Run concurrent winner/loser fixtures for every marker in the runtime atomicity table.
12. Prove the exact account-status/scope matrix, replacement-passkey recovery proof mapping, final-staff-passkey guard, and verified security-event export prerequisite.
13. Prove the bootstrap flag cannot authorize an unprotected, active, disabled,
    database-backed, or second account; prove protected invitation/enrollment
    reissue preserves identity/role/destination and that the bootstrap exit
    disables every owner challenge before ordinary enrollment.

Worker version rollback does not roll back D1. After canonical writes begin, prefer feature-disable plus fix-forward to a destructive downgrade.

## References

- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [Cloudflare D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare D1 indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
- [Cloudflare D1 Worker API and STRICT tables](https://developers.cloudflare.com/d1/worker-api/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
