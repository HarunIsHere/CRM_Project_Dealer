export const API_BASE_URL = "https://crm.ayartuerk.me/api/v1";

export type Product = {
  id: number;
  name: string;
  price: number;
  category_id?: number | null;
  category_name?: string | null;
  shop_id?: number | null;
  shop_name?: string | null;
};

export type MeetingPoint = {
  id: number;
  name: string;
  address: string;
  google_maps_link: string;
  is_default: boolean;
  is_active: boolean;
};

export type PaymentMethod = {
  code: string;
  name: string;
  is_active?: boolean;
};

export type Shop = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  google_maps_link?: string | null;
  phone?: string | null;
  is_active: boolean;
  payment_methods?: PaymentMethod[];
};

export type CatalogResponse = {
  ok: boolean;
  catalog: {
    products: Product[];
    categories?: Array<{ id: number; name: string }>;
    meeting_points?: MeetingPoint[];
    fulfillment?: {
      allow_preferred_customer_location?: boolean;
      allow_new_customer_location?: boolean;
      allow_customer_pickup?: boolean;
    };
    allowed_delivery_cities?: string[];
    languages?: string[];
  };
};

export type PublicShopsResponse = {
  ok?: boolean;
  shops: Shop[];
};

export type PublicPaymentMethodsResponse = {
  ok?: boolean;
  payment_methods: PaymentMethod[];
};

export type PublicMeetingPointsResponse = {
  ok?: boolean;
  meeting_points: MeetingPoint[];
};

export type CustomerProfile = {
  id: number;
  full_name?: string;
  username?: string;
  language?: string;
  preferred_language?: string;
  conversation_state?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
};

export type CustomerSession = {
  access_token: string;
  token_type?: string;
  expires_at?: string | null;
};

export type CustomerSessionStartResponse = {
  ok: boolean;
  session: CustomerSession;
  customer?: CustomerProfile;
};

export type CustomerSessionVerifyResponse = {
  ok: boolean;
  valid: boolean;
  expires_at?: string | null;
  customer?: CustomerProfile;
};

export type CustomerLogoutResponse = {
  ok: boolean;
  logged_out?: boolean;
  revoked_count?: number;
};

export type CustomerProfileResponse = {
  ok: boolean;
  customer: CustomerProfile;
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
  shop_id?: number | null;
  shop_name?: string | null;
};

export type CustomerCart = {
  id?: number | null;
  status?: string;
  order_status?: string;
  delivery_location_label?: string | null;
  delivery_google_maps_link?: string | null;
  delivery_note?: string | null;
  admin_status_note?: string | null;
  session_token?: string;
  items: CustomerCartItem[];
  total_amount: number;
  total_formatted?: string;
  currency?: string;
  item_count: number;
  created_at?: string | null;
  updated_at?: string | null;
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
  delivery_location_label?: string | null;
  delivery_google_maps_link?: string | null;
  delivery_note?: string | null;
  admin_status_note?: string | null;
  total_amount: number;
  total_formatted?: string;
  currency?: string;
  item_count?: number;
  customer_name?: string | null;
  phone?: string | null;
  delivery_address?: string | null;
  payment_method_code?: string | null;
  notes?: string | null;
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

export function getPublicShops(): Promise<PublicShopsResponse> {
  return fetchJson<PublicShopsResponse>(`${API_BASE_URL}/public/shops`);
}

export function getPublicPaymentMethods(): Promise<PublicPaymentMethodsResponse> {
  return fetchJson<PublicPaymentMethodsResponse>(`${API_BASE_URL}/public/payment-methods`);
}

export function getPublicMeetingPoints(): Promise<PublicMeetingPointsResponse> {
  return fetchJson<PublicMeetingPointsResponse>(`${API_BASE_URL}/public/meeting-points`);
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

export function verifyCustomerSession(accessToken: string): Promise<CustomerSessionVerifyResponse> {
  return fetchJson<CustomerSessionVerifyResponse>(`${API_BASE_URL}/customer/session/verify`, {
    method: "POST",
    headers: authHeaders(accessToken)
  });
}

export function logoutCustomerSession(accessToken: string): Promise<CustomerLogoutResponse> {
  return fetchJson<CustomerLogoutResponse>(`${API_BASE_URL}/customer/session/logout`, {
    method: "POST",
    headers: authHeaders(accessToken)
  });
}

export function getCustomerProfile(accessToken: string): Promise<CustomerProfileResponse> {
  return fetchJson<CustomerProfileResponse>(`${API_BASE_URL}/customer/me`, {
    headers: authHeaders(accessToken)
  });
}

export function updateCustomerProfile(
  accessToken: string,
  input: {
    fullName: string;
    username?: string;
    preferredLanguage?: string;
  }
): Promise<CustomerProfileResponse> {
  return fetchJson<CustomerProfileResponse>(`${API_BASE_URL}/customer/me`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      full_name: input.fullName,
      username: input.username ?? "",
      preferred_language: input.preferredLanguage ?? "en"
    })
  });
}

export function getCustomerCart(accessToken: string): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart`, {
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

export function updateCustomerCartItem(accessToken: string, itemId: number, quantity: number): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart/items/${itemId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ quantity })
  });
}

export function removeCustomerCartItem(accessToken: string, itemId: number): Promise<CustomerCartResponse> {
  return fetchJson<CustomerCartResponse>(`${API_BASE_URL}/customer/cart/items/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken)
  });
}

export function checkoutCustomerCart(
  accessToken: string,
  input: {
    address?: string;
    locationLabel?: string;
    googleMapsLink?: string;
    latitude?: string;
    longitude?: string;
    deliveryNote?: string;
    saveAsPreferred?: boolean;
  } = {}
): Promise<CustomerOrderResponse> {
  const address = input.address ?? "Berlin";

  return fetchJson<CustomerOrderResponse>(`${API_BASE_URL}/customer/checkout/address`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      address,
      location_label: input.locationLabel ?? address,
      google_maps_link: input.googleMapsLink ?? "",
      latitude: input.latitude ?? "",
      longitude: input.longitude ?? "",
      delivery_note: input.deliveryNote ?? "Telegram mini app checkout",
      save_as_preferred: input.saveAsPreferred ?? false
    })
  });
}

export function checkoutCustomerPickup(
  accessToken: string,
  input: {
    notes?: string;
    paymentMethodCode?: string;
  } = {}
): Promise<CustomerOrderResponse> {
  return fetchJson<CustomerOrderResponse>(`${API_BASE_URL}/customer/checkout/pickup`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      notes: input.notes ?? "",
      payment_method_code: input.paymentMethodCode ?? ""
    })
  });
}

export function getCustomerOrders(accessToken: string): Promise<CustomerOrdersResponse> {
  return fetchJson<CustomerOrdersResponse>(`${API_BASE_URL}/customer/orders`, {
    headers: authHeaders(accessToken)
  });
}

export function getCustomerOrderDetail(accessToken: string, orderId: number): Promise<CustomerOrderResponse> {
  return fetchJson<CustomerOrderResponse>(`${API_BASE_URL}/customer/orders/${orderId}`, {
    headers: authHeaders(accessToken)
  });
}
