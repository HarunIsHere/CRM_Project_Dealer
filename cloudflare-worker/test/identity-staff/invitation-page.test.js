import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import test from "node:test";

import { getAdminSharedText } from "../../src/i18n/admin-shared.generated.js";
import {
  ADMIN_INVITATION_LANDING_ROUTE,
  handleAdminInvitationLanding,
  renderAdminInvitationLandingPage,
  resolveAdminInvitationLandingLocale
} from "../../src/identity/staff/invitation-page.js";

const TEST_NONCE = "0123456789abcdef0123456789abcdef";
const TOKEN = "A".repeat(43);
const ELEMENT_IDS = [
  "invitation-panel",
  "invitation-heading",
  "invitation-intro",
  "invitation-status",
  "invitation-details",
  "username-label",
  "username-value",
  "email-label",
  "email-value",
  "role-label",
  "role-value",
  "accept-button",
  "verified-panel",
  "verified-heading",
  "verified-body",
  "continue-link",
  "privacy-notice"
];

function landingRequest({ method = "GET", acceptLanguage = "en", suffix = "" } = {}) {
  return new Request(`https://crm.ayartuerk.me${ADMIN_INVITATION_LANDING_ROUTE}${suffix}`, {
    method,
    headers: { "accept-language": acceptLanguage }
  });
}

function extractClientScript(html) {
  const scripts = [...html.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  return scripts[0][1];
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return String(name).toLowerCase() === "content-type"
          ? "application/json; charset=utf-8"
          : null;
      }
    },
    async json() {
      return body;
    }
  };
}

function fakeElement(id) {
  const listeners = new Map();
  return {
    id,
    textContent: "",
    hidden: ["invitation-details", "accept-button", "verified-panel"].includes(id),
    disabled: id === "accept-button",
    href: id === "continue-link" ? "/auth/admin/enrollment" : "",
    focused: false,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    listener(type) {
      return listeners.get(type);
    },
    focus() {
      this.focused = true;
    }
  };
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function runLandingClient({ fragment, responses, initialLocale = "en" }) {
  const html = renderAdminInvitationLandingPage({
    locale: initialLocale,
    nonce: TEST_NONCE
  });
  const script = extractClientScript(html);
  const elements = Object.fromEntries(ELEMENT_IDS.map((id) => [id, fakeElement(id)]));
  const fetchCalls = [];
  const historyCalls = [];
  const responseQueue = [...responses];
  const document = {
    title: "",
    documentElement: { lang: initialLocale, dir: initialLocale === "ar" ? "rtl" : "ltr" },
    getElementById(id) {
      assert.ok(elements[id], `unexpected element lookup: ${id}`);
      return elements[id];
    }
  };
  const window = {
    location: {
      hash: fragment,
      pathname: ADMIN_INVITATION_LANDING_ROUTE,
      assign() {
        throw new Error("the landing must not auto-navigate");
      }
    },
    history: {
      replaceState(...args) {
        historyCalls.push(args);
        window.location.hash = "";
      }
    }
  };
  const fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    assert.ok(responseQueue.length > 0, "unexpected fetch");
    return responseQueue.shift();
  };

  vm.runInNewContext(script, {
    btoa(value) {
      return Buffer.from(value, "binary").toString("base64");
    },
    crypto: webcrypto,
    document,
    fetch,
    JSON,
    Set,
    String,
    Uint8Array,
    window
  });
  await flushAsyncWork();
  return { document, elements, fetchCalls, historyCalls, script };
}

test("GET returns an uncached nonce-protected first-party-only document", async () => {
  const response = handleAdminInvitationLanding(landingRequest(), {
    nonceFactory: () => TEST_NONCE
  });
  const html = await response.text();
  const csp = response.headers.get("content-security-policy");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, new RegExp(`script-src 'nonce-${TEST_NONCE}'`));
  assert.match(csp, new RegExp(`style-src 'nonce-${TEST_NONCE}'`));
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /require-trusted-types-for 'script'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/);
  assert.equal((html.match(new RegExp(`nonce="${TEST_NONCE}"`, "g")) || []).length, 2);
  assert.doesNotMatch(html, /<(?:link|img|iframe|object|embed)\b/i);
  assert.doesNotMatch(html, /\b(?:src|action)\s*=/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /googletag|segment\.com|sentry\.io|newrelic|mixpanel|hotjar/i);
});

