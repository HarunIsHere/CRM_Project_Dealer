import "./styles.css";
import { API_V1, getPublicCatalog, getPublicPaymentMethods } from "./api";

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
      <p class="muted">Catalog, meeting points, and payment methods are connected.</p>

      <div class="endpoint">
        <strong>API</strong>
        <span>${API_V1}</span>
      </div>

      <button id="loadButton">Load catalog</button>

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

  result.textContent = "Loading catalog...";

  try {
    const [catalog, paymentMethods] = await Promise.all([
      getPublicCatalog(),
      getPublicPaymentMethods(),
    ]);

    const productText = catalog.products
      .map((product) => {
        const category = product.category_name || "Uncategorized";
        return `- ${product.name} · ${product.price_formatted} · ${category}`;
      })
      .join("\n");

    const categoryText = catalog.categories
      .map((category) => `- ${category.name}`)
      .join("\n");

    const meetingPointText = catalog.meeting_points
      .map((point) => `- ${point.name}\n  ${point.google_maps_link}`)
      .join("\n");

    const paymentText = paymentMethods
      .map((method) => `- ${method.name} (${method.code})`)
      .join("\n");

    result.textContent = `Products:\n${productText}\n\nCategories:\n${categoryText}\n\nMeeting points:\n${meetingPointText}\n\nPayment methods:\n${paymentText}\n\nDelivery cities:\n${catalog.allowed_delivery_cities.join(", ")}`;
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "Unknown error";
  }
});
