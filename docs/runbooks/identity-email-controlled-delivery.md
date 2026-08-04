# Identity email controlled-delivery runbook

Status: implementation and preproduction validation only. Authentication email
and recovery feature flags remain disabled until the security acceptance gates
are complete.

## Fixed policy

- Transactional sender: `CRM Delivery Security <security@auth.ayartuerk.me>`.
- Provider access is isolated behind the Worker email adapter.
- Local development uses simulated bindings (`remote = false`).
- Real preproduction delivery is restricted by the application-level
  `CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS` secret and, while the account is in
  verified-destination mode, Cloudflare's verified destination list. Test
  recipients are deliberately configuration, not addresses hard-coded into the
  Worker or binding, so changing the controlled set requires no code cleanup.
- `CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS` remains `false` until a separate,
  explicit production rollout approval.
- Email addresses, links, codes, decrypted payloads, and rendered bodies must
  never be written to logs.
- Telegram recovery remains available until the project owner explicitly
  decides to retire it.

## Cloudflare prerequisites

1. Onboard `auth.ayartuerk.me` for Email Sending and confirm its SPF and DKIM
   records are valid.
2. Add each controlled test recipient as a Cloudflare Email Routing destination
   and complete the verification message.
3. Confirm the account permits Email Sending and review the current quota.
4. Keep production Email Preview or equivalent body-retention features disabled
   after setup validation.

Do not add an arbitrary-recipient binding or a hard-coded binding destination
list merely to simplify development. The provider adapter must fail closed when
the configurable test-destination secret is absent.

## Worker secrets

Set these through Wrangler's interactive secret command; never put their values
in `wrangler.toml`, shell history, screenshots, tickets, or logs.

- `CRM_AUTH_EMAIL_OUTBOX_KEY_V1`: a random 32-byte key encoded as base64.
- `CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS`: a comma-separated list containing
  only the manually verified controlled recipients.
- `CRM_AUTH_CHALLENGE_HMAC_KEY_V1`: random key material for purpose-bound
  invitation and recovery-link token hashes.
- `CRM_AUTH_SESSION_HMAC_KEY_V1`: random key material for canonical session and
  CSRF-token hashes.
- `CRM_AUTH_IDEMPOTENCY_HMAC_KEY_V1`: random key material for idempotency-key,
  subject-scope, and request fingerprints.
- `CRM_AUTH_IDEMPOTENCY_RESPONSE_KEY_V1`: a random 32-byte key encoded as
  base64url for encrypted secret-bearing replay responses.
- `CRM_AUTH_FINGERPRINT_KEY_V1`: random key material for privacy-preserving
  abuse-control fingerprints.
- `CRM_AUTH_RECOVERY_CODE_HMAC_KEY_V1`: random key material for contextual
  offline recovery-code verifiers.
- `CRM_AUTH_BOOTSTRAP_SUPERADMIN_EMAIL` and
  `CRM_AUTH_BOOTSTRAP_ADMIN_EMAIL`: the approved initial staff destinations.
- `CRM_AUTH_BOOTSTRAP_OWNER_RECEIPT`: a random, non-personal owner-operation
  receipt that binds the protected reconciliation audit trail.

Every identity key is independent from `ADMIN_JWT_SECRET` and from every other
identity key. Key rotation adds the new versioned secret first, retains the old
version where the corresponding keyring supports overlap, and changes the
matching `*_ACTIVE_KEY_VERSION` only after the new secret exists in every
required environment. Bootstrap email and owner-receipt values are
configuration secrets, never source constants.

## No-send verification

Run the offline predeployment guard from `cloudflare-worker/`:

```bash
npm run predeploy:identity
```

The default command is deliberately offline. It validates the disabled feature
flags, migration/schema contract, declared secret names, bindings and queues,
then runs the complete Worker tests, syntax check, localization drift check,
and an isolated Wrangler dry-run. It does not inspect Cloudflare or use a remote
email binding.

After an explicit decision to perform read-only Cloudflare checks, run:

```bash
npm run predeploy:identity:remote
```

This additionally verifies required secret *names* (never values), queue
resources, applied D1 migrations, the canonical D1 table count, the account
locale column, and `PRAGMA foreign_key_check`. It does not deploy or mutate D1.

After the disabled-flags staged Worker has been deployed, verify its live
bindings and both queue consumers with:

```bash
npm run verify:identity:deployed
```

The deployed-wiring check is separate because requiring a new binding to exist
before the first staged deployment would create a circular gate.

Confirm that:

- all five locales render both plain text and HTML;
- Arabic output is right-to-left;
- links are first-party HTTPS URLs;
- HTML variables are escaped;
- the adapter refuses a missing binding, a disabled delivery flag, and a
  destination outside the controlled allow-list;
- encrypted outbox payloads cannot be decrypted with a different key or after
  tampering;
- terminal outbox rows discard ciphertext and IV;
- the scheduled dispatcher and Queue consumer do no work while delivery is
  disabled.

## Controlled real send

1. Confirm the exact destination is verified in the Cloudflare dashboard and is
   present in the Worker secret allow-list.
2. Confirm `CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS=false`.
3. Use a non-production enrollment test account to create one purpose-bound,
   short-lived challenge and one encrypted outbox row.
4. Temporarily enable only the email-delivery infrastructure flag in the
   controlled environment. Do not enable recovery or client-readiness flags.
5. Record only outbox ID, provider message ID, safe outcome, and timestamp.
6. Confirm receipt, subject, text/HTML rendering, sender authentication, link
   origin, expiry, single use, and replay rejection.
7. Disable the flag again and confirm the outbox row is terminal with its
   ciphertext and IV removed.

Repeat once per locale. Do not use real customer or staff accounts for this
stage.

## Stop conditions

Stop immediately and leave all flags disabled if the sender domain is not fully
authenticated, the destination is not verified, any secret or address appears
in logs, an unknown destination is accepted, an expired/consumed challenge is
sent, terminal payloads remain in D1, or the public response reveals whether an
account exists.
