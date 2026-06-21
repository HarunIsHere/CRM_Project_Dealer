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

export type CatalogProduct = {
  id: number;
  name: string;
  price: number;
  price_formatted: string;
  is_active: boolean;
  category_id: number | null;
  category_name: string;
  aliases: string[];
};

export type CatalogCategory = {
  id: number;
  name: string;
};

export type MeetingPoint = {
  id: number;
  name: string;
  address: string;
  google_maps_link: string;
  is_default: boolean;
  is_active: boolean;
};

export type FulfillmentOptions = {
  allow_preferred_customer_location: boolean;
  allow_new_customer_location: boolean;
  allow_customer_pickup: boolean;
};

export type PublicCatalog = {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  meeting_points: MeetingPoint[];
  fulfillment: FulfillmentOptions;
  allowed_delivery_cities: string[];
  languages: string[];
};

type ShopsResponse = {
  shops: Shop[];
};

type PaymentMethodsResponse = {
  payment_methods: PaymentMethod[];
};

type CatalogResponse = {
  catalog: PublicCatalog;
};

type MeetingPointsResponse = {
  meeting_points: MeetingPoint[];
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

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const data = await fetchJson<CatalogResponse>(`${API_V1}/public/catalog`);
  return data.catalog;
}

export async function getPublicMeetingPoints(): Promise<MeetingPoint[]> {
  const data = await fetchJson<MeetingPointsResponse>(`${API_V1}/public/meeting-points`);
  return data.meeting_points;
}
