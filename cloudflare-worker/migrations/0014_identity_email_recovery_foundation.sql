-- CRM Delivery canonical identity, verified-email, and recovery foundation.
-- Additive migration. All corresponding Worker feature flags default off.

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
  CASE WHEN is_active = 1 THEN 'active' ELSE 'disabled' END ,
  'required',
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM admin_users;

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
  CASE WHEN profile_status = 'disabled' THEN 'administrative' ELSE NULL END ,
  CASE WHEN profile_status = 'disabled' THEN CURRENT_TIMESTAMP ELSE NULL END ,
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

-- Realm and canonical-link guards.
CREATE TRIGGER trg_customers_auth_realm_bi
BEFORE INSERT ON customers
WHEN NEW.auth_account_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM auth_accounts
   WHERE id = NEW.auth_account_id AND realm = 'customer'
 )
BEGIN
  SELECT RAISE(ABORT, 'auth realm/link invariant failed');
END;

CREATE TRIGGER trg_customers_auth_realm_bu
BEFORE UPDATE OF auth_account_id ON customers
WHEN NEW.auth_account_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM auth_accounts
   WHERE id = NEW.auth_account_id AND realm = 'customer'
 )
BEGIN
  SELECT RAISE(ABORT, 'auth realm/link invariant failed');
END;

CREATE TRIGGER trg_admin_users_auth_realm_bi
BEFORE INSERT ON admin_users
WHEN NEW.auth_account_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM auth_accounts
   WHERE id = NEW.auth_account_id AND realm = 'staff'
 )
BEGIN
  SELECT RAISE(ABORT, 'auth realm/link invariant failed');
END;

CREATE TRIGGER trg_admin_users_auth_realm_bu
BEFORE UPDATE OF auth_account_id ON admin_users
WHEN NEW.auth_account_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM auth_accounts
   WHERE id = NEW.auth_account_id AND realm = 'staff'
 )
BEGIN
  SELECT RAISE(ABORT, 'auth realm/link invariant failed');
END;

CREATE TRIGGER trg_customer_sessions_auth_link_bi
BEFORE INSERT ON customer_app_sessions
WHEN NOT EXISTS (
  SELECT 1
  FROM customers c
  WHERE c.id = NEW.customer_id
    AND c.auth_account_id IS NOT NULL
    AND (
      NEW.auth_account_id IS NULL
      OR NEW.auth_account_id = c.auth_account_id
    )
)
BEGIN
  SELECT RAISE(ABORT, 'auth realm/link invariant failed');
END;

CREATE TRIGGER trg_customer_sessions_auth_link_bu
BEFORE UPDATE OF customer_id, auth_account_id ON customer_app_sessions
WHEN NEW.auth_account_id IS NULL
 OR NOT EXISTS (
   SELECT 1
   FROM customers c
   WHERE c.id = NEW.customer_id
     AND c.auth_account_id = NEW.auth_account_id
 )
BEGIN
  SELECT RAISE(ABORT, 'auth realm/link invariant failed');
END;

CREATE TRIGGER trg_admin_users_username_guard_bu
BEFORE UPDATE OF username ON admin_users
WHEN OLD.username IS NOT NEW.username
BEGIN
  SELECT CASE
    WHEN NEW.username IS NULL
      OR trim(NEW.username) = ''
      OR NEW.username <> trim(NEW.username)
      OR NEW.username GLOB '*[^A-Za-z0-9._-]*'
    THEN RAISE(ABORT, 'invalid canonical staff username')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM admin_users u
      WHERE u.id <> OLD.id
        AND lower(trim(u.username)) = lower(trim(NEW.username))
    )
    THEN RAISE(ABORT, 'canonical staff username collision')
  END;
END;

CREATE TRIGGER trg_admin_users_password_sentinel_guard_bu
BEFORE UPDATE OF password_hash ON admin_users
WHEN OLD.password_hash IS NOT NEW.password_hash
 AND NEW.password_hash = '!canonical-auth-disabled!'
 AND EXISTS (
   SELECT 1
   FROM auth_password_credentials p
   WHERE p.auth_account_id = OLD.auth_account_id
     AND p.algorithm = 'legacy_sha256_admin_jwt_secret_v1'
     AND p.revoked_at IS NULL
 )
BEGIN
  SELECT RAISE(ABORT, 'active legacy password credential remains');
END;