test("only the exact query-free GET landing route is accepted", async () => {
  const methodResponse = handleAdminInvitationLanding(landingRequest({ method: "POST" }));
  assert.equal(methodResponse.status, 405);
  assert.equal(methodResponse.headers.get("allow"), "GET");

  const queryToken = "secret-query-token";
  const queryResponse = handleAdminInvitationLanding(landingRequest({
    suffix: `?token=${queryToken}`
  }));
  assert.equal(queryResponse.status, 404);
  assert.doesNotMatch(await queryResponse.text(), new RegExp(queryToken));
  assert.equal(queryResponse.headers.get("cache-control"), "no-store, max-age=0");

  const otherPath = new Request("https://crm.ayartuerk.me/auth/admin/invitation/extra");
  assert.equal(handleAdminInvitationLanding(otherPath).status, 404);
});

test("Accept-Language selects only a supported first-class locale", () => {
  assert.equal(resolveAdminInvitationLandingLocale(landingRequest({
    acceptLanguage: "fr-FR, de-DE;q=0.8, en;q=0.6"
  })), "de");
  assert.equal(resolveAdminInvitationLandingLocale(landingRequest({
    acceptLanguage: "en;q=0.3, ar-SA;q=1, tr;q=0.8"
  })), "ar");
  assert.equal(resolveAdminInvitationLandingLocale(landingRequest({
    acceptLanguage: "ru-RU"
  })), "ru");
  assert.equal(resolveAdminInvitationLandingLocale(landingRequest({
    acceptLanguage: "*, fr;q=0.9"
  })), "en");
});

test("all five canonical Admin locales render and Arabic is RTL", async () => {
  for (const locale of ["en", "de", "tr", "ar", "ru"]) {
    const response = handleAdminInvitationLanding(landingRequest({
      acceptLanguage: `${locale}-${locale.toUpperCase()}`
    }), { nonceFactory: () => TEST_NONCE });
    const html = await response.text();
    const text = getAdminSharedText(locale);
    const direction = locale === "ar" ? "rtl" : "ltr";

    assert.match(html, new RegExp(`<html lang="${locale}" dir="${direction}">`));
    assert.ok(html.includes(text.auth_invitation_page_title));
    assert.ok(html.includes(text.auth_invitation_heading));
    assert.ok(html.includes(text.auth_invitation_accept));
    assert.ok(html.includes(text.auth_security_privacy_notice));
  }
});

