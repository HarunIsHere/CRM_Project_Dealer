import assert from "node:assert/strict";
import test from "node:test";

import {
  CompromisedPasswordServiceError,
  PWNED_PASSWORDS_PROVIDER,
  createPwnedPasswordsChecker
} from "../../src/identity/staff/pwned-passwords.js";

const PASSWORD = "correct horse battery staple";
const FULL_SHA1 = "ABF7AAD6438836DBE526AA231ABDE2D0EEF74D42";

function response(body, overrides = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain", ...overrides }
  });
}

async function expectUnavailable(action) {
  await assert.rejects(action, (error) => {
    assert.equal(error instanceof CompromisedPasswordServiceError, true);
    assert.equal(error.code, "temporarily_unavailable");
    assert.equal(error.status, 503);
    return true;
  });
}

test("Pwned Passwords contract uses five-character padded k-anonymity", () => {
  assert.deepEqual(PWNED_PASSWORDS_PROVIDER, {
    endpoint: "https://api.pwnedpasswords.com/range/",
    hash: "SHA-1",
    prefixLength: 5,
    padding: true,
    sendsPlaintext: false,
    sendsFullHash: false
  });
});

test("sends only the SHA-1 prefix and detects a positive suffix", async () => {
  let call;
  const checker = createPwnedPasswordsChecker({
    async fetchImpl(url, init) {
      call = { url, init };
      return response(`${FULL_SHA1.slice(5)}:42\r\n${"0".repeat(35)}:0\r\n`);
    }
  });

  assert.equal(await checker(PASSWORD), true);
  assert.equal(call.url, `https://api.pwnedpasswords.com/range/${FULL_SHA1.slice(0, 5)}`);
  assert.equal(call.url.includes(PASSWORD), false);
  assert.equal(call.url.includes(FULL_SHA1), false);
  assert.equal(call.init.method, "GET");
  assert.equal(call.init.headers["add-padding"], "true");
  assert.match(call.init.headers["user-agent"], /CRM-Delivery-Security/);
});

test("ignores padded zero-count rows and returns false when absent", async () => {
  const checker = createPwnedPasswordsChecker({
    fetchImpl: async () => response(`${"0".repeat(35)}:0\n${"F".repeat(35)}:7\n`)
  });
  assert.equal(await checker(PASSWORD), false);
});

test("fails closed for transport, status, media type, and malformed data", async () => {
  const cases = [
    async () => { throw new Error("network"); },
    async () => new Response("offline", { status: 503 }),
    async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" }
    }),
    async () => response("not-a-range-row"),
    async () => response(`${"A".repeat(35)}:1\n${"A".repeat(35)}:2`)
  ];
  for (const fetchImpl of cases) {
    const checker = createPwnedPasswordsChecker({ fetchImpl });
    await expectUnavailable(() => checker(PASSWORD));
  }
});

test("rejects invalid provider configuration", () => {
  assert.throws(
    () => createPwnedPasswordsChecker({ endpoint: "http://example.test/range/" }),
    CompromisedPasswordServiceError
  );
  assert.throws(
    () => createPwnedPasswordsChecker({ userAgent: "bad\nheader" }),
    CompromisedPasswordServiceError
  );
});
