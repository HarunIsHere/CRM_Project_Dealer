const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

const ADMIN_CSS = ':root {\n    --bg: #f4f6f8;\n    --panel: #ffffff;\n    --text: #1f2937;\n    --muted: #6b7280;\n    --border: #d9dee7;\n    --primary: #2563eb;\n    --primary-hover: #1d4ed8;\n    --danger: #dc2626;\n    --success: #16a34a;\n    --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);\n    --radius: 14px;\n}\n\n* {\n    box-sizing: border-box;\n}\n\nbody {\n    margin: 0;\n    padding: 24px;\n    background: var(--bg);\n    color: var(--text);\n    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n    font-size: 15px;\n    line-height: 1.45;\n}\n\nh1 {\n    margin: 0 0 18px;\n    font-size: 28px;\n    letter-spacing: -0.03em;\n}\n\nh2 {\n    margin: 28px 0 12px;\n    font-size: 20px;\n    letter-spacing: -0.02em;\n}\n\nh3 {\n    margin: 22px 0 10px;\n    font-size: 17px;\n}\n\np {\n    margin: 10px 0;\n}\n\na {\n    color: var(--primary);\n    text-decoration: none;\n}\n\na:hover {\n    text-decoration: underline;\n}\n\nform {\n    margin: 0;\n}\n\nbody > form,\nbody > p,\nbody > table,\nbody > div,\nbody > h2 + form,\nbody > h3 + form {\n    max-width: 1200px;\n}\n\nbody > table,\n#open-requests-container,\nform:not([style*="display:inline"]) {\n    background: var(--panel);\n    border: 1px solid var(--border);\n    border-radius: var(--radius);\n    box-shadow: var(--shadow);\n    padding: 16px;\n    margin-bottom: 18px;\n}\n\ntable {\n    width: 100%;\n    border-collapse: collapse;\n    background: var(--panel);\n    border: 1px solid var(--border) !important;\n    border-radius: var(--radius);\n    overflow: hidden;\n}\n\nth,\ntd {\n    border: 1px solid var(--border) !important;\n    padding: 10px;\n    text-align: left;\n    vertical-align: top;\n}\n\nth {\n    background: #eef2f7;\n    font-weight: 700;\n    color: #111827;\n}\n\ntr:nth-child(even) td {\n    background: #fafbfc;\n}\n\ninput,\nselect,\ntextarea {\n    width: 100%;\n    max-width: 720px;\n    border: 1px solid var(--border);\n    border-radius: 10px;\n    padding: 9px 10px;\n    font: inherit;\n    background: #fff;\n    color: var(--text);\n}\n\ninput[type="checkbox"],\ninput[type="radio"] {\n    width: auto;\n    margin-right: 6px;\n}\n\ntextarea {\n    min-height: 84px;\n    resize: vertical;\n}\n\nbutton {\n    appearance: none;\n    border: 0;\n    border-radius: 10px;\n    background: var(--primary);\n    color: #fff;\n    padding: 9px 13px;\n    font: inherit;\n    font-weight: 650;\n    cursor: pointer;\n    margin: 3px 4px 3px 0;\n}\n\nbutton:hover {\n    background: var(--primary-hover);\n}\n\nbutton[type="submit"] {\n    background: var(--primary);\n}\n\nform[action*="logout"] button,\nform[action*="delete"] button {\n    background: var(--danger);\n}\n\nform[action*="logout"] button:hover,\nform[action*="delete"] button:hover {\n    background: #b91c1c;\n}\n\np[style*="color:red"],\n.error {\n    color: var(--danger) !important;\n    background: #fef2f2;\n    border: 1px solid #fecaca;\n    padding: 10px 12px;\n    border-radius: 10px;\n}\n\np[style*="color:green"],\n.success {\n    color: var(--success) !important;\n    background: #f0fdf4;\n    border: 1px solid #bbf7d0;\n    padding: 10px 12px;\n    border-radius: 10px;\n}\n\n.page-actions {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n    margin: 14px 0 22px;\n}\n\n.page-actions form {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n    margin: 0;\n}\n\n@media (max-width: 760px) {\n    body {\n        padding: 14px;\n        font-size: 14px;\n    }\n\n    h1 {\n        font-size: 23px;\n    }\n\n    h2 {\n        font-size: 18px;\n    }\n\n    body > table,\n    #open-requests-container,\n    form:not([style*="display:inline"]) {\n        padding: 12px;\n        border-radius: 12px;\n        overflow-x: auto;\n    }\n\n    table {\n        min-width: 720px;\n        display: block;\n        overflow-x: auto;\n        white-space: nowrap;\n    }\n\n    input,\n    select,\n    textarea {\n        max-width: none;\n    }\n\n    button {\n        width: 100%;\n        margin: 4px 0;\n    }\n\n    form[style*="display:inline"] button,\n    td button {\n        width: auto;\n    }\n\n    .page-actions {\n        display: block;\n    }\n}\n\n.request-action-button {\n    width: 135px;\n    text-align: center;\n}\n\n/* Compact admin UI adjustment */\nbody {\n    font-size: 13px;\n    padding: 18px;\n}\n\nh1 {\n    font-size: 24px;\n    margin-bottom: 14px;\n}\n\nh2 {\n    font-size: 17px;\n    margin: 22px 0 10px;\n}\n\nh3 {\n    font-size: 15px;\n}\n\nbutton {\n    padding: 6px 10px;\n    font-size: 13px;\n    border-radius: 8px;\n    margin: 2px 3px 2px 0;\n}\n\ninput,\nselect,\ntextarea {\n    font-size: 13px;\n    padding: 7px 9px;\n    border-radius: 8px;\n}\n\nth,\ntd {\n    padding: 7px 8px;\n}\n\nbody > table,\n#open-requests-container,\nform:not([style*="display:inline"]) {\n    padding: 12px;\n    margin-bottom: 14px;\n}\n\n.request-action-button {\n    width: 110px;\n}\n\n@media (max-width: 760px) {\n    body {\n        font-size: 13px;\n        padding: 10px;\n    }\n\n    h1 {\n        font-size: 21px;\n    }\n\n    h2 {\n        font-size: 16px;\n    }\n\n    button {\n        font-size: 13px;\n        padding: 7px 9px;\n    }\n\n    th,\n    td {\n        padding: 6px 7px;\n    }\n}\n\nhr {\n    max-width: 1200px;\n    border: 0;\n    border-top: 1px solid var(--border);\n    margin: 14px 0 18px;\n}\n\n.admin-header {\n    max-width: 1200px;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    margin-bottom: 10px;\n}\n\n.admin-header h1 {\n    margin: 0;\n}\n\n.header-actions {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.header-actions form {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n    margin: 0;\n}\n\n@media (max-width: 760px) {\n    .admin-header {\n        align-items: flex-start;\n        flex-direction: column;\n    }\n\n    .header-actions {\n        width: 100%;\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n    }\n\n    .header-actions a,\n    .header-actions form {\n        width: 100%;\n    }\n\n    .header-actions button {\n        width: 100%;\n    }\n}\n\n.admin-header {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n}\n\n.header-actions {\n    display: flex;\n    gap: 8px;\n}\n\n.header-actions form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.header-actions a {\n    display: inline-block;\n}\n\nhr + hr {\n    margin-top: -10px;\n}\n\n@media (max-width: 760px) {\n    .admin-header {\n        flex-direction: column;\n        align-items: flex-start;\n    }\n\n    .header-actions {\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n        width: 100%;\n    }\n}\n\n.all-done-header-form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 6px 0 0 0 !important;\n}\n\n.all-done-header-form button {\n    width: 90px;\n}\n#open-requests-container table th:nth-child(9),\n#open-requests-container table td:nth-child(9) {\n    width: 125px;\n    min-width: 125px;\n    max-width: 125px;\n    padding: 7px 8px;\n}\n\n#open-requests-container table td:nth-child(9) form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 0 5px 0 !important;\n}\n\n#open-requests-container table td:nth-child(9) button,\n.request-action-button {\n    width: 110px;\n    margin: 0 0 5px 0 !important;\n}\n\n.all-done-header-form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.all-done-header-form button {\n    width: 90px;\n}\n\n.open-requests-table-actions {\n    max-width: 1200px;\n    display: flex;\n    justify-content: flex-end;\n    margin: 0 0 8px 0;\n}\n\n.open-requests-table-actions form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.open-requests-table-actions button {\n    width: 90px;\n}\n\n.admin-info-text {\n    max-width: 1200px;\n    background: #eef2ff;\n    border: 1px solid #c7d2fe;\n    border-radius: 10px;\n    padding: 10px 12px;\n    color: #1e3a8a;\n    margin: 10px 0 18px;\n}\n';

const SUPPORTED_LANGUAGES = ["en", "de", "tr", "ar", "ru"];

const ADMIN_COOKIE_NAME = "admin_access_token";

const RESPONSE_TEXTS = {
  contact_admin_received: {
    en: "I received your message. I will help you shortly.",
    de: "Ich habe Ihre Nachricht erhalten. Ich helfe Ihnen gleich.",
    tr: "Mesajınızı aldım. Kısa süre içinde yardımcı olacağım.",
    ar: "وصلتني رسالتك. سأساعدك قريبا.",
    ru: "Я получил ваше сообщение. Скоро помогу вам."
  },
  unresolved: {
    en: "I did not understand exactly. Please choose by pressing a button or typing the number. You can share your location directly on chat for delivery. If you prefer to type your address, please use the Type address function.",
    de: "Ich habe es nicht genau verstanden. Bitte wählen Sie per Button oder geben Sie die Nummer ein. Sie können Ihren Standort direkt im Chat für die Lieferung teilen. Wenn Sie Ihre Adresse lieber eintippen möchten, nutzen Sie bitte die Funktion Adresse eingeben.",
    tr: "Tam olarak anlayamadım. Lütfen bir butona basarak veya numarayı yazarak seçin. Teslimat için konumunuzu doğrudan sohbette paylaşabilirsiniz. Adresinizi yazmak isterseniz lütfen Adres yaz fonksiyonunu kullanın.",
    ar: "لم أفهم بالضبط. يرجى الاختيار بالضغط على الزر أو كتابة الرقم. يمكنك مشاركة موقعك مباشرة في المحادثة للتوصيل. إذا كنت تفضل كتابة عنوانك، يرجى استخدام خيار كتابة العنوان.",
    ru: "Я не совсем понял. Пожалуйста, выберите кнопку или введите номер. Вы можете отправить свою локацию прямо в чате для доставки. Если вы хотите ввести адрес вручную, используйте функцию Ввести адрес."
  },
  type_address: {
    en: "Please type your address. After that, choose the correct location from the list.",
    de: "Bitte geben Sie Ihre Adresse ein. Wählen Sie danach den richtigen Standort aus der Liste.",
    tr: "Lütfen adresinizi yazın. Sonra listeden doğru konumu seçin.",
    ar: "يرجى كتابة عنوانك. بعد ذلك اختر الموقع الصحيح من القائمة.",
    ru: "Пожалуйста, введите ваш адрес. После этого выберите правильную локацию из списка."
  },
  choose_location: {
    en: "Please choose one of our active locations:",
    de: "Bitte wählen Sie einen unserer aktiven Standorte:",
    tr: "Lütfen aktif konumlarımızdan birini seçin:",
    ar: "يرجى اختيار أحد مواقعنا المتاحة:",
    ru: "Пожалуйста, выберите одну из наших активных локаций:"
  },
  no_active_locations: {
    en: "Currently no location is available. We will inform you shortly when it is available.",
    de: "Aktuell ist kein Standort verfügbar. Wir informieren Sie, sobald ein Standort verfügbar ist.",
    tr: "Şu anda uygun bir konum yok. Uygun olduğunda sizi bilgilendireceğiz.",
    ar: "لا يوجد موقع متاح حاليا. سنبلغك عندما يصبح متاحا.",
    ru: "Сейчас нет доступной локации. Мы сообщим вам, когда она появится."
  },
  address_not_found: {
    en: "I could not find this address. Please try again with a more specific address, hotel name, city, or country, or contact admin to describe your location.",
    de: "Ich konnte diese Adresse nicht finden. Bitte versuchen Sie es erneut mit einer genaueren Adresse, einem Hotelnamen, einer Stadt oder einem Land, oder kontaktieren Sie den Admin, um Ihren Standort zu beschreiben.",
    tr: "Bu adresi bulamadım. Lütfen daha net bir adres, otel adı, şehir veya ülke ile tekrar deneyin ya da konumunuzu açıklamak için admin ile iletişime geçin.",
    ar: "لم أتمكن من العثور على هذا العنوان. يرجى المحاولة مرة أخرى بعنوان أكثر دقة أو اسم فندق أو مدينة أو بلد، أو التواصل مع الإدارة لوصف موقعك.",
    ru: "Я не смог найти этот адрес. Попробуйте указать более точный адрес, название отеля, город или страну, либо свяжитесь с админом, чтобы описать вашу локацию."
  },
  no_delivery: {
    en: "Sorry, delivery is not possible for this location.",
    de: "Entschuldigung, Lieferung ist für diesen Standort nicht möglich.",
    tr: "Üzgünüm, bu konuma teslimat mümkün değil.",
    ar: "عذرا، التوصيل غير ممكن إلى هذا الموقع.",
    ru: "Извините, доставка в эту локацию невозможна."
  }
};

