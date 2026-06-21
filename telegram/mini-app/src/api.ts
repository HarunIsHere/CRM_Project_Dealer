export const API_V1 = "https://crm.ayartuerk.me/api/v1";

export type PaymentMethod = {
  code: string;
  name: string;
  is_active?: boolean;
};

export type Shop = {
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

type ShopsResponse = {
  shops: Shop[];
};

type PaymentMethodsResponse = {
  payment_methods: PaymentMethod[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getPublicShops(): Promise<Shop[]> {
  const data = await fetchJson<ShopsResponse>(`${API_V1}/public/shops`);
  return data.shops;
}

export async function getPublicPaymentMethods(): Promise<PaymentMethod[]> {
  const data = await fetchJson<PaymentMethodsResponse>(`${API_V1}/public/payment-methods`);
  return data.payment_methods;
}
