import { createOpaqueId } from "../crypto.js";

export const CUSTOMER_EMAIL_ENROLLMENT_LANDING_ROUTE =
  "/auth/customer/email/enrollment";

function page(nonce) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify your email</title>
<style nonce="${nonce}">body{margin:0;background:#f4f7fb;color:#172033;font:16px system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}.card{background:#fff;border:1px solid #dbe3ef;border-radius:18px;box-shadow:0 18px 50px #17203318;max-width:520px;padding:34px;margin:20px}h1{margin-top:0}.muted{color:#667085}</style></head>
<body><main class="card"><h1>Verify your email</h1><p id="status">Return to the device where you started email setup and enter the eight-digit code from this email.</p><p class="muted">For your security, this link cannot attach an email without the customer session that started the request.</p></main>
<script nonce="${nonce}">(()=>{const token=new URLSearchParams(location.hash.slice(1)).get("token");history.replaceState(null,"",location.pathname);if(!token)document.getElementById("status").textContent="This verification link is invalid or expired.";})();</script></body></html>`;
}

export function handleCustomerEmailEnrollmentLanding(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname !== CUSTOMER_EMAIL_ENROLLMENT_LANDING_ROUTE || url.search) {
    return new Response(request.method === "GET" ? "Not found." : "Method not allowed.", {
      status: request.method === "GET" ? 404 : 405,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  const nonce = createOpaqueId();
  return new Response(page(nonce), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}