-- Bounded legacy-write compatibility bridges.
CREATE TRIGGER trg_customers_auth_bridge_ai
AFTER INSERT ON customers
WHEN NEW.auth_account_id IS NULL
BEGIN
  INSERT INTO auth_accounts (
    id,
    webauthn_user_handle,
    realm,
    status,
    enrollment_state,
    last_transition_id,
    created_at,
    updated_at
  ) VALUES (
    lower(hex(randomblob(16))),
    lower(hex(randomblob(16))),
    'customer',
    'active',
    'not_required',
    lower(hex(randomblob(16))),
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  );

  UPDATE customers
  SET auth_account_id = (
    SELECT id
    FROM auth_accounts
    WHERE rowid = last_insert_rowid()
  )
  WHERE id = NEW.id;
END;

CREATE TRIGGER trg_admin_users_auth_bridge_ai
AFTER INSERT ON admin_users
BEGIN
  SELECT CASE
    WHEN NEW.username IS NULL
      OR trim(NEW.username) = ''
      OR NEW.username <> trim(NEW.username)
      OR NEW.username GLOB '*[^A-Za-z0-9._-]*'
    THEN RAISE(ABORT, 'invalid canonical staff username')
  END;

  SELECT CASE
    WHEN NEW.auth_account_id IS NULL
      AND (
        length(NEW.password_hash) <> 64
        OR NEW.password_hash GLOB '*[^0-9a-f]*'
      )
    THEN RAISE(ABORT, 'invalid legacy password verifier')
  END;

  INSERT INTO auth_accounts (
    id,
    webauthn_user_handle,
    realm,
    status,
    enrollment_state,
    last_transition_id,
    disabled_reason,
    disabled_at,
    created_at,
    updated_at
  )
  SELECT
    lower(hex(randomblob(16))),
    lower(hex(randomblob(16))),
    'staff',
    CASE WHEN NEW.is_active = 1 THEN 'active' ELSE 'disabled' END ,
    'required',
    lower(hex(randomblob(16))),
    CASE WHEN NEW.is_active = 1 THEN NULL ELSE 'administrative' END ,
    CASE WHEN NEW.is_active = 1 THEN NULL ELSE CURRENT_TIMESTAMP END ,
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  WHERE NEW.auth_account_id IS NULL;

  UPDATE admin_users
  SET auth_account_id = COALESCE(
        NEW.auth_account_id,
        (
          SELECT id
          FROM auth_accounts
          WHERE rowid = last_insert_rowid()
        )
      ),
      username_normalized = lower(trim(NEW.username))
  WHERE id = NEW.id;

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
    created_transition_id,
    created_at,
    updated_at
  )
  SELECT
    lower(hex(randomblob(16))),
    u.auth_account_id,
    'staff',
    NEW.password_hash,
    'legacy_sha256_admin_jwt_secret_v1',
    1,
    '{"digest":"SHA-256","input":"utf8_secret_colon_password","encoding":"lower_hex"}',
    0,
    1,
    lower(hex(randomblob(16))),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM admin_users u
  WHERE u.id = NEW.id
    AND NEW.auth_account_id IS NULL;
END;

CREATE TRIGGER trg_admin_users_password_bridge_au
AFTER UPDATE OF password_hash ON admin_users
WHEN OLD.password_hash IS NOT NEW.password_hash
 AND NEW.password_hash <> '!canonical-auth-disabled!'
