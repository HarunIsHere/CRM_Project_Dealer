import "./styles.css";
import { API_V1, getPublicPaymentMethods, getPublicShops } from "./api";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: unknown;
      };
    };
  }
}

const telegramApp = window.Telegram?.WebApp;
telegramApp?.ready();
telegramApp?.expand();

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

app.innerHTML = `
  <main class="shell">
    <section class="card">
      <p class="eyebrow">CRM Delivery</p>
      <h1>Customer Mini App</h1>
      <p class="muted">Shared API foundation is connected.</p>

      <div class="endpoint">
        <strong>API</strong>
        <span>${API_V1}</span>
      </div>

      <button id="loadButton">Load shops and payment methods</button>

      <pre id="result">Ready.</pre>
    </section>
  </main>
`;

const result = document.querySelector<HTMLPreElement>("#result");
const loadButton = document.querySelector<HTMLButtonElement>("#loadButton");

loadButton?.addEventListener("click", async () => {
  if (!result) {
    return;
  }

  result.textContent = "Loading...";

  try {
    const [shops, paymentMethods] = await Promise.all([
      getPublicShops(),
      getPublicPaymentMethods(),
    ]);

    const shopText = shops
      .map((shop) => {
        const payments = shop.payment_methods.map((method) => method.name).join(", ");
        return `- ${shop.name} (${shop.slug})\n  Payments: ${payments}`;
      })
      .join("\n");

    const paymentText = paymentMethods
      .map((method) => `- ${method.name} (${method.code})`)
      .join("\n");

    result.textContent = `Shops:\n${shopText}\n\nPayment methods:\n${paymentText}`;
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "Unknown error";
  }
});
