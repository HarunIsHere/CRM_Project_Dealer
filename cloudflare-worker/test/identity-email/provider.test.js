import assert from "node:assert/strict";
import test from "node:test";

import {
  EmailDeliveryError,
  classifyProviderError,
  createTransactionalEmailProvider,
  isArbitraryRecipientDeliveryAllowed,
  isControlledDestinationAllowed,
  normalizeEmailAddress,
  sendTransactionalEmail
} from "../../src/identity/email/provider.js";

function providerEnv(overrides = {}) {
  return {
    CRM_AUTH_EMAIL_PROVIDER: "cloudflare",
    CRM_AUTH_EMAIL_FROM: "security@auth.ayartuerk.me",
    CRM_AUTH_EMAIL_FROM_NAME: "CRM Delivery Security",
    CRM_AUTH_EMAIL_DELIVERY: "true",
    CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS: "false",
    CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS: "verified@example.com",
    AUTH_EMAIL: {
      async send() {
        return { messageId: "provider-message-1" };
      }
    },
    ...overrides
  };
}

const canonicalMessage = Object.freeze({
  to: "verified@example.com",
  subject: "Verify your email",
  text: "Use the secure verification link.",
  html: "<p>Use the secure verification link.</p>"
});

test("normalizes addresses and keeps arbitrary-recipient mode strictly opt-in", () => {
  assert.equal(normalizeEmailAddress("  User@Example.COM  "), "user@example.com");
  assert.equal(normalizeEmailAddress(null), "");
  assert.equal(normalizeEmailAddress("not-an-email"), "");
  assert.equal(normalizeEmailAddress("user@example.com.evil/path"), "");

  assert.equal(
    isArbitraryRecipientDeliveryAllowed(
      providerEnv({ CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS: "true" })
    ),
    true
  );
  assert.equal(
    isArbitraryRecipientDeliveryAllowed(
      providerEnv({ CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS: "TRUE" })
    ),
    false
  );
  assert.equal(isArbitraryRecipientDeliveryAllowed(providerEnv()), false);
});

test("controlled delivery accepts only normalized configured destinations", () => {
  const env = providerEnv({
    CRM_AUTH_EMAIL_ALLOWED_TEST_DESTINATIONS:
      "first@example.com, VERIFIED@EXAMPLE.COM, second@example.com"
  });

  assert.equal(isControlledDestinationAllowed(env, " verified@example.com "), true);
  assert.equal(isControlledDestinationAllowed(env, "unknown@example.com"), false);
  assert.equal(isControlledDestinationAllowed(env, ""), false);
  assert.equal(
    isControlledDestinationAllowed(
      { ...env, CRM_AUTH_EMAIL_ALLOW_ARBITRARY_RECIPIENTS: "true" },
      "any-recipient@example.net"
    ),
    true
  );
});

test("provider fails closed when the email binding is missing", () => {
  const env = providerEnv({ AUTH_EMAIL: undefined });

  assert.throws(
    () => createTransactionalEmailProvider(env),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "E_EMAIL_BINDING_UNAVAILABLE");
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test("provider fails closed unless delivery is explicitly enabled", () => {
  assert.throws(
    () => createTransactionalEmailProvider(
      providerEnv({ CRM_AUTH_EMAIL_DELIVERY: "false" })
    ),
    (error) => error instanceof EmailDeliveryError
      && error.code === "E_EMAIL_DELIVERY_DISABLED"
      && error.retryable === false
  );

  assert.throws(
    () => createTransactionalEmailProvider(
      providerEnv({ CRM_AUTH_EMAIL_DELIVERY: "TRUE" })
    ),
    (error) => error instanceof EmailDeliveryError
      && error.code === "E_EMAIL_DELIVERY_DISABLED"
  );
});

test("provider rejects a destination outside the controlled allowlist before sending", async () => {
  let calls = 0;
  const env = providerEnv({
    AUTH_EMAIL: {
      async send() {
        calls += 1;
        return { messageId: "must-not-send" };
      }
    }
  });

  await assert.rejects(
    () => sendTransactionalEmail(env, { ...canonicalMessage, to: "blocked@example.com" }),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.code, "E_RECIPIENT_NOT_ALLOWED");
      assert.equal(error.retryable, false);
      return true;
    }
  );
  assert.equal(calls, 0);
});

test("provider sends the canonical message through the binding and returns safe metadata", async () => {
  const calls = [];
  const env = providerEnv({
    AUTH_EMAIL: {
      async send(message) {
        calls.push(message);
        return { messageId: "provider-message-42" };
      }
    }
  });

  const result = await sendTransactionalEmail(env, {
    ...canonicalMessage,
    to: " VERIFIED@EXAMPLE.COM "
  });

  assert.deepEqual(calls, [
    {
      to: "verified@example.com",
      from: {
        email: "security@auth.ayartuerk.me",
        name: "CRM Delivery Security"
      },
      subject: canonicalMessage.subject,
      text: canonicalMessage.text,
      html: canonicalMessage.html
    }
  ]);
  assert.deepEqual(result, {
    provider: "cloudflare_email_service",
    messageId: "provider-message-42"
  });
});

test("provider requires text and HTML bodies before invoking the binding", async () => {
  let calls = 0;
  const env = providerEnv({
    AUTH_EMAIL: {
      async send() {
        calls += 1;
      }
    }
  });

  await assert.rejects(
    () => sendTransactionalEmail(env, { ...canonicalMessage, html: "" }),
    (error) => error instanceof EmailDeliveryError
      && error.code === "E_CANONICAL_MESSAGE_INVALID"
  );
  assert.equal(calls, 0);
});

test("provider errors are classified without exposing provider messages", () => {
  const cases = [
    ["E_RATE_LIMIT_EXCEEDED", true],
    ["E_DAILY_LIMIT_EXCEEDED", true],
    ["E_DELIVERY_FAILED", true],
    ["E_INTERNAL_SERVER_ERROR", true],
    ["E_VALIDATION_ERROR", false],
    ["E_RECIPIENT_NOT_ALLOWED", false],
    ["E_RECIPIENT_SUPPRESSED", false],
    ["E_SENDER_NOT_VERIFIED", false]
  ];

  for (const [code, retryable] of cases) {
    const classified = classifyProviderError(
      Object.assign(new Error("sensitive provider detail"), { code })
    );
    assert.ok(classified instanceof EmailDeliveryError);
    assert.equal(classified.code, code);
    assert.equal(classified.retryable, retryable);
    assert.equal(classified.provider, "cloudflare_email_service");
    assert.equal(classified.message, "Transactional email delivery failed.");
    assert.doesNotMatch(classified.message, /sensitive provider detail/);
  }

  const unknown = classifyProviderError(new Error("unknown sensitive failure"));
  assert.equal(unknown.code, "E_PROVIDER_UNKNOWN");
  assert.equal(unknown.retryable, true);
  assert.equal(unknown.message, "Transactional email delivery failed.");
});
