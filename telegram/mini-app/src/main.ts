import "./styles.css";
import {
  addCustomerCartItem,
  checkoutCustomerCart,
  getCustomerCart,
  getPublicCatalog,
  type CustomerCart,
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
let message = "Loading catalog...";

const app = document.querySelector<HTMLDivElement>("#app");

function render() {
  if (!app) return;

  const cartItems = cart?.items ?? [];

  app.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">CRM Delivery</p>
        <h1>Customer Shop</h1>
        <p>${message}</p>
        <p class="muted">Session: ${sessionToken}</p>
      </section>

      <section class="card">
        <h2>Cart</h2>
        <p>Items: ${cart?.item_count ?? 0}</p>
        <p>Total: ${cart?.total_amount ?? 0} ${cart?.currency ?? "EUR"}</p>
        <div class="list">
          ${
            cartItems.length
              ? cartItems.map((item) => `
                <div class="row">
                  <span>${item.quantity} × ${item.product_name}</span>
                  <strong>${item.line_total} ${cart?.currency ?? "EUR"}</strong>
                </div>
              `).join("")
              : `<p class="muted">Cart is empty.</p>`
          }
        </div>
        <button id="checkout-button" ${cartItems.length ? "" : "disabled"}>Checkout</button>
      </section>

      <section class="card">
        <h2>Products</h2>
        <div class="list">
          ${products.map((product) => `
            <article class="product">
              <div>
                <h3>${product.name}</h3>
                <p>${product.price} EUR</p>
                <p class="muted">${product.category_name ?? ""}</p>
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
}

async function load() {
  try {
    const catalogResponse = await getPublicCatalog();
    products = catalogResponse.catalog.products;

    const cartResponse = await getCustomerCart(sessionToken);
    cart = cartResponse.cart;

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
  } catch (error) {
    message = `Checkout failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

void load();
