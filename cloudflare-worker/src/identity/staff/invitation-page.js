import { getAdminSharedText } from "../../i18n/admin-shared.generated.js";
import { createOpaqueId } from "../crypto.js";

export const ADMIN_INVITATION_LANDING_ROUTE = "/auth/admin/invitation";

const INVITATION_PREVIEW_ROUTE = "/api/v1/admin/auth/invitations/preview";
const INVITATION_ACCEPT_ROUTE = "/api/v1/admin/auth/invitations/accept";
const ADMIN_ENROLLMENT_ROUTE = "/auth/admin/enrollment";
const SUPPORTED_LOCALES = Object.freeze(["en", "de", "tr", "ar", "ru"]);
const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES);
const LANDING_TEXT_KEYS = Object.freeze([
  "auth_invitation_page_title",
  "auth_invitation_loading",
  "auth_invitation_heading",
  "auth_invitation_intro",
  "auth_invitation_username",
  "auth_invitation_email",
  "auth_invitation_role",
  "auth_invitation_accept",
  "auth_invitation_accepting",
  "auth_invitation_invalid",
  "auth_invitation_error",
  "auth_invitation_verified_heading",
  "auth_invitation_verified_body",
  "auth_invitation_continue_setup",
  "auth_security_privacy_notice",
  "role_admin",
  "role_superadmin"
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeInlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function normalizeSupportedLocale(value) {
  const primary = String(value ?? "").trim().toLowerCase().split("-")[0];
  return SUPPORTED_LOCALE_SET.has(primary) ? primary : null;
}

export function resolveAdminInvitationLandingLocale(request) {
  const header = String(request?.headers?.get("accept-language") ?? "");
  const candidates = header.split(",").map((part, index) => {
    const [tag, ...parameters] = part.trim().split(";");
    let quality = 1;
    for (const parameter of parameters) {
      const match = parameter.trim().match(/^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i);
      if (!match) {
        quality = 0;
        break;
      }
      quality = Number(match[1]);
    }
    return { locale: normalizeSupportedLocale(tag), quality, index };
  }).filter((candidate) => candidate.locale && candidate.quality > 0);

  candidates.sort((left, right) => (
    right.quality - left.quality || left.index - right.index
  ));
  return candidates[0]?.locale ?? "en";
}

function landingCatalog() {
  return Object.fromEntries(SUPPORTED_LOCALES.map((locale) => {
    const source = getAdminSharedText(locale);
    const text = Object.fromEntries(LANDING_TEXT_KEYS.map((key) => {
      const value = source[key];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Missing Admin invitation text: ${locale}.${key}`);
      }
      return [key, value];
    }));
    return [locale, text];
  }));
}

function validNonce(value) {
  return /^[A-Za-z0-9+/_-]{22,128}={0,2}$/.test(String(value ?? ""));
}

function invitationPageCsp(nonce) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    `style-src 'nonce-${nonce}'`,
    "style-src-attr 'none'",
    "connect-src 'self'",
    "img-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "manifest-src 'none'",
    "worker-src 'none'",
    "trusted-types 'none'",
    "require-trusted-types-for 'script'"
  ].join("; ");
}

function securityHeaders(nonce = null) {
  const contentSecurityPolicy = nonce
    ? invitationPageCsp(nonce)
    : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
  return {
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    expires: "0",
    "content-security-policy": contentSecurityPolicy,
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()"
    ].join(", ")
  };
}

export function renderAdminInvitationLandingPage({ locale = "en", nonce } = {}) {
  const selectedLocale = normalizeSupportedLocale(locale) ?? "en";
  if (!validNonce(nonce)) throw new TypeError("A valid CSP nonce is required.");

  const translations = landingCatalog();
  const text = translations[selectedLocale];
  const direction = selectedLocale === "ar" ? "rtl" : "ltr";
  const catalogJson = serializeInlineJson(translations);

  return `<!doctype html>
<html lang="${selectedLocale}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(text.auth_invitation_page_title)}</title>
  <style nonce="${nonce}">
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #172033; background: #f4f7fb; }
    main { width: min(100%, 560px); padding: clamp(24px, 5vw, 40px); border: 1px solid #d9e2ef; border-radius: 18px; background: #fff; box-shadow: 0 18px 50px rgba(20, 45, 85, .10); }
    h1, h2 { margin: 0 0 14px; line-height: 1.2; }
    p { line-height: 1.55; }
    .muted { color: #526078; }
    .status { min-height: 1.5em; margin: 24px 0; font-weight: 650; }
    dl { display: grid; grid-template-columns: minmax(110px, auto) 1fr; gap: 12px 20px; margin: 24px 0; }
    dt { color: #526078; }
    dd { margin: 0; overflow-wrap: anywhere; font-weight: 650; }
    button, .button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; padding: 10px 18px; border: 0; border-radius: 10px; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; color: #fff; background: #2367e8; }
    button:disabled { cursor: wait; opacity: .65; }
    button:focus-visible, .button:focus-visible { outline: 3px solid #8cb3ff; outline-offset: 3px; }
    .privacy { margin-top: 28px; font-size: .875rem; color: #68758a; }
    [hidden] { display: none !important; }
    html[dir="rtl"] body { text-align: right; }
  </style>
</head>
<body>
  <main aria-labelledby="invitation-heading">
    <section id="invitation-panel">
      <h1 id="invitation-heading">${escapeHtml(text.auth_invitation_heading)}</h1>
      <p id="invitation-intro" class="muted">${escapeHtml(text.auth_invitation_intro)}</p>
      <p id="invitation-status" class="status" role="status" aria-live="polite">${escapeHtml(text.auth_invitation_loading)}</p>
      <dl id="invitation-details" hidden>
        <dt id="username-label">${escapeHtml(text.auth_invitation_username)}</dt><dd id="username-value"></dd>
        <dt id="email-label">${escapeHtml(text.auth_invitation_email)}</dt><dd id="email-value"></dd>
        <dt id="role-label">${escapeHtml(text.auth_invitation_role)}</dt><dd id="role-value"></dd>
      </dl>
      <button id="accept-button" type="button" hidden disabled>${escapeHtml(text.auth_invitation_accept)}</button>
    </section>
    <section id="verified-panel" tabindex="-1" hidden>
      <h2 id="verified-heading">${escapeHtml(text.auth_invitation_verified_heading)}</h2>
      <p id="verified-body">${escapeHtml(text.auth_invitation_verified_body)}</p>
      <a id="continue-link" class="button" href="${ADMIN_ENROLLMENT_ROUTE}">${escapeHtml(text.auth_invitation_continue_setup)}</a>
    </section>
    <p id="privacy-notice" class="privacy">${escapeHtml(text.auth_security_privacy_notice)}</p>
  </main>
  <script nonce="${nonce}">
  (() => {
    "use strict";

    const translations = ${catalogJson};
    const supportedLocales = new Set(["en", "de", "tr", "ar", "ru"]);
    const previewRoute = ${JSON.stringify(INVITATION_PREVIEW_ROUTE)};
    const acceptRoute = ${JSON.stringify(INVITATION_ACCEPT_ROUTE)};
    const enrollmentRoute = ${JSON.stringify(ADMIN_ENROLLMENT_ROUTE)};
    const elements = {
      panel: document.getElementById("invitation-panel"),
      heading: document.getElementById("invitation-heading"),
      intro: document.getElementById("invitation-intro"),
      status: document.getElementById("invitation-status"),
      details: document.getElementById("invitation-details"),
      usernameLabel: document.getElementById("username-label"),
      username: document.getElementById("username-value"),
      emailLabel: document.getElementById("email-label"),
      email: document.getElementById("email-value"),
      roleLabel: document.getElementById("role-label"),
      role: document.getElementById("role-value"),
      accept: document.getElementById("accept-button"),
      verified: document.getElementById("verified-panel"),
      verifiedHeading: document.getElementById("verified-heading"),
      verifiedBody: document.getElementById("verified-body"),
      continueLink: document.getElementById("continue-link"),
      privacy: document.getElementById("privacy-notice")
    };
    let locale = ${JSON.stringify(selectedLocale)};
    let token = null;
    let invitationReady = false;

    function text(key) {
      return translations[locale][key];
    }

    function applyLocale(value) {
      locale = supportedLocales.has(value) ? value : "en";
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
      document.title = text("auth_invitation_page_title");
      elements.heading.textContent = text("auth_invitation_heading");
      elements.intro.textContent = text("auth_invitation_intro");
      elements.usernameLabel.textContent = text("auth_invitation_username");
      elements.emailLabel.textContent = text("auth_invitation_email");
      elements.roleLabel.textContent = text("auth_invitation_role");
      elements.accept.textContent = text("auth_invitation_accept");
      elements.verifiedHeading.textContent = text("auth_invitation_verified_heading");
      elements.verifiedBody.textContent = text("auth_invitation_verified_body");
      elements.continueLink.textContent = text("auth_invitation_continue_setup");
      elements.privacy.textContent = text("auth_security_privacy_notice");
    }

    function hideInvitationControls() {
      elements.details.hidden = true;
      elements.accept.hidden = true;
      elements.accept.disabled = true;
      invitationReady = false;
    }

    function showFailure(key, discardToken) {
      hideInvitationControls();
      elements.status.textContent = text(key);
      if (discardToken) token = null;
    }

    function responseIsInvalidInvitation(response, body) {
      return response.status === 400
        && body
        && body.error
        && body.error.code === "invalid_or_expired_invitation";
    }

    async function readJson(response) {
      const contentType = response.headers.get("content-type") || "";
      const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
      if (mediaType !== "application/json") throw new Error("unexpected_response");
      return response.json();
    }

    function validPreview(body) {
      const invitation = body && body.ok === true ? body.invitation : null;
      return Boolean(
        invitation
        && typeof invitation.username === "string"
        && invitation.username.length >= 1
        && invitation.username.length <= 128
        && (invitation.role === "admin" || invitation.role === "superadmin")
        && typeof invitation.email_masked === "string"
        && invitation.email_masked.length >= 3
        && invitation.email_masked.length <= 320
        && supportedLocales.has(invitation.locale)
        && invitation.status === "pending"
      );
    }

    function validAcceptance(body) {
      return Boolean(
        body
        && body.ok === true
        && body.invitation
        && body.invitation.status === "accepted"
        && body.enrollment
        && body.enrollment.stage === "email_verified"
        && body.enrollment.email_verified === true
        && body.session
        && body.session.transport === "cookie"
        && body.session.scope === "staff_enrollment"
      );
    }

    async function postJson(route, body, idempotencyKey = null) {
      const headers = { "Accept": "application/json", "Content-Type": "application/json" };
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return fetch(route, {
        method: "POST",
        mode: "same-origin",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers,
        body: JSON.stringify(body)
      });
    }

    function randomIdempotencyKey() {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).split("+").join("-").split("/").join("_").replace(/=+$/, "");
    }

    async function previewInvitation() {
      try {
        const response = await postJson(previewRoute, { token });
        const body = await readJson(response);
        if (!response.ok) {
          showFailure(
            responseIsInvalidInvitation(response, body)
              ? "auth_invitation_invalid"
              : "auth_invitation_error",
            responseIsInvalidInvitation(response, body)
          );
          return;
        }
        if (!validPreview(body)) {
          showFailure("auth_invitation_error", false);
          return;
        }

        applyLocale(body.invitation.locale);
        elements.status.textContent = "";
        elements.username.textContent = body.invitation.username;
        elements.email.textContent = body.invitation.email_masked;
        elements.role.textContent = text(
          body.invitation.role === "superadmin" ? "role_superadmin" : "role_admin"
        );
        elements.details.hidden = false;
        elements.accept.hidden = false;
        elements.accept.disabled = false;
        invitationReady = true;
      } catch {
        showFailure("auth_invitation_error", false);
      }
    }

    async function acceptInvitation() {
      if (!invitationReady || !token) {
        showFailure("auth_invitation_invalid", true);
        return;
      }
      invitationReady = false;
      elements.accept.disabled = true;
      elements.accept.textContent = text("auth_invitation_accepting");
      elements.status.textContent = text("auth_invitation_accepting");

      try {
        const response = await postJson(
          acceptRoute,
          {
            token,
            session_transport: "cookie",
            client: { platform: "admin_web", app_version: "1.0.0" }
          },
          randomIdempotencyKey()
        );
        const body = await readJson(response);
        if (!response.ok || !validAcceptance(body)) {
          const invalid = responseIsInvalidInvitation(response, body);
          showFailure(
            invalid ? "auth_invitation_invalid" : "auth_invitation_error",
            invalid
          );
          if (!invalid) {
            invitationReady = true;
            elements.accept.hidden = false;
            elements.accept.disabled = false;
            elements.accept.textContent = text("auth_invitation_accept");
          }
          return;
        }

        token = null;
        hideInvitationControls();
        elements.panel.hidden = true;
        elements.verified.hidden = false;
        elements.continueLink.href = enrollmentRoute;
        elements.verified.focus();
      } catch {
        showFailure("auth_invitation_error", false);
        invitationReady = true;
        elements.accept.hidden = false;
        elements.accept.disabled = false;
        elements.accept.textContent = text("auth_invitation_accept");
      }
    }

    elements.accept.addEventListener("click", acceptInvitation);

    const fragment = String(window.location.hash || "");
    const tokenMatch = /^#token=([A-Za-z0-9_-]{43})$/.exec(fragment);
    window.history.replaceState(null, "", window.location.pathname);
    if (!tokenMatch) {
      showFailure("auth_invitation_invalid", true);
      return;
    }
    token = tokenMatch[1];
    void previewInvitation();
  })();
  </script>
</body>
</html>`;
}

function genericLandingError(status, allow = null) {
  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    ...securityHeaders()
  });
  if (allow) headers.set("allow", allow);
  return new Response(status === 405 ? "Method not allowed." : "Not found.", {
    status,
    headers
  });
}

export function handleAdminInvitationLanding(request, { nonceFactory = createOpaqueId } = {}) {
  const url = new URL(request.url);
  if (
    url.pathname !== ADMIN_INVITATION_LANDING_ROUTE
    || url.search !== ""
    || url.hash !== ""
  ) {
    return genericLandingError(404);
  }
  if (request.method !== "GET") return genericLandingError(405, "GET");

  const nonce = nonceFactory();
  if (!validNonce(nonce)) throw new TypeError("The CSP nonce generator failed.");
  const locale = resolveAdminInvitationLandingLocale(request);
  return new Response(renderAdminInvitationLandingPage({ locale, nonce }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...securityHeaders(nonce)
    }
  });
}
