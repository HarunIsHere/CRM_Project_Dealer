import {
  EmailDeliveryError,
  sendTransactionalEmail
} from "./provider.js";
import {
  OutboxCryptoError,
  decryptOutboxPayload
} from "./outbox-crypto.js";
import {
  OutboxRepositoryError,
  claimOutboxItem,
  expireUndeliverableOutboxItems,
  listDueOutboxIds,
  loadLeasedOutboxItem,
  markOutboxSent,
  scheduleOutboxRetry,
  terminalizeOutboxItem
} from "./outbox-repository.js";
import {
  getIdentityEmailTemplatePolicy,
  isIdentityEmailDestinationStatusAllowed
} from "./policy.js";
import { renderAuthEmail } from "./templates.js";

const OUTBOX_ID_PATTERN = /^[0-9a-f]{32}$/;
const SAFE_EVENT_PATTERN = /^[a-z][a-z0-9_.-]{0,79}$/;
const SAFE_OUTCOME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const SAFE_PROVIDER_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const SAFE_ERROR_CODE_PATTERN = /^E_[A-Z0-9_]{1,79}$/;
const DEFAULT_LEASE_SECONDS = 120;
const DEFAULT_SWEEP_LIMIT = 25;
const RETRY_DELAYS_SECONDS = [15, 60, 180, 300, 600];

export function isEmailDeliveryEnabled(env) {
  return env?.CRM_AUTH_EMAIL_DELIVERY === "true";
}

function validOutboxId(value) {
  return OUTBOX_ID_PATTERN.test(String(value ?? ""));
}