const ADMIN_TEXTS = {
  en: {
    meeting_point_help: "If only one location is active, the customer receives that location directly. If multiple locations are active, the customer can choose from all active locations; the preferred location/s is marked as preferred."
  },
  de: {
    meeting_point_help: "Wenn nur ein Standort aktiv ist, erhält der Kunde diesen Standort direkt. Wenn mehrere Standorte aktiv sind, kann der Kunde aus allen aktiven Standorten wählen; der/die bevorzugte(n) Standort(e) werden als bevorzugt markiert."
  },
  tr: {
    meeting_point_help: "Sadece bir konum aktifse müşteri o konumu direkt alır. Birden fazla konum aktifse müşteri tüm aktif konumlar arasından seçim yapar; tercih edilen konum/lar tercih edilen olarak işaretlenir."
  },
  ar: {
    meeting_point_help: "إذا كان هناك موقع نشط واحد فقط، يتلقى العميل هذا الموقع مباشرة. إذا كانت هناك عدة مواقع نشطة، يمكن للعميل الاختيار من جميع المواقع النشطة؛ ويتم تمييز الموقع/المواقع المفضلة كمفضلة."
  },
  ru: {
    meeting_point_help: "Если активна только одна локация, клиент получает её напрямую. Если активно несколько локаций, клиент выбирает одну из всех активных локаций; предпочтительная локация/локации помечаются как предпочтительные."
  }
};

const MENU_OPTIONS = {
  "1": {
    key: "products",
    callback_data: "option_products",
    reply_trigger: "products",
    typed_values: ["1", "products", "product", "produkte", "produkt", "ürünler", "urunler", "ürün", "urun"],
    labels: {
      en: "1. Products",
      de: "1. Produkte",
      tr: "1. Ürünler",
      ar: "1. المنتجات",
      ru: "1. Товары"
    }
  },
  "2": {
    key: "get_my_location",
    callback_data: "option_get_my_location",
    reply_trigger: "CHOOSE_MEETING_POINT",
    typed_values: ["2", "get my location", "location", "konum", "standort", "место", "локация", "مكان", "موقع"],
    labels: {
      en: "2. Get my location",
      de: "2. Meinen Standort erhalten",
      tr: "2. Konumumu al",
      ar: "2. الحصول على موقعي",
      ru: "2. Получить мою локацию"
    }
  },
  "3": {
    key: "type_address",
    callback_data: "option_type_address",
    reply_trigger: "TYPE_ADDRESS",
    typed_values: ["3", "type address", "type my address", "address", "adres", "adresse", "adres yaz", "адрес", "ввести адрес", "عنوان", "كتابة العنوان"],
    labels: {
      en: "3. Type address",
      de: "3. Adresse eingeben",
      tr: "3. Adres yaz",
      ar: "3. كتابة العنوان",
      ru: "3. Ввести адрес"
    }
  },
  "4": {
    key: "contact_admin",
    callback_data: "option_admin",
    reply_trigger: "CONTACT_ADMIN",
    typed_values: ["4", "admin", "contact admin", "administrator", "support", "hilfe", "admin kontaktieren", "admin ile iletişim", "админ", "администратор", "مشرف", "الإدارة"],
    labels: {
      en: "4. Contact admin",
      de: "4. Admin kontaktieren",
      tr: "4. Admin ile iletişim",
      ar: "4. التواصل مع الإدارة",
      ru: "4. Связаться с админом"
    }
  }
};

const LANGUAGE_KEYWORDS = {
  en: ["location", "address", "where", "meet", "meeting", "product", "products", "price", "hello", "hi"],
  de: ["standort", "adresse", "wo", "treffen", "produkt", "produkte", "preis", "hallo", "guten"],
  tr: ["mekan", "konum", "adres", "nerede", "buluş", "buluşma", "lokasyon", "ürün", "urun", "fiyat", "selam", "merhaba"],
  ar: ["مكان", "موقع", "عنوان", "اين", "وين", "منتج", "منتجات", "سعر", "مرحبا"],
  ru: ["место", "локация", "адрес", "где", "встреча", "товар", "товары", "цена", "привет", "здравствуйте"]
};

const PRODUCT_KEYWORDS = [
  "product", "products", "price", "prices", "menu", "list", "buy", "available", "order",
  "produkt", "produkte", "preis", "preise", "liste", "menü", "kaufen", "bestellen",
  "ürün", "urun", "ürünler", "urunler", "fiyat", "fiyatlar", "sipariş",
  "قائمة", "سعر", "أسعار", "منتج", "منتجات", "طلب",
  "товар", "товары", "цена", "цены", "список", "меню", "купить", "заказать"
];

const LOCATION_KEYWORDS = [
  "where", "location", "address", "meet", "meeting point", "place", "center", "centre",
  "spot", "standort", "adresse", "wo", "treffen", "treffpunkt", "platz", "ort", "lokation",
  "nerede", "konum", "adres", "mekan", "lokasyon", "buluş", "buluşma", "buluşma noktası",
  "مكان", "موقع", "عنوان", "اين", "وين", "مركز", "لقاء",
  "место", "локация", "адрес", "где", "встреча", "точка встречи"
];

