-- Permit the Telegram Mini App to use its approved in-memory bearer session
-- while keeping browser cookies and native bearer transports unchanged.

PRAGMA defer_foreign_keys = ON;

-- These compatibility triggers reference auth_sessions from other tables.
-- Recreate them around the SQLite table rebuild so their bodies continue to
-- target the replacement table rather than a renamed legacy table.
DROP TRIGGER IF EXISTS trg_admin_users_password_bridge_au;
DROP TRIGGER IF EXISTS trg_admin_users_active_bridge_au;
DROP TRIGGER IF EXISTS trg_admin_users_username_bridge_au;
DROP TRIGGER IF EXISTS trg_customers_auth_bridge_bd;
DROP TRIGGER IF EXISTS trg_admin_users_auth_bridge_bd;

CREATE TABLE auth_sessions_next (
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
    REFERENCES auth_sessions_next(id, auth_account_id, realm)
    ON DELETE RESTRICT,
  FOREIGN KEY (rotated_to_session_id, auth_account_id, realm)
    REFERENCES auth_sessions_next(id, auth_account_id, realm)
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
      client_platform IN ('admin_web', 'customer_web')
      AND session_transport = 'cookie'
    )
    OR (
      client_platform = 'telegram_mini_app'
      AND session_transport IN ('cookie', 'bearer')
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

INSERT INTO auth_sessions_next (
  id,
  auth_account_id,
  realm,
  token_hash,
  token_hash_version,
  created_transition_id,
  issued_auth_version,
  scope,
  assurance_level,
  auth_methods_json,
  authorization_context_json,
  session_transport,
  csrf_token_hash,
  client_platform,
  app_version,
  device_label,
  installation_id_hash,
  rotated_from_session_id,
  rotated_to_session_id,
  rotation_transition_id,
  authenticated_at,
  strong_authenticated_at,
  created_at,
  last_seen_at,
  expires_at,
  revoked_at,
  revocation_reason
)
SELECT
  id,
  auth_account_id,
  realm,
  token_hash,
  token_hash_version,
  created_transition_id,
  issued_auth_version,
  scope,
  assurance_level,
  auth_methods_json,
  authorization_context_json,
  session_transport,
  csrf_token_hash,
  client_platform,
  app_version,
  device_label,
  installation_id_hash,
  rotated_from_session_id,
  rotated_to_session_id,
  rotation_transition_id,
  authenticated_at,
  strong_authenticated_at,
  created_at,
  last_seen_at,
  expires_at,
  revoked_at,
  revocation_reason
FROM auth_sessions;

DROP TABLE auth_sessions;
ALTER TABLE auth_sessions_next RENAME TO auth_sessions;

CREATE INDEX idx_auth_sessions_active_account
  ON auth_sessions(auth_account_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_sessions_expiry
  ON auth_sessions(revoked_at, expires_at);

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
    id, auth_account_id, account_realm, verifier, algorithm,
    algorithm_version, parameters_json, pepper_key_version, needs_upgrade,
    created_transition_id, created_at, updated_at
  ) VALUES (
    lower(hex(randomblob(16))), NEW.auth_account_id, 'staff', NEW.password_hash,
    'legacy_sha256_admin_jwt_secret_v1', 1,
    '{"digest":"SHA-256","input":"utf8_secret_colon_password","encoding":"lower_hex"}',
    0, 1,
    (SELECT last_transition_id FROM auth_accounts WHERE id = NEW.auth_account_id),
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
    WHEN NEW.auth_account_id IS NULL OR NEW.is_protected = 1
    THEN RAISE(ABORT, 'protected or unlinked staff status transition')
  END;

  SELECT CASE
    WHEN NEW.is_active = 0
      AND NOT EXISTS (
        SELECT 1 FROM auth_accounts
        WHERE id = NEW.auth_account_id AND status = 'active'
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
  SET status = iif(NEW.is_active = 1, 'active', 'disabled'),
      auth_version = auth_version + 1,
      legacy_sessions_revoked_before = CURRENT_TIMESTAMP,
      last_transition_id = lower(hex(randomblob(16))),
      disabled_reason = iif(NEW.is_active = 1, NULL, 'administrative'),
      disabled_at = iif(NEW.is_active = 1, NULL, CURRENT_TIMESTAMP),
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

PRAGMA defer_foreign_keys = OFF;