function safeCount(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function safeErrorCode(error, fallback = "E_EMAIL_DISPATCH_FAILED") {
  const candidate = String(error?.code ?? "").trim().toUpperCase();
  return SAFE_ERROR_CODE_PATTERN.test(candidate) ? candidate : fallback;
}

function logAuthEmailEvent(
  {
    event,
    outcome,
    outboxId,
    provider,
    errorCode,
    attempt,
    processedCount,
    terminalizedCount,
    sentCount,
    retryCount,
    failedCount,
    errorCount,
    acknowledgedCount,
    invalidCount
  },
  level = "log"
) {
  const safeEvent = String(event ?? "");
  if (!SAFE_EVENT_PATTERN.test(safeEvent)) return;

  const entry = { event: safeEvent };
  const safeOutcome = String(outcome ?? "");
  if (SAFE_OUTCOME_PATTERN.test(safeOutcome)) entry.outcome = safeOutcome;
  if (validOutboxId(outboxId)) entry.outbox_id = String(outboxId);

  const safeProvider = String(provider ?? "").trim().toLowerCase();
  if (SAFE_PROVIDER_PATTERN.test(safeProvider)) entry.provider = safeProvider;

  const normalizedErrorCode = String(errorCode ?? "").trim().toUpperCase();
  if (SAFE_ERROR_CODE_PATTERN.test(normalizedErrorCode)) {
    entry.error_code = normalizedErrorCode;
  }

  const counts = {
    attempt,
    processed_count: processedCount,
    terminalized_count: terminalizedCount,
    sent_count: sentCount,
    retry_count: retryCount,
    failed_count: failedCount,
    error_count: errorCount,
    acknowledged_count: acknowledgedCount,
    invalid_count: invalidCount
  };
  for (const [name, value] of Object.entries(counts)) {
    const count = safeCount(value);
    if (count !== null) entry[name] = count;
  }

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

function resultLogLevel(outcome) {
  if (["failed", "sent_unrecorded", "lease_lost", "error"].includes(outcome)) {
    return "error";
  }
  if (["retry", "expired", "cancelled"].includes(outcome)) return "warn";
  return "log";
}

function timestamp(value) {
  const result = value instanceof Date ? value : new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

function eligibility(row, now) {
  const outboxExpiry = timestamp(row?.expires_at);
  if (!outboxExpiry || outboxExpiry.getTime() <= now.getTime()) {
    return {
      allowed: false,
      status: "expired",
      code: "E_OUTBOX_EXPIRED"
    };
  }

  if (!String(row?.display_email ?? "").trim()) {
    return {
      allowed: false,
      status: "failed",
      code: "E_OUTBOX_DESTINATION_UNAVAILABLE"
    };
  }

  const templatePolicy = getIdentityEmailTemplatePolicy(row?.template_key);
  if (!templatePolicy || templatePolicy.realm !== row?.realm) {
    return {
      allowed: false,
      status: "failed",
      code: "E_OUTBOX_TEMPLATE_POLICY_INVALID"
    };
  }

  if (row.challenge_id) {
    const challengeExpiry = timestamp(row.challenge_expires_at);
    if (
      row.challenge_row_id !== row.challenge_id
      || row.challenge_auth_account_id !== row.auth_account_id
      || row.challenge_email_address_id !== row.email_address_id
      || row.challenge_realm !== row.realm
      || templatePolicy.kind !== "challenge"
      || row.challenge_purpose !== templatePolicy.challengePurpose
    ) {
      return {
        allowed: false,
        status: "failed",
        code: "E_OUTBOX_CHALLENGE_INVARIANT"
      };
    }
    if (row.challenge_status !== "pending") {
      return {
        allowed: false,
        status: "cancelled",
        code: "E_OUTBOX_CHALLENGE_INACTIVE"
      };
    }
    if (!challengeExpiry || challengeExpiry.getTime() <= now.getTime()) {
      return {
        allowed: false,
        status: "expired",
        code: "E_OUTBOX_CHALLENGE_EXPIRED"
      };
    }
    if (!isIdentityEmailDestinationStatusAllowed(
      row.template_key,
      row.email_status
    )) {
      return {
        allowed: false,
        status: "cancelled",
        code: "E_OUTBOX_DESTINATION_INACTIVE"
      };
    }
    return {
      allowed: true,
      expiresAt: challengeExpiry.getTime() < outboxExpiry.getTime()
        ? challengeExpiry
        : outboxExpiry
    };
  }

  if (
    templatePolicy.kind !== "notification"
    || templatePolicy.challengePurpose !== null
    || !row.security_event_id
    || row.security_event_row_id !== row.security_event_id
    || row.security_event_subject_account_id !== row.auth_account_id
  ) {
    return {
      allowed: false,
      status: "failed",
      code: "E_OUTBOX_SECURITY_EVENT_INVARIANT"
    };
  }
  if (!isIdentityEmailDestinationStatusAllowed(
    row.template_key,
    row.email_status
  )) {
    return {
      allowed: false,
      status: "cancelled",
      code: "E_OUTBOX_DESTINATION_INACTIVE"
    };
  }

  return { allowed: true, expiresAt: outboxExpiry };
}

function normalizedFailure(error) {
  if (error instanceof EmailDeliveryError) {
    return {
      code: error.code,
      retryable: error.retryable,
      provider: error.provider
    };
  }
  if (error instanceof OutboxCryptoError) {
    return { code: error.code, retryable: false, provider: null };
  }
  if (error instanceof OutboxRepositoryError) throw error;
  return {
    code: "E_EMAIL_TEMPLATE_OR_DISPATCH_FAILED",
    retryable: false,
    provider: null
  };
}

function retryDelaySeconds(attemptCount) {
  const index = Math.max(
    0,
    Math.min(RETRY_DELAYS_SECONDS.length - 1, Number(attemptCount) - 1)
  );
  return RETRY_DELAYS_SECONDS[index];
}

async function finishIneligible(env, row, lease, ineligible, now) {
  const updated = await terminalizeOutboxItem(
    env,
    row.id,
    lease.leaseId,
    {
      status: ineligible.status,
      errorCode: ineligible.code,
      now
    }
  );
  return {
    outcome: updated ? ineligible.status : "lease_lost",
    outboxId: row.id,
    errorCode: ineligible.code
  };
}

export async function dispatchAuthEmailOutboxItem(
  env,
  outboxId,
  { now = new Date(), leaseSeconds = DEFAULT_LEASE_SECONDS } = {}
) {
  if (!isEmailDeliveryEnabled(env)) {
    return { outcome: "disabled", outboxId: String(outboxId ?? "") };
  }
  if (!validOutboxId(outboxId)) {
    return { outcome: "invalid_id", outboxId: "" };
  }

  const currentTime = timestamp(now);
  if (!currentTime) {
    throw new OutboxRepositoryError("E_OUTBOX_TIMESTAMP_INVALID");
  }
  const lease = await claimOutboxItem(env, outboxId, {
    now: currentTime,
    leaseSeconds
  });
  if (!lease) return { outcome: "not_claimed", outboxId };

  const row = await loadLeasedOutboxItem(env, outboxId, lease.leaseId);
  if (!row) return { outcome: "lease_lost", outboxId };

  const deliveryEligibility = eligibility(row, currentTime);
  if (!deliveryEligibility.allowed) {
    return finishIneligible(
      env,
      row,
      lease,
      deliveryEligibility,
      currentTime
    );
  }

  try {
    const payload = await decryptOutboxPayload(env, row);
    const rendered = await renderAuthEmail(row.template_key, row.locale, payload);
    const delivery = await sendTransactionalEmail(env, {
      to: row.display_email,
      subject: rendered?.subject,
      text: rendered?.text,
      html: rendered?.html
    });
    const recorded = await markOutboxSent(env, outboxId, lease.leaseId, {
      provider: delivery.provider,
      messageId: delivery.messageId,
      now: new Date()
    });
    return {
      outcome: recorded ? "sent" : "sent_unrecorded",
      outboxId,
      provider: delivery.provider
    };
  } catch (error) {
    const failure = normalizedFailure(error);
    const delaySeconds = retryDelaySeconds(row.attempt_count);
    const retryAt = new Date(currentTime.getTime() + delaySeconds * 1000);
    const attemptsRemain = Number(row.attempt_count) < Number(row.max_attempts);
    const windowRemains = (
      retryAt.getTime() + 1000 < deliveryEligibility.expiresAt.getTime()
    );

    if (failure.retryable && attemptsRemain && windowRemains) {
      const scheduled = await scheduleOutboxRetry(
        env,
        outboxId,
        lease.leaseId,
        {
          provider: failure.provider,
          errorCode: failure.code,
          availableAt: retryAt,
          now: currentTime
        }
      );
      if (scheduled) {
        return {
          outcome: "retry",
          outboxId,
          errorCode: failure.code,
          retryAfterSeconds: delaySeconds
        };
      }
    }

    const terminalCode = failure.retryable
      ? "E_OUTBOX_RETRY_EXHAUSTED"
      : failure.code;
    const failed = await terminalizeOutboxItem(
      env,
      outboxId,
      lease.leaseId,
      {
        status: "failed",
        provider: failure.provider,
        errorCode: terminalCode,
        now: currentTime
      }
    );
    return {
      outcome: failed ? "failed" : "lease_lost",
      outboxId,
      errorCode: terminalCode
    };
  }
}

export async function signalAuthEmailOutbox(env, outboxId) {
  if (!isEmailDeliveryEnabled(env) || !validOutboxId(outboxId)) return false;
  if (!env?.AUTH_EMAIL_QUEUE || typeof env.AUTH_EMAIL_QUEUE.send !== "function") {
    return false;
  }
  await env.AUTH_EMAIL_QUEUE.send({ outbox_id: outboxId });
  return true;
}

export async function processAuthEmailQueue(batch, env) {
  await expireUndeliverableOutboxItems(env);
  const messages = Array.isArray(batch?.messages) ? batch.messages : [];

  for (const message of messages) {
    const outboxId = String(message?.body?.outbox_id ?? "");
    if (!validOutboxId(outboxId) || !isEmailDeliveryEnabled(env)) {
      message.ack();
      continue;
    }

    try {
      const result = await dispatchAuthEmailOutboxItem(env, outboxId);
      logAuthEmailEvent(
        {
          event: "auth_email.queue_dispatch",
          outcome: result.outcome,
          outboxId,
          provider: result.provider,
          errorCode: result.errorCode,
          attempt: message?.attempts
        },
        resultLogLevel(result.outcome)
      );
      if (result.outcome === "retry") {
        message.retry({ delaySeconds: result.retryAfterSeconds });
      } else {
        message.ack();
      }
    } catch (error) {
      logAuthEmailEvent(
        {
          event: "auth_email.queue_dispatch",
          outcome: "retry_exception",
          outboxId,
          errorCode: safeErrorCode(error, "E_EMAIL_QUEUE_PROCESSING_FAILED"),
          attempt: message?.attempts
        },
        "error"
      );
      message.retry({ delaySeconds: DEFAULT_LEASE_SECONDS });
    }
  }
}

export async function processAuthEmailDeadLetterQueue(batch) {
  const messages = Array.isArray(batch?.messages) ? batch.messages : [];
  let invalidCount = 0;

  for (const message of messages) {
    const outboxId = String(message?.body?.outbox_id ?? "");
    const valid = validOutboxId(outboxId);
    if (!valid) invalidCount += 1;
    logAuthEmailEvent(
      {
        event: "auth_email.dead_letter",
        outcome: valid ? "acknowledged" : "acknowledged_invalid_id",
        outboxId: valid ? outboxId : null,
        attempt: message?.attempts
      },
      "error"
    );
    message.ack();
  }

  logAuthEmailEvent(
    {
      event: "auth_email.dead_letter_batch",
      outcome: "acknowledged",
      acknowledgedCount: messages.length,
      invalidCount
    },
    "error"
  );
  return { acknowledged: messages.length, invalid: invalidCount };
}

export async function sweepAuthEmailOutbox(
  env,
  { limit = DEFAULT_SWEEP_LIMIT } = {}
) {
  const terminalized = await expireUndeliverableOutboxItems(env);
  if (!isEmailDeliveryEnabled(env)) {
    if (terminalized > 0) {
      logAuthEmailEvent(
        {
          event: "auth_email.scheduled_sweep",
          outcome: "disabled_cleanup",
          processedCount: 0,
          terminalizedCount: terminalized
        },
        "warn"
      );
    }
    return { disabled: true, terminalized, processed: 0, outcomes: {} };
  }

  const ids = await listDueOutboxIds(env, { limit });
  const outcomes = {};
  let processed = 0;
  for (const outboxId of ids) {
    try {
      const result = await dispatchAuthEmailOutboxItem(env, outboxId);
      outcomes[result.outcome] = Number(outcomes[result.outcome] ?? 0) + 1;
      logAuthEmailEvent(
        {
          event: "auth_email.scheduled_dispatch",
          outcome: result.outcome,
          outboxId,
          provider: result.provider,
          errorCode: result.errorCode
        },
        resultLogLevel(result.outcome)
      );
    } catch (error) {
      outcomes.error = Number(outcomes.error ?? 0) + 1;
      logAuthEmailEvent(
        {
          event: "auth_email.scheduled_dispatch",
          outcome: "error",
          outboxId,
          errorCode: safeErrorCode(error)
        },
        "error"
      );
    }
    processed += 1;
  }
  if (processed > 0 || terminalized > 0) {
    logAuthEmailEvent(
      {
        event: "auth_email.scheduled_sweep",
        outcome: "completed",
        processedCount: processed,
        terminalizedCount: terminalized,
        sentCount: outcomes.sent ?? 0,
        retryCount: outcomes.retry ?? 0,
        failedCount: outcomes.failed ?? 0,
        errorCount: outcomes.error ?? 0
      },
      outcomes.error || outcomes.failed ? "error" : outcomes.retry ? "warn" : "log"
    );
  }
  return { disabled: false, terminalized, processed, outcomes };
}
