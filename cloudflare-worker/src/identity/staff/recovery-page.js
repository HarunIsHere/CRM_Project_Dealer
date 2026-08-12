import { getAdminSharedText } from "../../i18n/admin-shared.generated.js";
import { createOpaqueId } from "../crypto.js";

export const ADMIN_RECOVERY_LANDING_ROUTE = "/auth/admin/recovery";

const RECOVERY_VERIFY_ROUTE = "/api/v1/admin/auth/recovery/verify";
const RECOVERY_PASSWORD_ROUTE = "/api/v1/admin/auth/recovery/password";
const ADMIN_LOGIN_ROUTE = "/admin/login";
const SUPPORTED_LOCALES = Object.freeze(["en", "de", "tr", "ar", "ru"]);
const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES);
const LANDING_TEXT_KEYS = Object.freeze([
  "auth_recovery_page_title",
  "auth_recovery_heading",
  "auth_recovery_intro",
  "auth_recovery_username",
  "auth_recovery_code_label",
  "auth_recovery_code_placeholder",
  "auth_recovery_new_password",
  "auth_recovery_confirm_password",
  "auth_recovery_verify_button",
  "auth_recovery_set_password_button",
  "auth_recovery_processing",
  "auth_recovery_new_password_error",
  "auth_recovery_invalid",
  "auth_recovery_error",
  "auth_recovery_success_heading",
  "auth_recovery_success_body",
  "auth_recovery_back_to_login",
  "auth_security_privacy_notice"
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

export function resolveAdminRecoveryLandingLocale(request) {
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
        throw new Error(`Missing Admin recovery text: ${locale}.${key}`);
      }
      return [key, value];
    }));
    return [locale, text];
  }));
}

function validNonce(value) {
  return /^[A-Za-z0-9+/_-]{22,128}={0,2}$/.test(String(value ?? ""));
}