const GREETING_KEYWORDS = [
  "hello", "hi", "hey", "good morning", "good evening",
  "hallo", "guten tag", "guten morgen", "guten abend",
  "merhaba", "selam", "مرحبا", "السلام", "привет", "здравствуйте", "добрый день"
];

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  bir: 1, iki: 2, "üç": 3, uc: 3, "dört": 4, dort: 4, "beş": 5, bes: 5,
  ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, "fünf": 5, funf: 5
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function redirectResponse(path) {
  return new Response(null, {
    status: 303,
    headers: { location: path }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function safeLang(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : "en";
}

function t(group, language) {
  const lang = safeLang(language);
  return RESPONSE_TEXTS[group]?.[lang] || RESPONSE_TEXTS[group]?.en || "";
}

function detectLanguageByKeywords(text) {
  const clean = normalizeText(text);
  for (const [language, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    if (keywords.some((keyword) => clean.includes(normalizeText(keyword)))) {
      return language;
    }
  }
  return "unknown";
}

function detectLanguage(text) {
  const clean = normalizeText(text);
  if (!clean) {
    return "unknown";
  }
  return detectLanguageByKeywords(clean);
}

function getMenuOptionByText(text) {
  const clean = normalizeText(text);
  for (const option of Object.values(MENU_OPTIONS)) {
    if (option.typed_values.map(normalizeText).includes(clean)) {
      return option;
    }
  }
  return null;
}

function getMenuOptionByCallback(callbackData) {
  for (const [number, option] of Object.entries(MENU_OPTIONS)) {
    if (callbackData === option.callback_data) {
      return [number, option];
    }
  }
  return null;
}

function getMenuKeyboard(language = "en") {
  const lang = safeLang(language);
  return {
    inline_keyboard: Object.values(MENU_OPTIONS).map((option) => [
      {
        text: option.labels[lang] || option.labels.en,
        callback_data: option.callback_data
      }
    ])
  };
}

function getLanguageKeyboard(language = "en") {
  const rows = getMenuKeyboard(language).inline_keyboard;
  rows.push([
    { text: "English", callback_data: "language_en" },
    { text: "Deutsch", callback_data: "language_de" }
  ]);
  rows.push([
    { text: "Türkçe", callback_data: "language_tr" },
    { text: "العربية", callback_data: "language_ar" }
  ]);
  rows.push([
    { text: "Русский", callback_data: "language_ru" }
  ]);
  return { inline_keyboard: rows };
}

function getClosedHoursKeyboard(language = "en") {
  const labels = {
    en: { products: "1. Product List", admin: "2. Contact admin" },
    de: { products: "1. Produktliste", admin: "2. Admin kontaktieren" },
    tr: { products: "1. Ürün listesi", admin: "2. Admin ile iletişim" },
    ar: { products: "1. قائمة المنتجات", admin: "2. التواصل مع الإدارة" },
    ru: { products: "1. Список товаров", admin: "2. Связаться с админом" }
  };
  const selected = labels[safeLang(language)] || labels.en;
  return {
    inline_keyboard: [
      [{ text: selected.products, callback_data: "option_products" }],
      [{ text: selected.admin, callback_data: "option_admin" }]
    ]
  };
}

function getAdminWebKeyboard(env) {
  const adminUrl = env.ADMIN_WEB_URL || "https://crm.ayartuerk.me/admin/";
  return {
    inline_keyboard: [
      [{ text: "Open Admin Web Panel", url: adminUrl }],
      [{ text: "Open Requests", url: `${adminUrl.replace(/\/$/, "")}/openrequests/` }]
    ]
  };
}

function extractQuantity(text) {
  const clean = normalizeText(text);
  const digitMatch = clean.match(/\b\d+\b/);
  if (digitMatch) {
    return Number(digitMatch[0]);
  }
  for (const [word, number] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(clean)) {
      return number;
    }
  }
  return null;
}

function looksLikeAddress(text) {
  const clean = normalizeText(text);
  const keywords = [
    "strase", "stras", "str.", "str ", "strasse", "street", "st.", "avenue", "ave",
    "road", "rd", "platz", "allee", "cadde", "caddesi", "sokak", "mahallesi",
    "mahalle", "bulvar", "no:", "no ", "apt", "apartment", "berlin", "istanbul",
    "koln", "munich", "hamburg", "hotel", "resort"
  ];
  return /\d/.test(clean) || clean.includes(",") || keywords.some((keyword) => clean.includes(keyword));
}

function isLocationRequest(text) {
  const clean = normalizeText(text);
  return LOCATION_KEYWORDS.some((keyword) => clean.includes(normalizeText(keyword)));
}

function isCloseMatch(text, keywords, minScore = 78) {
  const clean = normalizeText(text);
  const normalizedKeywords = keywords.map(normalizeText);
  if (normalizedKeywords.some((keyword) => clean.includes(keyword))) {
    return true;
  }
  return normalizedKeywords.some((keyword) => similarity(clean, keyword) >= minScore / 100);
}

function similarity(a, b) {
  a = normalizeText(a);
  b = normalizeText(b);
  if (!a || !b) {
    return 0;
  }
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function generateBasicAliases(productName) {
  const aliases = new Set();
  const clean = String(productName || "").toLowerCase().trim();
  const normalized = normalizeText(productName);
  if (clean) aliases.add(clean);
  if (normalized) aliases.add(normalized);
  for (const word of clean.split(/\s+/)) {
    if (word.length >= 3) aliases.add(word);
  }
  for (const word of normalized.split(/\s+/)) {
    if (word.length >= 3) aliases.add(word);
  }
  return [...aliases].filter(Boolean);
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

async function setSetting(env, key, value) {
  const existing = await env.DB.prepare("SELECT id FROM app_settings WHERE key = ?").bind(key).first();
  if (existing) {
    await env.DB.prepare("UPDATE app_settings SET value = ? WHERE key = ?").bind(String(value ?? ""), key).run();
  } else {
    await env.DB.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").bind(key, String(value ?? "")).run();
  }
}

async function sendTelegram(method, env, payload) {
  const response = await fetch(`${TELEGRAM_API_BASE}${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function sendTelegramMessage(env, chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return sendTelegram("sendMessage", env, payload);
}

async function answerCallbackQuery(env, callbackQueryId) {
  return sendTelegram("answerCallbackQuery", env, { callback_query_id: callbackQueryId });
}

async function editMessageReplyMarkup(env, chatId, messageId, replyMarkup) {
  return sendTelegram("editMessageReplyMarkup", env, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup
  });
}

async function upsertCustomer(env, telegramUser, detectedLanguage = "unknown") {
  const telegramUserId = String(telegramUser.id);
  const username = telegramUser.username || null;
  const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || null;
  const existing = await env.DB.prepare("SELECT * FROM customers WHERE telegram_user_id = ?").bind(telegramUserId).first();

  if (existing) {
    await env.DB.prepare(
      "UPDATE customers SET username = ?, full_name = ?, last_seen_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?"
    ).bind(username, fullName, telegramUserId).run();
    return existing;
  }

  const preferred = detectedLanguage !== "unknown" ? detectedLanguage : "en";
  const result = await env.DB.prepare(
    "INSERT INTO customers (telegram_user_id, username, full_name, language, preferred_language) VALUES (?, ?, ?, ?, ?)"
  ).bind(telegramUserId, username, fullName, detectedLanguage, preferred).run();

  return {
    id: result.meta.last_row_id,
    telegram_user_id: telegramUserId,
    username,
    full_name: fullName,
    language: detectedLanguage,
    preferred_language: preferred,
    conversation_state: null
  };
}

async function updateCustomerLanguage(env, customerId, language) {
  await env.DB.prepare("UPDATE customers SET language = ?, preferred_language = ? WHERE id = ?")
    .bind(language, language, customerId).run();
}

async function setCustomerState(env, customerId, state) {
  await env.DB.prepare("UPDATE customers SET conversation_state = ? WHERE id = ?").bind(state, customerId).run();
}

async function saveMessage(env, customerId, direction, content, language = null, messageType = "text") {
  await env.DB.prepare(
    "INSERT INTO messages (customer_id, direction, platform, content, message_type, language) VALUES (?, ?, 'telegram', ?, ?, ?)"
  ).bind(customerId, direction, content, messageType, language).run();
}

async function logCustomerRequest(env, customerId, requestType, requestText = null, quantity = null, itemName = null, locationLabel = null, latitude = null, longitude = null, googleMapsLink = null) {
  const result = await env.DB.prepare(
    `INSERT INTO customer_requests
    (customer_id, request_type, request_text, item_name, quantity, location_label, latitude, longitude, google_maps_link, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
  ).bind(customerId, requestType, requestText, itemName, quantity, locationLabel, latitude, longitude, googleMapsLink).run();

  return result.meta.last_row_id;
}

async function getActiveProducts(env) {
  const result = await env.DB.prepare("SELECT id, name, price, is_active FROM products WHERE is_active = 1 ORDER BY id ASC").all();
  return result.results;
}

async function getAllProducts(env) {
  const result = await env.DB.prepare("SELECT id, name, price, is_active FROM products ORDER BY id ASC").all();
  return result.results;
}

async function getActiveMeetingPoints(env) {
  const result = await env.DB.prepare(
    "SELECT id, name, address, google_maps_link, is_default, is_active FROM meeting_points WHERE is_active = 1 ORDER BY is_default DESC, name ASC"
  ).all();
  return result.results;
}

async function getAllMeetingPoints(env) {
  const result = await env.DB.prepare(
    "SELECT id, name, address, google_maps_link, is_default, is_active FROM meeting_points ORDER BY id ASC"
  ).all();
  return result.results;
}

async function getProductAliasMap(env) {
  const result = await env.DB.prepare("SELECT product_id, alias FROM product_aliases ORDER BY alias ASC").all();
  const map = {};
  for (const row of result.results) {
    if (!map[row.product_id]) map[row.product_id] = [];
    map[row.product_id].push(row.alias);
  }
  return map;
}

async function syncAutoAliases(env, productId, productName) {
  const aliases = generateBasicAliases(productName);
  await env.DB.prepare("DELETE FROM product_aliases WHERE product_id = ?").bind(productId).run();
  for (const alias of aliases) {
    await env.DB.prepare("INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)").bind(productId, alias).run();
  }
}

async function replaceManualAliases(env, productId, aliasesText) {
  const aliases = new Set();
  for (const alias of generateBasicAliases(aliasesText)) aliases.add(alias);
  for (const raw of String(aliasesText || "").split(",")) {
    const normalized = normalizeText(raw);
    if (normalized) aliases.add(normalized);
  }
  await env.DB.prepare("DELETE FROM product_aliases WHERE product_id = ?").bind(productId).run();
  for (const alias of aliases) {
    await env.DB.prepare("INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)").bind(productId, alias).run();
  }
}

async function getMatchingProduct(env, text) {
  const clean = normalizeText(text);
  if (isCloseMatch(clean, GREETING_KEYWORDS)) {
    return null;
  }

  const aliasesResult = await env.DB.prepare(
    `SELECT pa.alias, p.id, p.name, p.price, p.is_active
     FROM product_aliases pa
     JOIN products p ON p.id = pa.product_id
     WHERE p.is_active = 1`
  ).all();

  let best = null;
  for (const row of aliasesResult.results) {
    const score = partialScore(clean, normalizeText(row.alias));
    if (!best || score > best.score) best = { score, product: row };
  }

  if (best && best.score >= 0.90) {
    return best.product;
  }

  for (const word of clean.split(/\s+/).filter((word) => word.length >= 3)) {
    for (const row of aliasesResult.results) {
      const score = partialScore(word, normalizeText(row.alias));
      if (score >= 0.90) return row;
    }
  }

  const products = await getActiveProducts(env);
  best = null;
  for (const product of products) {
    const score = partialScore(clean, normalizeText(product.name));
    if (!best || score > best.score) best = { score, product };
  }

  if (best && best.score >= 0.90) return best.product;

  for (const word of clean.split(/\s+/).filter((word) => word.length >= 4)) {
    for (const product of products) {
      if (partialScore(word, normalizeText(product.name)) >= 0.90) return product;
    }
  }

  return null;
}

function partialScore(a, b) {
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  return similarity(a, b);
}

function formatPrice(price) {
  const number = Number(price);
  return Number.isInteger(number) ? String(number) : String(number);
}

async function formatProductListReply(env, language) {
  const products = await getActiveProducts(env);
  if (!products.length) {
    return "No active products are available right now.";
  }

  const headers = {
    en: "Available products:",
    de: "Verfügbare Produkte:",
    tr: "Mevcut ürünler:",
    ar: "المنتجات المتوفرة:",
    ru: "Доступные товары:"
  };

  const lines = products.map((product) => `- ${product.name}: ${formatPrice(product.price)}`);
  return `${headers[safeLang(language)] || headers.en}\n${lines.join("\n")}`;
}

function formatSingleProductReply(product, language) {
  return `${product.name}: ${formatPrice(product.price)}`;
}

function getGreetingReply(language) {
  const replies = {
    en: "Hello. How can I help you?",
    de: "Hallo. Wie kann ich helfen?",
    tr: "Merhaba. Nasıl yardımcı olabilirim?",
    ar: "مرحبا. كيف يمكنني مساعدتك؟",
    ru: "Здравствуйте. Чем могу помочь?"
  };
  return replies[safeLang(language)] || replies.en;
}

async function isWithinWorkingHours(env) {
  const enabled = await getSetting(env, "working_hours_enabled");
  if (enabled !== "on") {
    return true;
  }

  const timezone = await getSetting(env, "working_hours_timezone") || "Europe/Berlin";
  const startValue = await getSetting(env, "working_hours_start") || "10:00";
  const endValue = await getSetting(env, "working_hours_end") || "22:00";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour").value);
  const minute = Number(parts.find((part) => part.type === "minute").value);
  const nowMinutes = hour * 60 + minute;
  const startMinutes = parseTimeMinutes(startValue);
  const endMinutes = parseTimeMinutes(endValue);

  if (startMinutes <= endMinutes) {
    return startMinutes <= nowMinutes && nowMinutes <= endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function parseTimeMinutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

async function getClosedHoursReply(env, language) {
  const mode = await getSetting(env, "working_hours_message_mode") || "custom";
  const custom = await getSetting(env, "working_hours_closed_message");

  if (mode === "custom" && custom) {
    return custom;
  }

  const timezone = await getSetting(env, "working_hours_timezone") || "Europe/Berlin";
  const startValue = await getSetting(env, "working_hours_start") || "10:00";
  const endValue = await getSetting(env, "working_hours_end") || "22:00";

  const replies = {
    en: `We are currently closed. Our working hours are ${startValue} - ${endValue} (${timezone}).`,
    de: `Wir haben derzeit geschlossen. Unsere Arbeitszeiten sind ${startValue} - ${endValue} (${timezone}).`,
    tr: `Şu anda kapalıyız. Çalışma saatlerimiz ${startValue} - ${endValue} (${timezone}).`,
    ar: `نحن مغلقون حاليا. ساعات العمل لدينا هي ${startValue} - ${endValue} (${timezone}).`,
    ru: `Сейчас мы закрыты. Наши рабочие часы: ${startValue} - ${endValue} (${timezone}).`
  };

  const lang = safeLang(language);
  if (lang === "en") return replies.en;
  return `${replies[lang]}\n\n${replies.en}`;
}

async function getRuleBasedReply(env, text, language) {
  const clean = normalizeText(text);

  if (isCloseMatch(clean, LOCATION_KEYWORDS)) {
    if (!(await isWithinWorkingHours(env))) return getClosedHoursReply(env, language);
    return formatMeetingPointReply(env, language);
  }

  if (isCloseMatch(clean, GREETING_KEYWORDS)) {
    return getGreetingReply(language);
  }

  const productReply = await getProductReplyIfMatched(env, clean, language);
  if (productReply !== null) return productReply;

  return null;
}

async function getProductReplyIfMatched(env, text, language) {
  const products = await getActiveProducts(env);
  if (!products.length) return null;

  const matchedProduct = await getMatchingProduct(env, text);
  if (matchedProduct) {
    if (!(await isWithinWorkingHours(env))) return getClosedHoursReply(env, language);
    return formatSingleProductReply(matchedProduct, language);
  }

  if (isCloseMatch(text, PRODUCT_KEYWORDS)) {
    return formatProductListReply(env, language);
  }

  return null;
}

async function formatMeetingPointReply(env, language) {
  const points = await getActiveMeetingPoints(env);

  if (!points.length) {
    return t("no_active_locations", language);
  }

  if (points.length === 1) {
    return formatSelectedMeetingPointReply(points[0], language);
  }

  return t("choose_location", language);
}

function formatSelectedMeetingPointReply(point, language) {
  const labels = {
    en: "Selected location:",
    de: "Ausgewählter Standort:",
    tr: "Seçilen konum:",
    ar: "الموقع المختار:",
    ru: "Выбранная локация:"
  };
  return [
    labels[safeLang(language)] || labels.en,
    "",
    point.name,
    point.address || "",
    point.google_maps_link
  ].filter(Boolean).join("\n");
}

function getMeetingPointChoiceKeyboard(points) {
  return {
    inline_keyboard: points.map((point) => [
      {
        text: (point.is_default ? `Preferred - ${point.name}` : point.name).slice(0, 60),
        callback_data: `meeting_point_select_${point.id}`
      }
    ])
  };
}

function getAddressChoicesKeyboard(results) {
  const rows = results.slice(0, 7).map((result, index) => [
    {
      text: result.address.slice(0, 60),
      callback_data: `address_select_${index}`
    }
  ]);
  rows.push([
    {
      text: "Contact admin to describe location",
      callback_data: "option_admin"
    }
  ]);
  return { inline_keyboard: rows };
}

function getAddressNotFoundKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Contact admin to describe location", callback_data: "option_admin" }]
    ]
  };
}

function getDeliveryAdminKeyboard(requestId, customerId, googleMapsLink, clickedValues = new Set(), lastValue = null) {
  const etaLabel = (value) => {
    if (value === lastValue) return `🔵 ${value}`;
    if (clickedValues.has(value)) return `✓ ${value}`;
    return value;
  };

  return {
    inline_keyboard: [
      [
        { text: "Open Map", url: googleMapsLink },
        { text: "Free text reply", callback_data: `admin_reply_${customerId}` }
      ],
      [
        { text: etaLabel("15 min"), callback_data: `delivery_eta_${requestId}_15 min` },
        { text: etaLabel("30 min"), callback_data: `delivery_eta_${requestId}_30 min` },
        { text: etaLabel("45 min"), callback_data: `delivery_eta_${requestId}_45 min` }
      ],
      [
        { text: etaLabel("1h"), callback_data: `delivery_eta_${requestId}_1h` },
        { text: etaLabel("1h 15 min"), callback_data: `delivery_eta_${requestId}_1h 15 min` },
        { text: etaLabel("1h 30 min"), callback_data: `delivery_eta_${requestId}_1h 30 min` }
      ],
      [
        { text: etaLabel("No delivery"), callback_data: `delivery_no_${requestId}` }
      ]
    ]
  };
}

function getAdminReplyKeyboard(customerId) {
  return {
    inline_keyboard: [
      [{ text: "Reply to customer", callback_data: `admin_reply_${customerId}` }]
    ]
  };
}

function makeGoogleMapsLink(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

async function searchLocations(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "10");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { "user-agent": "CRMProjectDealer/1.0" }
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return data.map((item) => {
    const latitude = item.lat;
    const longitude = item.lon;
    const displayName = item.display_name;
    return {
      name: item.name || displayName,
      address: displayName,
      latitude,
      longitude,
      google_maps_link: `https://www.google.com/maps?q=${latitude},${longitude}`
    };
  });
}

async function getAdminChatId(env) {
  return getSetting(env, "admin_telegram_chat_id");
}

async function isActiveAdmin(env, telegramId) {
  const adminChatId = await getAdminChatId(env);
  return adminChatId && String(telegramId) === String(adminChatId);
}

async function forwardUnresolvedMessage(env, customer, incomingText) {
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return;

  const text = [
    "Unresolved customer message:",
    "",
    `Customer: ${customer.full_name || ""}`,
    `Telegram ID: ${customer.telegram_user_id}`,
    `Message: ${incomingText}`
  ].join("\n");

  await sendTelegramMessage(env, adminChatId, text, getAdminReplyKeyboard(customer.id));
}

async function forwardProductRequest(env, customer, incomingText, productName, quantity) {
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return;

  const text = [
    "Product request:",
    "",
    `Customer: ${customer.full_name || ""}`,
    `Telegram ID: ${customer.telegram_user_id}`,
    `Product: ${productName}`,
    `Quantity: ${quantity || "Not specified"}`,
    `Message: ${incomingText}`
  ].join("\n");

  await sendTelegramMessage(env, adminChatId, text, getAdminReplyKeyboard(customer.id));
}

async function forwardLocationNeeded(env, customer, incomingText) {
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return;

  const text = [
    "Location needed:",
    "",
    `Customer: ${customer.full_name || ""}`,
    `Telegram ID: ${customer.telegram_user_id}`,
    "Customer asked for location, but no active preferred location is available.",
    `Message: ${incomingText}`
  ].join("\n");

  await sendTelegramMessage(env, adminChatId, text, getAdminReplyKeyboard(customer.id));
}

async function forwardCustomerLocationToAdmin(env, customer, requestId, locationLabel, googleMapsLink) {
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return;

  const text = [
    "Customer delivery location:",
    "",
    `Customer: ${customer.full_name || ""}`,
    `Telegram ID: ${customer.telegram_user_id}`,
    `Location: ${locationLabel}`,
    `Map: ${googleMapsLink}`
  ].join("\n");

  await sendTelegramMessage(
    env,
    adminChatId,
    text,
    getDeliveryAdminKeyboard(requestId, customer.id, googleMapsLink)
  );
}

async function notifyCustomersAboutLocationChange(env, meetingPoint) {
  const result = await env.DB.prepare(
    "SELECT DISTINCT customer_id FROM customer_requests WHERE request_type = 'location' AND status != 'done'"
  ).all();

  for (const row of result.results) {
    const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(row.customer_id).first();
    if (!customer) continue;

    const text = [
      "Location changed (became available), please come to the new location:",
      "",
      meetingPoint.name,
      meetingPoint.address,
      meetingPoint.google_maps_link
    ].filter(Boolean).join("\n");

    await sendTelegramMessage(env, customer.telegram_user_id, text);
  }
}

async function notifyCustomersLocationUnavailable(env) {
  const result = await env.DB.prepare(
    "SELECT DISTINCT customer_id FROM customer_requests WHERE request_type = 'location' AND status != 'done'"
  ).all();

  for (const row of result.results) {
    const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(row.customer_id).first();
    if (!customer) continue;

    await sendTelegramMessage(
      env,
      customer.telegram_user_id,
      "Sorry, dealer is not at the location anymore. We will inform you shortly when a new location is available."
    );
  }
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }).filter(([key]) => key)
  );
}

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) input += "=";
  return atob(input);
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

async function createAdminToken(env, username) {
  const payload = {
    sub: username,
    scope: "admin",
    exp: Math.floor(Date.now() / 1000) + 43200
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSign(env.ADMIN_JWT_SECRET, body);
  return `${body}.${sig}`;
}

async function verifyAdminToken(env, token) {
  if (!token || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  const expected = await hmacSign(env.ADMIN_JWT_SECRET, body);
  if (sig !== expected) return false;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(body));
  } catch {
    return false;
  }

  if (payload.scope !== "admin") return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;

  const allowed = [env.ADMIN_USERNAME];
  if (env.SUPERADMIN_USERNAME) allowed.push(env.SUPERADMIN_USERNAME);

  return allowed.includes(payload.sub);
}

async function getCurrentAdminPassword(env) {
  return await getSetting(env, "admin_password_override") || env.ADMIN_PASSWORD;
}

async function authenticateAdmin(env, username, password) {
  if (username === env.ADMIN_USERNAME && password === await getCurrentAdminPassword(env)) {
    return true;
  }
  if (env.SUPERADMIN_USERNAME && env.SUPERADMIN_PASSWORD && username === env.SUPERADMIN_USERNAME && password === env.SUPERADMIN_PASSWORD) {
    return true;
  }
  return false;
}

async function requireAdmin(request, env) {
  const token = parseCookies(request)[ADMIN_COOKIE_NAME];
  return verifyAdminToken(env, token);
}

async function handleLoginPage(error = null) {
  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>Admin Login</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<h1>Admin Login</h1>
${error ? `<p style="color:red;">${escapeHtml(error)}</p>` : ""}
<form action="/admin/login" method="post">
  <label>Username</label><br>
  <input type="text" name="username" required>
  <br><br>
  <label>Password</label><br>
  <input type="password" name="password" required>
  <br><br>
  <button type="submit">Login</button>
</form>
<p><a href="/admin/forgot-password">I forgot my password</a></p>
</body>
</html>`);
}

async function handleAdminLogin(request, env) {
  const form = await request.formData();
  const username = String(form.get("username") || "");
  const password = String(form.get("password") || "");

  if (!(await authenticateAdmin(env, username, password))) {
    return handleLoginPage("Invalid username or password.");
  }

  const token = await createAdminToken(env, username);
  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin",
      "set-cookie": `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`
    }
  });
}

function handleAdminLogout() {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/admin/login",
      "set-cookie": `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    }
  });
}

