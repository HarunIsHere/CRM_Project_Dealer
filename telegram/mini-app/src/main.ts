import "./styles.css";
import {
  addCustomerCartItem,
  checkoutCustomerCart,
  getCustomerCart,
  getCustomerOrders,
  getPublicCatalog,
  startCustomerSession,
  type CustomerCart,
  type CustomerOrderSummary,
  type Product
} from "./api";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const telegramUser = tg?.initDataUnsafe?.user;
const deviceId = `telegram_${telegramUser?.id ?? "browser_demo"}`;
const tokenStorageKey = `crm_customer_access_token_${deviceId}`;

let accessToken = localStorage.getItem(tokenStorageKey) || "";
let products: Product[] = [];
let cart: CustomerCart | null = null;
let orders: CustomerOrderSummary[] = [];
let message = "Loading catalog...";

const app = document.querySelector<HTMLDivElement>("#app");

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayItemName(item: { name?: string | null; product_name?: string | null }): string {
  return item.product_name || item.name || "Product";
}

function displayLineTotal(item: { line_total?: number | null; price_snapshot?: number | null; unit_price?: number | null; quantity?: number | null }): number {
  if (item.line_total !== undefined && item.line_total !== null) return Number(item.line_total || 0);
  const unit = Number(item.price_snapshot ?? item.unit_price ?? 0);
  return unit * Number(item.quantity || 1);
}

function displayOrderCode(order: CustomerOrderSummary): string {
  return order.public_order_code || `Order #${order.id}`;
}

function displayOrderStatus(order: CustomerOrderSummary): string {
  return order.order_status_label || order.order_status || order.status || "new";
}

function renderOrderStatus(order: CustomerOrderSummary): string {
  const latest = order.status_history?.[0];
  const note = latest?.note ? ` · ${escapeHtml(latest.note)}` : "";
  const updated = latest?.created_at || order.updated_at || "";

  return `
    <p>Status: <strong>${escapeHtml(displayOrderStatus(order))}</strong></p>
    ${latest ? `<p class="muted">Last update: ${escapeHtml(latest.new_status)}${note}</p>` : ""}
    ${updated ? `<p class="muted">Updated: ${escapeHtml(updated)}</p>` : ""}
  `;
}

function render() {
  if (!app) return;

  const cartItems = cart?.items ?? [];
  const currency = cart?.currency ?? "EUR";

  app.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">CRM Delivery</p>
        <h1>Customer Shop</h1>
        <p>${escapeHtml(message)}</p>
        <p class="muted">Device: ${escapeHtml(deviceId)}</p>
      </section>

      <section class="card">
        <h2>Cart</h2>
        <p>Items: ${cart?.item_count ?? 0}</p>
        <p>Total: ${escapeHtml(cart?.total_formatted ?? `${cart?.total_amount ?? 0} ${currency}`)}</p>
        <div class="list">
          ${
            cartItems.length
              ? cartItems.map((item) => `
                <div class="row">
                  <span>${escapeHtml(item.quantity)} × ${escapeHtml(displayItemName(item))}</span>
                  <strong>${escapeHtml(displayLineTotal(item))} ${escapeHtml(currency)}</strong>
                </div>
              `).join("")
              : `<p class="muted">Cart is empty.</p>`
          }
        </div>
        <button id="checkout-button" ${cartItems.length ? "" : "disabled"}>Checkout</button>
      </section>

      <section class="card">
        <h2>Orders</h2>
        <button id="refresh-orders-button">Refresh orders</button>
        <div class="list">
          ${
            orders.length
              ? orders.map((order) => `
                <article class="order">
                  <div>
                    <h3>${escapeHtml(displayOrderCode(order))}</h3>
                    ${renderOrderStatus(order)}
                    <p>Total: ${escapeHtml(order.total_formatted ?? `${order.total_amount} ${order.currency ?? "EUR"}`)}</p>
                  </div>
                </article>
              `).join("")
              : `<p class="muted">No orders yet.</p>`
          }
        </div>
      </section>

      <section class="card">
        <h2>Products</h2>
        <div class="list">
          ${products.map((product) => `
            <article class="product">
              <div>
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.price)} EUR</p>
                <p class="muted">${escapeHtml(product.category_name ?? "")}</p>
              </div>
              <button data-product-id="${product.id}">Add</button>
            </article>
          `).join("")}
        </div>
      </section>
    </main>
  `;

  app.querySelectorAll<HTMLButtonElement>("button[data-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const productId = Number(button.dataset.productId);
      await addItem(productId);
    });
  });

  app.querySelector<HTMLButtonElement>("#checkout-button")?.addEventListener("click", async () => {
    await checkout();
  });

  app.querySelector<HTMLButtonElement>("#refresh-orders-button")?.addEventListener("click", async () => {
    await loadOrders();
  });
}

async function ensureSession() {
  if (accessToken) return accessToken;

  const fullName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || "Telegram Mini App Customer";
  const username = telegramUser?.username || "";
  const language = (telegramUser?.language_code || "en").slice(0, 2);

  const response = await startCustomerSession({
    deviceId,
    fullName,
    username,
    language
  });

  accessToken = response.session.access_token;
  localStorage.setItem(tokenStorageKey, accessToken);

  return accessToken;
}

async function loadOrders() {
  try {
    const token = await ensureSession();
    const ordersResponse = await getCustomerOrders(token);
    orders = ordersResponse.orders;
  } catch (error) {
    message = `Order loading failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function load() {
  try {
    const token = await ensureSession();

    const catalogResponse = await getPublicCatalog();
    products = catalogResponse.catalog.products;

    const cartResponse = await getCustomerCart(token);
    cart = cartResponse.cart;

    const ordersResponse = await getCustomerOrders(token);
    orders = ordersResponse.orders;

    message = "Catalog loaded";
  } catch (error) {
    localStorage.removeItem(tokenStorageKey);
    accessToken = "";
    message = `Loading failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function addItem(productId: number) {
  try {
    const token = await ensureSession();
    const response = await addCustomerCartItem(token, productId, 1);
    cart = response.cart;
    message = "Product added";
  } catch (error) {
    message = `Add failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function checkout() {
  try {
    const token = await ensureSession();
    const response = await checkoutCustomerCart(token);
    message = response.order ? `Order created: ${displayOrderCode(response.order)}` : "Checkout completed";

    const cartResponse = await getCustomerCart(token);
    cart = cartResponse.cart;

    const ordersResponse = await getCustomerOrders(token);
    orders = ordersResponse.orders;
  } catch (error) {
    message = `Checkout failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

void load();
