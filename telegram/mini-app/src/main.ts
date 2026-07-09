import "./styles.css";
import {
  addCustomerCartItem,
  checkoutCustomerCart,
  checkoutCustomerPickup,
  getCustomerCart,
  getCustomerOrderDetail,
  getCustomerOrders,
  getCustomerProfile,
  getPublicCatalog,
  getPublicMeetingPoints,
  getPublicPaymentMethods,
  getPublicShops,
  logoutCustomerSession,
  removeCustomerCartItem,
  startCustomerSession,
  updateCustomerCartItem,
  updateCustomerProfile,
  verifyCustomerSession,
  type CustomerCart,
  type CustomerOrderSummary,
  type CustomerProfile,
  type MeetingPoint,
  type PaymentMethod,
  type Product,
  type Shop
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
let profile: CustomerProfile | null = null;
let products: Product[] = [];
let shops: Shop[] = [];
let paymentMethods: PaymentMethod[] = [];
let meetingPoints: MeetingPoint[] = [];
let cart: CustomerCart | null = null;
let orders: CustomerOrderSummary[] = [];
let selectedOrder: CustomerOrderSummary | null = null;
let checkoutMode: "address" | "pickup" = "address";
let message = "Loading Mini App...";

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

function defaultFullName(): string {
  return [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || "Telegram Mini App Customer";
}

function defaultUsername(): string {
  return telegramUser?.username || "";
}

function defaultLanguage(): string {
  return (telegramUser?.language_code || "en").slice(0, 2);
}

function firstActiveMeetingPoint(): MeetingPoint | null {
  return meetingPoints.find((point) => point.is_active && point.is_default) || meetingPoints.find((point) => point.is_active) || null;
}

function firstActivePaymentMethod(): PaymentMethod | null {
  return paymentMethods.find((method) => method.is_active !== false) || paymentMethods[0] || null;
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

function renderProfile(): string {
  return `
    <section class="card">
      <h2>Profile</h2>
      <p>Name: <strong>${escapeHtml(profile?.full_name || defaultFullName())}</strong></p>
      <p class="muted">Username: ${escapeHtml(profile?.username || defaultUsername() || "-")}</p>
      <p class="muted">Language: ${escapeHtml(profile?.preferred_language || profile?.language || defaultLanguage())}</p>
      <div class="actions">
        <button id="refresh-profile-button">Refresh profile</button>
        <button id="update-profile-button">Sync Telegram profile</button>
        <button id="logout-button">Logout</button>
      </div>
    </section>
  `;
}

function renderCart(): string {
  const cartItems = cart?.items ?? [];
  const currency = cart?.currency ?? "EUR";

  return `
    <section class="card">
      <h2>Cart</h2>
      <p>Items: ${cart?.item_count ?? 0}</p>
      <p>Total: ${escapeHtml(cart?.total_formatted ?? `${cart?.total_amount ?? 0} ${currency}`)}</p>
      <div class="list">
        ${
          cartItems.length
            ? cartItems.map((item) => `
              <div class="row">
                <div>
                  <strong>${escapeHtml(item.quantity)} × ${escapeHtml(displayItemName(item))}</strong>
                  <p class="muted">${escapeHtml(displayLineTotal(item))} ${escapeHtml(currency)}</p>
                </div>
                <div class="actions">
                  <button data-cart-decrease-id="${item.id ?? ""}" ${item.id ? "" : "disabled"}>-</button>
                  <button data-cart-increase-id="${item.id ?? ""}" ${item.id ? "" : "disabled"}>+</button>
                  <button data-cart-remove-id="${item.id ?? ""}" ${item.id ? "" : "disabled"}>Remove</button>
                </div>
              </div>
            `).join("")
            : `<p class="muted">Cart is empty.</p>`
        }
      </div>

      <div class="checkout-box">
        <h3>Checkout</h3>
        <label>
          <input type="radio" name="checkout-mode" value="address" ${checkoutMode === "address" ? "checked" : ""}>
          Delivery address
        </label>
        <label>
          <input type="radio" name="checkout-mode" value="pickup" ${checkoutMode === "pickup" ? "checked" : ""}>
          Pickup
        </label>

        <input id="delivery-address-input" placeholder="Delivery address" value="${escapeHtml(cart?.delivery_location_label || "Berlin")}" ${checkoutMode === "pickup" ? "disabled" : ""}>
        <input id="delivery-note-input" placeholder="Note" value="${escapeHtml(cart?.delivery_note || "")}">
        <label class="muted">
          <input id="save-preferred-input" type="checkbox" ${checkoutMode === "pickup" ? "disabled" : ""}>
          Save as preferred delivery location
        </label>

        <p class="muted">Pickup point: ${escapeHtml(firstActiveMeetingPoint()?.name || "Default pickup point")}</p>
        <p class="muted">Payment: ${escapeHtml(firstActivePaymentMethod()?.name || "Default payment")}</p>
        <button id="checkout-button" ${cartItems.length ? "" : "disabled"}>${checkoutMode === "pickup" ? "Checkout pickup" : "Checkout delivery"}</button>
      </div>
    </section>
  `;
}

function renderOrders(): string {
  return `
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
                <button data-order-id="${order.id}">Details</button>
              </article>
            `).join("")
            : `<p class="muted">No orders yet.</p>`
        }
      </div>
      ${
        selectedOrder
          ? `
            <div class="detail">
              <h3>${escapeHtml(displayOrderCode(selectedOrder))}</h3>
              ${renderOrderStatus(selectedOrder)}
              <p>Total: ${escapeHtml(selectedOrder.total_formatted ?? `${selectedOrder.total_amount} ${selectedOrder.currency ?? "EUR"}`)}</p>
              <p class="muted">Delivery: ${escapeHtml(selectedOrder.delivery_location_label || selectedOrder.delivery_address || "-")}</p>
              <p class="muted">Note: ${escapeHtml(selectedOrder.delivery_note || selectedOrder.notes || "-")}</p>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderPublicInfo(): string {
  return `
    <section class="card">
      <h2>Public info</h2>
      <p>Shops: ${shops.length}</p>
      <p>Payment methods: ${paymentMethods.length}</p>
      <p>Meeting points: ${meetingPoints.length}</p>
      <div class="list">
        ${shops.slice(0, 3).map((shop) => `
          <div class="row">
            <span>${escapeHtml(shop.name)}</span>
            <span class="muted">${escapeHtml(shop.is_active ? "active" : "inactive")}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderProducts(): string {
  return `
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
  `;
}

function bindEvents() {
  if (!app) return;

  app.querySelectorAll<HTMLButtonElement>("button[data-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await addItem(Number(button.dataset.productId));
    });
  });

  app.querySelectorAll<HTMLButtonElement>("button[data-cart-increase-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await changeCartItemQuantity(Number(button.dataset.cartIncreaseId), 1);
    });
  });

  app.querySelectorAll<HTMLButtonElement>("button[data-cart-decrease-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await changeCartItemQuantity(Number(button.dataset.cartDecreaseId), -1);
    });
  });

  app.querySelectorAll<HTMLButtonElement>("button[data-cart-remove-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await removeItem(Number(button.dataset.cartRemoveId));
    });
  });

  app.querySelectorAll<HTMLInputElement>("input[name='checkout-mode']").forEach((input) => {
    input.addEventListener("change", () => {
      checkoutMode = input.value === "pickup" ? "pickup" : "address";
      render();
    });
  });

  app.querySelector<HTMLButtonElement>("#checkout-button")?.addEventListener("click", async () => {
    await checkout();
  });

  app.querySelector<HTMLButtonElement>("#refresh-orders-button")?.addEventListener("click", async () => {
    await loadOrders();
  });

  app.querySelectorAll<HTMLButtonElement>("button[data-order-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadOrderDetail(Number(button.dataset.orderId));
    });
  });

  app.querySelector<HTMLButtonElement>("#refresh-profile-button")?.addEventListener("click", async () => {
    await loadProfile();
  });

  app.querySelector<HTMLButtonElement>("#update-profile-button")?.addEventListener("click", async () => {
    await syncProfile();
  });

  app.querySelector<HTMLButtonElement>("#logout-button")?.addEventListener("click", async () => {
    await logout();
  });
}

function render() {
  if (!app) return;

  app.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">CRM Delivery</p>
        <h1>Customer Shop</h1>
        <p>${escapeHtml(message)}</p>
        <p class="muted">Device: ${escapeHtml(deviceId)}</p>
      </section>

      ${renderProfile()}
      ${renderCart()}
      ${renderOrders()}
      ${renderPublicInfo()}
      ${renderProducts()}
    </main>
  `;

  bindEvents();
}

async function ensureSession() {
  if (accessToken) {
    try {
      const verifyResponse = await verifyCustomerSession(accessToken);
      if (verifyResponse.valid) {
        profile = verifyResponse.customer ?? profile;
        return accessToken;
      }
    } catch {
      localStorage.removeItem(tokenStorageKey);
      accessToken = "";
    }
  }

  const response = await startCustomerSession({
    deviceId,
    fullName: defaultFullName(),
    username: defaultUsername(),
    language: defaultLanguage()
  });

  accessToken = response.session.access_token;
  profile = response.customer ?? profile;
  localStorage.setItem(tokenStorageKey, accessToken);

  return accessToken;
}

async function loadProfile() {
  try {
    const token = await ensureSession();
    const profileResponse = await getCustomerProfile(token);
    profile = profileResponse.customer;
    message = "Profile loaded";
  } catch (error) {
    message = `Profile loading failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function syncProfile() {
  try {
    const token = await ensureSession();
    const profileResponse = await updateCustomerProfile(token, {
      fullName: defaultFullName(),
      username: defaultUsername(),
      preferredLanguage: defaultLanguage()
    });
    profile = profileResponse.customer;
    message = "Profile synced";
  } catch (error) {
    message = `Profile sync failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function loadOrders() {
  try {
    const token = await ensureSession();
    const ordersResponse = await getCustomerOrders(token);
    orders = ordersResponse.orders;
    message = "Orders loaded";
  } catch (error) {
    message = `Order loading failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function loadOrderDetail(orderId: number) {
  try {
    const token = await ensureSession();
    const response = await getCustomerOrderDetail(token, orderId);
    selectedOrder = response.order;
    message = response.order ? "Order detail loaded" : "Order detail not found";
  } catch (error) {
    message = `Order detail failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function load() {
  try {
    const token = await ensureSession();

    const [catalogResponse, shopsResponse, paymentMethodsResponse, meetingPointsResponse, profileResponse, cartResponse, ordersResponse] = await Promise.all([
      getPublicCatalog(),
      getPublicShops(),
      getPublicPaymentMethods(),
      getPublicMeetingPoints(),
      getCustomerProfile(token),
      getCustomerCart(token),
      getCustomerOrders(token)
    ]);

    products = catalogResponse.catalog.products;
    shops = shopsResponse.shops;
    paymentMethods = paymentMethodsResponse.payment_methods;
    meetingPoints = meetingPointsResponse.meeting_points;
    profile = profileResponse.customer;
    cart = cartResponse.cart;
    orders = ordersResponse.orders;

    message = "Mini App loaded";
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

async function changeCartItemQuantity(itemId: number, delta: number) {
  const item = cart?.items.find((cartItem) => cartItem.id === itemId);
  if (!item) return;

  const nextQuantity = Number(item.quantity || 1) + delta;
  if (nextQuantity <= 0) {
    await removeItem(itemId);
    return;
  }

  try {
    const token = await ensureSession();
    const response = await updateCustomerCartItem(token, itemId, nextQuantity);
    cart = response.cart;
    message = "Cart updated";
  } catch (error) {
    message = `Cart update failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function removeItem(itemId: number) {
  try {
    const token = await ensureSession();
    const response = await removeCustomerCartItem(token, itemId);
    cart = response.cart;
    message = "Item removed";
  } catch (error) {
    message = `Remove failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function checkout() {
  try {
    const token = await ensureSession();
    const note = app?.querySelector<HTMLInputElement>("#delivery-note-input")?.value || "";
    const paymentMethod = firstActivePaymentMethod();

    const response = checkoutMode === "pickup"
      ? await checkoutCustomerPickup(token, {
        notes: note || "Telegram mini app pickup",
        paymentMethodCode: paymentMethod?.code || ""
      })
      : await checkoutCustomerCart(token, {
        address: app?.querySelector<HTMLInputElement>("#delivery-address-input")?.value || "Berlin",
        deliveryNote: note || "Telegram mini app delivery",
        saveAsPreferred: Boolean(app?.querySelector<HTMLInputElement>("#save-preferred-input")?.checked)
      });

    message = response.order ? `Order created: ${displayOrderCode(response.order)}` : "Checkout completed";
    selectedOrder = response.order;

    const cartResponse = await getCustomerCart(token);
    cart = cartResponse.cart;

    const ordersResponse = await getCustomerOrders(token);
    orders = ordersResponse.orders;
  } catch (error) {
    message = `Checkout failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  render();
}

async function logout() {
  try {
    if (accessToken) {
      await logoutCustomerSession(accessToken);
    }
  } catch {
    // Local logout still proceeds.
  }

  localStorage.removeItem(tokenStorageKey);
  accessToken = "";
  profile = null;
  cart = null;
  orders = [];
  selectedOrder = null;
  message = "Logged out locally";

  render();
}

void load();
