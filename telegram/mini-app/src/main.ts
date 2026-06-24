import "./styles.css";
import {
  addCustomerCartItem,
  checkoutCustomerCart,
  getCustomerCart,
  getCustomerOrders,
  getPublicCatalog,
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
          };
        };
      };
    };
  }
}

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const sessionToken = `telegram_${tg?.initDataUnsafe?.user?.id ?? Date.now()}`;

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

function renderOrderStatus(order: CustomerOrderSummary): string {
  const latest = order.status_history?.[0];
  const note = latest?.note ? ` · ${escapeHtml(latest.note)}` : "";
  const updated = latest?.created_at || order.updated_at || "";

  return `
    <p>Status: <strong>${escapeHtml(order.status)}</strong></p>
    ${latest ? `<p class="muted">Last update: ${escapeHtml(latest.new_status)}${note}</p>` : ""}
    ${updated ? `<p class="muted">Updated: ${escapeHtml(updated)}</p>` : ""}
  `;
}

function render() {
  if (!app) return;

  const cartItems = cart?.items ?? [];

  app.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">CRM Delivery</p>
        <h1>Customer Shop</h1>
        <p>${escapeHtml(message)}</p>
        <p class="muted">Session: ${escapeHtml(sessionToken)}</p>
      </section>

      <section class="card">
        <h2>Cart</h2>
        <p>Items: ${cart?.item_count ?? 0}</p>
        <p>Total: ${cart?.total_amount ?? 0} ${escapeHtml(cart?.currency ?? "EUR")}</p>
        <div class="list">
          ${
            cartItems.length
              ? cartItems.map((item) => `
                <div class="row">
                  <span>${escapeHtml(item.quantity)} × ${escapeHtml(item.product_name)}</span>
                  <strong>${escapeHtml(item.line_total)} ${escapeHtml(cart?.currency ?? "EUR")}</strong>
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
                    <h3>${escapeHtml(order.public_order_code)}</h3>
                    ${renderOrderStatus(order)}
                    <p>Total: ${escapeHtml(order.total_amount)} ${escapeHtml(order.currency)}</p>
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

async function loadOrders() {
  try {
    const ordersResponse = await getCustomerOrders(sessionToken);
    orders = ordersResponse.orders;
  } catch (error) {
    message = `Order loading failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function load() {
  try {
    const catalogResponse = await getPublicCatalog();
    products = catalogResponse.catalog.products;

    const cartResponse = await getCustomerCart(sessionToken);
    cart = cartResponse.cart;

    const ordersResponse = await getCustomerOrders(sessionToken);
    orders = ordersResponse.orders;

    message = "Catalog loaded";
  } catch (error) {
    message = `Loading failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function addItem(productId: number) {
  try {
    const response = await addCustomerCartItem(sessionToken, productId, 1);
    cart = response.cart;
    message = "Product added";
  } catch (error) {
    message = `Add failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function checkout() {
  try {
    const response = await checkoutCustomerCart(sessionToken);
    message = `Order created: ${response.order.public_order_code}`;

    const cartResponse = await getCustomerCart(sessionToken);
    cart = cartResponse.cart;

    const ordersResponse = await getCustomerOrders(sessionToken);
    orders = ordersResponse.orders;
  } catch (error) {
    message = `Checkout failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

void load();
