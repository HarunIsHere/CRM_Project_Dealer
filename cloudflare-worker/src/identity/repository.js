import { constantTimeEqual, createOpaqueId } from "./crypto.js";
import { createAcceptedSessionTokenHashes } from "./session-keyring.js";

function parseAuthorizationContext(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function deadlineAllows(deadline, nowMs) {
  if (deadline === null || deadline === undefined || deadline === "") return true;
  const deadlineMs = Date.parse(String(deadline));
  return Number.isFinite(deadlineMs) && deadlineMs > nowMs;
}

function profileAllows(row) {
  if (row.realm === "customer") {
    return row.customer_profile_id !== null
      && row.customer_profile_id !== undefined;
  }
  return row.realm === "staff"
    && row.staff_profile_id !== null
    && row.staff_profile_id !== undefined
    && Number(row.staff_profile_is_active) === 1
    && typeof row.role === "string"
    && row.role.length > 0;
}

function sessionStatusAllows(row, nowMs) {
  if (!profileAllows(row)) return false;

  if (row.realm === "customer") {
    return (
      row.account_status === "active"
      && ["customer_guest", "customer_verified"].includes(row.scope)
    );
  }

  if (row.realm !== "staff" || row.account_status === "deleted") return false;

  if (["staff_strong", "staff_password_limited"].includes(row.scope)) {
    if (row.account_status !== "active") return false;
    if (row.scope === "staff_strong") return true;
    return (
      ["required", "in_progress"].includes(row.enrollment_state)
      && deadlineAllows(row.enrollment_deadline_at, nowMs)
    );
  }

  if (["staff_recovery_email", "staff_recovery_authorized"].includes(row.scope)) {
    return row.account_status === "active";
  }

  if (row.scope === "staff_enrollment") {
    if (!deadlineAllows(row.enrollment_deadline_at, nowMs)) return false;
    if (row.account_status === "pending") {
      return Number(row.has_accepted_staff_invitation) === 1;
    }
    if (row.account_status === "active") {
      return ["required", "in_progress"].includes(row.enrollment_state);
    }
    // Disabled enrollment-expired authorization remains denied until the
    // contract fixes its context proof and profile-mirror exception exactly.
    return false;
  }

  // A disabled break-glass account also has an inactive mirrored staff
  // profile. It remains denied until that runbook exception is represented by
  // a closed authorization-context contract.
  return row.scope === "break_glass" && row.account_status === "active";
}

export async function resolveCanonicalSession(
  env,
  rawToken,
  realm,
  { now = new Date() } = {}
) {
  if (!env?.DB || !rawToken || !realm) return null;
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  if (!Number.isFinite(nowMs)) return null;
  const nowIso = nowDate.toISOString();
  const acceptedHashes = await createAcceptedSessionTokenHashes(env, rawToken);
  const hashPredicates = acceptedHashes.map(() => (
    "(s.token_hash_version = ? AND s.token_hash = ?)"
  )).join(" OR ");
  const hashBindings = acceptedHashes.flatMap(({ tokenHashVersion, tokenHash }) => (
    [tokenHashVersion, tokenHash]
  ));
  const row = await env.DB.prepare(`
    SELECT
      s.*,
      a.status AS account_status,
      a.auth_version AS current_auth_version,
      a.enrollment_state,
      a.enrollment_deadline_at,
      a.disabled_reason,
      u.id AS staff_profile_id,
      u.role AS role,
      u.is_active AS staff_profile_is_active,
      c.id AS customer_profile_id,
      c.is_blocked AS customer_profile_is_blocked,
      CASE WHEN EXISTS (
        SELECT 1
        FROM auth_staff_invitations i
        WHERE i.auth_account_id = a.id
          AND i.admin_user_id = u.id
          AND i.status = 'accepted'
          AND i.accepted_at IS NOT NULL
      ) THEN 1 ELSE 0 END AS has_accepted_staff_invitation
    FROM auth_sessions s
    JOIN auth_accounts a ON a.id = s.auth_account_id
    LEFT JOIN admin_users u
      ON a.realm = 'staff'
     AND u.auth_account_id = a.id
    LEFT JOIN customers c
      ON a.realm = 'customer'
     AND c.auth_account_id = a.id
    WHERE (${hashPredicates})
      AND s.realm = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime(?)
    LIMIT 1
  `).bind(...hashBindings, realm, nowIso).first();

  if (!row) return null;
  if (row.realm !== realm) return null;
  const matchedHash = acceptedHashes.find(({ tokenHashVersion }) => (
    tokenHashVersion === Number(row.token_hash_version)
  ));
  if (
    !matchedHash
    || !await constantTimeEqual(matchedHash.tokenHash, row.token_hash)
  ) {
    return null;
  }
  if (Number(row.issued_auth_version) !== Number(row.current_auth_version)) {
    return null;
  }
  if (!sessionStatusAllows(row, nowMs)) return null;

  return {
    ...row,
    authorization_context: parseAuthorizationContext(
      row.authorization_context_json
    )
  };
}

export async function appendSecurityEvent(env, event) {
  if (!env?.DB) throw new Error("D1 binding is unavailable");
  const id = createOpaqueId();
  await env.DB.prepare(`
    INSERT INTO auth_security_events (
      id,
      event_type,
      outcome,
      subject_account_id,
      actor_account_id,
      actor_role,
      correlation_id,
      fingerprint_key_version,
      request_ip_hash,
      request_user_agent_hash,
      request_device_hash,
      metadata_json,
      occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    event.event_type,
    event.outcome,
    event.subject_account_id || null,
    event.actor_account_id || null,
    event.actor_role || null,
    event.correlation_id,
    event.fingerprint_key_version,
    event.request_ip_hash || null,
    event.request_user_agent_hash || null,
    event.request_device_hash || null,
    JSON.stringify(event.metadata || {}),
    new Date().toISOString()
  ).run();
  return id;
}