async function getAdminData(env) {
  const [customers, products, meetingPoints, aliasMap] = await Promise.all([
    env.DB.prepare("SELECT * FROM customers ORDER BY last_seen_at DESC").all(),
    getAllProducts(env),
    getAllMeetingPoints(env),
    getProductAliasMap(env)
  ]);

  return {
    customers: customers.results,
    products,
    meetingPoints,
    productAliasMap: aliasMap,
    settings: {
      admin_telegram_chat_id: await getSetting(env, "admin_telegram_chat_id") || "",
      working_hours_enabled: await getSetting(env, "working_hours_enabled") || "off",
      working_hours_timezone: await getSetting(env, "working_hours_timezone") || "Europe/Berlin",
      working_hours_start: await getSetting(env, "working_hours_start") || "10:00",
      working_hours_end: await getSetting(env, "working_hours_end") || "22:00",
      working_hours_closed_message: await getSetting(env, "working_hours_closed_message") || "",
      working_hours_message_mode: await getSetting(env, "working_hours_message_mode") || "custom",
      admin_view_language: await getSetting(env, "admin_view_language") || "en"
    }
  };
}

function renderAdminDashboard(data) {
  const adminText = ADMIN_TEXTS[data.settings.admin_view_language] || ADMIN_TEXTS.en;

  const productRows = data.products.map((product) => `
    <tr>
      <form action="/admin/products/${product.id}/update" method="post">
        <td>${product.id}</td>
        <td><input type="text" name="name" value="${escapeHtml(product.name)}" required></td>
        <td><input type="number" step="0.01" name="price" value="${escapeHtml(product.price)}" required></td>
        <td><textarea name="aliases" rows="2" cols="40">${escapeHtml((data.productAliasMap[product.id] || []).join(", "))}</textarea></td>
        <td><input type="checkbox" name="is_active" ${product.is_active ? "checked" : ""}></td>
        <td><button type="submit">Save</button>
      </form>
      <form action="/admin/products/${product.id}/delete" method="post" style="display:inline;">
        <button type="submit">Delete</button>
      </form></td>
    </tr>
  `).join("");

  const pointRows = data.meetingPoints.map((point) => `
    <tr>
      <form action="/admin/meeting-points/${point.id}/update" method="post">
        <td>${point.id}</td>
        <td><input type="text" name="name" value="${escapeHtml(point.name)}" required></td>
        <td><input type="text" name="address" value="${escapeHtml(point.address)}" size="50" required></td>
        <td>
          <input type="text" name="google_maps_link" value="${escapeHtml(point.google_maps_link)}" size="50" required>
          <br><a href="${escapeHtml(point.google_maps_link)}" target="_blank">Open Map</a>
        </td>
        <td>${point.is_default ? "True" : "False"}</td>
        <td><input type="checkbox" name="is_active" ${point.is_active ? "checked" : ""}></td>
        <td><button type="submit">Save</button>
      </form>
      ${point.is_active ? `<form action="/admin/meeting-points/${point.id}/default" method="post" style="display:inline;"><button type="submit">Set Preferred</button></form>` : ""}
      <form action="/admin/meeting-points/${point.id}/delete" method="post" style="display:inline;">
        <button type="submit">Delete</button>
      </form></td>
    </tr>
  `).join("");

  const customerRows = data.customers.map((customer) => `
    <tr>
      <td>${customer.id}</td>
      <td>${escapeHtml(customer.full_name)}</td>
      <td>${escapeHtml(customer.username)}</td>
      <td>${escapeHtml(customer.language)}</td>
      <td>${escapeHtml(customer.last_seen_at)}</td>
      <td><a href="/admin/customers/${customer.id}">View History</a></td>
    </tr>
  `).join("");

  const selected = (value, option) => value === option ? "selected" : "";
  const checked = (condition) => condition ? "checked" : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>CRM Delivery Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div class="admin-header">
  <h1>CRM Delivery Admin</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">Logout</button></form>
    <a href="/admin/change-password"><button type="button">Change Password</button></a>
  </div>
</div>
<hr><hr>
<div class="page-actions"><a href="/admin/openrequests/"><button type="button">Open Requests</button></a></div>
<hr><hr>

<h2>Admin Language</h2>
<form action="/admin/settings/admin-language" method="post">
  <label>View Language</label><br>
  <select name="admin_view_language">
    <option value="en" ${selected(data.settings.admin_view_language, "en")}>English</option>
    <option value="de" ${selected(data.settings.admin_view_language, "de")}>German</option>
    <option value="tr" ${selected(data.settings.admin_view_language, "tr")}>Turkish</option>
    <option value="ar" ${selected(data.settings.admin_view_language, "ar")}>Arabic</option>
    <option value="ru" ${selected(data.settings.admin_view_language, "ru")}>Russian</option>
  </select>
  <button type="submit">Save Language</button>
</form>
<hr>

<h2>Notification Settings</h2>
<form action="/admin/settings/admin-telegram" method="post">
  <label>Admin Telegram Chat ID</label><br>
  <input type="text" name="admin_telegram_chat_id" value="${escapeHtml(data.settings.admin_telegram_chat_id)}" size="30" required>
  <button type="submit">Save Notification Receiver</button>
</form>
<hr>

<h2>Working Hours</h2>
<form action="/admin/settings/working-hours" method="post">
  <label><input type="checkbox" name="working_hours_enabled" value="on" ${checked(data.settings.working_hours_enabled === "on")}>Enable working-hours restrictions</label>
  <br><br>
  <label>Timezone</label><br>
  <input type="text" name="working_hours_timezone" value="${escapeHtml(data.settings.working_hours_timezone)}" required>
  <br><br>
  <label>Start Time</label><br>
  <input type="time" name="working_hours_start" value="${escapeHtml(data.settings.working_hours_start)}" required>
  <br><br>
  <label>End Time</label><br>
  <input type="time" name="working_hours_end" value="${escapeHtml(data.settings.working_hours_end)}" required>
  <br><br>
  <label>Closed-hours message mode</label><br>
  <label><input type="radio" name="working_hours_message_mode" value="auto" ${checked(data.settings.working_hours_message_mode === "auto")}>Auto message from selected working hours</label>
  <br>
  <label><input type="radio" name="working_hours_message_mode" value="custom" ${checked(data.settings.working_hours_message_mode !== "auto")}>Custom free-text message</label>
  <br><br>
  <label>Custom Closed Message</label><br>
  <textarea name="working_hours_closed_message" rows="3" cols="80">${escapeHtml(data.settings.working_hours_closed_message)}</textarea>
  <p>Auto mode ignores the custom text and replies using the selected working hours in the customer's language plus English. Custom mode sends the free-text message exactly as written.</p>
  <br><br>
  <button type="submit">Save Working Hours</button>
</form>
<hr>

<h2>Products</h2>
<table border="1" cellpadding="10">
  <tr><th>ID</th><th>Name</th><th>Price</th><th>Aliases</th><th>Active</th><th>Action</th></tr>
  ${productRows}
</table>

<h3>Add Product</h3>
<form action="/admin/products" method="post">
  <label>Product Name</label><br>
  <input type="text" name="name" required>
  <br><br>
  <label>Price</label><br>
  <input type="number" step="0.01" name="price" required>
  <br><br>
  <button type="submit">Create Product</button>
</form>
<hr>

<h2>Meeting Points</h2>
<table border="1" cellpadding="10">
  <tr><th>ID</th><th>Name</th><th>Address</th><th>Google Maps</th><th>Preferred</th><th>Active</th><th>Action</th></tr>
  ${pointRows}
</table>
<p class="admin-info-text">${escapeHtml(adminText.meeting_point_help)}</p>

<h3>Add Meeting Point</h3>
<input type="text" id="location-search" placeholder="Search location..." size="50">
<button onclick="searchLocation()">Search</button>
<div id="search-results"></div>
<br><br>
<form action="/admin/meeting-points" method="post">
  <label>Name</label><br>
  <input type="text" id="name" name="name" required>
  <br><br>
  <label>Address</label><br>
  <input type="text" id="address" name="address" size="80" required>
  <br><br>
  <label>Google Maps Link</label><br>
  <input type="text" id="google_maps_link" name="google_maps_link" size="80" required>
  <br><br>
  <label><input type="checkbox" name="is_default">Set as preferred</label>
  <br><br>
  <button type="submit">Create Meeting Point</button>
</form>
<hr>

<h2>Customers</h2>
<table border="1" cellpadding="10">
  <tr><th>ID</th><th>Full Name</th><th>Username</th><th>Language</th><th>Last Seen</th><th>Action</th></tr>
  ${customerRows}
</table>

<script>
async function searchLocation() {
  const query = document.getElementById("location-search").value.trim();
  const resultsDiv = document.getElementById("search-results");
  resultsDiv.innerHTML = "Searching...";

  if (!query) {
    resultsDiv.innerHTML = "Enter a location first.";
    return;
  }

  const response = await fetch("/admin/search-location?query=" + encodeURIComponent(query));
  const results = await response.json();
  resultsDiv.innerHTML = "";

  if (results.length === 0) {
    resultsDiv.innerHTML = "No locations found.";
    return;
  }

  results.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerText = item.address;
    button.style.display = "block";
    button.style.margin = "8px 0";
    button.onclick = () => {
      document.getElementById("name").value = item.name;
      document.getElementById("address").value = item.address;
      document.getElementById("google_maps_link").value = item.google_maps_link;
    };
    resultsDiv.appendChild(button);
  });
}
</script>
</body>
</html>`;
}

async function handleAdminHome(env) {
  return htmlResponse(renderAdminDashboard(await getAdminData(env)));
}

async function handleCreateProduct(request, env) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const price = Number(form.get("price") || 0);
  if (name && price > 0) {
    const result = await env.DB.prepare("INSERT INTO products (name, price, is_active) VALUES (?, ?, 1)").bind(name, price).run();
    await syncAutoAliases(env, result.meta.last_row_id, name);
  }
  return redirectResponse("/admin");
}

async function handleUpdateProduct(request, env, productId) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const price = Number(form.get("price") || 0);
  const aliases = String(form.get("aliases") || "");
  const isActive = form.get("is_active") ? 1 : 0;

  if (name && price > 0) {
    await env.DB.prepare("UPDATE products SET name = ?, price = ?, is_active = ? WHERE id = ?").bind(name, price, isActive, productId).run();
    if (aliases.trim()) {
      await replaceManualAliases(env, productId, aliases);
    } else {
      await syncAutoAliases(env, productId, name);
    }
  }
  return redirectResponse("/admin");
}

async function handleDeleteProduct(env, productId) {
  await env.DB.prepare("DELETE FROM product_aliases WHERE product_id = ?").bind(productId).run();
  await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();
  return redirectResponse("/admin");
}

async function handleCreateMeetingPoint(request, env) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const address = String(form.get("address") || "").trim();
  const googleMapsLink = String(form.get("google_maps_link") || "").trim();
  const isDefault = form.get("is_default") ? 1 : 0;

  if (name && googleMapsLink) {
    const result = await env.DB.prepare(
      "INSERT INTO meeting_points (name, address, google_maps_link, is_default, is_active) VALUES (?, ?, ?, ?, 1)"
    ).bind(name, address, googleMapsLink, isDefault).run();

    if (isDefault) {
      await notifyCustomersAboutLocationChange(env, {
        id: result.meta.last_row_id,
        name,
        address,
        google_maps_link: googleMapsLink
      });
    }
  }
  return redirectResponse("/admin");
}

async function handleUpdateMeetingPoint(request, env, pointId) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const address = String(form.get("address") || "").trim();
  const googleMapsLink = String(form.get("google_maps_link") || "").trim();
  const isActive = form.get("is_active") ? 1 : 0;

  const before = await env.DB.prepare("SELECT * FROM meeting_points WHERE id = ?").bind(pointId).first();

  if (name && googleMapsLink) {
    await env.DB.prepare(
      "UPDATE meeting_points SET name = ?, address = ?, google_maps_link = ?, is_active = ?, is_default = CASE WHEN ? = 0 THEN 0 ELSE is_default END WHERE id = ?"
    ).bind(name, address, googleMapsLink, isActive, isActive, pointId).run();
  }

  if (before && before.is_default && before.is_active && !isActive) {
    await notifyCustomersLocationUnavailable(env);
  }

  return redirectResponse("/admin");
}

async function handleSetPreferredMeetingPoint(env, pointId) {
  await env.DB.prepare("UPDATE meeting_points SET is_default = 1, is_active = 1 WHERE id = ?").bind(pointId).run();
  const point = await env.DB.prepare("SELECT * FROM meeting_points WHERE id = ?").bind(pointId).first();
  if (point) await notifyCustomersAboutLocationChange(env, point);
  return redirectResponse("/admin");
}

async function handleDeleteMeetingPoint(env, pointId) {
  await env.DB.prepare("DELETE FROM meeting_points WHERE id = ?").bind(pointId).run();
  return redirectResponse("/admin");
}

async function handleUpdateAdminTelegram(request, env) {
  const form = await request.formData();
  await setSetting(env, "admin_telegram_chat_id", String(form.get("admin_telegram_chat_id") || ""));
  return redirectResponse("/admin");
}

async function handleUpdateWorkingHours(request, env) {
  const form = await request.formData();
  await setSetting(env, "working_hours_enabled", form.get("working_hours_enabled") ? "on" : "off");
  await setSetting(env, "working_hours_timezone", String(form.get("working_hours_timezone") || "Europe/Berlin"));
  await setSetting(env, "working_hours_start", String(form.get("working_hours_start") || "10:00"));
  await setSetting(env, "working_hours_end", String(form.get("working_hours_end") || "22:00"));
  await setSetting(env, "working_hours_message_mode", String(form.get("working_hours_message_mode") || "custom"));
  await setSetting(env, "working_hours_closed_message", String(form.get("working_hours_closed_message") || ""));
  return redirectResponse("/admin");
}

async function handleUpdateAdminLanguage(request, env) {
  const form = await request.formData();
  let language = String(form.get("admin_view_language") || "en");
  if (!SUPPORTED_LANGUAGES.includes(language)) language = "en";
  await setSetting(env, "admin_view_language", language);
  return redirectResponse("/admin");
}

async function getOpenRequestContext(env) {
  const customers = await env.DB.prepare("SELECT * FROM customers ORDER BY last_seen_at DESC").all();
  const rows = await env.DB.prepare(
    "SELECT * FROM customer_requests WHERE status != 'done' AND request_type != 'product_list' ORDER BY created_at DESC"
  ).all();

  const customerMap = Object.fromEntries(customers.results.map((customer) => [customer.id, customer]));
  const groups = new Map();

  for (const row of rows.results) {
    const key = `${row.customer_id}|${row.request_type}|${row.item_name || ""}`;
    if (!groups.has(key)) {
      groups.set(key, {
        customer_id: row.customer_id,
        request_type: row.request_type,
        item_name: row.item_name,
        quantity: 0,
        request_count: 0,
        status: row.status,
        latest_text: row.request_text,
        latest_created_at: row.created_at,
        google_maps_link: row.google_maps_link
      });
    }

    const group = groups.get(key);
    group.request_count += 1;
    if (row.quantity) group.quantity += Number(row.quantity);
  }

  return {
    openRequests: [...groups.values()],
    customerMap
  };
}

function renderOpenRequestsTable(context) {
  const rows = context.openRequests.map((item) => {
    const customer = context.customerMap[item.customer_id];
    const customerLabel = customer ? (customer.full_name || customer.username || customer.telegram_user_id) : "Unknown";
    const quantity = item.request_type === "product_specific" ? (item.quantity || "") : item.request_count;
    return `<tr>
      <td>${escapeHtml(customerLabel)}</td>
      <td>${escapeHtml(item.request_type)}</td>
      <td>${escapeHtml(item.item_name)}</td>
      <td>${escapeHtml(quantity)}</td>
      <td>${escapeHtml(item.request_count)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.latest_text)}${item.google_maps_link ? `<br><a href="${escapeHtml(item.google_maps_link)}" target="_blank">Open Map</a>` : ""}</td>
      <td>${escapeHtml(item.latest_created_at)}</td>
      <td>${customer ? `<a href="/admin/customers/${customer.id}"><button type="button" class="request-action-button">Open Customer</button></a><a href="/admin/customers/${customer.id}#send-reply"><button type="button" class="request-action-button">Answer</button></a>` : ""}</td>
      <td>
        <form action="/admin/customer-requests/group/done" method="post">
          <input type="hidden" name="customer_id" value="${escapeHtml(item.customer_id)}">
          <input type="hidden" name="request_type" value="${escapeHtml(item.request_type)}">
          <input type="hidden" name="item_name" value="${escapeHtml(item.item_name || "")}">
          <button type="submit">Done</button>
        </form>
      </td>
    </tr>`;
  }).join("");

  return `<table border="1" cellpadding="10">
    <tr>
      <th>Customer</th>
      <th>Type</th>
      <th>Item</th>
      <th>Quantity</th>
      <th>Request Count</th>
      <th>Status</th>
      <th>Latest Text</th>
      <th>Latest Created At</th>
      <th>Action</th>
      <th>Done</th>
    </tr>
    ${rows}
  </table>`;
}

async function handleOpenRequestsPage(env) {
  const table = renderOpenRequestsTable(await getOpenRequestContext(env));
  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>Open Requests</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<h1>Open Requests</h1>
<div class="page-actions"><a href="/admin"><button type="button">Back to Admin Dashboard</button></a></div>
<div class="open-requests-table-actions">
  <form action="/admin/customer-requests/all/done" method="post"><button type="submit">All Done</button></form>
</div>
<div id="open-requests-container">${table}</div>
<script>
async function refreshOpenRequests() {
  const response = await fetch("/admin/open-requests");
  const html = await response.text();
  document.getElementById("open-requests-container").innerHTML = html;
}
setInterval(refreshOpenRequests, 10000);
</script>
</body>
</html>`);
}

