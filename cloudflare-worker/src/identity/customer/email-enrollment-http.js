import {
  constantTimeEqual,
  createOpaqueId,
  hashOpaqueToken
} from "../crypto.js";
import {
  createAcceptedChallengeTokenHashes,
  createMagicLinkToken,
  createVersionedChallengeTokenHash
} from "../challenge-token.js";
import { prepareEncryptedOutboxInsert } from "../email/outbox-repository.js";
import {
  maskEmailAddress,
  normalizeEmailAddress
} from "../email/normalization.js";
import {
  identityError,
  identityResponse,
  isIdentityOriginAllowed
} from "../http.js";
import {
  createIdentityRequestContext,
  IdentityProtocolError,
  readIdentityJson
} from "../protocol.js";
import { resolveCanonicalSession } from "../repository.js";

export const CUSTOMER_EMAIL_ENROLLMENT_ROUTE =
  "/api/v1/customer/security/email";
export const CUSTOMER_EMAIL_ENROLLMENT_START_ROUTE =
  "/api/v1/customer/security/email/enrollment";
export const CUSTOMER_EMAIL_ENROLLMENT_VERIFY_ROUTE =
  "/api/v1/customer/security/email/enrollment/complete";

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CODE_PATTERN = /^[0-9]{8}$/;
const ID_PATTERN = /^[0-9a-f]{32}$/;

function protocolError(code, status, message) {
  throw new IdentityProtocolError(code, status, message);
}

function requireDatabase(env) {
  if (!env?.DB || typeof env.DB.prepare !== "function" || typeof env.DB.batch !== "function") {
    protocolError("temporarily_unavailable", 503, "Identity persistence is unavailable.");
  }
  return env.DB;
}

function requireOrigin(request, env) {
  if (!isIdentityOriginAllowed(request, env)) {
    protocolError("origin_not_allowed", 403, "The request origin is not allowed.");
  }
}

function bearerToken(request) {
  const match = String(request.headers.get("authorization") || "")
    .match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  return match?.[1] || null;
}

async function requireCustomerSession(request, env) {
  const token = bearerToken(request);
  const session = token
    ? await resolveCanonicalSession(env, token, "customer")
    : null;
  if (!session || session.scope !== "customer_verified") {
    protocolError("unauthorized", 401, "A valid customer session is required.");
  }
  return session;
}

function locale(value) {
  const primary = String(value || "en").trim().toLowerCase().split("-")[0];
  return ["en", "de", "tr", "ar", "ru"].includes(primary) ? primary : "en";
}

function publicOrigin(env) {
  const parsed = new URL(String(env?.CRM_AUTH_PUBLIC_ORIGIN || "https://crm.ayartuerk.me"));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    protocolError("temporarily_unavailable", 503, "The public identity origin is unavailable.");
  }
  return parsed.origin;
}

function positiveVersion(value) {
  const text = String(value ?? "").trim();
  if (!/^[1-9][0-9]{0,2}$/.test(text)) {
    protocolError("temporarily_unavailable", 503, "Identity key configuration is unavailable.");
  }
  return Number(text);
}

function challengeCodeConfig(env) {
  const version = positiveVersion(env?.CRM_AUTH_CHALLENGE_HMAC_ACTIVE_KEY_VERSION);
  const key = String(env?.[`CRM_AUTH_CHALLENGE_HMAC_KEY_V${version}`] || "");
  if (key.length < 32 || key.length > 1024) {
    protocolError("temporarily_unavailable", 503, "Identity key configuration is unavailable.");
  }
  return { version, key };
}

function createManualCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
  return String(value).padStart(8, "0");
}

async function createCodeVerifier(env, accountId, challengeId, code) {
  const config = challengeCodeConfig(env);
  return {
    version: config.version,
    verifier: await hashOpaqueToken(
      ["crm-customer-email-enrollment-code-v1", `key-v${config.version}`, accountId, challengeId, code].join("\u0000"),
      config.key
    )
  };
}

async function accountEmailState(database, accountId) {
  return database.prepare(`
    SELECT id, display_email, normalized_email, status, is_primary, verified_at
    FROM auth_email_addresses
    WHERE auth_account_id = ?
      AND realm = 'customer'
      AND status = 'verified'
      AND verified_at IS NOT NULL
      AND replaced_at IS NULL
      AND revoked_at IS NULL
      AND deleted_at IS NULL
    ORDER BY is_primary DESC, created_at
    LIMIT 1
  `).bind(accountId).first();
}

function enrollmentBody(row) {
  return {
    present: Boolean(row),
    masked: row ? maskEmailAddress(row.display_email) : null,
    verified: Boolean(row),
    verified_at: row?.verified_at || null
  };
}

