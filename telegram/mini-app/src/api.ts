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

export type CustomerCartItem = {
  product_id: number;
  quantity: number;
  product_name: string;
  unit_price: number;
  shop_id?: number | null;
  shop_name?: string | null;
  line_total: number;
};

export type CustomerCart = {
  session_token: string;
  items: CustomerCartItem[];
  total_amount: number;
  currency: string;
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
  public_order_code: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at?: string | null;
  updated_at?: string | null;
  status_history?: CustomerOrderStatusHistory[];
};

export type CustomerOrderResponse = {
  ok: boolean;
  order: CustomerOrderSummary;
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

export function getPublicCatalog(): Promise<CatalogResponse> {
  return fetchJson<CatalogResponse>(`${API_BASE_URL}/public/catalog`);
}

export function getCustomerCart(sessionToken: string): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart?session_token=${encodeURIComponent(sessionToken)}`);
}

export function getCustomerOrders(sessionToken: string): Promise<CustomerOrdersResponse> {
  return fetchJson<CustomerOrdersResponse>(`${API_BASE_URL}/customer/orders?session_token=${encodeURIComponent(sessionToken)}`);
}

export function addCustomerCartItem(sessionToken: string, productId: number, quantity: number): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart/items`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      session_token: sessionToken,
      product_id: productId,
      quantity
    })
  });
}

export function checkoutCustomerCart(sessionToken: string): Promise<CustomerOrderResponse> {
  return fetchJson<CustomerOrderResponse>(`${API_BASE_URL}/customer/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      session_token: sessionToken,
      customer_name: "Telegram Mini App Demo Customer",
      phone: "+49123456789",
      delivery_address: "Berlin",
      payment_method_code: "cash_delivery",
      notes: "Telegram mini app smoke checkout"
    })
  });
}