function recoveryPageCsp(nonce) {
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
    ? recoveryPageCsp(nonce)
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

export function renderAdminRecoveryLandingPage({ locale = "en", nonce } = {}) {
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
  <title>${escapeHtml(text.auth_recovery_page_title)}</title>
  <style nonce="${nonce}">
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #172033; background: #f4f7fb; }
    main { width: min(100%, 560px); padding: clamp(24px, 5vw, 40px); border: 1px solid #d9e2ef; border-radius: 18px; background: #fff; box-shadow: 0 18px 50px rgba(20, 45, 85, .10); }
    h1, h2 { margin: 0 0 14px; line-height: 1.2; }
    p { line-height: 1.55; }
    .muted { color: #526078; }
    .status { min-height: 1.5em; margin: 24px 0; font-weight: 650; }
    label { display: block; margin: 0 0 6px; font-weight: 650; color: #34425c; }
    input { display: block; width: 100%; min-height: 46px; margin-bottom: 18px; padding: 10px 12px; border: 1px solid #c7d2e3; border-radius: 10px; font: inherit; color: #172033; background: #fff; }
    input:focus-visible { outline: 3px solid #8cb3ff; outline-offset: 2px; border-color: #2367e8; }
    button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; padding: 10px 18px; border: 0; border-radius: 10px; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; color: #fff; background: #2367e8; }
    button:disabled { cursor: wait; opacity: .65; }
    button:focus-visible { outline: 3px solid #8cb3ff; outline-offset: 3px; }
    .privacy { margin-top: 28px; font-size: .875rem; color: #68758a; }
    [hidden] { display: none !important; }
    html[dir="rtl"] body { text-align: right; }
  </style>
</head>
<body>
  <main aria-labelledby="recovery-heading">
    <section id="verify-panel">
      <h1 id="recovery-heading">${escapeHtml(text.auth_recovery_heading)}</h1>
      <p id="recovery-intro" class="muted">${escapeHtml(text.auth_recovery_intro)}</p>
      <p id="recovery-status" class="status" role="status" aria-live="polite">${escapeHtml(text.auth_recovery_processing)}</p>
      <div id="code-form" hidden>
        <label for="recovery-username">${escapeHtml(text.auth_recovery_username)}</label>
        <input id="recovery-username" name="username" type="text" autocomplete="username" maxlength="120">
        <label for="recovery-code">${escapeHtml(text.auth_recovery_code_label)}</label>
        <input id="recovery-code" name="manual_code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="${escapeHtml(text.auth_recovery_code_placeholder)}">
        <button id="verify-button" type="button">${escapeHtml(text.auth_recovery_verify_button)}</button>
      </div>
    </section>
    <section id="password-panel" tabindex="-1" hidden>
      <h2 id="password-heading">${escapeHtml(text.auth_recovery_heading)}</h2>
      <p id="password-intro" class="muted">${escapeHtml(text.auth_recovery_intro)}</p>
      <p id="password-status" class="status" role="status" aria-live="polite"></p>
      <label for="new-password">${escapeHtml(text.auth_recovery_new_password)}</label>
      <input id="new-password" name="new_password" type="password" autocomplete="new-password" minlength="8">
      <label for="confirm-password">${escapeHtml(text.auth_recovery_confirm_password)}</label>
      <input id="confirm-password" name="confirm_password" type="password" autocomplete="new-password" minlength="8">
      <button id="set-password-button" type="button">${escapeHtml(text.auth_recovery_set_password_button)}</button>
    </section>
    <section id="success-panel" tabindex="-1" hidden>
      <h2 id="success-heading">${escapeHtml(text.auth_recovery_success_heading)}</h2>
      <p id="success-body">${escapeHtml(text.auth_recovery_success_body)}</p>
      <a id="login-link" href="${ADMIN_LOGIN_ROUTE}">${escapeHtml(text.auth_recovery_back_to_login)}</a>
    </section>
    <p id="privacy-notice" class="privacy">${escapeHtml(text.auth_security_privacy_notice)}</p>
  </main>
  <script nonce="${nonce}">
  (() => {
    "use strict";

    const translations = ${catalogJson};
    const supportedLocales = new Set(["en", "de", "tr", "ar", "ru"]);
    const verifyRoute = ${JSON.stringify(RECOVERY_VERIFY_ROUTE)};
    const passwordRoute = ${JSON.stringify(RECOVERY_PASSWORD_ROUTE)};
    const loginRoute = ${JSON.stringify(ADMIN_LOGIN_ROUTE)};
    const elements = {
      verifyPanel: document.getElementById("verify-panel"),
      recoveryStatus: document.getElementById("recovery-status"),
      codeForm: document.getElementById("code-form"),
      username: document.getElementById("recovery-username"),
      code: document.getElementById("recovery-code"),
      verifyButton: document.getElementById("verify-button"),
      passwordPanel: document.getElementById("password-panel"),
      passwordStatus: document.getElementById("password-status"),
      newPassword: document.getElementById("new-password"),
      confirmPassword: document.getElementById("confirm-password"),
      setPasswordButton: document.getElementById("set-password-button"),
      successPanel: document.getElementById("success-panel"),
      loginLink: document.getElementById("login-link")
    };
    let locale = ${JSON.stringify(selectedLocale)};
    let token = null;
    let csrfToken = null;

    function text(key) {
      return translations[locale][key];
    }

    function showStatus(key) {
      elements.recoveryStatus.textContent = text(key);
    }

    function showPasswordStatus(key) {
      elements.passwordStatus.textContent = text(key);
    }

    function responseIsInvalidRecovery(response, body) {
      return response.status === 401
        || (body && body.error && body.error.code === "unauthorized");
    }

    async function readJson(response) {
      const contentType = response.headers.get("content-type") || "";
      const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
      if (mediaType !== "application/json") throw new Error("unexpected_response");
      return response.json();
    }

    async function postJson(route, body) {
      return fetch(route, {
        method: "POST",
        mode: "same-origin",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }

    async function verifyRecovery(payload) {
      elements.recoveryStatus.textContent = text("auth_recovery_processing");
      elements.verifyButton.disabled = true;
      try {
        const response = await postJson(verifyRoute, payload);
        const body = await readJson(response);
        if (!response.ok || !body || body.ok !== true) {
          showStatus(
            responseIsInvalidRecovery(response, body)
              ? "auth_recovery_invalid"
              : "auth_recovery_error"
          );
          elements.verifyButton.disabled = false;
          return;
        }
        const session = body.session;
        if (!session || session.scope !== "staff_recovery_email" || !session.csrf_token) {
          showStatus("auth_recovery_error");
          elements.verifyButton.disabled = false;
          return;
        }
        csrfToken = session.csrf_token;
        elements.verifyPanel.hidden = true;
        elements.passwordPanel.hidden = false;
        elements.newPassword.focus();
      } catch {
        showStatus("auth_recovery_error");
        elements.verifyButton.disabled = false;
      }
    }

    async function verifyWithToken() {
      return verifyRecovery({
        token,
        session_transport: "cookie",
        client_platform: "admin_web",
        app_version: "1.0.0"
      });
    }

    async function verifyWithCode() {
      const username = String(elements.username.value || "").trim();
      const manualCode = String(elements.code.value || "").trim();
      if (!username || !/^[0-9]{8}$/.test(manualCode)) {
        showStatus("auth_recovery_invalid");
        return;
      }
      return verifyRecovery({
        username,
        manual_code: manualCode,
        session_transport: "cookie",
        client_platform: "admin_web",
        app_version: "1.0.0"
      });
    }

    async function setPassword() {
      const newPassword = String(elements.newPassword.value || "");
      const confirmPassword = String(elements.confirmPassword.value || "");
      if (!newPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
        showPasswordStatus("auth_recovery_new_password_error");
        return;
      }
      if (!csrfToken) {
        showPasswordStatus("auth_recovery_error");
        return;
      }
      elements.setPasswordButton.disabled = true;
      elements.setPasswordButton.textContent = text("auth_recovery_processing");
      showPasswordStatus("auth_recovery_processing");

      try {
        const response = await fetch(passwordRoute, {
          method: "PUT",
          mode: "same-origin",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Csrf-Token": csrfToken
          },
          body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
        });
        const body = await readJson(response);
        if (!response.ok || !body || body.ok !== true || body.password_changed !== true) {
          showPasswordStatus(
            responseIsInvalidRecovery(response, body)
              ? "auth_recovery_invalid"
              : "auth_recovery_error"
          );
          elements.setPasswordButton.disabled = false;
          elements.setPasswordButton.textContent = text("auth_recovery_set_password_button");
          return;
        }
        csrfToken = null;
        elements.passwordPanel.hidden = true;
        elements.successPanel.hidden = false;
        elements.loginLink.href = loginRoute;
        elements.successPanel.focus();
      } catch {
        showPasswordStatus("auth_recovery_error");
        elements.setPasswordButton.disabled = false;
        elements.setPasswordButton.textContent = text("auth_recovery_set_password_button");
      }
    }

    elements.verifyButton.addEventListener("click", verifyWithCode);
    elements.setPasswordButton.addEventListener("click", setPassword);

    const fragment = String(window.location.hash || "");
    const tokenMatch = /^#token=([A-Za-z0-9_-]{43})$/.exec(fragment);
    window.history.replaceState(null, "", window.location.pathname);
    if (tokenMatch) {
      token = tokenMatch[1];
      void verifyWithToken();
    } else {
      elements.recoveryStatus.textContent = "";
      elements.codeForm.hidden = false;
      elements.username.focus();
    }
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

export function handleAdminRecoveryLanding(request, { nonceFactory = createOpaqueId } = {}) {
  const url = new URL(request.url);
  if (
    url.pathname !== ADMIN_RECOVERY_LANDING_ROUTE
    || url.search !== ""
    || url.hash !== ""
  ) {
    return genericLandingError(404);
  }
  if (request.method !== "GET") return genericLandingError(405, "GET");

  const nonce = nonceFactory();
  if (!validNonce(nonce)) throw new TypeError("The CSP nonce generator failed.");
  const locale = resolveAdminRecoveryLandingLocale(request);
  return new Response(renderAdminRecoveryLandingPage({ locale, nonce }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...securityHeaders(nonce)
    }
  });
}