function errorResponse(request, env, error, requestId) {
  if (error instanceof IdentityProtocolError) {
    return identityError(request, env, error.code, error.message, error.status, error.details, requestId);
  }
  if (/unique constraint|constraint failed|sqlite_constraint/i.test(String(error?.message || error || ""))) {
    return identityError(
      request,
      env,
      "email_in_use",
      "This email is already connected to another customer account.",
      409,
      undefined,
      requestId
    );
  }
  return identityError(
    request,
    env,
    "temporarily_unavailable",
    "Customer email enrollment is temporarily unavailable.",
    503,
    undefined,
    requestId
  );
}

export async function handleCustomerEmailEnrollmentStatus(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "GET") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    requireOrigin(request, env);
    const session = await requireCustomerSession(request, env);
    const email = await accountEmailState(requireDatabase(env), session.auth_account_id);
    return identityResponse(
      request,
      env,
      { ok: true, request_id: context.requestId, email: enrollmentBody(email) },
      200,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

export async function handleCustomerEmailEnrollmentStart(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    requireOrigin(request, env);
    const session = await requireCustomerSession(request, env);
    const body = await readIdentityJson(request, {
      allowedFields: ["email"],
      requiredFields: ["email"]
    });
    let normalized;
    try {
      normalized = normalizeEmailAddress(body.email);
    } catch {
      protocolError("invalid_email", 400, "Enter a valid email address.");
    }
    const database = requireDatabase(env);
    const current = await accountEmailState(database, session.auth_account_id);
    if (current) {
      if (current.normalized_email !== normalized.normalizedEmail) {
        protocolError("email_already_enrolled", 409, "This customer account already has a verified email.");
      }
      return identityResponse(
        request,
        env,
        { ok: true, request_id: context.requestId, email: enrollmentBody(current) },
        200,
        context.requestId
      );
    }
    const used = await database.prepare(`
      SELECT auth_account_id
      FROM auth_email_addresses
      WHERE realm = 'customer'
        AND normalized_email = ?
        AND status = 'verified'
        AND verified_at IS NOT NULL
        AND replaced_at IS NULL
        AND revoked_at IS NULL
        AND deleted_at IS NULL
      LIMIT 1
    `).bind(normalized.normalizedEmail).first();
    if (used && used.auth_account_id !== session.auth_account_id) {
      protocolError("email_in_use", 409, "This email is already connected to another customer account.");
    }

    const nowAt = new Date().toISOString();
    const activeAttempt = await database.prepare(`
      SELECT resend_not_before
      FROM auth_challenges
      WHERE auth_account_id = ? AND realm = 'customer'
        AND purpose = 'email_enrollment' AND status = 'pending'
        AND datetime(expires_at) > datetime(?)
      LIMIT 1
    `).bind(session.auth_account_id, nowAt).first();
    if (
      activeAttempt?.resend_not_before
      && Date.parse(activeAttempt.resend_not_before) > Date.parse(nowAt)
    ) {
      protocolError("retry_later", 429, "Wait before requesting another verification email.");
    }
    const expiresAt = new Date(Date.now() + CHALLENGE_LIFETIME_MS).toISOString();
    const resendNotBefore = new Date(Date.now() + 60 * 1000).toISOString();
    const emailId = createOpaqueId();
    const challengeId = createOpaqueId();
    const correlationId = createOpaqueId();
    const token = createMagicLinkToken();
    const code = createManualCode();
    const [tokenHash, codeVerifier] = await Promise.all([
      createVersionedChallengeTokenHash(env, token, "email_enrollment"),
      createCodeVerifier(env, session.auth_account_id, challengeId, code)
    ]);
    const preferredLocale = locale(session.locale);
    const outbox = await prepareEncryptedOutboxInsert(
      env,
      {
        challengeId,
        emailAddressId: emailId,
        authAccountId: session.auth_account_id,
        realm: "customer",
        templateKey: "auth.customer.email_enrollment.verify.v1",
        challengePurpose: "email_enrollment",
        locale: preferredLocale,
        dedupeKey: `customer-email-enrollment:${challengeId}`,
        maxAttempts: 5,
        availableAt: nowAt,
        expiresAt
      },
      {
        action_url: `${publicOrigin(env)}/auth/customer/email/enrollment#token=${token}`,
        manual_code: code,
        expires_at: expiresAt
      }
    );

    await database.batch([
      database.prepare(`
        UPDATE auth_challenges
        SET status = 'invalidated', invalidated_at = ?, transition_id = COALESCE(transition_id, ?)
        WHERE auth_account_id = ? AND realm = 'customer' AND purpose = 'email_enrollment'
          AND status IN ('pending', 'verified')
      `).bind(nowAt, createOpaqueId(), session.auth_account_id),
      database.prepare(`
        UPDATE auth_email_addresses
        SET status = 'deleted', deleted_at = ?, updated_at = ?
        WHERE auth_account_id = ? AND realm = 'customer' AND status = 'pending'
      `).bind(nowAt, nowAt, session.auth_account_id),
      database.prepare(`
        INSERT INTO auth_email_addresses (
          id, auth_account_id, realm, normalized_email, normalization_version,
          display_email, status, is_primary, created_at, updated_at
        ) VALUES (?, ?, 'customer', ?, ?, ?, 'pending', 0, ?, ?)
      `).bind(
        emailId,
        session.auth_account_id,
        normalized.normalizedEmail,
        normalized.normalizationVersion,
        normalized.displayEmail,
        nowAt,
        nowAt
      ),
      database.prepare(`
        INSERT INTO auth_challenges (
          id, auth_account_id, realm, email_address_id, initiating_session_id,
          expected_auth_version, purpose, status, verification_method,
          required_proof_policy, token_hash, code_verifier, verifier_key_version,
          fingerprint_key_version, locale, correlation_id, max_attempts,
          failed_attempts, resend_not_before, expires_at, created_at
        ) VALUES (
          ?, ?, 'customer', ?, ?, ?, 'email_enrollment', 'pending',
          'magic_link_or_email_code', 'single', ?, ?, ?, ?, ?, ?, 5, 0, ?, ?, ?
        )
      `).bind(
        challengeId,
        session.auth_account_id,
        emailId,
        session.id,
        Number(session.current_auth_version),
        tokenHash.tokenHash,
        codeVerifier.verifier,
        codeVerifier.version,
        positiveVersion(env?.CRM_AUTH_FINGERPRINT_ACTIVE_KEY_VERSION || "1"),
        preferredLocale,
        correlationId,
        resendNotBefore,
        expiresAt,
        nowAt
      ),
      outbox.statement
    ]);

    return identityResponse(
      request,
      env,
      {
        ok: true,
        request_id: context.requestId,
        challenge: {
          id: challengeId,
          email: maskEmailAddress(normalized.displayEmail),
          expires_at: expiresAt
        }
      },
      202,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}

async function challengeByToken(env, database, token, nowAt) {
  const hashes = await createAcceptedChallengeTokenHashes(env, token, "email_enrollment");
  const placeholders = hashes.map(() => "?").join(", ");
  return database.prepare(`
    SELECT c.*, e.display_email, e.normalized_email, a.auth_version
    FROM auth_challenges c
    JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer'
    JOIN auth_email_addresses e
      ON e.id = c.email_address_id AND e.auth_account_id = c.auth_account_id AND e.realm = 'customer'
    WHERE c.token_hash IN (${placeholders})
      AND c.realm = 'customer' AND c.purpose = 'email_enrollment'
      AND c.status = 'pending' AND datetime(c.expires_at) > datetime(?)
      AND e.status = 'pending' AND a.status = 'active'
    ORDER BY c.created_at DESC LIMIT 1
  `).bind(...hashes, nowAt).first();
}

async function challengeByCode(env, database, session, challengeId, code, nowAt) {
  const challenge = await database.prepare(`
    SELECT c.*, e.display_email, e.normalized_email, a.auth_version
    FROM auth_challenges c
    JOIN auth_accounts a ON a.id = c.auth_account_id AND a.realm = 'customer'
    JOIN auth_email_addresses e
      ON e.id = c.email_address_id AND e.auth_account_id = c.auth_account_id AND e.realm = 'customer'
    WHERE c.id = ? AND c.auth_account_id = ? AND c.initiating_session_id = ?
      AND c.realm = 'customer' AND c.purpose = 'email_enrollment'
      AND c.status = 'pending' AND datetime(c.expires_at) > datetime(?)
      AND e.status = 'pending' AND a.status = 'active'
    LIMIT 1
  `).bind(challengeId, session.auth_account_id, session.id, nowAt).first();
  if (!challenge) return null;
  const verifier = await createCodeVerifier(env, session.auth_account_id, challengeId, code);
  if (
    Number(challenge.verifier_key_version) !== verifier.version
    || !await constantTimeEqual(challenge.code_verifier, verifier.verifier)
  ) {
    const failed = Number(challenge.failed_attempts || 0) + 1;
    await database.prepare(`
      UPDATE auth_challenges
      SET failed_attempts = ?,
          status = CASE WHEN ? >= max_attempts THEN 'invalidated' ELSE status END,
          invalidated_at = CASE WHEN ? >= max_attempts THEN ? ELSE invalidated_at END,
          transition_id = CASE WHEN ? >= max_attempts THEN COALESCE(transition_id, ?) ELSE transition_id END
      WHERE id = ? AND status = 'pending'
    `).bind(failed, failed, failed, nowAt, failed, createOpaqueId(), challengeId).run();
    return null;
  }
  return challenge;
}

async function consumeChallenge(database, challenge, nowAt) {
  if (Number(challenge.expected_auth_version) !== Number(challenge.auth_version)) {
    protocolError("invalid_challenge", 401, "The email verification request is invalid or expired.");
  }
  const conflict = await database.prepare(`
    SELECT auth_account_id
    FROM auth_email_addresses
    WHERE realm = 'customer' AND normalized_email = ? AND status = 'verified'
      AND verified_at IS NOT NULL AND replaced_at IS NULL AND revoked_at IS NULL AND deleted_at IS NULL
      AND auth_account_id <> ?
    LIMIT 1
  `).bind(challenge.normalized_email, challenge.auth_account_id).first();
  if (conflict) {
    protocolError("email_in_use", 409, "This email is already connected to another customer account.");
  }
  const transitionId = createOpaqueId();
  await database.batch([
    database.prepare(`
      UPDATE auth_email_addresses
      SET status = 'verified', verified_at = ?, updated_at = ?,
          is_primary = CASE WHEN NOT EXISTS (
            SELECT 1 FROM auth_email_addresses
            WHERE auth_account_id = ? AND realm = 'customer' AND status = 'verified'
              AND is_primary = 1 AND verified_at IS NOT NULL
              AND replaced_at IS NULL AND revoked_at IS NULL AND deleted_at IS NULL
          ) THEN 1 ELSE 0 END
      WHERE id = ? AND auth_account_id = ? AND realm = 'customer' AND status = 'pending'
    `).bind(nowAt, nowAt, challenge.auth_account_id, challenge.email_address_id, challenge.auth_account_id),
    database.prepare(`
      UPDATE auth_challenges
      SET status = 'consumed', consumed_at = ?, transition_id = ?
      WHERE id = ? AND auth_account_id = ? AND realm = 'customer'
        AND purpose = 'email_enrollment' AND status = 'pending'
        AND expected_auth_version = ? AND datetime(expires_at) > datetime(?)
    `).bind(
      nowAt,
      transitionId,
      challenge.id,
      challenge.auth_account_id,
      Number(challenge.expected_auth_version),
      nowAt
    )
  ]);
  return {
    present: true,
    masked: maskEmailAddress(challenge.display_email),
    verified: true,
    verified_at: nowAt
  };
}

export async function handleCustomerEmailEnrollmentVerify(request, env) {
  const context = createIdentityRequestContext(request);
  try {
    if (request.method !== "POST") protocolError("method_not_allowed", 405, "The HTTP method is not allowed.");
    requireOrigin(request, env);
    const body = await readIdentityJson(request, {
      allowedFields: ["token", "challenge_id", "manual_code"],
      requiredFields: []
    });
    const token = body.token === undefined ? "" : String(body.token).trim();
    const challengeId = body.challenge_id === undefined ? "" : String(body.challenge_id).trim();
    const code = body.manual_code === undefined ? "" : String(body.manual_code).trim();
    const usingToken = Boolean(token);
    const usingCode = Boolean(challengeId || code);
    if (usingToken === usingCode || (usingToken && !TOKEN_PATTERN.test(token))) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    if (usingCode && (!ID_PATTERN.test(challengeId) || !CODE_PATTERN.test(code))) {
      protocolError("invalid_request", 400, "The request shape is invalid.");
    }
    const database = requireDatabase(env);
    const nowAt = new Date().toISOString();
    const session = await requireCustomerSession(request, env);
    let challenge = usingToken
      ? await challengeByToken(env, database, token, nowAt)
      : await challengeByCode(env, database, session, challengeId, code, nowAt);
    if (
      challenge
      && (
        challenge.auth_account_id !== session.auth_account_id
        || challenge.initiating_session_id !== session.id
      )
    ) {
      challenge = null;
    }
    if (!challenge) {
      protocolError("invalid_challenge", 401, "The email verification request is invalid or expired.");
    }
    const email = await consumeChallenge(database, challenge, nowAt);
    return identityResponse(
      request,
      env,
      { ok: true, request_id: context.requestId, email },
      200,
      context.requestId
    );
  } catch (error) {
    return errorResponse(request, env, error, context.requestId);
  }
}
