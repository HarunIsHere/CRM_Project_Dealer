-- Canonical shop tenancy and future self-service onboarding foundation.
-- Existing admin_shop_access remains as a compatibility source until all
-- clients authorize through canonical account memberships.

ALTER TABLE shops
  ADD COLUMN ownership_model TEXT NOT NULL DEFAULT 'platform_managed'
  CHECK (ownership_model IN ('platform_managed', 'member_owned'));

ALTER TABLE shops
  ADD COLUMN created_by_auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

ALTER TABLE shops
  ADD COLUMN approved_by_auth_account_id TEXT
  REFERENCES auth_accounts(id) ON DELETE RESTRICT;

ALTER TABLE shops ADD COLUMN approved_at TEXT;

CREATE TABLE shop_memberships (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  shop_id INTEGER NOT NULL,
  auth_account_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'manager', 'staff')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  invited_by_auth_account_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT,
  suspended_at TEXT,
  revoked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shop_id, auth_account_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT,
  FOREIGN KEY (auth_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (invited_by_auth_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  CHECK (
    (status = 'active' AND activated_at IS NOT NULL)
    OR status <> 'active'
  ),
  CHECK (
    (status = 'suspended' AND suspended_at IS NOT NULL)
    OR (status <> 'suspended' AND suspended_at IS NULL)
  ),
  CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR (status <> 'revoked' AND revoked_at IS NULL)
  )
) STRICT;

CREATE INDEX idx_shop_memberships_account_status
  ON shop_memberships(auth_account_id, status, shop_id);

CREATE INDEX idx_shop_memberships_shop_status
  ON shop_memberships(shop_id, status, role);

INSERT OR IGNORE INTO shop_memberships (
  id,
  shop_id,
  auth_account_id,
  role,
  status,
  created_at,
  activated_at,
  revoked_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))),
  access.shop_id,
  admin.auth_account_id,
  CASE
    WHEN lower(access.role) IN ('owner', 'shop_owner') THEN 'owner'
    WHEN lower(access.role) IN ('staff', 'shop_staff') THEN 'staff'
    ELSE 'manager'
  END,
  CASE WHEN access.is_active = 1 THEN 'active' ELSE 'revoked' END,
  access.created_at,
  CASE WHEN access.is_active = 1 THEN access.created_at ELSE NULL END,
  CASE WHEN access.is_active = 0 THEN CURRENT_TIMESTAMP ELSE NULL END,
  CURRENT_TIMESTAMP
FROM admin_shop_access access
JOIN admin_users admin ON admin.id = access.admin_user_id
WHERE admin.auth_account_id IS NOT NULL;

CREATE TABLE shop_applications (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) = 32 AND id NOT GLOB '*[^0-9a-f]*'),
  applicant_auth_account_id TEXT NOT NULL,
  proposed_name TEXT NOT NULL CHECK (trim(proposed_name) <> ''),
  proposed_slug TEXT NOT NULL CHECK (trim(proposed_slug) <> ''),
  description TEXT,
  address TEXT,
  google_maps_link TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn')),
  submitted_at TEXT,
  reviewed_by_auth_account_id TEXT,
  reviewed_at TEXT,
  decision_reason TEXT,
  approved_shop_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_auth_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_auth_account_id)
    REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_shop_id)
    REFERENCES shops(id) ON DELETE RESTRICT,
  CHECK (
    (status = 'draft' AND submitted_at IS NULL)
    OR (status <> 'draft' AND submitted_at IS NOT NULL)
  ),
  CHECK (
    (
      status = 'approved'
      AND reviewed_by_auth_account_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND approved_shop_id IS NOT NULL
    )
    OR (
      status <> 'approved'
      AND approved_shop_id IS NULL
    )
  ),
  CHECK (
    status <> 'rejected'
    OR (
      reviewed_by_auth_account_id IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  )
) STRICT;

CREATE UNIQUE INDEX ux_shop_applications_open_account
  ON shop_applications(applicant_auth_account_id)
  WHERE status IN ('draft', 'pending');

CREATE INDEX idx_shop_applications_review_queue
  ON shop_applications(status, submitted_at, created_at);

CREATE INDEX idx_shop_applications_approved_shop
  ON shop_applications(approved_shop_id)
  WHERE approved_shop_id IS NOT NULL;
