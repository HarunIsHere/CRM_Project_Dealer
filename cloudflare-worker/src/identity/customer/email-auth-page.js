import { createOpaqueId } from "../crypto.js";

export const CUSTOMER_SHOP_ROUTE = "/shop";
export const CUSTOMER_EMAIL_CONTINUE_ROUTE = "/auth/customer/continue";

function page(nonce) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CRM Delivery Customer Shop</title>
<style nonce="${nonce}">
:root{color-scheme:light;--ink:#172033;--muted:#667085;--line:#dbe3ef;--blue:#2563eb;--bg:#f4f7fb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px system-ui,-apple-system,sans-serif;min-height:100vh;padding:24px}.shell{width:min(560px,100%);margin:5vh auto}.brand{color:var(--blue);font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:13px}.card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 50px #17203318;padding:30px;margin-top:18px}h1{font-size:34px;margin:8px 0 10px}h2{margin:0 0 14px}.muted{color:var(--muted)}label{display:block;font-weight:700;margin:18px 0 7px}input{width:100%;font:inherit;border:1px solid #bdc8da;border-radius:11px;padding:13px 14px}button{font:inherit;font-weight:750;color:#fff;background:var(--blue);border:0;border-radius:11px;padding:13px 18px;margin-top:16px;cursor:pointer}button.secondary{background:#172033;margin-left:8px}.error{color:#b42318}.success{color:#067647}.hidden{display:none}.profile{border-top:1px solid var(--line);margin-top:22px;padding-top:20px}@media(max-width:520px){body{padding:14px}.card{padding:22px}h1{font-size:29px}}
</style></head>
<body><main class="shell"><div class="brand">CRM Delivery</div><section class="card">
<h1>Customer Shop</h1><p class="muted">Sign in with the verified email connected to your customer account.</p>
<p id="status" aria-live="polite"></p>
<form id="email-form"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="email" required><button type="submit">Email me a sign-in code</button></form>
<form id="code-form" class="hidden"><label for="code">Eight-digit code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required><button type="submit">Sign in</button><button id="restart" type="button" class="secondary">Use another email</button></form>
<section id="confirm" class="hidden"><h2>Continue sign-in?</h2><p id="confirm-text" class="muted"></p><button id="confirm-button" type="button">Continue</button></section>
<section id="profile" class="profile hidden"><h2>Signed in</h2><p id="profile-name"></p><p id="profile-email" class="muted"></p><p class="muted">Your Web customer session now uses the same canonical account as Telegram and the native apps.</p><button id="logout" type="button" class="secondary">Log out</button></section>
</section></main>
<script nonce="${nonce}">(()=>{
const $=id=>document.getElementById(id),client={platform:"customer_web",app_version:"1.0.0"};let attempt=null,confirmation=null;
const message=(text,type="")=>{$("status").textContent=text;$("status").className=type};
const key=()=>crypto.randomUUID().replaceAll("-","");
const request=async(path,body,method="POST",headers={})=>{const response=await fetch(path,{method,credentials:"same-origin",headers:{"content-type":"application/json","idempotency-key":key(),...headers},body:body===null?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error?.message||"Request failed.");return data};
const showProfile=data=>{$("email-form").classList.add("hidden");$("code-form").classList.add("hidden");$("confirm").classList.add("hidden");$("profile").classList.remove("hidden");$("profile-name").textContent=data.customer?.full_name||"Customer";$("profile-email").textContent=data.customer?.email||"Verified email";message("You are signed in.","success")};
const finish=async body=>{const data=await request("/api/v1/customer/auth/email/complete",{...body,session_transport:"cookie",client});if(data.confirmation_required){confirmation=data.confirmation_token;$("confirm-text").textContent="Continue as the customer account for "+data.destination_masked+"?";$("confirm").classList.remove("hidden");$("email-form").classList.add("hidden");$("code-form").classList.add("hidden");message("Confirm before switching the customer account in this browser.");return}showProfile(data)};
$("email-form").addEventListener("submit",async event=>{event.preventDefault();message("Sending your sign-in email…");try{const data=await request("/api/v1/customer/auth/email/start",{email:$("email").value,intent:"sign_in",locale:navigator.language||"en",return_to:"home",initiation_nonce:null,session_transport:"cookie",client});attempt=data.attempt_id;$("email-form").classList.add("hidden");$("code-form").classList.remove("hidden");message("Check your email. Open the secure link or enter the eight-digit code.","success");$("code").focus()}catch(error){message(error.message,"error")}});
$("code-form").addEventListener("submit",async event=>{event.preventDefault();message("Checking the code…");try{await finish({attempt_id:attempt,manual_code:$("code").value})}catch(error){message(error.message,"error")}});
$("restart").addEventListener("click",()=>{attempt=null;$("code").value="";$("code-form").classList.add("hidden");$("email-form").classList.remove("hidden");message("");$("email").focus()});
$("confirm-button").addEventListener("click",async()=>{message("Completing sign-in…");try{const data=await request("/api/v1/customer/auth/email/confirm",{confirmation_token:confirmation,confirmation:"continue",session_transport:"cookie",client});showProfile(data)}catch(error){message(error.message,"error")}});
$("logout").addEventListener("click",async()=>{const cookie=document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("__Host-crm_customer_csrf="));const csrf=cookie?cookie.slice(cookie.indexOf("=")+1):"";try{await request("/api/v1/customer/auth/logout",{},"POST",{"x-csrf-token":csrf});location.reload()}catch(error){message(error.message,"error")}});
const token=new URLSearchParams(location.hash.slice(1)).get("token");if(token){history.replaceState(null,"",location.pathname);message("Checking your secure email link…");finish({token}).catch(error=>message(error.message,"error"))}else{fetch("/api/v1/customer/auth/session",{credentials:"same-origin"}).then(async response=>response.ok?showProfile(await response.json()):null).catch(()=>{})}
})();</script></body></html>`;
}

export function handleCustomerEmailAuthPage(request) {
  const url = new URL(request.url);
  const allowedPath = url.pathname === CUSTOMER_SHOP_ROUTE
    || url.pathname === CUSTOMER_EMAIL_CONTINUE_ROUTE;
  if (request.method !== "GET" || !allowedPath || url.search) {
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