BEGIN
  SELECT CASE
    WHEN NEW.auth_account_id IS NULL
      OR length(NEW.password_hash) <> 64
      OR NEW.password_hash GLOB '*[^0-9a-f]*'
    THEN RAISE(ABORT, 'invalid legacy password verifier')
  END;

  UPDATE auth_accounts
  SET auth_version = auth_version + 1,
      legacy_sessions_revoked_before = CURRENT_TIMESTAMP,
      last_transition_id = lower(hex(randomblob(16))),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.auth_account_id
    AND realm = 'staff';

  UPDATE auth_password_credentials
  SET revoked_at = CURRENT_TIMESTAMP,
      revocation_transition_id = (
        SELECT last_transition_id
        FROM auth_accounts
        WHERE id = NEW.auth_account_id
      ),
      updated_at = CURRENT_TIMESTAMP
  WHERE auth_account_id = NEW.auth_account_id
    AND revoked_at IS NULL;

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
    created_transition_id,
    created_at,
    updated_at
  ) VALUES (
    lower(hex(randomblob(16))),
    NEW.auth_account_id,
    'staff',
    NEW.password_hash,
    'legacy_sha256_admin_jwt_secret_v1',
    1,
    '{"digest":"SHA-256","input":"utf8_secret_colon_password","encoding":"lower_hex"}',
    0,
    1,
    (
      SELECT last_transition_id
      FROM auth_accounts
      WHERE id = NEW.auth_account_id
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  UPDATE auth_sessions
  SET revoked_at = CURRENT_TIMESTAMP,
      revocation_reason = 'legacy_password_changed'
  WHERE auth_account_id = NEW.auth_account_id
    AND revoked_at IS NULL;

  UPDATE auth_challenges
  SET status = 'invalidated',
      invalidated_at = CURRENT_TIMESTAMP,
      transition_id = lower(hex(randomblob(16)))
  WHERE auth_account_id = NEW.auth_account_id
    AND status IN ('pending', 'verified');
END;

CREATE TRIGGER trg_admin_users_active_bridge_au
AFTER UPDATE OF is_active ON admin_users
WHEN OLD.is_active IS NOT NEW.is_active
 AND EXISTS (
   SELECT 1
   FROM auth_accounts a
   WHERE a.id = NEW.auth_account_id
     AND (
       (NEW.is_active = 1 AND a.status <> 'active')
       OR (NEW.is_active = 0 AND a.status <> 'disabled')
     )
 )
BEGIN
  SELECT CASE
    WHEN NEW.auth_account_id IS NULL
      OR NEW.is_protected = 1
    THEN RAISE(ABORT, 'protected or unlinked staff status transition')
  END;

  SELECT CASE
    WHEN NEW.is_active = 0
      AND NOT EXISTS (
        SELECT 1 FROM auth_accounts
        WHERE id = NEW.auth_account_id
          AND status = 'active'
      )
    THEN RAISE(ABORT, 'invalid staff disable transition')
  END;

  SELECT CASE
    WHEN NEW.is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM auth_accounts
        WHERE id = NEW.auth_account_id
          AND status = 'disabled'
          AND disabled_reason = 'administrative'
      )
    THEN RAISE(ABORT, 'invalid staff reactivation transition')
  END;

  SELECT CASE
    WHEN NEW.is_active = 0
      AND NEW.role = 'superadmin'
      AND NOT EXISTS (
        SELECT 1
        FROM admin_users u
        JOIN auth_accounts a ON a.id = u.auth_account_id
        WHERE u.id <> NEW.id
          AND u.role = 'superadmin'
          AND u.is_active = 1
          AND a.status = 'active'
      )
    THEN RAISE(ABORT, 'last active superadmin')
  END;

  UPDATE auth_accounts
  SET status = CASE WHEN NEW.is_active = 1 THEN 'active' ELSE 'disabled' END ,
      auth_version = auth_version + 1,
      legacy_sessions_revoked_before = CURRENT_TIMESTAMP,
      last_transition_id = lower(hex(randomblob(16))),
      disabled_reason = CASE
        WHEN NEW.is_active = 1 THEN NULL
        ELSE 'administrative'
      END ,
      disabled_at = CASE
        WHEN NEW.is_active = 1 THEN NULL
        ELSE CURRENT_TIMESTAMP
      END ,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.auth_account_id;

  UPDATE auth_sessions
  SET revoked_at = CURRENT_TIMESTAMP,
      revocation_reason = 'legacy_staff_status_changed'
  WHERE auth_account_id = NEW.auth_account_id
    AND revoked_at IS NULL;

  UPDATE auth_challenges
  SET status = 'invalidated',
      invalidated_at = CURRENT_TIMESTAMP,
      transition_id = lower(hex(randomblob(16)))
  WHERE auth_account_id = NEW.auth_account_id
    AND status IN ('pending', 'verified');
END;

CREATE TRIGGER trg_admin_users_username_bridge_au
AFTER UPDATE OF username ON admin_users
WHEN OLD.username IS NOT NEW.username
BEGIN
  UPDATE admin_users
  SET username_normalized = lower(trim(NEW.username))
  WHERE id = NEW.id;

  UPDATE auth_accounts
  SET auth_version = auth_version + 1,
      legacy_sessions_revoked_before = CURRENT_TIMESTAMP,
      last_transition_id = lower(hex(randomblob(16))),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.auth_account_id;

  UPDATE auth_sessions
  SET revoked_at = CURRENT_TIMESTAMP,
      revocation_reason = 'legacy_staff_username_changed'
  WHERE auth_account_id = NEW.auth_account_id
    AND revoked_at IS NULL;

  UPDATE auth_challenges
  SET status = 'invalidated',
      invalidated_at = CURRENT_TIMESTAMP,
      transition_id = lower(hex(randomblob(16)))
  WHERE auth_account_id = NEW.auth_account_id
    AND status IN ('pending', 'verified');
END;

CREATE TRIGGER trg_customers_auth_bridge_bd
BEFORE DELETE ON customers
WHEN OLD.auth_account_id IS NOT NULL
BEGIN
  UPDATE auth_accounts
  SET status = 'deleted',
      auth_version = auth_version + 1,
      legacy_sessions_revoked_before = CURRENT_TIMESTAMP,
      last_transition_id = lower(hex(randomblob(16))),
      disabled_reason = NULL,
      disabled_at = NULL,
      deleted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.auth_account_id
    AND realm = 'customer';

  UPDATE auth_sessions
  SET revoked_at = CURRENT_TIMESTAMP,
      revocation_reason = 'legacy_customer_deleted'
  WHERE auth_account_id = OLD.auth_account_id
    AND revoked_at IS NULL;

  UPDATE auth_challenges
  SET status = 'invalidated',
      invalidated_at = CURRENT_TIMESTAMP,
      transition_id = lower(hex(randomblob(16)))
  WHERE auth_account_id = OLD.auth_account_id
    AND status IN ('pending', 'verified');
END;

CREATE TRIGGER trg_admin_users_auth_bridge_bd
BEFORE DELETE ON admin_users
BEGIN
  SELECT CASE
    WHEN OLD.is_protected = 1
    THEN RAISE(ABORT, 'protected staff profile cannot be deleted')
  END;

  SELECT CASE
    WHEN OLD.role = 'superadmin'
      AND OLD.is_active = 1
      AND NOT EXISTS (
        SELECT 1
        FROM admin_users u
        JOIN auth_accounts a ON a.id = u.auth_account_id
        WHERE u.id <> OLD.id
          AND u.role = 'superadmin'
          AND u.is_active = 1
          AND a.status = 'active'
      )
    THEN RAISE(ABORT, 'last active superadmin')
  END;

  UPDATE auth_accounts
  SET status = 'deleted',
      auth_version = auth_version + 1,
      legacy_sessions_revoked_before = CURRENT_TIMESTAMP,
      last_transition_id = lower(hex(randomblob(16))),
      disabled_reason = NULL,
      disabled_at = NULL,
      deleted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.auth_account_id
    AND realm = 'staff';

  UPDATE auth_sessions
  SET revoked_at = CURRENT_TIMESTAMP,
      revocation_reason = 'legacy_staff_deleted'
  WHERE auth_account_id = OLD.auth_account_id
    AND revoked_at IS NULL;

  UPDATE auth_challenges
  SET status = 'invalidated',
      invalidated_at = CURRENT_TIMESTAMP,
      transition_id = lower(hex(randomblob(16)))
  WHERE auth_account_id = OLD.auth_account_id
    AND status IN ('pending', 'verified');
END;

CREATE TRIGGER trg_customer_sessions_auth_bridge_ai
AFTER INSERT ON customer_app_sessions
WHEN NEW.auth_account_id IS NULL
BEGIN
  UPDATE customer_app_sessions
  SET auth_account_id = (
        SELECT c.auth_account_id
        FROM customers c
        WHERE c.id = NEW.customer_id
      ),
      issued_auth_version = (
        SELECT a.auth_version
        FROM customers c
        JOIN auth_accounts a ON a.id = c.auth_account_id
        WHERE c.id = NEW.customer_id
      )
  WHERE id = NEW.id;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM customer_app_sessions s
      WHERE s.id = NEW.id
        AND (
          s.auth_account_id IS NULL
          OR s.issued_auth_version IS NULL
        )
    )
    THEN RAISE(ABORT, 'auth realm/link invariant failed')
  END;
END;

CREATE TABLE _auth_0014_assertions (
  assertion_name TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL CHECK (failure_count = 0)
) STRICT;

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

DROP TABLE _auth_0014_assertions;
DROP TABLE _auth_0014_profile_map;
