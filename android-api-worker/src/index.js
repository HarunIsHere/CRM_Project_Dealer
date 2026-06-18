const SUPPORTED_LANGUAGES = ["en", "de", "tr", "ar", "ru"];

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-language"
    }
  });
}

function apiResponse(data, status = 200) {
  return jsonResponse({
    ok: status >= 200 && status < 400,
    data: status >= 400 ? null : data,
    error: status >= 400 ? data?.error || "Request failed" : null
  }, status);
}

function safeLang(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : "en";
}

function getApiLanguage(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("lang");
  const fromHeader = request.headers.get("x-language") || request.headers.get("accept-language") || "";
  const candidate = fromQuery || fromHeader.split(",")[0]?.slice(0, 2) || "en";
  return safeLang(candidate);
}

async function handleHealth(request, env) {
  return apiResponse({
    app: env.APP_NAME || "CRM Delivery Android API",
    status: "ok",
    api_version: env.API_VERSION || "v1",
    language: getApiLanguage(request),
    domain: "api.horizend.com",
    protected_production_worker: "cloudflare-worker is separate"
  });
}

async function handleLanguages() {
  return apiResponse({
    default_language: "en",
    supported_languages: [
      { code: "en", name: "English", native_name: "English", rtl: false },
      { code: "de", name: "German", native_name: "Deutsch", rtl: false },
      { code: "tr", name: "Turkish", native_name: "Türkçe", rtl: false },
      { code: "ar", name: "Arabic", native_name: "العربية", rtl: true },
      { code: "ru", name: "Russian", native_name: "Русский", rtl: false }
    ]
  });
}

async function handleProducts(env) {
  const result = await env.DB.prepare(`
    SELECT
      p.id,
      p.name,
      p.price,
      p.category_id,
      pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.is_active = 1
    ORDER BY pc.name ASC, p.name ASC
  `).all();

  return apiResponse({
    products: (result.results || []).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category_id: product.category_id || null,
      category_name: product.category_name || null,
      currency: "EUR",
      is_active: true
    }))
  });
}

async function handleMeetingPoints(env) {
  const result = await env.DB.prepare(`
    SELECT id, name, address, google_maps_link, is_default, is_active
    FROM meeting_points
    WHERE is_active = 1
    ORDER BY is_default DESC, name ASC
  `).all();

  return apiResponse({
    meeting_points: (result.results || []).map((point) => ({
      id: point.id,
      name: point.name,
      address: point.address || "",
      google_maps_link: point.google_maps_link,
      is_default: Boolean(point.is_default),
      is_active: Boolean(point.is_active)
    }))
  });
}

async function handleCatalog(request, env) {
  const language = getApiLanguage(request);

  const [categoryResult, productResult, meetingPointResult] = await Promise.all([
    env.DB.prepare(`
      SELECT id, name, is_active
      FROM product_categories
      WHERE is_active = 1
      ORDER BY name ASC
    `).all(),
    env.DB.prepare(`
      SELECT
        p.id,
        p.name,
        p.price,
        p.category_id,
        pc.name AS category_name
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.is_active = 1
      ORDER BY pc.name ASC, p.name ASC
    `).all(),
    env.DB.prepare(`
      SELECT id, name, address, google_maps_link, is_default, is_active
      FROM meeting_points
      WHERE is_active = 1
      ORDER BY is_default DESC, name ASC
    `).all()
  ]);

  return apiResponse({
    language,
    currency: "EUR",
    categories: (categoryResult.results || []).map((category) => ({
      id: category.id,
      name: category.name,
      is_active: Boolean(category.is_active)
    })),
    products: (productResult.results || []).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category_id: product.category_id || null,
      category_name: product.category_name || null,
      currency: "EUR",
      is_active: true
    })),
    meeting_points: (meetingPointResult.results || []).map((point) => ({
      id: point.id,
      name: point.name,
      address: point.address || "",
      google_maps_link: point.google_maps_link,
      is_default: Boolean(point.is_default),
      is_active: Boolean(point.is_active)
    }))
  });
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, authorization, x-language"
      }
    });
  }

  const url = new URL(request.url);

  if (url.pathname === "/" || url.pathname === "/api/v1/health") return handleHealth(request, env);
  if (url.pathname === "/api/v1/languages") return handleLanguages();
  if (url.pathname === "/api/v1/products") return handleProducts(env);
  if (url.pathname === "/api/v1/meeting-points") return handleMeetingPoints(env);
  if (url.pathname === "/api/v1/catalog") return handleCatalog(request, env);

  return apiResponse({ error: "Android API endpoint not found" }, 404);
}

export default {
  fetch: handleRequest
};
