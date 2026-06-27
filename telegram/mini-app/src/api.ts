export const API_BASE_URL = "https://crm.ayartuerk.me/api/v1";

export type Product = {
  id: number;
  name: string;
  price: number;
  category_id?: number | null;
  category_name?: string | null;
};

export type CatalogResponse = {
  ok: boolean;
  catalog: {
    products: Product[];
  };
};

export type CustomerSessionStartResponse = {
  ok: boolean;
  session: {
    access_token: string;
    token_type: string;
    expires_at: string;
  };
  customer: {
    id: number;
    full_name: string;
    username: string;
    preferred_language: string;
  };
};

export type CustomerCartItem = {
  id?: number | null;
  product_id?: number | null;
  name?: string | null;
  product_name?: string | null;
  quantity: number;
  price_snapshot?: number | null;
  unit_price?: number | null;
  line_total?: number | null;
};

export type CustomerCart = {
  id?: number | null;
  status?: string;
  order_status?: string;
  items: CustomerCartItem[];
  total_amount: number;
  total_formatted?: string;
  currency?: string;
  item_count: number;
};

export type CustomerCartResponse = {
  ok: boolean;
  cart: CustomerCart;
};

export type CustomerOrderStatusHistory = {
  id: number;
  order_id?: number | null;
  previous_status?: string | null;
  new_status: string;
  changed_by_admin_username?: string | null;
  note?: string | null;
  created_at?: string | null;
};

export type CustomerOrderSummary = {
  id: number;
  public_order_code?: string | null;
  status?: string;
  order_status?: string;
  order_status_label?: string;
  total_amount: number;
  total_formatted?: string;
  currency?: string;
  created_at?: string | null;
  updated_at?: string | null;
  status_history?: CustomerOrderStatusHistory[];
};

export type CustomerOrderResponse = {
  ok: boolean;
  order: CustomerOrderSummary | null;
  cart?: CustomerCart;
};

export type CustomerOrdersResponse = {
  ok: boolean;
  orders: CustomerOrderSummary[];
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    "authorization": `Bearer ${accessToken}`,
    "content-type": "application/json"
  };
}

export function getPublicCatalog(): Promise<CatalogResponse> {
  return fetchJson<CatalogResponse>(`${API_BASE_URL}/public/catalog`);
}

export function startCustomerSession(input: {
  deviceId: string;
  fullName: string;
  username: string;
  language: string;
}): Promise<CustomerSessionStartResponse> {
  return fetchJson<CustomerSessionStartResponse>(`${API_BASE_URL}/customer/session/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      device_id: input.deviceId,
      platform: "telegram-mini-app",
      app_version: "0.1.0",
      full_name: input.fullName,
      username: input.username,
      language: input.language
    })
  });
}

export function getCustomerCart(accessToken: string): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart`, {
    headers: authHeaders(accessToken)
  });
}

export function getCustomerOrders(accessToken: string): Promise<CustomerOrdersResponse> {
  return fetchJson<CustomerOrdersResponse>(`${API_BASE_URL}/customer/orders`, {
    headers: authHeaders(accessToken)
  });
}

export function addCustomerCartItem(accessToken: string, productId: number, quantity: number): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart/items`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      product_id: productId,
      quantity
    })
  });
}

export function checkoutCustomerCart(accessToken: string): Promise<CustomerOrderResponse> {
  return fetchJson<CustomerOrderResponse>(`${API_BASE_URL}/customer/checkout/address`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      address: "Berlin",
      location_label: "Berlin",
      delivery_note: "Telegram mini app checkout"
    })
  });
}
