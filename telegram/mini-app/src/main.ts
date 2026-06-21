import "./styles.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          start_param?: string;
        };
        colorScheme?: "light" | "dark";
      };
    };
  }
}

type PaymentMethod = {
  code: string;
  name: string;
  is_active?: boolean;
};

type Shop = {
  id: number;
  name: string;
  slug: string;
  description: string;
  address: string;
  google_maps_link: string;
  phone: string;
  is_active: boolean;
  payment_methods: PaymentMethod[];
};

const API_V1 = "https://crm.ayartuerk.me/api/v1";

const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();

const user = webApp?.initDataUnsafe?.user;
const startParam = webApp?.initDataUnsafe?.start_param || "";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <section class="page">
    <div class="card">
      <p class="eyebrow">CRM Delivery</p>
      <h1>Telegram Mini App Foundation</h1>
      <p class="muted">Shared customer shopping client for Telegram.</p>

      <div class="info">
        <strong>API</strong>
        <span>${API_V1}</span>
      </div>

      <div class="info">
        <strong>Telegram user</strong>
        <span>${user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || user.id : "Not opened inside Telegram"}</span>
      </div>

      <div class="info">
        <strong>Start parameter</strong>
        <span>${startParam || "None"}</span>
      </div>

      <div class="actions">
        <button id="loadButton">Load shops and payment methods</button>
      </div>

      <div id="content" class="content-block">Ready.</div>
    </div>
  </section>
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPaymentMethods(methods: PaymentMethod[]): string {
  if (!methods.length) return `<p class="muted">No payment methods found.</p>`;

  return `
    <ul class="list">
      ${methods.map((method) => `
        <li>
          <strong>${escapeHtml(method.name)}</strong>
          <span>${escapeHtml(method.code)}</span>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderShops(shops: Shop[]): string {
  if (!shops.length) return `<p class="muted">No shops found.</p>`;

  return `
    <div class="shop-list">
      ${shops.map((shop) => `
        <article class="shop-card">
          <h2>${escapeHtml(shop.name)}</h2>
          <p class="muted">${escapeHtml(shop.description || "No description yet.")}</p>
          <p><strong>Slug:</strong> ${escapeHtml(shop.slug)}</p>
          <p><strong>Payment:</strong> ${shop.payment_methods.map((method) => escapeHtml(method.name)).join(", ") || "No payment methods"}</p>
        </article>
      `).join("")}
    </div>
  `;
}

async function loadFoundationData(): Promise<void> {
  const content = document.querySelector<HTMLDivElement>("#content")!;
  content.textContent = "Loading...";

  try {
    const [shopsResponse, paymentMethodsResponse] = await Promise.all([
      fetch(`${API_V1}/public/shops`),
      fetch(`${API_V1}/public/payment-methods`)
    ]);

    if (!shopsResponse.ok) throw new Error(`Shops request failed: ${shopsResponse.status}`);
    if (!paymentMethodsResponse.ok) throw new Error(`Payment methods request failed: ${paymentMethodsResponse.status}`);

    const shopsData = await shopsResponse.json() as { shops: Shop[] };
    const paymentMethodsData = await paymentMethodsResponse.json() as { payment_methods: PaymentMethod[] };

    content.innerHTML = `
      <section>
        <h2>Shops</h2>
        ${renderShops(shopsData.shops || [])}
      </section>

      <section>
        <h2>Payment methods</h2>
        ${renderPaymentMethods(paymentMethodsData.payment_methods || [])}
      </section>
    `;
  } catch (error) {
    content.innerHTML = `<pre>${escapeHtml(error instanceof Error ? error.message : "Unknown error")}</pre>`;
  }
}

document.querySelector<HTMLButtonElement>("#loadButton")!.addEventListener("click", loadFoundationData);