async function handleOpenRequestsPartial(env) {
  return htmlResponse(renderOpenRequestsTable(await getOpenRequestContext(env)));
}

async function handleCustomerDetail(env, customerId) {
  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(customerId).first();
  if (!customer) return redirectResponse("/admin");

  const messages = await env.DB.prepare("SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC").bind(customerId).all();
  const requests = await env.DB.prepare("SELECT * FROM customer_requests WHERE customer_id = ? ORDER BY created_at DESC").bind(customerId).all();

  const requestRows = requests.results.map((item) => `<tr>
    <td>${item.id}</td>
    <td>${escapeHtml(item.request_type)}</td>
    <td>${escapeHtml(item.status)}</td>
    <td>${escapeHtml(item.item_name || "")}</td>
    <td>${escapeHtml(item.quantity || "")}</td>
    <td>${escapeHtml(item.request_text)}${item.google_maps_link ? `<br><a href="${escapeHtml(item.google_maps_link)}" target="_blank">Open Map</a>` : ""}</td>
    <td>${escapeHtml(item.created_at)}</td>
    <td>
      <form action="/admin/customer-requests/${item.id}/status" method="post">
        <select name="status">
          <option value="new" ${item.status === "new" ? "selected" : ""}>new</option>
          <option value="in_progress" ${item.status === "in_progress" ? "selected" : ""}>in_progress</option>
          <option value="done" ${item.status === "done" ? "selected" : ""}>done</option>
        </select>
        <button type="submit">Save</button>
      </form>
    </td>
  </tr>`).join("");

  const messageRows = messages.results.map((message) => `<tr>
    <td>${message.id}</td>
    <td>${escapeHtml(message.direction)}</td>
    <td>${escapeHtml(message.content)}</td>
    <td>${escapeHtml(message.language)}</td>
    <td>${escapeHtml(message.created_at)}</td>
  </tr>`).join("");

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>Customer Detail</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<h1>Customer Detail</h1>
<p><a href="/admin">Back to Admin Dashboard</a></p>

<h2>Customer</h2>
<table border="1" cellpadding="8">
  <tr><th>ID</th><td>${customer.id}</td></tr>
  <tr><th>Telegram ID</th><td>${escapeHtml(customer.telegram_user_id)}</td></tr>
  <tr><th>Username</th><td>${escapeHtml(customer.username)}</td></tr>
  <tr><th>Full Name</th><td>${escapeHtml(customer.full_name)}</td></tr>
  <tr><th>Language</th><td>${escapeHtml(customer.language)}</td></tr>
  <tr><th>Preferred Language</th><td>${escapeHtml(customer.preferred_language)}</td></tr>
  <tr><th>Blocked</th><td>${escapeHtml(customer.is_blocked)}</td></tr>
  <tr><th>Last Seen</th><td>${escapeHtml(customer.last_seen_at)}</td></tr>
</table>

<h2 id="send-reply">Send Reply</h2>
<form action="/admin/customers/${customer.id}/reply" method="post">
  <textarea name="reply_text" rows="4" cols="80" required></textarea>
  <br><br>
  <button type="submit">Send Reply to Customer</button>
</form>

<h2>Structured Requests</h2>
<table border="1" cellpadding="8">
  <tr><th>ID</th><th>Type</th><th>Status</th><th>Item</th><th>Quantity</th><th>Text</th><th>Created At</th><th>Action</th></tr>
  ${requestRows}
</table>

<h2>Conversation History</h2>
<table border="1" cellpadding="8">
  <tr><th>ID</th><th>Direction</th><th>Message</th><th>Language</th><th>Created At</th></tr>
  ${messageRows}
</table>
</body>
</html>`);
}

async function handleSendCustomerReply(request, env, customerId) {
  const form = await request.formData();
  const replyText = String(form.get("reply_text") || "").trim();
  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(customerId).first();
  if (customer && replyText) {
    await sendTelegramMessage(env, customer.telegram_user_id, replyText);
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language, "admin_reply");
  }
  return redirectResponse(`/admin/customers/${customerId}`);
}

async function handleUpdateCustomerRequestStatus(request, env, requestId) {
  const form = await request.formData();
  const status = String(form.get("status") || "");
  if (["new", "in_progress", "done"].includes(status)) {
    await env.DB.prepare("UPDATE customer_requests SET status = ? WHERE id = ?").bind(status, requestId).run();
  }
  const row = await env.DB.prepare("SELECT customer_id FROM customer_requests WHERE id = ?").bind(requestId).first();
  return redirectResponse(row ? `/admin/customers/${row.customer_id}` : "/admin");
}

async function handleMarkCustomerRequestGroupDone(request, env) {
  const form = await request.formData();
  const customerId = Number(form.get("customer_id"));
  const requestType = String(form.get("request_type") || "");
  const itemName = String(form.get("item_name") || "");

  if (itemName) {
    await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE customer_id = ? AND request_type = ? AND status != 'done' AND item_name = ?")
      .bind(customerId, requestType, itemName).run();
  } else {
    await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE customer_id = ? AND request_type = ? AND status != 'done' AND item_name IS NULL")
      .bind(customerId, requestType).run();
  }

  return redirectResponse("/admin");
}

async function handleMarkAllDone(env) {
  await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE status != 'done'").run();
  return redirectResponse("/admin");
}

async function handleChangePasswordPage(error = null, success = null) {
  return htmlResponse(`<!DOCTYPE html>
<html>
<head><title>Change Admin Password</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/static/admin.css"></head>
<body>
<h1>Change Admin Password</h1>
<p><a href="/admin"><button type="button">Back to Admin Dashboard</button></a></p>
${error ? `<p style="color:red;">${escapeHtml(error)}</p>` : ""}
${success ? `<p style="color:green;">${escapeHtml(success)}</p>` : ""}
<form action="/admin/change-password" method="post">
  <label>Current Password</label><br><input type="password" name="current_password" required><br><br>
  <label>New Password</label><br><input type="password" name="new_password" required><br><br>
  <label>Confirm New Password</label><br><input type="password" name="confirm_password" required><br><br>
  <button type="submit">Change Password</button>
</form>
</body></html>`);
}

async function handleChangePassword(request, env) {
  const form = await request.formData();
  const current = String(form.get("current_password") || "");
  const next = String(form.get("new_password") || "");
  const confirm = String(form.get("confirm_password") || "");

  if (!(await authenticateAdmin(env, env.ADMIN_USERNAME, current))) return handleChangePasswordPage("Current password is incorrect.", null);
  if (next !== confirm) return handleChangePasswordPage("New passwords do not match.", null);
  if (next.length < 8) return handleChangePasswordPage("New password must be at least 8 characters.", null);

  await setSetting(env, "admin_password_override", next);
  return handleChangePasswordPage(null, "Password changed successfully.");
}

async function handleForgotPasswordPage(error = null, success = null) {
  return htmlResponse(`<!DOCTYPE html>
<html>
<head><title>Forgot Admin Password</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/static/admin.css"></head>
<body>
<h1>Forgot Admin Password</h1>
<p><a href="/admin/login">Back to Login</a></p>
${error ? `<p style="color:red;">${escapeHtml(error)}</p>` : ""}
${success ? `<p style="color:green;">${escapeHtml(success)}</p>` : ""}
<form action="/admin/forgot-password" method="post"><button type="submit">Send reset code to admin Telegram</button></form>
</body></html>`);
}

async function handleSendForgotPasswordCode(env) {
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return handleForgotPasswordPage("No admin Telegram Chat ID is configured.", null);

  const code = String(Math.floor(10000 + Math.random() * 90000));
  await setSetting(env, "admin_password_reset_code", code);
  await setSetting(env, "admin_password_reset_expires_at", String(Math.floor(Date.now() / 1000) + 600));

  await sendTelegramMessage(env, adminChatId, `Admin password reset code: ${code}\n\nThis code expires in 10 minutes.`);
  return handleResetPasswordPage();
}

async function handleResetPasswordPage(error = null) {
  return htmlResponse(`<!DOCTYPE html>
<html>
<head><title>Reset Admin Password</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/static/admin.css"></head>
<body>
<h1>Reset Admin Password</h1>
<p><a href="/admin/login">Back to Login</a></p>
${error ? `<p style="color:red;">${escapeHtml(error)}</p>` : ""}
<form action="/admin/reset-password" method="post">
  <label>5-digit code</label><br><input type="text" name="reset_code" maxlength="5" required><br><br>
  <label>New Password</label><br><input type="password" name="new_password" required><br><br>
  <label>Confirm New Password</label><br><input type="password" name="confirm_password" required><br><br>
  <button type="submit">Reset Password</button>
</form>
</body></html>`);
}

async function handleResetPassword(request, env) {
  const form = await request.formData();
  const code = String(form.get("reset_code") || "");
  const next = String(form.get("new_password") || "");
  const confirm = String(form.get("confirm_password") || "");

  const saved = await getSetting(env, "admin_password_reset_code");
  const expires = await getSetting(env, "admin_password_reset_expires_at");

  if (!saved || !expires) return handleResetPasswordPage("No active reset code. Please request a new code.");
  if (Number(expires) < Math.floor(Date.now() / 1000)) return handleResetPasswordPage("Reset code expired. Please request a new code.");
  if (code !== saved) return handleResetPasswordPage("Invalid reset code.");
  if (next !== confirm) return handleResetPasswordPage("New passwords do not match.");
  if (next.length < 8) return handleResetPasswordPage("New password must be at least 8 characters.");

  await setSetting(env, "admin_password_override", next);
  await setSetting(env, "admin_password_reset_code", "");
  await setSetting(env, "admin_password_reset_expires_at", "");
  return redirectResponse("/admin/login");
}

async function sendMeetingPointChoiceOrDirect(env, customer, chatId, incomingText) {
  const points = await getActiveMeetingPoints(env);

  if (!points.length) {
    const replyText = t("no_active_locations", customer.preferred_language || "en");
    await forwardLocationNeeded(env, customer, incomingText);
    await sendTelegramMessage(env, chatId, replyText);
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    return;
  }

  if (points.length === 1) {
    const point = points[0];
    const replyText = formatSelectedMeetingPointReply(point, customer.preferred_language || "en");
    await logCustomerRequest(env, customer.id, "location", incomingText, null, point.name, point.address, null, null, point.google_maps_link);
    await sendTelegramMessage(env, chatId, replyText);
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    return;
  }

  const replyText = t("choose_location", customer.preferred_language || "en");
  await sendTelegramMessage(env, chatId, replyText, getMeetingPointChoiceKeyboard(points));
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
}

async function handleLocationMessage(env, message) {
  const detectedLanguage = "unknown";
  const customer = await upsertCustomer(env, message.from, detectedLanguage);
  const latitude = String(message.location.latitude);
  const longitude = String(message.location.longitude);
  const googleMapsLink = makeGoogleMapsLink(latitude, longitude);
  const locationLabel = `Telegram shared location: ${latitude}, ${longitude}`;

  await saveMessage(env, customer.id, "incoming", googleMapsLink, customer.preferred_language, "telegram_location");

  const requestId = await logCustomerRequest(
    env,
    customer.id,
    "delivery_location",
    locationLabel,
    null,
    "telegram_location",
    locationLabel,
    latitude,
    longitude,
    googleMapsLink
  );

  await forwardCustomerLocationToAdmin(env, customer, requestId, locationLabel, googleMapsLink);

  const replyText = "Location received. We will confirm delivery shortly.";
  await sendTelegramMessage(env, message.chat.id, replyText);
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
}

async function handleTelegramTextMessage(env, message) {
  const incomingText = message.text || "";
  const detectedLanguage = detectLanguage(incomingText);
  const preferredLanguageFromMessage = detectedLanguage !== "unknown" ? detectedLanguage : "unknown";
  let customer = await upsertCustomer(env, message.from, detectedLanguage);

  if (preferredLanguageFromMessage !== "unknown") {
    await updateCustomerLanguage(env, customer.id, preferredLanguageFromMessage);
    customer.language = preferredLanguageFromMessage;
    customer.preferred_language = preferredLanguageFromMessage;
  }

  const adminChatId = await getAdminChatId(env);
  const pendingCustomerId = await getSetting(env, "pending_admin_reply_customer_id");

  if (pendingCustomerId && String(message.chat.id) === String(adminChatId)) {
    const target = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(Number(pendingCustomerId)).first();
    if (target) {
      await sendTelegramMessage(env, target.telegram_user_id, incomingText);
      await saveMessage(env, target.id, "outgoing", incomingText, target.preferred_language, "admin_reply");
      await setSetting(env, "pending_admin_reply_customer_id", "");
      await sendTelegramMessage(env, message.chat.id, "Reply sent to customer.");
      return;
    }
  }

  if (incomingText.startsWith("/")) {
    await handleTelegramCommand(env, message, customer, incomingText);
    return;
  }

  await saveMessage(env, customer.id, "incoming", incomingText, detectedLanguage);

  if (customer.conversation_state === "awaiting_typed_address") {
    const results = (await searchLocations(incomingText)).slice(0, 7);

    if (results.length) {
      await setSetting(env, `address_search_results_${customer.id}`, JSON.stringify(results));
      const replyText = "Please choose the correct location from the list.";
      await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
      await sendTelegramMessage(env, message.chat.id, replyText, getAddressChoicesKeyboard(results));
      return;
    }

    const replyText = t("address_not_found", customer.preferred_language || "en");
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    await sendTelegramMessage(env, message.chat.id, replyText, getAddressNotFoundKeyboard());
    return;
  }

  const replyLanguage = customer.preferred_language || "en";
  const selectedMenuOption = getMenuOptionByText(incomingText);
  const selectedMenuKey = selectedMenuOption ? selectedMenuOption.key : null;

  if (!(await isWithinWorkingHours(env)) && !["products", "contact_admin"].includes(selectedMenuKey)) {
    const closedReply = await getClosedHoursReply(env, replyLanguage);
    await saveMessage(env, customer.id, "outgoing", closedReply, customer.preferred_language);
    await sendTelegramMessage(env, message.chat.id, closedReply, getClosedHoursKeyboard(replyLanguage));
    return;
  }

  let replyText = null;
  let replyMarkup = null;

  if (selectedMenuOption) {
    if (selectedMenuOption.reply_trigger === "CONTACT_ADMIN") {
      await logCustomerRequest(env, customer.id, "contact_admin", incomingText);
      const forwardText = ["4", "admin", "contact admin"].includes(normalizeText(incomingText)) ? "Customer selected: Contact admin" : incomingText;
      await forwardUnresolvedMessage(env, customer, forwardText);
      replyText = t("contact_admin_received", replyLanguage);
    } else if (selectedMenuOption.reply_trigger === "TYPE_ADDRESS") {
      await setCustomerState(env, customer.id, "awaiting_typed_address");
      await logCustomerRequest(env, customer.id, "typed_address_started", "Customer selected type address");
      replyText = t("type_address", replyLanguage);
    } else if (selectedMenuOption.reply_trigger === "CHOOSE_MEETING_POINT") {
      await sendMeetingPointChoiceOrDirect(env, customer, message.chat.id, "Customer selected get my location");
      return;
    } else {
      replyText = await getRuleBasedReply(env, selectedMenuOption.reply_trigger, replyLanguage);
    }
  }

  if (replyText === null && looksLikeAddress(incomingText)) {
    await setCustomerState(env, customer.id, "awaiting_typed_address");
    const results = (await searchLocations(incomingText)).slice(0, 7);

    if (results.length) {
      await setSetting(env, `address_search_results_${customer.id}`, JSON.stringify(results));
      replyText = "Please choose the correct location from the list.";
      await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
      await sendTelegramMessage(env, message.chat.id, replyText, getAddressChoicesKeyboard(results));
      return;
    }

    await setCustomerState(env, customer.id, null);
  }

  if (replyText === null && isLocationRequest(incomingText)) {
    await sendMeetingPointChoiceOrDirect(env, customer, message.chat.id, incomingText);
    return;
  }

  if (replyText === null) {
    replyText = await getRuleBasedReply(env, incomingText, replyLanguage);

    if (replyText !== null && !replyText.includes("Available products:")) {
      const matchedProduct = await getMatchingProduct(env, incomingText);
      const quantity = extractQuantity(incomingText);

      if (matchedProduct) {
        await logCustomerRequest(env, customer.id, "product_specific", incomingText, quantity, matchedProduct.name);
        await forwardProductRequest(env, customer, incomingText, matchedProduct.name, quantity);
      }
    }
  }

  if (replyText === null) {
    await setCustomerState(env, customer.id, "awaiting_unresolved_option");
    replyText = t("unresolved", replyLanguage);
    replyMarkup = getLanguageKeyboard(replyLanguage);
  }

  await saveMessage(env, customer.id, "outgoing", replyText, detectedLanguage);
  await sendTelegramMessage(env, message.chat.id, replyText, replyMarkup);
}

async function handleTelegramCommand(env, message, customer, text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].split("@")[0];

  if (command === "/start") {
    await sendTelegramMessage(env, message.chat.id, "CRM Delivery Bot is running.");
    return;
  }

  if (command === "/health") {
    await sendTelegramMessage(env, message.chat.id, "Worker bot health: OK");
    return;
  }

  if (command === "/myid") {
    await sendTelegramMessage(env, message.chat.id, `Your Telegram chat ID is: ${message.chat.id}`);
    return;
  }

  if (command === "/w") {
    if (!(await isActiveAdmin(env, message.chat.id))) {
      await sendTelegramMessage(env, message.chat.id, "You are not allowed to access the admin web link.");
      return;
    }
    await sendTelegramMessage(env, message.chat.id, "Admin web panel:", getAdminWebKeyboard(env));
    return;
  }

  if (command === "/setadmin") {
    const code = parts[1] || "";
    if (code !== env.ADMIN_SETUP_CODE) {
      await sendTelegramMessage(env, message.chat.id, "Invalid admin setup code.");
      return;
    }
    await setSetting(env, "admin_telegram_chat_id", String(message.chat.id));
    await sendTelegramMessage(env, message.chat.id, "You are now set as the admin notification receiver.", getAdminWebKeyboard(env));
    return;
  }

  if (command === "/setsuperadmin") {
    const code = parts[1] || "";
    if (!env.SUPERADMIN_BOT_SETUP_CODE || code !== env.SUPERADMIN_BOT_SETUP_CODE) {
      await sendTelegramMessage(env, message.chat.id, "Invalid superadmin setup code.");
      return;
    }
    await setSetting(env, "admin_telegram_chat_id", String(message.chat.id));
    await sendTelegramMessage(env, message.chat.id, "Superadmin takeover complete. You are now the admin notification receiver.", getAdminWebKeyboard(env));
    return;
  }
}

async function handleAddressSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const index = Number(callbackQuery.data.replace("address_select_", ""));
  const stored = await getSetting(env, `address_search_results_${customer.id}`);

  if (!stored) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Address search expired. Please type your address again.");
    return;
  }

  const results = JSON.parse(stored);
  if (index >= results.length) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Selected address was not found. Please type your address again.");
    return;
  }

  const selected = results[index];
  const latitude = String(selected.latitude);
  const longitude = String(selected.longitude);
  const googleMapsLink = selected.google_maps_link;
  const locationLabel = selected.address;

  await setCustomerState(env, customer.id, null);

  const requestId = await logCustomerRequest(
    env,
    customer.id,
    "delivery_location",
    locationLabel,
    null,
    "typed_address",
    locationLabel,
    latitude,
    longitude,
    googleMapsLink
  );

  await saveMessage(env, customer.id, "incoming", locationLabel, customer.preferred_language, "typed_address_location");
  await forwardCustomerLocationToAdmin(env, customer, requestId, locationLabel, googleMapsLink);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, "Location received. We will confirm delivery shortly.");
}

async function handleMeetingPointSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const pointId = Number(callbackQuery.data.replace("meeting_point_select_", ""));
  const point = await env.DB.prepare("SELECT * FROM meeting_points WHERE id = ? AND is_active = 1").bind(pointId).first();

  if (!point) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, t("no_active_locations", customer.preferred_language || "en"));
    return;
  }

  await setCustomerState(env, customer.id, null);
  const replyText = formatSelectedMeetingPointReply(point, customer.preferred_language || "en");

  await logCustomerRequest(env, customer.id, "location", "Customer selected meeting point", null, point.name, point.address, null, null, point.google_maps_link);
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText);
}

async function handleAdminReplySelection(env, callbackQuery) {
  if (!(await isActiveAdmin(env, callbackQuery.from.id))) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "You are not allowed to use admin reply.");
    return;
  }

  const customerId = Number(callbackQuery.data.replace("admin_reply_", ""));
  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(customerId).first();

  if (!customer) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Customer not found.");
    return;
  }

  await setSetting(env, "pending_admin_reply_customer_id", String(customer.id));
  await sendTelegramMessage(
    env,
    callbackQuery.message.chat.id,
    `Type your reply now. The next message you send here will be sent to ${customer.full_name || customer.telegram_user_id}.`
  );
}

async function handleLanguageSelection(env, callbackQuery) {
  const selectedLanguage = callbackQuery.data.replace("language_", "");
  if (!SUPPORTED_LANGUAGES.includes(selectedLanguage)) return;

  const customer = await upsertCustomer(env, callbackQuery.from);
  await updateCustomerLanguage(env, customer.id, selectedLanguage);

  const replyText = t("unresolved", selectedLanguage);
  await saveMessage(env, customer.id, "outgoing", replyText, selectedLanguage);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText, getLanguageKeyboard(selectedLanguage));
}

async function handleOptionSelection(env, callbackQuery) {
  const selected = getMenuOptionByCallback(callbackQuery.data);
  if (!selected) return;

  const [selectedNumber, option] = selected;
  const customer = await upsertCustomer(env, callbackQuery.from);
  await saveMessage(env, customer.id, "incoming", selectedNumber, customer.preferred_language);

  if (!(await isWithinWorkingHours(env)) && !["products", "contact_admin"].includes(option.key)) {
    const closedReply = await getClosedHoursReply(env, customer.preferred_language || "en");
    await saveMessage(env, customer.id, "outgoing", closedReply, customer.preferred_language);
    await sendTelegramMessage(env, callbackQuery.message.chat.id, closedReply, getClosedHoursKeyboard(customer.preferred_language || "en"));
    return;
  }

  if (selectedNumber === "2") {
    await sendMeetingPointChoiceOrDirect(env, customer, callbackQuery.message.chat.id, "Customer selected get my location");
    return;
  }

  if (selectedNumber === "3") {
    await setCustomerState(env, customer.id, "awaiting_typed_address");
    await logCustomerRequest(env, customer.id, "typed_address_started", "Customer selected type address");
    const replyText = t("type_address", customer.preferred_language || "en");
    await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText);
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    return;
  }

  if (selectedNumber === "4") {
    await logCustomerRequest(env, customer.id, "contact_admin", "Customer selected contact admin");
    await forwardUnresolvedMessage(env, customer, "Customer selected: Contact admin");
    const replyText = t("contact_admin_received", customer.preferred_language || "en");
    await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText);
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    return;
  }

  const replyText = await formatProductListReply(env, customer.preferred_language || "en");
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText);
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
}

async function handleDeliveryEtaSelection(env, callbackQuery) {
  if (!(await isActiveAdmin(env, callbackQuery.from.id))) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "You are not allowed to send delivery updates.");
    return;
  }

  let requestId;
  let etaText = null;

  if (callbackQuery.data.startsWith("delivery_no_")) {
    requestId = Number(callbackQuery.data.replace("delivery_no_", ""));
  } else {
    const payload = callbackQuery.data.replace("delivery_eta_", "");
    const parts = payload.split("_");
    requestId = Number(parts[0]);
    etaText = parts.slice(1).join("_");
  }

  const requestRow = await env.DB.prepare("SELECT * FROM customer_requests WHERE id = ?").bind(requestId).first();
  if (!requestRow) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Delivery request not found.");
    return;
  }

  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(requestRow.customer_id).first();
  if (!customer) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Customer not found.");
    return;
  }

  const clickedKey = `delivery_eta_clicked_${requestId}`;
  const lastKey = `delivery_eta_last_${requestId}`;

  const previous = await getSetting(env, clickedKey) || "";
  const clickedValues = new Set(previous.split("|").filter(Boolean));

  let etaValue;
  let replyText;

  if (etaText === null) {
    etaValue = "No delivery";
    replyText = t("no_delivery", customer.preferred_language || "en");
    await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE id = ?").bind(requestId).run();
  } else {
    etaValue = etaText;
    const replies = {
      en: `Delivery will be done to your location in ${etaText}.`,
      de: `Die Lieferung erfolgt an Ihren Standort in ${etaText}.`,
      tr: `Teslimat konumunuza ${etaText} içinde yapılacak.`,
      ar: `سيتم التوصيل إلى موقعك خلال ${etaText}.`,
      ru: `Доставка будет выполнена по вашей локации через ${etaText}.`
    };
    replyText = replies[safeLang(customer.preferred_language)] || replies.en;
    await env.DB.prepare("UPDATE customer_requests SET status = 'in_progress' WHERE id = ?").bind(requestId).run();
  }

  clickedValues.add(etaValue);
  await setSetting(env, clickedKey, [...clickedValues].sort().join("|"));
  await setSetting(env, lastKey, etaValue);

  await sendTelegramMessage(env, customer.telegram_user_id, replyText);
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language, "delivery_eta");

  await editMessageReplyMarkup(
    env,
    callbackQuery.message.chat.id,
    callbackQuery.message.message_id,
    getDeliveryAdminKeyboard(requestId, customer.id, requestRow.google_maps_link, clickedValues, etaValue)
  );

  await sendTelegramMessage(env, callbackQuery.message.chat.id, `Delivery update sent to customer: ${etaValue}`);
}

async function handleCallbackQuery(env, callbackQuery) {
  await answerCallbackQuery(env, callbackQuery.id);

  if (callbackQuery.data.startsWith("address_select_")) return handleAddressSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("meeting_point_select_")) return handleMeetingPointSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("delivery_")) return handleDeliveryEtaSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("admin_reply_")) return handleAdminReplySelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("language_")) return handleLanguageSelection(env, callbackQuery);

  return handleOptionSelection(env, callbackQuery);
}

async function handleTelegramWebhook(request, env) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: "Unauthorized webhook" }, 401);
  }

  const update = await request.json();

  if (update.message?.location) {
    await handleLocationMessage(env, update.message);
  } else if (update.message?.text) {
    await handleTelegramTextMessage(env, update.message);
  }

  if (update.callback_query) {
    await handleCallbackQuery(env, update.callback_query);
  }

  return jsonResponse({ ok: true });
}

async function handleHealth() {
  return jsonResponse({ app: "CRM Delivery Worker", status: "ok" });
}

async function routeRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/health") return handleHealth();

  if (url.pathname === "/static/admin.css") {
    return new Response(ADMIN_CSS, { headers: { "content-type": "text/css; charset=utf-8" } });
  }

  if (url.pathname === "/telegram/webhook" && request.method === "POST") {
    return handleTelegramWebhook(request, env);
  }

  if (url.pathname === "/" || url.pathname === "") {
    return jsonResponse({ status: "running", app: "CRM Delivery" });
  }

  if (url.pathname === "/admin/login" && request.method === "GET") return handleLoginPage();
  if (url.pathname === "/admin/login" && request.method === "POST") return handleAdminLogin(request, env);
  if (url.pathname === "/admin/forgot-password" && request.method === "GET") return handleForgotPasswordPage();
  if (url.pathname === "/admin/forgot-password" && request.method === "POST") return handleSendForgotPasswordCode(env);
  if (url.pathname === "/admin/reset-password" && request.method === "GET") return handleResetPasswordPage();
  if (url.pathname === "/admin/reset-password" && request.method === "POST") return handleResetPassword(request, env);

  if (url.pathname.startsWith("/admin")) {
    const authenticated = await requireAdmin(request, env);
    if (!authenticated) return redirectResponse("/admin/login");
  }

  if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET") return handleAdminHome(env);
  if (url.pathname === "/admin/logout" && request.method === "POST") return handleAdminLogout();
  if (url.pathname === "/admin/change-password" && request.method === "GET") return handleChangePasswordPage();
  if (url.pathname === "/admin/change-password" && request.method === "POST") return handleChangePassword(request, env);

  if (url.pathname === "/admin/openrequests/" || url.pathname === "/admin/openrequests") return handleOpenRequestsPage(env);
  if (url.pathname === "/admin/open-requests") return handleOpenRequestsPartial(env);

  if (url.pathname === "/admin/search-location" && request.method === "GET") {
    return jsonResponse(await searchLocations(url.searchParams.get("query") || ""));
  }

  if (url.pathname === "/admin/settings/admin-telegram" && request.method === "POST") return handleUpdateAdminTelegram(request, env);
  if (url.pathname === "/admin/settings/working-hours" && request.method === "POST") return handleUpdateWorkingHours(request, env);
  if (url.pathname === "/admin/settings/admin-language" && request.method === "POST") return handleUpdateAdminLanguage(request, env);

  if (url.pathname === "/admin/products" && request.method === "POST") return handleCreateProduct(request, env);
  const productUpdate = url.pathname.match(/^\/admin\/products\/(\d+)\/update$/);
  if (productUpdate && request.method === "POST") return handleUpdateProduct(request, env, Number(productUpdate[1]));
  const productDelete = url.pathname.match(/^\/admin\/products\/(\d+)\/delete$/);
  if (productDelete && request.method === "POST") return handleDeleteProduct(env, Number(productDelete[1]));

  if (url.pathname === "/admin/meeting-points" && request.method === "POST") return handleCreateMeetingPoint(request, env);
  const pointUpdate = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/update$/);
  if (pointUpdate && request.method === "POST") return handleUpdateMeetingPoint(request, env, Number(pointUpdate[1]));
  const pointDefault = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/default$/);
  if (pointDefault && request.method === "POST") return handleSetPreferredMeetingPoint(env, Number(pointDefault[1]));
  const pointDelete = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/delete$/);
  if (pointDelete && request.method === "POST") return handleDeleteMeetingPoint(env, Number(pointDelete[1]));

  const customerDetail = url.pathname.match(/^\/admin\/customers\/(\d+)$/);
  if (customerDetail && request.method === "GET") return handleCustomerDetail(env, Number(customerDetail[1]));
  const customerReply = url.pathname.match(/^\/admin\/customers\/(\d+)\/reply$/);
  if (customerReply && request.method === "POST") return handleSendCustomerReply(request, env, Number(customerReply[1]));

  const requestStatus = url.pathname.match(/^\/admin\/customer-requests\/(\d+)\/status$/);
  if (requestStatus && request.method === "POST") return handleUpdateCustomerRequestStatus(request, env, Number(requestStatus[1]));
  if (url.pathname === "/admin/customer-requests/group/done" && request.method === "POST") return handleMarkCustomerRequestGroupDone(request, env);
  if (url.pathname === "/admin/customer-requests/all/done" && request.method === "POST") return handleMarkAllDone(env);

  return jsonResponse({ error: "Not found", path: url.pathname }, 404);
}

export default {
  async fetch(request, env) {
    return routeRequest(request, env);
  }
};