test("the client accepts only an exact fragment token, clears it, and previews without consuming", async () => {
  const hostileUsername = `<img src=x onerror=alert(1)>`;
  const runtime = await runLandingClient({
    fragment: `#token=${TOKEN}`,
    responses: [jsonResponse(200, {
      ok: true,
      request_id: "a".repeat(32),
      invitation: {
        username: hostileUsername,
        role: "superadmin",
        email_masked: "h***@gmail.com",
        locale: "ar",
        status: "pending",
        expires_at: "2030-01-01T00:00:00.000Z"
      }
    })]
  });

  assert.deepEqual(runtime.historyCalls, [[null, "", ADMIN_INVITATION_LANDING_ROUTE]]);
  assert.equal(runtime.fetchCalls.length, 1);
  assert.equal(runtime.fetchCalls[0].url, "/api/v1/admin/auth/invitations/preview");
  assert.equal(runtime.fetchCalls[0].options.method, "POST");
  assert.equal(runtime.fetchCalls[0].options.credentials, "same-origin");
  assert.equal(runtime.fetchCalls[0].options.mode, "same-origin");
  assert.equal(runtime.fetchCalls[0].options.cache, "no-store");
  assert.equal(runtime.fetchCalls[0].options.referrerPolicy, "no-referrer");
  assert.deepEqual(JSON.parse(runtime.fetchCalls[0].options.body), { token: TOKEN });
  assert.equal(runtime.document.documentElement.lang, "ar");
  assert.equal(runtime.document.documentElement.dir, "rtl");
  assert.equal(runtime.elements["username-value"].textContent, hostileUsername);
  assert.equal(runtime.elements["email-value"].textContent, "h***@gmail.com");
  assert.equal(runtime.elements["role-value"].textContent, getAdminSharedText("ar").role_superadmin);
  assert.equal(runtime.elements["invitation-details"].hidden, false);
  assert.equal(runtime.elements["accept-button"].hidden, false);
  assert.equal(runtime.elements["accept-button"].disabled, false);
  assert.doesNotMatch(runtime.script, /\.innerHTML|insertAdjacentHTML|document\.write|\beval\s*\(/);
  assert.ok(Object.values(runtime.elements).every((element) => (
    !String(element.textContent).includes(TOKEN)
  )));
});

test("explicit acceptance uses a random idempotency key and reveals only the enrollment link", async () => {
  const runtime = await runLandingClient({
    fragment: `#token=${TOKEN}`,
    responses: [
      jsonResponse(200, {
        ok: true,
        request_id: "a".repeat(32),
        invitation: {
          username: "senkimsin",
          role: "superadmin",
          email_masked: "h***@gmail.com",
          locale: "en",
          status: "pending",
          expires_at: "2030-01-01T00:00:00.000Z"
        }
      }),
      jsonResponse(200, {
        ok: true,
        request_id: "b".repeat(32),
        invitation: {
          username: "senkimsin",
          role: "superadmin",
          email_masked: "h***@gmail.com",
          locale: "en",
          status: "accepted",
          expires_at: "2030-01-01T00:00:00.000Z"
        },
        enrollment: {
          stage: "email_verified",
          email_verified: true,
          password_set: false,
          passkey_registered: false,
          recovery_codes_acknowledged: false,
          deadline_at: "2030-01-04T00:00:00.000Z"
        },
        session: {
          id: "ses_test",
          transport: "cookie",
          scope: "staff_enrollment",
          expires_at: "2030-01-01T00:30:00.000Z",
          csrf_token: "C".repeat(43),
          assurance: {
            level: 1,
            methods: ["email"],
            authenticated_at: "2030-01-01T00:00:00.000Z",
            strong_authenticated_at: null
          }
        }
      })
    ]
  });

  await runtime.elements["accept-button"].listener("click")();
  assert.equal(runtime.fetchCalls.length, 2);
  const acceptance = runtime.fetchCalls[1];
  assert.equal(acceptance.url, "/api/v1/admin/auth/invitations/accept");
  assert.match(acceptance.options.headers["Idempotency-Key"], /^[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(JSON.parse(acceptance.options.body), {
    token: TOKEN,
    session_transport: "cookie",
    client: { platform: "admin_web", app_version: "1.0.0" }
  });
  assert.equal(runtime.elements["invitation-panel"].hidden, true);
  assert.equal(runtime.elements["verified-panel"].hidden, false);
  assert.equal(runtime.elements["verified-panel"].focused, true);
  assert.equal(runtime.elements["continue-link"].href, "/auth/admin/enrollment");
  assert.doesNotMatch(runtime.elements["continue-link"].href, /token|csrf|session/i);
  assert.doesNotMatch(runtime.script, /localStorage|sessionStorage/);
});

test("malformed and API-rejected invitations show one generic localized state without a fetch leak", async () => {
  const malformed = await runLandingClient({
    fragment: `#token=${"A".repeat(42)}`,
    responses: []
  });
  assert.equal(malformed.fetchCalls.length, 0);
  assert.equal(
    malformed.elements["invitation-status"].textContent,
    getAdminSharedText("en").auth_invitation_invalid
  );
  assert.equal(malformed.elements["invitation-details"].hidden, true);
  assert.equal(malformed.elements["accept-button"].hidden, true);

  const rejected = await runLandingClient({
    fragment: `#token=${TOKEN}`,
    initialLocale: "de",
    responses: [jsonResponse(400, {
      ok: false,
      request_id: "c".repeat(32),
      error: {
        code: "invalid_or_expired_invitation",
        message: "server detail must not be rendered"
      }
    })]
  });
  assert.equal(
    rejected.elements["invitation-status"].textContent,
    getAdminSharedText("de").auth_invitation_invalid
  );
  assert.ok(Object.values(rejected.elements).every((element) => (
    !String(element.textContent).includes("server detail")
    && !String(element.textContent).includes(TOKEN)
  )));
});
