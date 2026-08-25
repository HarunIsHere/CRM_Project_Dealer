import {
  getIdentityCapabilities,
  handleIdentityApi
} from "./identity/service.js";
import {
  processAuthEmailDeadLetterQueue,
  processAuthEmailQueue,
  sweepAuthEmailOutbox
} from "./identity/email/dispatcher.js";
import { sweepExpiredIdempotencyKeys } from "./identity/idempotency.js";
import {
  ADMIN_INVITATION_LANDING_ROUTE,
  handleAdminInvitationLanding
} from "./identity/staff/invitation-page.js";
import {
  ADMIN_RECOVERY_LANDING_ROUTE,
  handleAdminRecoveryLanding
} from "./identity/staff/recovery-page.js";
import { getAdminSharedText } from "./i18n/admin-shared.generated.js";
import { createOpaqueId } from "./identity/crypto.js";
import { normalizeEmailAddress } from "./identity/email/normalization.js";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const TELEGRAM_MINI_APP_URL = "https://crm-delivery-mini-app.pages.dev";

function getTelegramMiniAppAssetResponse(pathname) {
  if (pathname === "/telegram/mini-app" || pathname === "/telegram/mini-app/") {
    return Response.redirect(TELEGRAM_MINI_APP_URL, 302);
  }

  if (pathname.startsWith("/telegram/mini-app/")) {
    return Response.redirect(TELEGRAM_MINI_APP_URL, 302);
  }

  return null;
}

const ADMIN_CSS = ':root {\n    --bg: #f4f6f8;\n    --panel: #ffffff;\n    --text: #1f2937;\n    --muted: #6b7280;\n    --border: #d9dee7;\n    --primary: #2563eb;\n    --primary-hover: #1d4ed8;\n    --danger: #dc2626;\n    --success: #16a34a;\n    --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);\n    --radius: 14px;\n}\n\n* {\n    box-sizing: border-box;\n}\n\nbody {\n    margin: 0;\n    padding: 24px;\n    background: var(--bg);\n    color: var(--text);\n    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n    font-size: 15px;\n    line-height: 1.45;\n}\n\nh1 {\n    margin: 0 0 18px;\n    font-size: 28px;\n    letter-spacing: -0.03em;\n}\n\nh2 {\n    margin: 28px 0 12px;\n    font-size: 20px;\n    letter-spacing: -0.02em;\n}\n\nh3 {\n    margin: 22px 0 10px;\n    font-size: 17px;\n}\n\np {\n    margin: 10px 0;\n}\n\na {\n    color: var(--primary);\n    text-decoration: none;\n}\n\na:hover {\n    text-decoration: underline;\n}\n\nform {\n    margin: 0;\n}\n\nbody > form,\nbody > p,\nbody > table,\nbody > div,\nbody > h2 + form,\nbody > h3 + form {\n    max-width: 1200px;\n}\n\nbody > table,\n#open-requests-container,\nform:not([style*="display:inline"]) {\n    background: var(--panel);\n    border: 1px solid var(--border);\n    border-radius: var(--radius);\n    box-shadow: var(--shadow);\n    padding: 16px;\n    margin-bottom: 18px;\n}\n\ntable {\n    width: 100%;\n    border-collapse: collapse;\n    background: var(--panel);\n    border: 1px solid var(--border) !important;\n    border-radius: var(--radius);\n    overflow: hidden;\n}\n\nth,\ntd {\n    border: 1px solid var(--border) !important;\n    padding: 10px;\n    text-align: left;\n    vertical-align: top;\n}\n\nth {\n    background: #eef2f7;\n    font-weight: 700;\n    color: #111827;\n}\n\ntr:nth-child(even) td {\n    background: #fafbfc;\n}\n\ninput,\nselect,\ntextarea {\n    width: 100%;\n    max-width: 720px;\n    border: 1px solid var(--border);\n    border-radius: 10px;\n    padding: 9px 10px;\n    font: inherit;\n    background: #fff;\n    color: var(--text);\n}\n\ninput[type="checkbox"],\ninput[type="radio"] {\n    width: auto;\n    margin-right: 6px;\n}\n\ntextarea {\n    min-height: 84px;\n    resize: vertical;\n}\n\nbutton {\n    appearance: none;\n    border: 0;\n    border-radius: 10px;\n    background: var(--primary);\n    color: #fff;\n    padding: 9px 13px;\n    font: inherit;\n    font-weight: 650;\n    cursor: pointer;\n    margin: 3px 4px 3px 0;\n}\n\nbutton:hover {\n    background: var(--primary-hover);\n}\n\nbutton[type="submit"] {\n    background: var(--primary);\n}\n\nform[action*="logout"] button,\nform[action*="delete"] button {\n    background: var(--danger);\n}\n\nform[action*="logout"] button:hover,\nform[action*="delete"] button:hover {\n    background: #b91c1c;\n}\n\np[style*="color:red"],\n.error {\n    color: var(--danger) !important;\n    background: #fef2f2;\n    border: 1px solid #fecaca;\n    padding: 10px 12px;\n    border-radius: 10px;\n}\n\np[style*="color:green"],\n.success {\n    color: var(--success) !important;\n    background: #f0fdf4;\n    border: 1px solid #bbf7d0;\n    padding: 10px 12px;\n    border-radius: 10px;\n}\n\n.page-actions {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n    margin: 14px 0 22px;\n}\n\n.page-actions form {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n    margin: 0;\n}\n\n@media (max-width: 760px) {\n    body {\n        padding: 14px;\n        font-size: 14px;\n    }\n\n    h1 {\n        font-size: 23px;\n    }\n\n    h2 {\n        font-size: 18px;\n    }\n\n    body > table,\n    #open-requests-container,\n    form:not([style*="display:inline"]) {\n        padding: 12px;\n        border-radius: 12px;\n        overflow-x: auto;\n    }\n\n    table {\n        min-width: 720px;\n        display: block;\n        overflow-x: auto;\n        white-space: nowrap;\n    }\n\n    input,\n    select,\n    textarea {\n        max-width: none;\n    }\n\n    button {\n        width: 100%;\n        margin: 4px 0;\n    }\n\n    form[style*="display:inline"] button,\n    td button {\n        width: auto;\n    }\n\n    .page-actions {\n        display: block;\n    }\n}\n\n.request-action-button {\n    width: 135px;\n    text-align: center;\n}\n\n/* Compact admin UI adjustment */\nbody {\n    font-size: 13px;\n    padding: 18px;\n}\n\nh1 {\n    font-size: 24px;\n    margin-bottom: 14px;\n}\n\nh2 {\n    font-size: 17px;\n    margin: 22px 0 10px;\n}\n\nh3 {\n    font-size: 15px;\n}\n\nbutton {\n    padding: 6px 10px;\n    font-size: 13px;\n    border-radius: 8px;\n    margin: 2px 3px 2px 0;\n}\n\ninput,\nselect,\ntextarea {\n    font-size: 13px;\n    padding: 7px 9px;\n    border-radius: 8px;\n}\n\nth,\ntd {\n    padding: 7px 8px;\n}\n\nbody > table,\n#open-requests-container,\nform:not([style*="display:inline"]) {\n    padding: 12px;\n    margin-bottom: 14px;\n}\n\n.request-action-button {\n    width: 110px;\n}\n\n@media (max-width: 760px) {\n    body {\n        font-size: 13px;\n        padding: 10px;\n    }\n\n    h1 {\n        font-size: 21px;\n    }\n\n    h2 {\n        font-size: 16px;\n    }\n\n    button {\n        font-size: 13px;\n        padding: 7px 9px;\n    }\n\n    th,\n    td {\n        padding: 6px 7px;\n    }\n}\n\nhr {\n    max-width: 1200px;\n    border: 0;\n    border-top: 1px solid var(--border);\n    margin: 14px 0 18px;\n}\n\n.admin-header {\n    max-width: 1200px;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    margin-bottom: 10px;\n}\n\n.admin-header h1 {\n    margin: 0;\n}\n\n.header-actions {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.header-actions form {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n    margin: 0;\n}\n\n@media (max-width: 760px) {\n    .admin-header {\n        align-items: flex-start;\n        flex-direction: column;\n    }\n\n    .header-actions {\n        width: 100%;\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n    }\n\n    .header-actions a,\n    .header-actions form {\n        width: 100%;\n    }\n\n    .header-actions button {\n        width: 100%;\n    }\n}\n\n.admin-header {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n}\n\n.header-actions {\n    display: flex;\n    gap: 8px;\n}\n\n.header-actions form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.header-actions a {\n    display: inline-block;\n}\n\nhr + hr {\n    margin-top: -10px;\n}\n\n@media (max-width: 760px) {\n    .admin-header {\n        flex-direction: column;\n        align-items: flex-start;\n    }\n\n    .header-actions {\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n        width: 100%;\n    }\n}\n\n.all-done-header-form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 6px 0 0 0 !important;\n}\n\n.all-done-header-form button {\n    width: 90px;\n}\n#open-requests-container table th:nth-child(9),\n#open-requests-container table td:nth-child(9) {\n    width: 125px;\n    min-width: 125px;\n    max-width: 125px;\n    padding: 7px 8px;\n}\n\n#open-requests-container table td:nth-child(9) form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 0 5px 0 !important;\n}\n\n#open-requests-container table td:nth-child(9) button,\n.request-action-button {\n    width: 110px;\n    margin: 0 0 5px 0 !important;\n}\n\n.all-done-header-form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.all-done-header-form button {\n    width: 90px;\n}\n\n.open-requests-table-actions {\n    max-width: 1200px;\n    display: flex;\n    justify-content: flex-end;\n    margin: 0 0 8px 0;\n}\n\n.open-requests-table-actions form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.open-requests-table-actions button {\n    width: 90px;\n}\n\n.admin-info-text {\n    max-width: 1200px;\n    background: #eef2ff;\n    border: 1px solid #c7d2fe;\n    border-radius: 10px;\n    padding: 10px 12px;\n    color: #1e3a8a;\n    margin: 10px 0 18px;\n}\n';

const SUPPORTED_LANGUAGES = ["en", "de", "tr", "ar", "ru"];

const ADMIN_COOKIE_NAME = "admin_access_token";

const APP_CAPABILITIES = {
  app_name: "CRM Delivery",
  runtime: "Cloudflare Worker + D1 + Telegram webhook",
  response_policy: "local_first_ai_fallback",
  local_first_handlers: [
    "Telegram commands",
    "callback buttons",
    "typed menu numbers",
    "language selection",
    "product list",
    "specific product matching",
    "product aliases",
    "working-hours restrictions",
    "meeting point selection",
    "typed address flow",
    "Telegram shared location",
    "admin contact request",
    "admin notification forwarding",
    "admin free-text reply",
    "delivery ETA updates",
    "no-delivery response",
    "approved learned patterns"
  ],
  admin_features: [
    "admin login",
    "admin password change",
    "admin password reset by Telegram code",
    "admin notification receiver",
    "working hours",
    "bot response mode",
    "products",
    "product aliases",
    "meeting points",
    "open requests",
    "customer history",
    "AI learned pattern approval"
  ],
  ai_role: [
    "AI is fallback only",
    "AI is called only after local handlers fail",
    "AI must return structured JSON",
    "AI must not invent products",
    "AI must not invent prices",
    "AI must not invent meeting points",
    "AI must not bypass working-hours logic",
    "AI must not expose admin-only/internal details",
    "AI must return handled=false for nonsense/random keyboard input",
    "AI may help with normal customer questions using live context"
  ]
};

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
      open_customer: "Open Customer",
      message_customer: "Message Customer",
      send: "Send",
      cancel: "Cancel",
      general: "General",
    meeting_point_help: "If only one location is active, the customer receives that location directly. If multiple locations are active, the customer can choose from all active locations; the preferred location/s is marked as preferred."
  },
  de: {
      open_customer: "Kunde öffnen",
      message_customer: "Kunde anschreiben",
      send: "Senden",
      cancel: "Abbrechen",
      general: "Allgemein",
    meeting_point_help: "Wenn nur ein Standort aktiv ist, erhält der Kunde diesen Standort direkt. Wenn mehrere Standorte aktiv sind, kann der Kunde aus allen aktiven Standorten wählen; der/die bevorzugte(n) Standort(e) werden als bevorzugt markiert."
  },
  tr: {
      open_customer: "Müşteriyi Aç",
      message_customer: "Müşteriye Mesaj",
      send: "Gönder",
      cancel: "İptal",
      general: "Genel",
    meeting_point_help: "Sadece bir konum aktifse müşteri o konumu direkt alır. Birden fazla konum aktifse müşteri tüm aktif konumlar arasından seçim yapar; tercih edilen konum/lar tercih edilen olarak işaretlenir."
  },
  ar: {
      open_customer: "فتح العميل",
      message_customer: "مراسلة العميل",
      send: "إرسال",
      cancel: "إلغاء",
      general: "عام",
    meeting_point_help: "إذا كان هناك موقع نشط واحد فقط، يتلقى العميل هذا الموقع مباشرة. إذا كانت هناك عدة مواقع نشطة، يمكن للعميل الاختيار من جميع المواقع النشطة؛ ويتم تمييز الموقع/المواقع المفضلة كمفضلة."
  },
  ru: {
      open_customer: "Открыть клиента",
      message_customer: "Написать клиенту",
      send: "Отправить",
      cancel: "Отмена",
      general: "Общее",
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

function getAdminUiText(language = "en") {
  const normalizedLanguage = safeLang(language);
  return {
    ...getAdminSharedText(normalizedLanguage),
    _language: normalizedLanguage
  };
}


function getAdminDashboardUiText(language = "en") {
  return getAdminUiText(language);
}



function i18nBoolean(value, language = "en") {
  const normalized = String(value).toLowerCase();

  const isTrue = (
    normalized === "true"
    || normalized === "1"
    || normalized === "yes"
    || normalized === "on"
  );

  const labels = {
    en: { yes: "Yes", no: "No" },
    de: { yes: "Ja", no: "Nein" },
    tr: { yes: "Evet", no: "Hayır" },
    ar: { yes: "نعم", no: "لا" },
    ru: { yes: "Да", no: "Нет" }
  };

  const selected = labels[language] || labels.en;

  return isTrue ? selected.yes : selected.no;
}


function i18nAdmin(language = "en") {
  return getAdminUiText(language);
}

function i18nStatus(status, language = "en") {
  const ui = getAdminUiText(language);
  const value = String(status || "");

  if (value === "pending") return ui.pending_status;
  if (value === "approved") return ui.approved_status;
  if (value === "rejected") return ui.rejected_status;
  if (value === "new") return ui.new_status;
  if (value === "in_progress") return ui.in_progress_status;
  if (value === "done") return ui.done_status;

  return value;
}


function i18nMessageSource(source, language = "en") {
  const value = String(source || "");

  const map = {
    en: {
      "Incoming": "Incoming",
      "Rule Base": "Rule Base",
      "AI": "AI",
      "Admin": "Admin"
    },
    de: {
      "Incoming": "Eingehend",
      "Rule Base": "Regelbasis",
      "AI": "KI",
      "Admin": "Admin"
    },
    tr: {
      "Incoming": "Gelen",
      "Rule Base": "Kural Sistemi",
      "AI": "AI",
      "Admin": "Admin"
    },
    ar: {
      "Incoming": "وارد",
      "Rule Base": "نظام القواعد",
      "AI": "الذكاء الاصطناعي",
      "Admin": "الإدارة"
    },
    ru: {
      "Incoming": "Входящее",
      "Rule Base": "Система правил",
      "AI": "AI",
      "Admin": "Админ"
    }
  };

  return (map[language] && map[language][value]) || value;
}


function i18nRequestType(type, language = "en") {
  const value = String(type || "");

  const map = {
    en: {
      product_specific: "Product request",
      product_list: "Product list",
      delivery_location: "Delivery location",
      location: "Location",
      address: "Address",
      contact_admin: "Contact admin",
      unresolved: "Unresolved"
    },
    de: {
      product_specific: "Produktanfrage",
      product_list: "Produktliste",
      delivery_location: "Lieferort",
      location: "Standort",
      address: "Adresse",
      contact_admin: "Admin kontaktieren",
      unresolved: "Ungelöst"
    },
    tr: {
      product_specific: "Ürün talebi",
      product_list: "Ürün listesi",
      delivery_location: "Teslimat konumu",
      location: "Konum",
      address: "Adres",
      contact_admin: "Admin ile iletişim",
      unresolved: "Çözülemeyen"
    },
    ar: {
      product_specific: "طلب منتج",
      product_list: "قائمة المنتجات",
      delivery_location: "موقع التسليم",
      location: "الموقع",
      address: "العنوان",
      contact_admin: "التواصل مع الإدارة",
      unresolved: "غير محلول"
    },
    ru: {
      product_specific: "Запрос товара",
      product_list: "Список товаров",
      delivery_location: "Место доставки",
      location: "Локация",
      address: "Адрес",
      contact_admin: "Связаться с админом",
      unresolved: "Нерешено"
    }
  };

  return (map[language] && map[language][value]) || value;
}

function i18nIntent(intent, language = "en") {
  const value = String(intent || "");

  const map = {
    en: {
      general_answer: "General answer",
      greeting: "Greeting",
      product_request: "Product request",
      location_request: "Location request",
      address_request: "Address request",
      contact_admin: "Contact admin",
      abuse_or_insult: "Abuse / insult",
      unclear: "Unclear"
    },
    de: {
      general_answer: "Allgemeine Antwort",
      greeting: "Begrüßung",
      product_request: "Produktanfrage",
      location_request: "Standortanfrage",
      address_request: "Adressanfrage",
      contact_admin: "Admin kontaktieren",
      abuse_or_insult: "Beleidigung",
      unclear: "Unklar"
    },
    tr: {
      general_answer: "Genel cevap",
      greeting: "Selamlama",
      product_request: "Ürün talebi",
      location_request: "Konum talebi",
      address_request: "Adres talebi",
      contact_admin: "Admin ile iletişim",
      abuse_or_insult: "Hakaret",
      unclear: "Belirsiz"
    },
    ar: {
      general_answer: "رد عام",
      greeting: "تحية",
      product_request: "طلب منتج",
      location_request: "طلب موقع",
      address_request: "طلب عنوان",
      contact_admin: "التواصل مع الإدارة",
      abuse_or_insult: "إساءة / إهانة",
      unclear: "غير واضح"
    },
    ru: {
      general_answer: "Общий ответ",
      greeting: "Приветствие",
      product_request: "Запрос товара",
      location_request: "Запрос локации",
      address_request: "Запрос адреса",
      contact_admin: "Связаться с админом",
      abuse_or_insult: "Оскорбление",
      unclear: "Неясно"
    }
  };

  return (map[language] && map[language][value]) || value;
}

function i18nDirection(direction, language = "en") {
  const value = String(direction || "");

  const map = {
    en: {
      incoming: "Incoming",
      outgoing: "Outgoing"
    },
    de: {
      incoming: "Eingehend",
      outgoing: "Ausgehend"
    },
    tr: {
      incoming: "Gelen",
      outgoing: "Giden"
    },
    ar: {
      incoming: "وارد",
      outgoing: "صادر"
    },
    ru: {
      incoming: "Входящее",
      outgoing: "Исходящее"
    }
  };

  return (map[language] && map[language][value]) || value;
}


function getAdminTimezoneGroups(language = "en") {
  const labels = {
    en: [
      ["Etc/GMT+12", "(UTC-12:00) International Date Line West"],
      ["Etc/GMT+11", "(UTC-11:00) Coordinated Universal Time-11"],
      ["Pacific/Honolulu", "(UTC-10:00) Hawaii"],
      ["America/Anchorage", "(UTC-09:00) Alaska"],
      ["America/Los_Angeles", "(UTC-08:00) Pacific Time - US & Canada"],
      ["America/Denver", "(UTC-07:00) Mountain Time - US & Canada"],
      ["America/Chicago", "(UTC-06:00) Central Time - US & Canada"],
      ["America/New_York", "(UTC-05:00) Eastern Time - US & Canada"],
      ["America/Halifax", "(UTC-04:00) Atlantic Time - Canada"],
      ["America/Argentina/Buenos_Aires", "(UTC-03:00) Buenos Aires, Greenland"],
      ["Etc/GMT+2", "(UTC-02:00) Mid-Atlantic"],
      ["Atlantic/Azores", "(UTC-01:00) Azores, Cape Verde"],
      ["Europe/London", "(UTC+00:00) Dublin, Edinburgh, Lisbon, London"],
      ["Europe/Berlin", "(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna"],
      ["Europe/Athens", "(UTC+02:00) Athens, Bucharest, Cairo, Helsinki"],
      ["Europe/Istanbul", "(UTC+03:00) Istanbul, Moscow, Riyadh"],
      ["Asia/Dubai", "(UTC+04:00) Abu Dhabi, Dubai, Muscat"],
      ["Asia/Karachi", "(UTC+05:00) Islamabad, Karachi, Tashkent"],
      ["Asia/Dhaka", "(UTC+06:00) Astana, Dhaka"],
      ["Asia/Bangkok", "(UTC+07:00) Bangkok, Hanoi, Jakarta"],
      ["Asia/Shanghai", "(UTC+08:00) Beijing, Hong Kong, Singapore, Taipei"],
      ["Asia/Tokyo", "(UTC+09:00) Osaka, Sapporo, Seoul, Tokyo"],
      ["Australia/Sydney", "(UTC+10:00) Canberra, Melbourne, Sydney"],
      ["Pacific/Guadalcanal", "(UTC+11:00) Solomon Islands, New Caledonia"],
      ["Pacific/Auckland", "(UTC+12:00) Auckland, Fiji"]
    ],
    de: [
      ["Etc/GMT+12", "(UTC-12:00) Internationale Datumsgrenze West"],
      ["Etc/GMT+11", "(UTC-11:00) Koordinierte Weltzeit-11"],
      ["Pacific/Honolulu", "(UTC-10:00) Hawaii"],
      ["America/Anchorage", "(UTC-09:00) Alaska"],
      ["America/Los_Angeles", "(UTC-08:00) Pazifikzeit - USA & Kanada"],
      ["America/Denver", "(UTC-07:00) Mountain Time - USA & Kanada"],
      ["America/Chicago", "(UTC-06:00) Central Time - USA & Kanada"],
      ["America/New_York", "(UTC-05:00) Eastern Time - USA & Kanada"],
      ["America/Halifax", "(UTC-04:00) Atlantikzeit - Kanada"],
      ["America/Argentina/Buenos_Aires", "(UTC-03:00) Buenos Aires, Grönland"],
      ["Etc/GMT+2", "(UTC-02:00) Mittelatlantik"],
      ["Atlantic/Azores", "(UTC-01:00) Azoren, Kap Verde"],
      ["Europe/London", "(UTC+00:00) Dublin, Edinburgh, Lissabon, London"],
      ["Europe/Berlin", "(UTC+01:00) Amsterdam, Berlin, Bern, Rom, Stockholm, Wien"],
      ["Europe/Athens", "(UTC+02:00) Athen, Bukarest, Kairo, Helsinki"],
      ["Europe/Istanbul", "(UTC+03:00) Istanbul, Moskau, Riad"],
      ["Asia/Dubai", "(UTC+04:00) Abu Dhabi, Dubai, Maskat"],
      ["Asia/Karachi", "(UTC+05:00) Islamabad, Karatschi, Taschkent"],
      ["Asia/Dhaka", "(UTC+06:00) Astana, Dhaka"],
      ["Asia/Bangkok", "(UTC+07:00) Bangkok, Hanoi, Jakarta"],
      ["Asia/Shanghai", "(UTC+08:00) Peking, Hongkong, Singapur, Taipeh"],
      ["Asia/Tokyo", "(UTC+09:00) Osaka, Sapporo, Seoul, Tokio"],
      ["Australia/Sydney", "(UTC+10:00) Canberra, Melbourne, Sydney"],
      ["Pacific/Guadalcanal", "(UTC+11:00) Salomonen, Neukaledonien"],
      ["Pacific/Auckland", "(UTC+12:00) Auckland, Fidschi"]
    ],
    tr: [
      ["Etc/GMT+12", "(UTC-12:00) Uluslararası Tarih Çizgisi Batı"],
      ["Etc/GMT+11", "(UTC-11:00) Eşgüdümlü Evrensel Zaman-11"],
      ["Pacific/Honolulu", "(UTC-10:00) Hawaii"],
      ["America/Anchorage", "(UTC-09:00) Alaska"],
      ["America/Los_Angeles", "(UTC-08:00) Pasifik Saati - ABD & Kanada"],
      ["America/Denver", "(UTC-07:00) Dağ Saati - ABD & Kanada"],
      ["America/Chicago", "(UTC-06:00) Merkezi Saat - ABD & Kanada"],
      ["America/New_York", "(UTC-05:00) Doğu Saati - ABD & Kanada"],
      ["America/Halifax", "(UTC-04:00) Atlantik Saati - Kanada"],
      ["America/Argentina/Buenos_Aires", "(UTC-03:00) Buenos Aires, Grönland"],
      ["Etc/GMT+2", "(UTC-02:00) Orta Atlantik"],
      ["Atlantic/Azores", "(UTC-01:00) Azorlar, Cape Verde"],
      ["Europe/London", "(UTC+00:00) Dublin, Edinburgh, Lizbon, Londra"],
      ["Europe/Berlin", "(UTC+01:00) Amsterdam, Berlin, Bern, Roma, Stockholm, Viyana"],
      ["Europe/Athens", "(UTC+02:00) Atina, Bükreş, Kahire, Helsinki"],
      ["Europe/Istanbul", "(UTC+03:00) İstanbul, Moskova, Riyad"],
      ["Asia/Dubai", "(UTC+04:00) Abu Dabi, Dubai, Maskat"],
      ["Asia/Karachi", "(UTC+05:00) İslamabad, Karaçi, Taşkent"],
      ["Asia/Dhaka", "(UTC+06:00) Astana, Dakka"],
      ["Asia/Bangkok", "(UTC+07:00) Bangkok, Hanoi, Jakarta"],
      ["Asia/Shanghai", "(UTC+08:00) Pekin, Hong Kong, Singapur, Taipei"],
      ["Asia/Tokyo", "(UTC+09:00) Osaka, Sapporo, Seul, Tokyo"],
      ["Australia/Sydney", "(UTC+10:00) Canberra, Melbourne, Sidney"],
      ["Pacific/Guadalcanal", "(UTC+11:00) Solomon Adaları, Yeni Kaledonya"],
      ["Pacific/Auckland", "(UTC+12:00) Auckland, Fiji"]
    ],
    ar: [
      ["Etc/GMT+12", "(UTC-12:00) خط التاريخ الدولي غرباً"],
      ["Etc/GMT+11", "(UTC-11:00) التوقيت العالمي المنسق-11"],
      ["Pacific/Honolulu", "(UTC-10:00) هاواي"],
      ["America/Anchorage", "(UTC-09:00) ألاسكا"],
      ["America/Los_Angeles", "(UTC-08:00) توقيت المحيط الهادئ - الولايات المتحدة وكندا"],
      ["America/Denver", "(UTC-07:00) توقيت الجبال - الولايات المتحدة وكندا"],
      ["America/Chicago", "(UTC-06:00) التوقيت المركزي - الولايات المتحدة وكندا"],
      ["America/New_York", "(UTC-05:00) التوقيت الشرقي - الولايات المتحدة وكندا"],
      ["America/Halifax", "(UTC-04:00) توقيت الأطلسي - كندا"],
      ["America/Argentina/Buenos_Aires", "(UTC-03:00) بوينس آيرس، غرينلاند"],
      ["Etc/GMT+2", "(UTC-02:00) وسط الأطلسي"],
      ["Atlantic/Azores", "(UTC-01:00) الأزور، الرأس الأخضر"],
      ["Europe/London", "(UTC+00:00) دبلن، إدنبرة، لشبونة، لندن"],
      ["Europe/Berlin", "(UTC+01:00) أمستردام، برلين، برن، روما، ستوكهولم، فيينا"],
      ["Europe/Athens", "(UTC+02:00) أثينا، بوخارست، القاهرة، هلسنكي"],
      ["Europe/Istanbul", "(UTC+03:00) إسطنبول، موسكو، الرياض"],
      ["Asia/Dubai", "(UTC+04:00) أبوظبي، دبي، مسقط"],
      ["Asia/Karachi", "(UTC+05:00) إسلام آباد، كراتشي، طشقند"],
      ["Asia/Dhaka", "(UTC+06:00) أستانا، دكا"],
      ["Asia/Bangkok", "(UTC+07:00) بانكوك، هانوي، جاكرتا"],
      ["Asia/Shanghai", "(UTC+08:00) بكين، هونغ كونغ، سنغافورة، تايبيه"],
      ["Asia/Tokyo", "(UTC+09:00) أوساكا، سابورو، سيول، طوكيو"],
      ["Australia/Sydney", "(UTC+10:00) كانبرا، ملبورن، سيدني"],
      ["Pacific/Guadalcanal", "(UTC+11:00) جزر سليمان، كاليدونيا الجديدة"],
      ["Pacific/Auckland", "(UTC+12:00) أوكلاند، فيجي"]
    ],
    ru: [
      ["Etc/GMT+12", "(UTC-12:00) Международная линия перемены даты - запад"],
      ["Etc/GMT+11", "(UTC-11:00) Всемирное координированное время-11"],
      ["Pacific/Honolulu", "(UTC-10:00) Гавайи"],
      ["America/Anchorage", "(UTC-09:00) Аляска"],
      ["America/Los_Angeles", "(UTC-08:00) Тихоокеанское время - США и Канада"],
      ["America/Denver", "(UTC-07:00) Горное время - США и Канада"],
      ["America/Chicago", "(UTC-06:00) Центральное время - США и Канада"],
      ["America/New_York", "(UTC-05:00) Восточное время - США и Канада"],
      ["America/Halifax", "(UTC-04:00) Атлантическое время - Канада"],
      ["America/Argentina/Buenos_Aires", "(UTC-03:00) Буэнос-Айрес, Гренландия"],
      ["Etc/GMT+2", "(UTC-02:00) Средняя Атлантика"],
      ["Atlantic/Azores", "(UTC-01:00) Азоры, Кабо-Верде"],
      ["Europe/London", "(UTC+00:00) Дублин, Эдинбург, Лиссабон, Лондон"],
      ["Europe/Berlin", "(UTC+01:00) Амстердам, Берлин, Берн, Рим, Стокгольм, Вена"],
      ["Europe/Athens", "(UTC+02:00) Афины, Бухарест, Каир, Хельсинки"],
      ["Europe/Istanbul", "(UTC+03:00) Стамбул, Москва, Эр-Рияд"],
      ["Asia/Dubai", "(UTC+04:00) Абу-Даби, Дубай, Маскат"],
      ["Asia/Karachi", "(UTC+05:00) Исламабад, Карачи, Ташкент"],
      ["Asia/Dhaka", "(UTC+06:00) Астана, Дакка"],
      ["Asia/Bangkok", "(UTC+07:00) Бангкок, Ханой, Джакарта"],
      ["Asia/Shanghai", "(UTC+08:00) Пекин, Гонконг, Сингапур, Тайбэй"],
      ["Asia/Tokyo", "(UTC+09:00) Осака, Саппоро, Сеул, Токио"],
      ["Australia/Sydney", "(UTC+10:00) Канберра, Мельбурн, Сидней"],
      ["Pacific/Guadalcanal", "(UTC+11:00) Соломоновы острова, Новая Каледония"],
      ["Pacific/Auckland", "(UTC+12:00) Окленд, Фиджи"]
    ]
  };

  return labels[language] || labels.en;
}

function getAdminTimezoneOptions(selectedTimezone, language = "en") {
  return getAdminTimezoneGroups(language).map((entry) => {
    const value = entry[0];
    const label = entry[1];
    const selected = value === selectedTimezone ? "selected" : "";

    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}


function formatMessageSource(messageType, direction = "") {
  const value = String(messageType || "text");

  if (direction === "incoming") return "Incoming";
  if (value === "ai_reply") return "AI";
  if (value === "learned_rule_reply") return "Learned Rule";
  if (value === "admin_reply") return "Admin";
  if (value === "delivery_eta") return "Delivery ETA";
  if (value === "text") return "Rule Base";

  return value;
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
    .replace(/ß/g, "ss")
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

function getTelegramMiniAppButton(language = "en") {
  const labels = {
    en: "Open Customer Shop",
    de: "Kunden-Shop öffnen",
    tr: "Müşteri mağazasını aç",
    ar: "افتح متجر العملاء",
    ru: "Открыть магазин"
  };
  const lang = safeLang(language);
  return {
    text: labels[lang] || labels.en,
    web_app: { url: TELEGRAM_MINI_APP_URL }
  };
}

function getMenuKeyboard(language = "en") {
  const lang = safeLang(language);
  const rows = [
    [getTelegramMiniAppButton(lang)],
    ...Object.values(MENU_OPTIONS).map((option) => [
      {
        text: option.labels[lang] || option.labels.en,
        callback_data: option.callback_data
      }
    ])
  ];

  return { inline_keyboard: rows };
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
  const adminUrl = env.ADMIN_WEB_URL || "https://crm.ayartuerk.me/admin";
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

function parseDeliveryCities(value) {
  const raw = String(value || "").trim();

  if (!raw) return ["Berlin"];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const cities = parsed
        .map((city) => String(city || "").trim())
        .filter(Boolean);

      return cities.length ? [...new Set(cities)] : ["Berlin"];
    }
  } catch (_) {
    // Fall back to comma parsing below.
  }

  const cities = raw
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean);

  return cities.length ? [...new Set(cities)] : ["Berlin"];
}

async function getAllowedDeliveryCities(env) {
  return parseDeliveryCities(await getSetting(env, "allowed_delivery_cities"));
}

async function setAllowedDeliveryCities(env, cities) {
  const cleaned = [...new Set(
    cities
      .map((city) => String(city || "").trim())
      .filter(Boolean)
  )];

  await setSetting(
    env,
    "allowed_delivery_cities",
    JSON.stringify(cleaned.length ? cleaned : ["Berlin"])
  );
}

function formatAllowedCities(cities) {
  return cities.join(", ");
}

function detectUnsupportedDeliveryCity(text, allowedCities) {
  const clean = normalizeText(text);
  const allowed = allowedCities.map(normalizeText);

  if (allowed.some((city) => clean.includes(city))) {
    return null;
  }

  const knownCities = [
    "berlin", "potsdam", "hamburg", "munich", "munchen", "muenchen",
    "koln", "koeln", "cologne", "frankfurt", "stuttgart", "dusseldorf",
    "duesseldorf", "dortmund", "essen", "leipzig", "bremen", "dresden",
    "hannover", "nuremberg", "nurnberg", "nuernberg", "bonn",
    "istanbul", "ankara", "izmir", "antalya", "bangkok", "samui",
    "koh samui", "phangan", "koh phangan"
  ];

  return knownCities.find((city) => clean.includes(city) && !allowed.includes(city)) || null;
}

function extractCoordinatesFromGoogleMapsLink(value) {
  let raw = String(value || "");

  try {
    raw = decodeURIComponent(raw);
  } catch (_) {}

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /\b(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)\b/
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return {
        latitude: String(latitude),
        longitude: String(longitude)
      };
    }
  }

  return null;
}

function getLocationCoordinates(location = {}) {
  const latitude = location.latitude !== undefined && location.latitude !== null ? String(location.latitude).trim() : "";
  const longitude = location.longitude !== undefined && location.longitude !== null ? String(location.longitude).trim() : "";

  if (latitude && longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      return {
        latitude: String(lat),
        longitude: String(lon)
      };
    }
  }

  return extractCoordinatesFromGoogleMapsLink(location.google_maps_link || location.delivery_google_maps_link || "");
}

function textMentionsAllowedDeliveryCity(value, allowedCities = []) {
  const clean = normalizeText(value);
  const allowed = allowedCities.map(normalizeText).filter(Boolean);

  return allowed.some((city) => clean.includes(city));
}

function getReverseGeocodeCityText(reverseData = {}) {
  const address = reverseData.address || {};

  return [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.borough,
    address.suburb,
    address.county,
    address.state,
    address.country,
    reverseData.display_name
  ].filter(Boolean).join(", ");
}

async function reverseGeocodeDeliveryCoordinates(latitude, longitude) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude);
  url.searchParams.set("lon", longitude);
  url.searchParams.set("addressdetails", "1");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url.toString(), {
      headers: { "user-agent": "CRMProjectDealer/1.0" },
      signal: controller.signal
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}


async function validateDeliveryLocationAgainstAllowedCities(env, location = {}) {
  const allowedCities = await getAllowedDeliveryCities(env);
  const directText = [
    location.label,
    location.location_label,
    location.address,
    location.description,
    location.delivery_location_label,
    location.delivery_address
  ].filter(Boolean).join(", ");

  const coordinates = getLocationCoordinates(location);

  if (coordinates) {
    const reverseData = await reverseGeocodeDeliveryCoordinates(coordinates.latitude, coordinates.longitude);
    const reverseText = getReverseGeocodeCityText(reverseData || {});

    if (textMentionsAllowedDeliveryCity(reverseText, allowedCities)) {
      return { ok: true, allowed_cities: allowedCities, reverse_text: reverseText };
    }

    return {
      ok: false,
      code: "delivery_city_not_allowed",
      message: `Delivery is currently available only in: ${formatAllowedCities(allowedCities)}.`,
      allowed_cities: allowedCities,
      detected_city: reverseText || `${coordinates.latitude}, ${coordinates.longitude}`
    };
  }

  if (textMentionsAllowedDeliveryCity(directText, allowedCities)) {
    return { ok: true, allowed_cities: allowedCities };
  }

  const unsupportedCity = detectUnsupportedDeliveryCity(directText, allowedCities);

  if (unsupportedCity) {
    return {
      ok: false,
      code: "delivery_city_not_allowed",
      message: `Delivery is currently available only in: ${formatAllowedCities(allowedCities)}.`,
      allowed_cities: allowedCities,
      detected_city: unsupportedCity
    };
  }

  return {
    ok: false,
    code: "delivery_city_not_confirmed",
    message: `Delivery location must be inside: ${formatAllowedCities(allowedCities)}.`,
    allowed_cities: allowedCities
  };
}

function getUnsupportedCityReply(language, allowedCities) {
  const cities = formatAllowedCities(allowedCities);
  const replies = {
    en: `Delivery is not possible in that city yet. Delivery is currently available only in: ${cities}. Please enter an address in one of these cities or contact admin.`,
    de: `Lieferung in diese Stadt ist derzeit noch nicht möglich. Lieferung ist aktuell nur hier verfügbar: ${cities}. Bitte geben Sie eine Adresse in einer dieser Städte ein oder kontaktieren Sie den Admin.`,
    tr: `Bu şehre teslimat şu anda mümkün değil. Teslimat şu anda sadece şu şehirlerde mevcut: ${cities}. Lütfen bu şehirlerden birinde adres girin veya admin ile iletişime geçin.`,
    ar: `التوصيل إلى هذه المدينة غير متاح حالياً. التوصيل متاح حالياً فقط في: ${cities}. يرجى إدخال عنوان في إحدى هذه المدن أو التواصل مع الإدارة.`,
    ru: `Доставка в этот город пока недоступна. Сейчас доставка доступна только в: ${cities}. Введите адрес в одном из этих городов или свяжитесь с админом.`
  };

  return replies[safeLang(language)] || replies.en;
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

async function saveMessage(env, customerId, direction, content, language = null, messageType = "text", platform = "telegram") {
  await env.DB.prepare(
    "INSERT INTO messages (customer_id, direction, platform, content, message_type, language) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(customerId, direction, platform, content, messageType, language).run();
}

async function logCustomerRequest(env, customerId, requestType, requestText = null, quantity = null, itemName = null, locationLabel = null, latitude = null, longitude = null, googleMapsLink = null) {
  const result = await env.DB.prepare(
    `INSERT INTO customer_requests
    (customer_id, request_type, request_text, item_name, quantity, location_label, latitude, longitude, google_maps_link, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
  ).bind(customerId, requestType, requestText, itemName, quantity, locationLabel, latitude, longitude, googleMapsLink).run();

  return result.meta.last_row_id;
}


async function setPreferredCustomerLocation(env, customerId, locationId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);

  await env.DB.prepare(`
    UPDATE customer_locations_v2
    SET is_preferred = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE customer_id = ?
       OR session_token = ?
  `).bind(customerId, sessionToken).run();

  await env.DB.prepare(`
    UPDATE customer_locations_v2
    SET is_preferred = 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND (customer_id = ? OR session_token = ?)
  `).bind(locationId, customerId, sessionToken).run();
}

function getSetPreferredLocationText(language = "en") {
  const replies = {
    en: "Set this as your preferred location?",
    de: "Diesen Standort als bevorzugten Standort speichern?",
    tr: "Bu konumu tercih edilen konumunuz olarak kaydedelim mi?",
    ar: "هل تريد تعيين هذا الموقع كموقعك المفضل؟",
    ru: "Сделать эту локацию предпочтительной?"
  };

  return replies[safeLang(language)] || replies.en;
}

function getPreferredLocationSavedText(language = "en") {
  const replies = {
    en: "Preferred location saved.",
    de: "Bevorzugter Standort gespeichert.",
    tr: "Tercih edilen konum kaydedildi.",
    ar: "تم حفظ الموقع المفضل.",
    ru: "Предпочтительная локация сохранена."
  };

  return replies[safeLang(language)] || replies.en;
}

function getPreferredLocationSkippedText(language = "en") {
  const replies = {
    en: "Location saved without changing your preferred location.",
    de: "Standort gespeichert, ohne den bevorzugten Standort zu ändern.",
    tr: "Konum kaydedildi, tercih edilen konum değiştirilmedi.",
    ar: "تم حفظ الموقع دون تغيير موقعك المفضل.",
    ru: "Локация сохранена без изменения предпочтительной локации."
  };

  return replies[safeLang(language)] || replies.en;
}

function getSetPreferredLocationKeyboard(locationId) {
  return {
    inline_keyboard: [
      [
        { text: "Yes", callback_data: `preferred_location_yes_${locationId}` },
        { text: "No", callback_data: `preferred_location_no_${locationId}` }
      ]
    ]
  };
}



function getAdminGeneralExtraUiText(language = "en") {
  return getAdminUiText(language);
}

function getProductCategoryUiText(language = "en") {
  return getAdminUiText(language);
}

async function getActiveProducts(env) {
  const result = await env.DB.prepare("SELECT id, name, price, is_active FROM products WHERE is_active = 1 ORDER BY id ASC").all();
  return result.results;
}

async function getAllProducts(env) {
  const result = await env.DB.prepare(
    `SELECT
       p.id,
       p.name,
       p.price,
       p.is_active,
       p.category_id,
       pc.name AS category_name
     FROM products p
     LEFT JOIN product_categories pc ON pc.id = p.category_id
     ORDER BY p.id ASC`
  ).all();

  return result.results;
}

async function getAllProductCategories(env) {
  const result = await env.DB.prepare(
    "SELECT id, name, is_active FROM product_categories ORDER BY name ASC"
  ).all();

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

  for (const raw of String(aliasesText || "").split(",")) {
    const alias = raw.trim().toLowerCase();
    const normalized = normalizeText(raw);

    if (alias) aliases.add(alias);
    if (normalized) aliases.add(normalized);
  }

  await env.DB.prepare(
    "DELETE FROM product_aliases WHERE product_id = ?"
  ).bind(productId).run();

  for (const alias of aliases) {
    await env.DB.prepare(
      "INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)"
    ).bind(productId, alias).run();
  }
}

function normalizeProductMatchText(text) {
  return normalizeText(text)
    .replace(/\\b(gullun|gullum|gulluye|gulluyu|gulluden|gullude|gullunun)\\b/g, "gullu")
    .replace(/\\b(davutun|davutu|davuta|davuttan|davutta|davutunun)\\b/g, "davut")
    .replace(/\\b(kavunlunun|kavunluyu|kavunluya|kavunludan|kavunluda)\\b/g, "kavunlu")
    .replace(/\\b(mahmutun|mahmutu|mahmuta|mahmuttan|mahmutta)\\b/g, "mahmut");
}

function stripProductSuffixes(token) {
  const clean = normalizeProductMatchText(token);
  const variants = new Set([clean]);

  const suffixes = [
    "lar", "ler",
    "nin", "nın", "nun", "nün",
    "in", "ın", "un", "ün",
    "yi", "yı", "yu", "yü",
    "i", "ı", "u", "ü",
    "a", "e",
    "dan", "den", "tan", "ten",
    "da", "de", "ta", "te",
    "n"
  ].map(normalizeText);

  for (const suffix of suffixes) {
    if (clean.length > suffix.length + 3 && clean.endsWith(suffix)) {
      variants.add(clean.slice(0, -suffix.length));
    }
  }

  return Array.from(variants).filter(Boolean);
}

function bestProductTokenScore(inputToken, targetToken) {
  let best = partialScore(inputToken, targetToken);

  for (const variant of stripProductSuffixes(inputToken)) {
    best = Math.max(best, partialScore(variant, targetToken));
  }

  return best;
}

async function getMatchingProduct(env, text) {
  const clean = normalizeProductMatchText(text);

  if (isCloseMatch(clean, GREETING_KEYWORDS)) {
    return null;
  }

  const aliasesResult = await env.DB.prepare(
    `SELECT pa.alias, p.id, p.name, p.price, p.is_active
     FROM product_aliases pa
     JOIN products p ON p.id = pa.product_id
     WHERE p.is_active = 1`
  ).all();

  const inputWords = clean.split(/\s+/).filter((word) => word.length >= 3);

  for (const row of aliasesResult.results) {
    const alias = normalizeProductMatchText(row.alias);

    if (clean === alias || clean.includes(alias) || alias.includes(clean)) {
      return row;
    }

    for (const word of inputWords) {
      const aliasWords = alias.split(/\s+/).filter((part) => part.length >= 3);

      for (const aliasWord of aliasWords) {
        if (bestProductTokenScore(word, aliasWord) >= 0.78) {
          return row;
        }
      }
    }
  }

  const products = await getActiveProducts(env);

  for (const product of products) {
    const productName = normalizeProductMatchText(product.name);

    if (clean === productName || clean.includes(productName) || productName.includes(clean)) {
      return product;
    }

    const productWords = productName.split(/\s+/).filter((part) => part.length >= 3);

    for (const word of inputWords) {
      for (const productWord of productWords) {
        if (bestProductTokenScore(word, productWord) >= 0.78) {
          return product;
        }
      }
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


function getCustomerProductUiText(language = "en") {
  const texts = {
    en: {
      available_products: "Available products:",
      show_categories: "Show categories",
      special_request: "Special request",
      cart: "Cart",
      back_to_products: "Back to products",
      uncategorized_products: "Uncategorized products",
      choose_category: "Choose a category:",
      no_products_available: "No active products are available right now.",
      no_products_in_category: "No active products are available in this category.",
      type_special_request: "Please type your special request.",
      special_request_received: "Special request received. Admin will review it."
    },
    de: {
      available_products: "Verfügbare Produkte:",
      show_categories: "Kategorien anzeigen",
      special_request: "Sonderwunsch",
      cart: "Warenkorb",
      back_to_products: "Zurück zu Produkten",
      uncategorized_products: "Nicht kategorisierte Produkte",
      choose_category: "Kategorie auswählen:",
      no_products_available: "Derzeit sind keine aktiven Produkte verfügbar.",
      no_products_in_category: "In dieser Kategorie sind keine aktiven Produkte verfügbar.",
      type_special_request: "Bitte geben Sie Ihren Sonderwunsch ein.",
      special_request_received: "Sonderwunsch erhalten. Der Admin prüft ihn."
    },
    tr: {
      available_products: "Mevcut ürünler:",
      show_categories: "Kategorileri göster",
      special_request: "Özel istek",
      cart: "Sepet",
      back_to_products: "Ürünlere dön",
      uncategorized_products: "Kategorisiz ürünler",
      choose_category: "Bir kategori seçin:",
      no_products_available: "Şu anda aktif ürün yok.",
      no_products_in_category: "Bu kategoride aktif ürün yok.",
      type_special_request: "Lütfen özel isteğinizi yazın.",
      special_request_received: "Özel istek alındı. Admin inceleyecek."
    },
    ar: {
      available_products: "المنتجات المتوفرة:",
      show_categories: "عرض الفئات",
      special_request: "طلب خاص",
      cart: "السلة",
      back_to_products: "العودة إلى المنتجات",
      uncategorized_products: "منتجات بدون فئة",
      choose_category: "اختر فئة:",
      no_products_available: "لا توجد منتجات نشطة حالياً.",
      no_products_in_category: "لا توجد منتجات نشطة في هذه الفئة.",
      type_special_request: "يرجى كتابة طلبك الخاص.",
      special_request_received: "تم استلام الطلب الخاص. ستقوم الإدارة بمراجعته."
    },
    ru: {
      available_products: "Доступные товары:",
      show_categories: "Показать категории",
      special_request: "Особый запрос",
      cart: "Корзина",
      back_to_products: "Назад к товарам",
      uncategorized_products: "Товары без категории",
      choose_category: "Выберите категорию:",
      no_products_available: "Сейчас нет активных товаров.",
      no_products_in_category: "В этой категории нет активных товаров.",
      type_special_request: "Пожалуйста, напишите ваш особый запрос.",
      special_request_received: "Особый запрос получен. Админ его проверит."
    }
  };

  return texts[safeLang(language)] || texts.en;
}

async function getActiveProductCategories(env) {
  const result = await env.DB.prepare(
    `SELECT DISTINCT pc.id, pc.name
     FROM product_categories pc
     JOIN products p ON p.category_id = pc.id
     WHERE pc.is_active = 1 AND p.is_active = 1
     ORDER BY pc.name ASC`
  ).all();

  return result.results;
}

async function getActiveProductsByCategory(env, categoryId) {
  const result = await env.DB.prepare(
    `SELECT id, name, price, is_active, category_id
     FROM products
     WHERE is_active = 1 AND category_id = ?
     ORDER BY name ASC`
  ).bind(categoryId).all();

  return result.results;
}

async function getActiveUncategorizedProducts(env) {
  const result = await env.DB.prepare(
    `SELECT id, name, price, is_active, category_id
     FROM products
     WHERE is_active = 1 AND category_id IS NULL
     ORDER BY name ASC`
  ).all();

  return result.results;
}

const TELEGRAM_PRODUCTS_PER_PAGE = 6;

function clampTelegramPage(page, totalItems, perPage = TELEGRAM_PRODUCTS_PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(Number(totalItems || 0) / perPage));
  const parsedPage = Number(page || 0);

  if (!Number.isFinite(parsedPage) || parsedPage < 0) return 0;
  if (parsedPage >= totalPages) return totalPages - 1;

  return parsedPage;
}

function paginateTelegramItems(items, page = 0, perPage = TELEGRAM_PRODUCTS_PER_PAGE) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePage = clampTelegramPage(page, safeItems.length, perPage);
  const totalPages = Math.max(1, Math.ceil(safeItems.length / perPage));
  const start = safePage * perPage;

  return {
    page: safePage,
    totalPages,
    items: safeItems.slice(start, start + perPage)
  };
}

function getTelegramPaginationRows(page, totalPages, callbackPrefix) {
  if (totalPages <= 1) return [];

  const rows = [];
  const nav = [];

  if (page > 0) {
    nav.push({ text: "◀ Previous", callback_data: `${callbackPrefix}_${page - 1}` });
  }

  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: "noop" });

  if (page < totalPages - 1) {
    nav.push({ text: "Next ▶", callback_data: `${callbackPrefix}_${page + 1}` });
  }

  rows.push(nav);
  return rows;
}

function getProductMenuKeyboard(products, language = "en", page = 0) {
  const ui = getCustomerProductUiText(language);
  const paged = paginateTelegramItems(products, page);
  const rows = [
    [getTelegramMiniAppButton(language)],
    [{ text: ui.show_categories, callback_data: "product_show_categories" }],
    [{ text: ui.special_request, callback_data: "product_special_request" }]
  ];

  for (const product of paged.items) {
    rows.push([{ text: `${product.name}: ${formatPrice(product.price)}`, callback_data: `product_select_${product.id}` }]);
  }

  rows.push(...getTelegramPaginationRows(paged.page, paged.totalPages, "product_page"));
  rows.push([{ text: ui.cart, callback_data: "cart_view" }]);

  return { inline_keyboard: rows };
}

function getProductCategoriesKeyboard(categories, hasUncategorized, language = "en") {
  const ui = getCustomerProductUiText(language);
  const rows = categories.map((category) => [
    { text: category.name, callback_data: `product_category_${category.id}` }
  ]);

  if (hasUncategorized) {
    rows.push([{ text: ui.uncategorized_products, callback_data: "product_category_uncategorized" }]);
  }

  rows.push([{ text: ui.back_to_products, callback_data: "product_back_to_products" }]);
  return { inline_keyboard: rows };
}

function getProductsInCategoryKeyboard(products, language = "en", callbackPrefix = "product_category_page", page = 0) {
  const ui = getCustomerProductUiText(language);
  const paged = paginateTelegramItems(products, page);
  const rows = paged.items.map((product) => [
    { text: `${product.name}: ${formatPrice(product.price)}`, callback_data: `product_select_${product.id}` }
  ]);

  rows.push(...getTelegramPaginationRows(paged.page, paged.totalPages, callbackPrefix));
  rows.push([{ text: ui.back_to_products, callback_data: "product_back_to_products" }]);
  rows.push([{ text: ui.cart, callback_data: "cart_view" }]);

  return { inline_keyboard: rows };
}

async function sendProductMenu(env, chatId, language = "en", page = 0) {
  const ui = getCustomerProductUiText(language);
  const products = await getActiveProducts(env);

  if (!products.length) {
    await sendTelegramMessage(env, chatId, ui.no_products_available);
    return;
  }

  const paged = paginateTelegramItems(products, page);
  await sendTelegramMessage(env, chatId, ui.available_products, getProductMenuKeyboard(products, language, paged.page));
}

async function isProductListRequestText(text) {
  return isCloseMatch(normalizeText(text), PRODUCT_KEYWORDS);
}


function getCartUiText(language = "en") {
  const texts = {
    en: {
      added_to_cart: (name, quantity) => `${name} x ${quantity} is in cart.`,
      need_anything_else: "Do you need anything else or do you want to check out? You can send a product name to continue shopping or choose an option below.",
      continue_shopping: "See products",
      edit_cart: "Edit cart",
      checkout: "Checkout",
      cart_empty: "Your cart is empty.",
      your_cart: "Your cart:",
      remove: "Remove",
      change_amount: "Change amount",
      increase: "+",
      decrease: "-",
      clear_cart: "Clear cart",
      change_quantity: "Change amount",
      enter_new_quantity: "Please enter the new amount.",
      cart_quantity_updated: "Cart amount updated.",
      item_removed: "Item removed from cart.",
      item_updated: "Cart updated.",
      checkout_next_stage: "Checkout delivery selection will be added in the next step."
    },
    de: {
      added_to_cart: (name, quantity) => `${name} x ${quantity} ist im Warenkorb.`,
      need_anything_else: "Brauchen Sie noch etwas oder möchten Sie zur Kasse gehen?",
      continue_shopping: "Produkte anzeigen",
      edit_cart: "Warenkorb ändern",
      checkout: "Zur Kasse",
      cart_empty: "Ihr Warenkorb ist leer.",
      your_cart: "Ihr Warenkorb:",
      remove: "Entfernen",
      change_amount: "Menge ändern",
      increase: "+",
      decrease: "-",
      clear_cart: "Warenkorb leeren",
      change_quantity: "Menge ändern",
      enter_new_quantity: "Bitte geben Sie die neue Menge ein.",
      cart_quantity_updated: "Warenkorbmenge aktualisiert.",
      item_removed: "Artikel aus dem Warenkorb entfernt.",
      item_updated: "Warenkorb aktualisiert.",
      checkout_next_stage: "Die Lieferauswahl für den Checkout wird im nächsten Schritt hinzugefügt."
    },
    tr: {
      added_to_cart: (name, quantity) => `${name} x ${quantity} sepete eklendi.`,
      need_anything_else: "Başka bir şey ister misiniz yoksa ödeme/teslimat aşamasına geçmek ister misiniz? Alışverişe devam etmek için ürün adı yazabilir veya aşağıdan bir seçenek seçebilirsiniz.",
      continue_shopping: "Ürünleri gör",
      edit_cart: "Sepeti düzenle",
      checkout: "Checkout",
      cart_empty: "Sepetiniz boş.",
      your_cart: "Sepetiniz:",
      remove: "Kaldır",
      change_amount: "Miktarı değiştir",
      increase: "+",
      decrease: "-",
      clear_cart: "Sepeti temizle",
      change_quantity: "Adedi değiştir",
      enter_new_quantity: "Lütfen yeni adedi yazın.",
      cart_quantity_updated: "Sepet adedi güncellendi.",
      item_removed: "Ürün sepetten kaldırıldı.",
      item_updated: "Sepet güncellendi.",
      checkout_next_stage: "Checkout teslimat seçimi bir sonraki adımda eklenecek."
    },
    ar: {
      added_to_cart: (name, quantity) => `تمت إضافة ${name} x ${quantity} إلى السلة.`,
      need_anything_else: "هل تحتاج شيئاً آخر أم تريد إتمام الطلب؟",
      continue_shopping: "عرض المنتجات",
      edit_cart: "تعديل السلة",
      checkout: "إتمام الطلب",
      cart_empty: "سلتك فارغة.",
      your_cart: "سلتك:",
      remove: "إزالة",
      change_amount: "تغيير الكمية",
      increase: "+",
      decrease: "-",
      clear_cart: "تفريغ السلة",
      item_removed: "تمت إزالة المنتج من السلة.",
      item_updated: "تم تحديث السلة.",
      checkout_next_stage: "سيتم إضافة اختيار التوصيل في الخطوة التالية."
    },
    ru: {
      added_to_cart: (name, quantity) => `${name} x ${quantity} добавлено в корзину.`,
      need_anything_else: "Нужно что-то ещё или хотите перейти к оформлению?",
      continue_shopping: "Показать товары",
      edit_cart: "Изменить корзину",
      checkout: "Оформить заказ",
      cart_empty: "Ваша корзина пуста.",
      your_cart: "Ваша корзина:",
      remove: "Удалить",
      change_amount: "Изменить количество",
      increase: "+",
      decrease: "-",
      clear_cart: "Очистить корзину",
      change_quantity: "Изменить количество",
      enter_new_quantity: "Пожалуйста, введите новое количество.",
      cart_quantity_updated: "Количество в корзине обновлено.",
      item_removed: "Товар удалён из корзины.",
      item_updated: "Корзина обновлена.",
      checkout_next_stage: "Выбор доставки для оформления будет добавлен на следующем шаге."
    }
  };

  return texts[safeLang(language)] || texts.en;
}

async function getOrCreateTelegramCartSession(env, customerId, customer = null) {
  const sessionToken = getCustomerOrderSessionToken(customerId);
  await ensureV2CartSession(env, sessionToken, customer);
  return {
    id: sessionToken,
    session_token: sessionToken,
    customer_id: customerId,
    status: "active",
    order_status: "in_progress"
  };
}

async function getActiveTelegramCartSession(env, customerId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);
  const items = await getV2CartItems(env, sessionToken);

  if (!items.length) return null;

  return {
    id: sessionToken,
    session_token: sessionToken,
    customer_id: customerId,
    status: "active",
    order_status: "in_progress"
  };
}

async function addProductToTelegramCart(env, customerId, product, quantity = 1, customer = null) {
  quantity = Number(quantity);
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;
  quantity = Math.floor(quantity);

  const sessionToken = getCustomerOrderSessionToken(customerId);
  await ensureV2CartSession(env, sessionToken, customer);

  const productId = Number(product.id || 0);
  const qty = Math.max(1, Number(quantity || 1));

  await env.DB.prepare(`
    INSERT INTO customer_cart_items_v2 (session_token, product_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(session_token, product_id)
    DO UPDATE SET
      quantity = quantity + excluded.quantity,
      updated_at = CURRENT_TIMESTAMP
  `).bind(sessionToken, productId, qty).run();

  return {
    id: sessionToken,
    session_token: sessionToken,
    customer_id: customerId,
    status: "active",
    order_status: "in_progress"
  };
}

async function getTelegramCartItems(env, customerId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);
  const rawItems = await getV2CartItems(env, sessionToken);
  const items = rawItems.map(mapV2CartItemForApi);
  const cart = items.length
    ? {
        id: sessionToken,
        session_token: sessionToken,
        customer_id: customerId,
        status: "active",
        order_status: "in_progress"
      }
    : null;

  return { cart, items };
}

function formatCartText(items, language = "en") {
  const ui = getCartUiText(language);

  if (!items.length) return ui.cart_empty;

  let total = 0;

  const lines = items.map((item, index) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.price_snapshot || 0);
    const lineTotal = unitPrice * quantity;

    if (unitPrice) total += lineTotal;

    const price = unitPrice
      ? ` - ${formatPrice(unitPrice)} x ${quantity} = ${formatPrice(lineTotal)}`
      : "";

    return `${index + 1}. ${item.name} x ${quantity}${price}`;
  });

  const totalTexts = {
    en: "Total",
    de: "Gesamt",
    tr: "Toplam",
    ar: "المجموع",
    ru: "Итого"
  };
  const totalLabel = totalTexts[safeLang(language)] || totalTexts.en;

  return `${ui.your_cart}\n${lines.join("\n")}\n\n${totalLabel}: ${formatPrice(total)}`;
}

function getAfterAddToCartKeyboard(language = "en") {
  const ui = getCartUiText(language);
  return {
    inline_keyboard: [
      [getTelegramMiniAppButton(language)],
      [{ text: ui.continue_shopping, callback_data: "cart_continue" }],
      [{ text: ui.edit_cart, callback_data: "cart_view" }],
      [{ text: ui.checkout, callback_data: "cart_checkout" }]
    ]
  };
}

function getCartKeyboard(items, language = "en") {
  const ui = getCartUiText(language);
  const lang = safeLang(language);
  const actionText = {
    en: "Change/remove",
    de: "Ändern/entfernen",
    tr: "Değiştir/kaldır",
    ar: "تغيير/حذف",
    ru: "Изменить/удалить"
  }[lang] || "Change/remove";

  const rows = [];

  for (const [index, item] of items.entries()) {
    const rowNumber = index + 1;
    rows.push([
      {
        text: `${rowNumber}. ${actionText} ${item.name}`,
        callback_data: `cart_action_${item.id}`
      }
    ]);
  }

  rows.push([getTelegramMiniAppButton(language)]);
  rows.push([
    { text: ui.continue_shopping, callback_data: "cart_continue" },
    { text: ui.checkout, callback_data: "cart_checkout" }
  ]);
  rows.push([{ text: ui.clear_cart, callback_data: "cart_clear" }]);

  return { inline_keyboard: rows };
}

async function sendCartView(env, customer, chatId) {
  const language = customer.preferred_language || customer.language || "en";
  const { items } = await getTelegramCartItems(env, customer.id);
  await sendTelegramMessage(env, chatId, formatCartText(items, language), getCartKeyboard(items, language));
}

async function sendAddedToCart(env, customer, chatId, product, quantity) {
  const language = customer.preferred_language || customer.language || "en";
  const ui = getCartUiText(language);

  const amount = Math.max(1, Math.floor(Number(quantity || 1)));
  const unitPrice = Number(product.price || 0);
  const totalPrice = unitPrice * amount;
  const priceLine = unitPrice ? `${formatPrice(unitPrice)} x ${amount} = ${formatPrice(totalPrice)}` : "";

  const replyText = [
    ui.added_to_cart(product.name, amount),
    priceLine,
    "",
    ui.need_anything_else
  ].filter((line) => line !== "").join("\n");

  await sendTelegramMessage(env, chatId, replyText, getAfterAddToCartKeyboard(language));
}

function getAskProductQuantityText(language = "en", product = "") {
  const productName = typeof product === "string" ? product : product.name;
  const productPrice = typeof product === "string" ? null : product.price;
  const priceText = productPrice !== null && productPrice !== undefined ? ` - ${formatPrice(productPrice)}` : "";
  const displayName = `${productName || "Ürün"}${priceText}`;

  const replies = {
    en: `${displayName}: how many pieces do you want?`,
    de: `${displayName}: wie viele Stück möchten Sie?`,
    tr: `${displayName}: kaç adet istiyorsunuz?`,
    ar: `${displayName}: كم قطعة تريد؟`,
    ru: `${displayName}: сколько штук вы хотите?`
  };

  return replies[safeLang(language)] || replies.en;
}

function getInvalidProductQuantityText(language = "en") {
  const replies = {
    en: "Please send a valid quantity, for example: 1, 2, 3.",
    de: "Bitte senden Sie eine gültige Menge, zum Beispiel: 1, 2, 3.",
    tr: "Lütfen geçerli bir adet gönderin, örnek: 1, 2, 3.",
    ar: "يرجى إرسال كمية صحيحة، مثال: 1، 2، 3.",
    ru: "Пожалуйста, отправьте корректное количество, например: 1, 2, 3."
  };

  return replies[safeLang(language)] || replies.en;
}

async function setPendingProductQuantity(env, customerId, product, incomingText = "") {
  await setSetting(
    env,
    `pending_product_quantity_${customerId}`,
    JSON.stringify({
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      incoming_text: incomingText
    })
  );
}

async function getPendingProductQuantity(env, customerId) {
  const raw = await getSetting(env, `pending_product_quantity_${customerId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function clearPendingProductQuantity(env, customerId) {
  await setSetting(env, `pending_product_quantity_${customerId}`, "");
}

async function handleProductRequestFromText(env, customer, chatId, incomingText, language) {
  const matchedProduct = await getMatchingProduct(env, incomingText);

  if (!matchedProduct) {
    return false;
  }

  const quantity = extractQuantity(incomingText);

  if (!quantity || Number(quantity) < 1) {
    await setPendingProductQuantity(env, customer.id, matchedProduct, incomingText);
    await setCustomerState(env, customer.id, "awaiting_product_quantity");

    const askText = getAskProductQuantityText(language, matchedProduct);
    await saveMessage(env, customer.id, "outgoing", askText, language);
    await sendTelegramMessage(env, chatId, askText);
    return true;
  }

  await addProductToTelegramCart(env, customer.id, matchedProduct, quantity, customer);
  await refreshCartStatusAfterItemChange(env, customer.id);
  await sendAddedToCart(env, customer, chatId, matchedProduct, quantity);
  return true;
}

async function setPendingCartQuantityChange(env, customerId, cartItemId) {
  await setSetting(env, `pending_cart_quantity_item_${customerId}`, String(cartItemId));
}

async function getPendingCartQuantityChange(env, customerId) {
  const value = await getSetting(env, `pending_cart_quantity_item_${customerId}`);
  return Number(value || 0);
}

async function clearPendingCartQuantityChange(env, customerId) {
  await setSetting(env, `pending_cart_quantity_item_${customerId}`, "");
}


async function refreshCartStatusAfterItemChange(env, customerId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);
  await ensureV2CartSession(env, sessionToken);
  return sessionToken;
}

function getCheckoutLocationKeyboard(language = "en", options = {}) {
  const texts = {
    en: {
      pickup: "Pickup",
      preferred_location: "Delivery: use preferred location",
      saved_locations: "Delivery: choose saved location",
      type_address: "Delivery: type/share address",
      see_locations: "Delivery: see our locations",
      contact_admin: "Contact admin to describe location",
      cancel: "Cancel checkout"
    },
    de: {
      pickup: "Abholung",
      preferred_location: "Lieferung: bevorzugten Standort verwenden",
      saved_locations: "Lieferung: gespeicherten Standort wählen",
      type_address: "Lieferung: Adresse eingeben/teilen",
      see_locations: "Lieferung: unsere Standorte anzeigen",
      contact_admin: "Admin kontaktieren und Ort beschreiben",
      cancel: "Checkout abbrechen"
    },
    tr: {
      pickup: "Teslim alma",
      preferred_location: "Teslimat: tercih edilen konumu kullan",
      saved_locations: "Teslimat: kayıtlı konum seç",
      type_address: "Teslimat: adres yaz/paylaş",
      see_locations: "Teslimat: konumlarımızı gör",
      contact_admin: "Konumu tarif etmek için adminle iletişime geç",
      cancel: "Checkout iptal"
    },
    ar: {
      pickup: "استلام",
      preferred_location: "توصيل: استخدم الموقع المفضل",
      saved_locations: "توصيل: اختر موقعاً محفوظاً",
      type_address: "توصيل: اكتب/شارك العنوان",
      see_locations: "توصيل: عرض مواقعنا",
      contact_admin: "تواصل مع المسؤول لوصف الموقع",
      cancel: "إلغاء الدفع"
    },
    ru: {
      pickup: "Самовывоз",
      preferred_location: "Доставка: использовать предпочтительную локацию",
      saved_locations: "Доставка: выбрать сохранённую локацию",
      type_address: "Доставка: ввести/отправить адрес",
      see_locations: "Доставка: показать наши локации",
      contact_admin: "Связаться с админом и описать локацию",
      cancel: "Отменить оформление"
    }
  };

  const ui = texts[safeLang(language)] || texts.en;
  const rows = [
    [{ text: ui.pickup, callback_data: "checkout_pickup" }]
  ];

  if (options.hasPreferredLocation) {
    rows.push([{ text: ui.preferred_location, callback_data: "checkout_preferred_location" }]);
  }

  if (options.hasSavedLocations) {
    rows.push([{ text: ui.saved_locations, callback_data: "checkout_saved_locations" }]);
  }

  rows.push(
    [{ text: ui.type_address, callback_data: "checkout_type_address" }],
    [{ text: ui.see_locations, callback_data: "location_show_meeting_points" }],
    [{ text: ui.contact_admin, callback_data: "location_contact_admin" }],
    [{ text: ui.cancel, callback_data: "location_cancel" }]
  );

  return { inline_keyboard: rows };
}

async function getCartItemForCustomer(env, customerId, itemId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);
  const item = await env.DB.prepare(`
    SELECT
      ci.id,
      ci.session_token,
      ci.product_id,
      ci.quantity,
      ci.created_at,
      ci.updated_at,
      p.name AS product_name,
      p.price AS unit_price,
      COALESCE(p.shop_id, 1) AS shop_id,
      s.name AS shop_name,
      (ci.quantity * p.price) AS line_total
    FROM customer_cart_items_v2 ci
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN shops s ON s.id = COALESCE(p.shop_id, 1)
    WHERE ci.id = ? AND ci.session_token = ?
  `).bind(itemId, sessionToken).first();

  return item ? mapV2CartItemForApi(item) : null;
}

async function handleCartSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const ui = getCartUiText(language);
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;

  if (data === "cart_continue") {
    await sendProductMenu(env, chatId, language);
    return;
  }

  if (data === "cart_view" || data === "cart_back") {
    await clearPendingCartQuantityChange(env, customer.id);
    await setCustomerState(env, customer.id, null);
    await sendCartView(env, customer, chatId);
    return;
  }

  if (data === "cart_checkout") {
    await sendCheckoutPrompt(env, customer, chatId);
    return;
  }

  const { cart } = await getTelegramCartItems(env, customer.id);
  if (!cart) {
    await sendTelegramMessage(env, chatId, ui.cart_empty);
    return;
  }

  if (data === "cart_clear") {
    const sessionToken = getCustomerOrderSessionToken(customer.id);
    await env.DB.prepare("DELETE FROM customer_cart_items_v2 WHERE session_token = ?")
      .bind(sessionToken)
      .run();
    await clearPendingCartQuantityChange(env, customer.id);
    await setCustomerState(env, customer.id, null);
    await sendTelegramMessage(env, chatId, ui.cart_empty);
    return;
  }

  if (data.startsWith("cart_action_")) {
    const itemId = Number(data.replace("cart_action_", ""));
    const item = await getCartItemForCustomer(env, customer.id, itemId);

    if (!item) {
      await sendTelegramMessage(env, chatId, ui.cart_empty);
      return;
    }

    await setPendingCartQuantityChange(env, customer.id, itemId);
    await setCustomerState(env, customer.id, "awaiting_cart_quantity");

    const actionTexts = {
      en: `Type the new amount for ${item.name}, or remove it below.`,
      de: `Geben Sie die neue Menge für ${item.name} ein oder entfernen Sie es unten.`,
      tr: `${item.name} için yeni adedi yazın veya aşağıdan kaldırın.`,
      ar: `اكتب الكمية الجديدة لـ ${item.name} أو احذفها من الأسفل.`,
      ru: `Введите новое количество для ${item.name} или удалите ниже.`
    };
    const removeTexts = {
      en: `Remove ${item.name}`,
      de: `${item.name} entfernen`,
      tr: `${item.name} kaldır`,
      ar: `حذف ${item.name}`,
      ru: `Удалить ${item.name}`
    };
    const backTexts = {
      en: "Back to cart",
      de: "Zurück zum Warenkorb",
      tr: "Sepete dön",
      ar: "العودة إلى السلة",
      ru: "Назад в корзину"
    };
    const lang = safeLang(language);

    await sendTelegramMessage(env, chatId, actionTexts[lang] || actionTexts.en, {
      inline_keyboard: [
        [{ text: removeTexts[lang] || removeTexts.en, callback_data: `cart_remove_${item.id}` }],
        [{ text: backTexts[lang] || backTexts.en, callback_data: "cart_back" }]
      ]
    });
    return;
  }

  if (data.startsWith("cart_remove_")) {
    const itemId = Number(data.replace("cart_remove_", ""));
    const sessionToken = getCustomerOrderSessionToken(customer.id);
    await env.DB.prepare("DELETE FROM customer_cart_items_v2 WHERE id = ? AND session_token = ?")
      .bind(itemId, sessionToken)
      .run();

    await refreshCartStatusAfterItemChange(env, customer.id);
    await clearPendingCartQuantityChange(env, customer.id);
    await setCustomerState(env, customer.id, null);

    await sendTelegramMessage(env, chatId, ui.item_removed);
    await sendCartView(env, customer, chatId);
    return;
  }
}

async function handleProductMenuSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const ui = getCustomerProductUiText(language);
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;

  if (data === "cart_view") {
    await sendCartView(env, customer, chatId);
    return;
  }

  if (data.startsWith("product_page_")) {
    const page = Number(data.replace("product_page_", ""));
    await sendProductMenu(env, chatId, language, page);
    return;
  }

  if (data === "product_back_to_products") {
    await sendProductMenu(env, chatId, language, 0);
    return;
  }

  if (data === "product_show_categories") {
    const categories = await getActiveProductCategories(env);
    const uncategorized = await getActiveUncategorizedProducts(env);

    await sendTelegramMessage(
      env,
      chatId,
      ui.choose_category,
      getProductCategoriesKeyboard(categories, uncategorized.length > 0, language)
    );
    return;
  }

  if (data === "product_category_uncategorized") {
    const products = await getActiveUncategorizedProducts(env);

    if (!products.length) {
      await sendTelegramMessage(env, chatId, ui.no_products_in_category);
      return;
    }

    await sendTelegramMessage(
      env,
      chatId,
      ui.uncategorized_products,
      getProductsInCategoryKeyboard(products, language, "product_category_uncategorized_page", 0)
    );
    return;
  }

  if (data.startsWith("product_category_uncategorized_page_")) {
    const page = Number(data.replace("product_category_uncategorized_page_", ""));
    const products = await getActiveUncategorizedProducts(env);

    if (!products.length) {
      await sendTelegramMessage(env, chatId, ui.no_products_in_category);
      return;
    }

    await sendTelegramMessage(
      env,
      chatId,
      ui.uncategorized_products,
      getProductsInCategoryKeyboard(products, language, "product_category_uncategorized_page", page)
    );
    return;
  }

  if (data.startsWith("product_category_") && data.includes("_page_")) {
    const match = data.match(/^product_category_(\d+)_page_(\d+)$/);
    if (!match) {
      await sendTelegramMessage(env, chatId, ui.no_products_in_category);
      return;
    }

    const categoryId = Number(match[1]);
    const page = Number(match[2]);
    const products = await getActiveProductsByCategory(env, categoryId);

    if (!products.length) {
      await sendTelegramMessage(env, chatId, ui.no_products_in_category);
      return;
    }

    await sendTelegramMessage(
      env,
      chatId,
      ui.available_products,
      getProductsInCategoryKeyboard(products, language, `product_category_${categoryId}_page`, page)
    );
    return;
  }

  if (data.startsWith("product_category_")) {
    const categoryId = Number(data.replace("product_category_", ""));
    const products = await getActiveProductsByCategory(env, categoryId);

    if (!products.length) {
      await sendTelegramMessage(env, chatId, ui.no_products_in_category);
      return;
    }

    await sendTelegramMessage(
      env,
      chatId,
      ui.available_products,
      getProductsInCategoryKeyboard(products, language, `product_category_${categoryId}_page`, 0)
    );
    return;
  }

  if (data === "product_special_request") {
    await setCustomerState(env, customer.id, "awaiting_special_request");
    await sendTelegramMessage(env, chatId, ui.type_special_request);
    return;
  }

  if (data.startsWith("product_select_")) {
    const productId = Number(data.replace("product_select_", ""));
    const product = await env.DB.prepare(
      "SELECT id, name, price, is_active FROM products WHERE id = ? AND is_active = 1"
    ).bind(productId).first();

    if (!product) {
      await sendTelegramMessage(env, chatId, ui.no_products_available);
      return;
    }

    const quantity = 1;
    await addProductToTelegramCart(env, customer.id, product, quantity, customer);
    await sendAddedToCart(env, customer, chatId, product, quantity);
    return;
  }
}

async function formatProductListReply(env, language) {
  const products = await getActiveProducts(env);
  const ui = getCustomerProductUiText(language);

  if (!products.length) {
    return ui.no_products_available;
  }

  const lines = products.map((product) => `- ${product.name}: ${formatPrice(product.price)}`);
  return `${ui.available_products}\n${lines.join("\n")}`;
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

  rows.push([
    {
      text: "Cancel location entry",
      callback_data: "cancel_location_entry"
    }
  ]);

  return { inline_keyboard: rows };
}

function getAddressNotFoundKeyboard(language = "en") {
  return getCheckoutLocationKeyboard(language);
}

function getBackToCheckoutText(language = "en") {
  return {
    en: "Back to checkout",
    de: "Zurück zum Checkout",
    tr: "Checkout'a dön",
    ar: "العودة إلى الدفع",
    ru: "Назад к оформлению"
  }[safeLang(language)] || "Back to checkout";
}

function getApproveLocationText(language = "en") {
  return {
    en: "Approve delivery at this location",
    de: "Lieferung an diesem Standort bestätigen",
    tr: "Bu konumda teslimatı onayla",
    ar: "تأكيد التوصيل في هذا الموقع",
    ru: "Подтвердить доставку в эту локацию"
  }[safeLang(language)] || "Approve delivery at this location";
}

function getLocationDescriptionPrompt(language = "en") {
  return {
    en: "Please type your location description.",
    de: "Bitte beschreiben Sie Ihren Standort.",
    tr: "Lütfen konumunuzu tarif edin.",
    ar: "يرجى كتابة وصف موقعك.",
    ru: "Пожалуйста, опишите вашу локацию."
  }[safeLang(language)] || "Please type your location description.";
}

function getLocationDescriptionReceivedText(language = "en") {
  return {
    en: "Location description received. We will prepare your order for delivery.",
    de: "Standortbeschreibung erhalten. Wir bereiten Ihre Bestellung zur Lieferung vor.",
    tr: "Konum tarifi alındı. Siparişinizi teslimat için hazırlayacağız.",
    ar: "تم استلام وصف الموقع. سنجهز طلبك للتوصيل.",
    ru: "Описание локации получено. Мы подготовим ваш заказ к доставке."
  }[safeLang(language)] || "Location description received. We will prepare your order for delivery.";
}

function getOurLocationApprovalPrompt(point, language = "en") {
  const intro = {
    en: "Please approve delivery at our location:",
    de: "Bitte bestätigen Sie die Lieferung an unserem Standort:",
    tr: "Lütfen konumumuzda teslimatı onaylayın:",
    ar: "يرجى تأكيد التوصيل في موقعنا:",
    ru: "Пожалуйста, подтвердите доставку в нашей локации:"
  }[safeLang(language)] || "Please approve delivery at our location:";

  return [
    intro,
    "",
    point.name,
    point.address,
    point.google_maps_link
  ].filter(Boolean).join("\n");
}

function getOurLocationApprovedText(language = "en") {
  return {
    en: "Location approved. We will prepare your order for delivery at our location.",
    de: "Standort bestätigt. Wir bereiten Ihre Bestellung zur Lieferung an unserem Standort vor.",
    tr: "Konum onaylandı. Siparişinizi konumumuzda teslimat için hazırlayacağız.",
    ar: "تم تأكيد الموقع. سنجهز طلبك للتوصيل في موقعنا.",
    ru: "Локация подтверждена. Мы подготовим ваш заказ к доставке в нашей локации."
  }[safeLang(language)] || "Location approved. We will prepare your order for delivery at our location.";
}

function getMeetingPointApprovalKeyboard(pointId, language = "en") {
  return {
    inline_keyboard: [
      [{ text: getApproveLocationText(language), callback_data: `meeting_point_approve_${pointId}` }],
      [{ text: getBackToCheckoutText(language), callback_data: "location_back_checkout" }]
    ]
  };
}

function getBackToCheckoutKeyboard(language = "en") {
  return {
    inline_keyboard: [
      [{ text: getBackToCheckoutText(language), callback_data: "location_back_checkout" }]
    ]
  };
}

async function getTelegramCustomerLocations(env, customer) {
  const customerId = Number(customer?.id || customer || 0);
  const sessionToken = customerId ? getCustomerOrderSessionToken(customerId) : "";

  return await env.DB.prepare(`
    SELECT *
    FROM customer_locations_v2
    WHERE customer_id = ?
       OR session_token = ?
    ORDER BY is_preferred DESC, datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
    LIMIT 10
  `).bind(customerId, sessionToken).all().then((result) => result.results || []);
}

async function getTelegramCheckoutLocationKeyboard(env, customer, language = "en") {
  const locations = await getTelegramCustomerLocations(env, customer);
  return getCheckoutLocationKeyboard(language, {
    hasPreferredLocation: locations.some((location) => Number(location.is_preferred || 0) === 1),
    hasSavedLocations: locations.length > 0
  });
}

function getChooseSavedCustomerLocationText(language = "en") {
  const replies = {
    en: "Choose one of your saved delivery locations.",
    de: "Wählen Sie einen Ihrer gespeicherten Lieferstandorte.",
    tr: "Kayıtlı teslimat konumlarınızdan birini seçin.",
    ar: "اختر أحد مواقع التوصيل المحفوظة لديك.",
    ru: "Выберите одну из ваших сохранённых локаций доставки."
  };

  return replies[safeLang(language)] || replies.en;
}

function getNoSavedCustomerLocationText(language = "en") {
  const replies = {
    en: "No saved delivery location found. Please type/share a new address.",
    de: "Kein gespeicherter Lieferstandort gefunden. Bitte geben/teilen Sie eine neue Adresse.",
    tr: "Kayıtlı teslimat konumu bulunamadı. Lütfen yeni bir adres yazın/paylaşın.",
    ar: "لم يتم العثور على موقع توصيل محفوظ. يرجى كتابة/مشاركة عنوان جديد.",
    ru: "Сохранённая локация доставки не найдена. Введите/отправьте новый адрес."
  };

  return replies[safeLang(language)] || replies.en;
}

function getSavedCustomerLocationKeyboard(locations = [], language = "en") {
  const rows = locations.map((location) => {
    const prefix = Number(location.is_preferred || 0) === 1 ? "★ " : "";
    const label = String(
      location.label ||
      location.address ||
      location.google_maps_link ||
      `Location #${location.id}`
    ).slice(0, 55);

    return [{
      text: `${prefix}${label}`,
      callback_data: `checkout_saved_location_${location.id}`
    }];
  });

  rows.push([{ text: getBackToCheckoutText(language), callback_data: "location_back_checkout" }]);

  return { inline_keyboard: rows };
}

async function checkoutTelegramWithCustomerLocationV2(env, customer, chatId, location, note = "telegram_bot_saved_location") {
  const language = customer.preferred_language || customer.language || "en";
  const checkout = await submitTelegramV2Checkout(env, customer, "delivery", {
    saved_location_id: location.id,
    delivery_note: note
  });

  if (!checkout.ok) {
    await sendTelegramMessage(env, chatId, checkout.message, getBackToCheckoutKeyboard(language));
    return;
  }

  await setCustomerState(env, customer.id, null);

  const replyText = getTelegramCheckoutSuccessText(checkout.order, "delivery", language);
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, chatId, replyText);
}

async function handleTelegramPreferredLocationCheckout(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const sessionToken = getCustomerOrderSessionToken(customer.id);

  const location = await env.DB.prepare(`
    SELECT *
    FROM customer_locations_v2
    WHERE (customer_id = ? OR session_token = ?)
      AND is_preferred = 1
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
    LIMIT 1
  `).bind(customer.id, sessionToken).first();

  if (!location) {
    await sendTelegramMessage(
      env,
      callbackQuery.message.chat.id,
      getNoSavedCustomerLocationText(language),
      getBackToCheckoutKeyboard(language)
    );
    return;
  }

  await checkoutTelegramWithCustomerLocationV2(
    env,
    customer,
    callbackQuery.message.chat.id,
    location,
    "telegram_bot_preferred_location"
  );
}

async function handleTelegramSavedLocationsCheckout(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const locations = await getTelegramCustomerLocations(env, customer);

  if (!locations.length) {
    await sendTelegramMessage(
      env,
      callbackQuery.message.chat.id,
      getNoSavedCustomerLocationText(language),
      getBackToCheckoutKeyboard(language)
    );
    return;
  }

  await sendTelegramMessage(
    env,
    callbackQuery.message.chat.id,
    getChooseSavedCustomerLocationText(language),
    getSavedCustomerLocationKeyboard(locations, language)
  );
}

async function handleTelegramSavedLocationCheckout(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const sessionToken = getCustomerOrderSessionToken(customer.id);
  const locationId = Number(callbackQuery.data.replace("checkout_saved_location_", ""));

  const location = await env.DB.prepare(`
    SELECT *
    FROM customer_locations_v2
    WHERE id = ?
      AND (customer_id = ? OR session_token = ?)
    LIMIT 1
  `).bind(locationId, customer.id, sessionToken).first();

  if (!location) {
    await sendTelegramMessage(
      env,
      callbackQuery.message.chat.id,
      getNoSavedCustomerLocationText(language),
      getBackToCheckoutKeyboard(language)
    );
    return;
  }

  await checkoutTelegramWithCustomerLocationV2(
    env,
    customer,
    callbackQuery.message.chat.id,
    location,
    "telegram_bot_saved_location"
  );
}

async function sendCheckoutPrompt(env, customer, chatId) {
  const language = customer.preferred_language || customer.language || "en";
  const checkoutTexts = {
    en: "Checkout started. Choose pickup or delivery.",
    de: "Checkout gestartet. Wählen Sie Abholung oder Lieferung.",
    tr: "Checkout başladı. Teslim alma veya teslimat seçin.",
    ar: "بدأ الدفع. اختر الاستلام أو التوصيل.",
    ru: "Оформление начато. Выберите самовывоз или доставку."
  };
  const replyText = checkoutTexts[safeLang(language)] || checkoutTexts.en;

  await setCustomerState(env, customer.id, null);
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, chatId, replyText, await getTelegramCheckoutLocationKeyboard(env, customer, language));
}

function getTelegramCheckoutSuccessText(order, fulfillmentType, language = "en") {
  const code = order?.public_order_code || order?.id || "";
  const suffix = code ? ` #${code}` : "";
  const replies = {
    en: fulfillmentType === "pickup" ? `Pickup order created${suffix}.` : `Delivery order created${suffix}.`,
    de: fulfillmentType === "pickup" ? `Abholbestellung erstellt${suffix}.` : `Lieferbestellung erstellt${suffix}.`,
    tr: fulfillmentType === "pickup" ? `Teslim alma siparişi oluşturuldu${suffix}.` : `Teslimat siparişi oluşturuldu${suffix}.`,
    ar: fulfillmentType === "pickup" ? `تم إنشاء طلب الاستلام${suffix}.` : `تم إنشاء طلب التوصيل${suffix}.`,
    ru: fulfillmentType === "pickup" ? `Заказ на самовывоз создан${suffix}.` : `Заказ на доставку создан${suffix}.`
  };

  return replies[safeLang(language)] || replies.en;
}

async function submitTelegramV2Checkout(env, customer, fulfillmentType, body = {}) {
  const result = await submitV2Checkout(env, { customer }, body, fulfillmentType);

  if (result.error) {
    let message = "Checkout could not be completed.";

    try {
      const payload = await result.error.clone().json();
      const error = payload.error || {};
      message = error.message || payload.message || message;

      if (["delivery_city_not_allowed", "delivery_city_not_confirmed"].includes(error.code)) {
        message = getUnsupportedCityReply(
          customer.preferred_language || customer.language || "en",
          error.details?.allowed_cities || await getAllowedDeliveryCities(env)
        );
      }
    } catch (_) {}

    return { ok: false, message };
  }

  return {
    ok: true,
    order: result.order,
    cart: result.cart,
    online_ordering: result.online_ordering
  };
}

async function handleTelegramPickupCheckout(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";

  const checkout = await submitTelegramV2Checkout(env, customer, "pickup", {
    notes: "telegram_bot_pickup"
  });

  if (!checkout.ok) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, checkout.message);
    return;
  }

  await setCustomerState(env, customer.id, null);

  const replyText = getTelegramCheckoutSuccessText(checkout.order, "pickup", language);
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText);
}

async function handleTelegramTypeAddressCheckout(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const replies = {
    en: "Please type your delivery address or share a map location.",
    de: "Bitte geben Sie Ihre Lieferadresse ein oder teilen Sie einen Kartenstandort.",
    tr: "Lütfen teslimat adresinizi yazın veya harita konumu paylaşın.",
    ar: "يرجى كتابة عنوان التوصيل أو مشاركة موقع على الخريطة.",
    ru: "Введите адрес доставки или отправьте геолокацию на карте."
  };
  const replyText = replies[safeLang(language)] || replies.en;

  await setCustomerState(env, customer.id, "awaiting_typed_address");
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText, getBackToCheckoutKeyboard(language));
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

function normalizeAddressSearchQuery(text) {
  return String(text || "")
    .replace(/straße/gi, "strasse")
    .replace(/str\./gi, "strasse")
    .replace(/\bstraßw\b/gi, "strasse")
    .replace(/\bstrasw\b/gi, "strasse")
    .replace(/\bstrabe\b/gi, "strasse")
    .replace(/\bstrase\b/gi, "strasse")
    .replace(/\bstrasse\b/gi, "strasse")
    .replace(/\bstr\b/gi, "strasse")
    .replace(/\s+/g, " ")
    .trim();
}

function getAddressSearchQueries(query) {
  const original = String(query || "").trim();
  const corrected = normalizeAddressSearchQuery(original);

  if (!original) return [];

  if (normalizeText(original) === normalizeText(corrected)) {
    return [original];
  }

  return [original, corrected];
}

function extractPostalCode(text) {
  const match = String(text || "").match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

function addressResultScore(query, item) {
  const cleanQuery = normalizeText(query);
  const displayName = normalizeText(item.address || "");
  const name = normalizeText(item.name || "");
  let score = 0;

  for (const word of cleanQuery.split(/\s+/).filter((part) => part.length >= 3)) {
    if (displayName.includes(word)) score += 2;
    if (name.includes(word)) score += 3;
  }

  if (item.postal_code && cleanQuery.includes(item.postal_code)) score += 20;

  return score;
}

async function searchLocations(env, query) {
  const allowedCities = await getAllowedDeliveryCities(env);
  const postalCode = extractPostalCode(query);
  const collected = [];
  const seen = new Set();

  const searchQueries = getAddressSearchQueries(query);

  for (const searchQuery of searchQueries) {
    for (const city of allowedCities) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", `${searchQuery}, ${city}`);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "10");
      url.searchParams.set("addressdetails", "1");

      const response = await fetch(url.toString(), {
        headers: { "user-agent": "CRMProjectDealer/1.0" }
      });

      if (!response.ok) continue;

      const data = await response.json();
      const cityNorm = normalizeText(city);

      for (const item of data) {
        const displayName = item.display_name || "";
        const displayNorm = normalizeText(displayName);
        const address = item.address || {};
        const itemPostalCode = String(address.postcode || "").trim();

        if (!displayNorm.includes(cityNorm)) continue;

        if (postalCode && itemPostalCode !== postalCode && !displayName.includes(postalCode)) {
          continue;
        }

        const key = `${item.lat}|${item.lon}|${displayName}`;
        if (seen.has(key)) continue;
        seen.add(key);

        collected.push({
          name: item.name || displayName,
          address: displayName,
          postal_code: itemPostalCode,
          latitude: item.lat,
          longitude: item.lon,
          google_maps_link: `https://www.google.com/maps?q=${item.lat},${item.lon}`
        });
      }
    }

    if (collected.length) break;
  }

  return collected
    .sort((a, b) => addressResultScore(normalizeAddressSearchQuery(query), b) - addressResultScore(normalizeAddressSearchQuery(query), a))
    .slice(0, 7);
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

async function getCustomerRequest(env, requestId) {
  return env.DB.prepare(
    "SELECT * FROM customer_requests WHERE id = ?"
  ).bind(requestId).first();
}

async function getPreferredCustomerLocation(env, customerId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);

  return env.DB.prepare(`
    SELECT *
    FROM customer_locations_v2
    WHERE (customer_id = ? OR session_token = ?)
      AND is_preferred = 1
    ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
    LIMIT 1
  `).bind(customerId, sessionToken).first();
}

async function updateRequestLocation(env, requestId, locationLabel, latitude = null, longitude = null, googleMapsLink = null) {
  await env.DB.prepare(
    `UPDATE customer_requests
     SET location_label = ?, latitude = ?, longitude = ?, google_maps_link = ?
     WHERE id = ?`
  ).bind(locationLabel, latitude, longitude, googleMapsLink, requestId).run();
}

async function getFulfillmentSettings(env) {
  return {
    allowPreferred: (await getSetting(env, "allow_preferred_customer_location") || "on") === "on",
    allowNew: (await getSetting(env, "allow_new_customer_location") || "on") === "on",
    allowPickup: (await getSetting(env, "allow_customer_pickup") || "on") === "on"
  };
}

function getProductFulfillmentPrompt(language = "en", productName = "") {
  const replies = {
    en: `How would you like to receive ${productName || "the product"}?`,
    de: `Wie möchten Sie ${productName || "das Produkt"} erhalten?`,
    tr: `${productName || "Ürünü"} nasıl teslim almak istersiniz?`,
    ar: `كيف تريد استلام ${productName || "المنتج"}؟`,
    ru: `Как вы хотите получить ${productName || "товар"}?`
  };

  return replies[safeLang(language)] || replies.en;
}

function getProductFulfillmentUnavailableText(language = "en") {
  const replies = {
    en: "No delivery option is currently available. Admin will contact you.",
    de: "Derzeit ist keine Lieferoption verfügbar. Der Admin wird Sie kontaktieren.",
    tr: "Şu anda teslimat seçeneği mevcut değil. Admin sizinle iletişime geçecek.",
    ar: "لا يوجد خيار توصيل متاح حالياً. ستتواصل الإدارة معك.",
    ru: "Сейчас нет доступного варианта доставки. Админ свяжется с вами."
  };

  return replies[safeLang(language)] || replies.en;
}

function getProductFulfillmentKeyboard(requestId, options) {
  const rows = [];

  if (options.allowPreferred && options.hasPreferredLocation) {
    rows.push([{ text: "Use preferred location", callback_data: `product_fulfillment_preferred_${requestId}` }]);
  }

  if (options.allowNew) {
    rows.push([{ text: "Enter new location", callback_data: `product_fulfillment_new_${requestId}` }]);
  }

  if (options.allowPickup) {
    rows.push([{ text: "Collect from our location", callback_data: `product_fulfillment_pickup_${requestId}` }]);
  }

  rows.push([{ text: "Contact admin", callback_data: "option_admin" }]);

  return { inline_keyboard: rows };
}

async function forwardProductRequestWithFulfillment(env, customer, request, fulfillmentLabel, googleMapsLink = null) {
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return;

  const text = [
    "Product request:",
    "",
    `Customer: ${customer.full_name || ""}`,
    `Telegram ID: ${customer.telegram_user_id}`,
    `Product: ${request.item_name || ""}`,
    `Quantity: ${request.quantity || "Not specified"}`,
    `Fulfillment: ${fulfillmentLabel || "Not selected"}`,
    googleMapsLink ? `Map: ${googleMapsLink}` : "",
    `Message: ${request.request_text || ""}`
  ].filter(Boolean).join("\n");

  const keyboard = googleMapsLink
    ? getDeliveryAdminKeyboard(request.id, customer.id, googleMapsLink)
    : getAdminReplyKeyboard(customer.id);

  await sendTelegramMessage(env, adminChatId, text, keyboard);
}

async function sendProductFulfillmentChoiceOrFallback(env, customer, chatId, requestId, product, quantity, incomingText, productReply) {
  const language = customer.preferred_language || customer.language || "en";
  const settings = await getFulfillmentSettings(env);
  const preferredLocation = await getPreferredCustomerLocation(env, customer.id);

  const options = {
    allowPreferred: settings.allowPreferred,
    allowNew: settings.allowNew,
    allowPickup: settings.allowPickup,
    hasPreferredLocation: Boolean(preferredLocation)
  };

  const hasAnyOption =
    (options.allowPreferred && options.hasPreferredLocation)
    || options.allowNew
    || options.allowPickup;

  if (!hasAnyOption) {
    await forwardProductRequest(env, customer, incomingText, product.name, quantity);
    await sendTelegramMessage(
      env,
      chatId,
      `${productReply}\n\n${getProductFulfillmentUnavailableText(language)}`
    );
    return true;
  }

  await sendTelegramMessage(
    env,
    chatId,
    `${productReply}\n\n${getProductFulfillmentPrompt(language, product.name)}`,
    getProductFulfillmentKeyboard(requestId, options)
  );

  return true;
}

async function handleProductFulfillmentSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const data = callbackQuery.data;

  const requestId = Number(
    data
      .replace("product_fulfillment_preferred_", "")
      .replace("product_fulfillment_new_", "")
      .replace("product_fulfillment_pickup_", "")
  );

  const request = await getCustomerRequest(env, requestId);

  if (!request || Number(request.customer_id) !== Number(customer.id)) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Product request was not found.");
    return;
  }

  if (data.startsWith("product_fulfillment_preferred_")) {
    const preferredLocation = await getPreferredCustomerLocation(env, customer.id);

    if (!preferredLocation) {
      await sendTelegramMessage(env, callbackQuery.message.chat.id, "No preferred location saved yet. Please enter a new location.");
      await setSetting(env, `pending_product_fulfillment_request_${customer.id}`, String(requestId));
      await setCustomerState(env, customer.id, "awaiting_typed_address");
      await sendTelegramMessage(env, callbackQuery.message.chat.id, t("type_address", language));
      return;
    }

    const locationLabel = preferredLocation.description || "Preferred customer location";
    await updateRequestLocation(
      env,
      requestId,
      locationLabel,
      preferredLocation.latitude,
      preferredLocation.longitude,
      preferredLocation.google_maps_link
    );

    const updatedRequest = await getCustomerRequest(env, requestId);
    await forwardProductRequestWithFulfillment(
      env,
      customer,
      updatedRequest,
      `Preferred customer location: ${locationLabel}`,
      preferredLocation.google_maps_link
    );

    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Order sent with your preferred location.");
    return;
  }

  if (data.startsWith("product_fulfillment_new_")) {
    await setSetting(env, `pending_product_fulfillment_request_${customer.id}`, String(requestId));
    await setCustomerState(env, customer.id, "awaiting_typed_address");
    await sendTelegramMessage(env, callbackQuery.message.chat.id, t("type_address", language));
    return;
  }

  if (data.startsWith("product_fulfillment_pickup_")) {
    await updateRequestLocation(env, requestId, "Customer pickup from business location", null, null, null);

    const updatedRequest = await getCustomerRequest(env, requestId);
    await forwardProductRequestWithFulfillment(
      env,
      customer,
      updatedRequest,
      "Customer will collect from our location",
      null
    );

    await sendMeetingPointChoiceOrDirect(
      env,
      customer,
      callbackQuery.message.chat.id,
      "Customer selected pickup for product request"
    );
  }
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

  const language = customer.preferred_language || customer.language || "en";
  const { items } = await getTelegramCartItems(env, customer.id);
  const cartText = items.length ? formatCartText(items, language) : "Cart: empty";

  const text = [
    "Customer delivery location:",
    "",
    `Customer: ${customer.full_name || ""}`,
    `Telegram ID: ${customer.telegram_user_id}`,
    "",
    cartText,
    "",
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

async function createAdminToken(env, username, role = "admin") {
  const now = Math.floor(Date.now() / 1000);
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);

  const payload = {
    sub: username,
    role,
    scope: "admin",
    iat: now,
    jti: base64UrlEncode(randomBytes),
    exp: now + 43200
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSign(env.ADMIN_JWT_SECRET, body);
  return `${body}.${sig}`;
}

async function hashAdminToken(env, token) {
  return sha256Hex(`${env.ADMIN_JWT_SECRET || "fallback-secret"}:admin:${token}`);
}

async function isAdminTokenRevoked(env, token) {
  const tokenHash = await hashAdminToken(env, token);
  const row = await env.DB.prepare(
    "SELECT id FROM admin_token_revocations WHERE token_hash = ? LIMIT 1"
  ).bind(tokenHash).first();

  return !!row;
}

async function revokeAdminToken(env, token, username = "", expiresAt = null) {
  const tokenHash = await hashAdminToken(env, token);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO admin_token_revocations
     (token_hash, username, expires_at)
     VALUES (?, ?, ?)`
  ).bind(tokenHash, username || null, expiresAt).run();
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

  const username = String(payload.sub || "");
  if (!username) return false;

  if (await isAdminTokenRevoked(env, token)) return false;

  if (env.SUPERADMIN_USERNAME && username === env.SUPERADMIN_USERNAME) {
    payload.role = "superadmin";
    payload.is_superadmin = true;
    return payload;
  }

  if (username === env.ADMIN_USERNAME) {
    payload.role = "admin";
    payload.is_superadmin = false;
    return payload;
  }

  const dbAdmin = await env.DB.prepare(
    "SELECT username, role, is_active FROM admin_users WHERE username = ?"
  ).bind(username).first();

  if (!dbAdmin || Number(dbAdmin.is_active) !== 1) return false;

  payload.role = dbAdmin.role || "admin";
  payload.is_superadmin = dbAdmin.role === "superadmin";
  return payload;
}

async function getCurrentAdminPassword(env) {
  return await getSetting(env, "admin_password_override") || env.ADMIN_PASSWORD;
}

async function getCurrentSuperadminPassword(env) {
  return await getSetting(env, "superadmin_password_override") || env.SUPERADMIN_PASSWORD;
}

async function hashAdminPassword(env, password) {
  const secret = env.ADMIN_JWT_SECRET || "fallback-secret";
  const input = `${secret}:${password}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateAdmin(env, username, password) {
  if (username === env.ADMIN_USERNAME && password === await getCurrentAdminPassword(env)) {
    return { username, role: "admin", is_superadmin: false, source: "env" };
  }

  if (env.SUPERADMIN_USERNAME && env.SUPERADMIN_PASSWORD && username === env.SUPERADMIN_USERNAME && password === await getCurrentSuperadminPassword(env)) {
    return { username, role: "superadmin", is_superadmin: true, source: "env_superadmin" };
  }

  const dbAdmin = await env.DB.prepare(
    "SELECT * FROM admin_users WHERE username = ? AND is_active = 1"
  ).bind(username).first();

  if (dbAdmin && dbAdmin.password_hash === await hashAdminPassword(env, password)) {
    await env.DB.prepare(
      "UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(dbAdmin.id).run();

    return {
      username: dbAdmin.username,
      role: dbAdmin.role || "admin",
      is_superadmin: dbAdmin.role === "superadmin",
      source: "db"
    };
  }

  return null;
}

async function getAdminSession(request, env) {
  const token = parseCookies(request)[ADMIN_COOKIE_NAME];
  const payload = await verifyAdminToken(env, token);
  if (!payload) return null;

  return {
    username: payload.sub,
    role: payload.role || "admin",
    is_superadmin: payload.is_superadmin === true
  };
}

async function requireAdmin(request, env) {
  return Boolean(await getAdminSession(request, env));
}

async function cleanupOldAdminAuditLogs(env) {
  await env.DB.prepare(
    "DELETE FROM admin_audit_logs WHERE created_at < datetime('now', '-30 days')"
  ).run();
}

async function logAdminAction(env, request, session, actionType, actionDetail = "") {
  const url = new URL(request.url);

  const ip = request.headers.get("cf-connecting-ip") || "";
  const userAgent = request.headers.get("user-agent") || "";

  await env.DB.prepare(
    `
    INSERT INTO admin_audit_logs (
      admin_username,
      admin_role,
      action_type,
      action_detail,
      path,
      method,
      ip,
      user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).bind(
    session?.username || "",
    session?.role || "",
    actionType,
    actionDetail,
    url.pathname,
    request.method,
    ip,
    userAgent
  ).run();
}

async function getAdminUsersForSuperadmin(env) {
  const rows = await env.DB.prepare(
    `SELECT
       admin_users.id,
       admin_users.username,
       admin_users.username_normalized,
       admin_users.role,
       admin_users.is_active,
       admin_users.is_protected,
       admin_users.auth_account_id,
       admin_users.created_at,
       admin_users.last_login_at,
       auth_email_addresses.display_email AS email
     FROM admin_users
     LEFT JOIN auth_email_addresses
       ON auth_email_addresses.auth_account_id = admin_users.auth_account_id
      AND auth_email_addresses.realm = 'staff'
      AND auth_email_addresses.is_primary = 1
      AND auth_email_addresses.status = 'verified'
     ORDER BY admin_users.username`
  ).all();

  const databaseAdmins = (rows.results || []).map((row) => {
    const normalizedUsername = String(
      row.username_normalized || row.username || ""
    ).trim().toLowerCase();
    const reconciledEnvironmentAccount = (
      normalizedUsername === String(env.SUPERADMIN_USERNAME || "").trim().toLowerCase()
      || normalizedUsername === String(env.ADMIN_USERNAME || "").trim().toLowerCase()
    );

    return {
      ...row,
      source: reconciledEnvironmentAccount ? "db/env" : "db",
      protected: Number(row.is_protected) === 1
    };
  });
  const databaseUsernames = new Set(databaseAdmins.map((admin) => (
    String(admin.username_normalized || admin.username || "").trim().toLowerCase()
  )));
  const environmentAdmins = [];

  if (
    env.SUPERADMIN_USERNAME
    && !databaseUsernames.has(String(env.SUPERADMIN_USERNAME).trim().toLowerCase())
  ) {
    environmentAdmins.push({
      id: "env-superadmin",
      username: env.SUPERADMIN_USERNAME,
      role: "superadmin",
      is_active: 1,
      created_at: "env",
      last_login_at: "",
      source: "env",
      protected: true
    });
  }

  if (
    env.ADMIN_USERNAME
    && !databaseUsernames.has(String(env.ADMIN_USERNAME).trim().toLowerCase())
  ) {
    environmentAdmins.push({
      id: "env-admin",
      username: env.ADMIN_USERNAME,
      role: "admin",
      is_active: 1,
      created_at: "env",
      last_login_at: "",
      source: "env",
      protected: true
    });
  }

  return [...environmentAdmins, ...databaseAdmins].sort((left, right) => (
    String(left.username).localeCompare(String(right.username))
  ));
}

async function getAdminAuditLogs(env) {
  await cleanupOldAdminAuditLogs(env);

  const rows = await env.DB.prepare(
    `
    SELECT *
    FROM admin_audit_logs
    WHERE created_at >= datetime('now', '-30 days')
    ORDER BY created_at DESC
    LIMIT 500
    `
  ).all();

  return rows.results || [];
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

  const auth = await authenticateAdmin(env, username, password);

  if (!auth) {
    await logAdminAction(env, request, { username, role: "" }, "admin_login_failed", username);
    return handleLoginPage("Invalid username or password.");
  }

  await cleanupOldAdminAuditLogs(env);
  await logAdminAction(env, request, auth, "admin_login_success", auth.source || "");

  const token = await createAdminToken(env, auth.username, auth.role);
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


async function getLearnedPatternsForAdmin(env) {
  const result = await env.DB.prepare(
    `
    SELECT lp.*, p.name AS product_name
    FROM learned_patterns lp
    LEFT JOIN products p ON p.id = lp.product_id
    ORDER BY
      CASE lp.status
        WHEN 'pending' THEN 0
        WHEN 'approved' THEN 1
        ELSE 2
      END,
      lp.created_at DESC
    LIMIT 100
    `
  ).all();

  return result.results;
}

async function handleApproveLearnedPattern(env, patternId) {
  await env.DB.prepare(
    `
    UPDATE learned_patterns
    SET status = 'approved',
        approved_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `
  ).bind(patternId).run();

  const pattern = await env.DB.prepare(
    "SELECT * FROM learned_patterns WHERE id = ?"
  ).bind(patternId).first();

  if (pattern && pattern.intent === "product_specific" && pattern.product_id) {
    await env.DB.prepare(
      "INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)"
    ).bind(pattern.product_id, pattern.normalized_pattern).run();
  }

  return redirectResponse("/admin");
}

async function handleRejectLearnedPattern(env, patternId) {
  await env.DB.prepare(
    "UPDATE learned_patterns SET status = 'rejected' WHERE id = ?"
  ).bind(patternId).run();

  return redirectResponse("/admin");
}

async function handleDeleteLearnedPattern(env, patternId) {
  await env.DB.prepare(
    "DELETE FROM learned_patterns WHERE id = ?"
  ).bind(patternId).run();

  return redirectResponse("/admin");
}

async function getAiUsageStats(env) {
  const lastHour = await env.DB.prepare(
    `
    SELECT COUNT(*) AS count
    FROM messages
    WHERE message_type = 'ai_reply'
      AND created_at >= datetime('now', '-1 hour')
    `
  ).first();

  const last24Hours = await env.DB.prepare(
    `
    SELECT COUNT(*) AS count
    FROM messages
    WHERE message_type = 'ai_reply'
      AND created_at >= datetime('now', '-24 hours')
    `
  ).first();

  const lastWeek = await env.DB.prepare(
    `
    SELECT COUNT(*) AS count
    FROM messages
    WHERE message_type = 'ai_reply'
      AND created_at >= datetime('now', '-7 days')
    `
  ).first();

  const lastMonth = await env.DB.prepare(
    `
    SELECT COUNT(*) AS count
    FROM messages
    WHERE message_type = 'ai_reply'
      AND created_at >= datetime('now', '-30 days')
    `
  ).first();

  const total = await env.DB.prepare(
    `
    SELECT COUNT(*) AS count
    FROM messages
    WHERE message_type = 'ai_reply'
    `
  ).first();

  return {
    lastHour: lastHour.count || 0,
    last24Hours: last24Hours.count || 0,
    lastWeek: lastWeek.count || 0,
    lastMonth: lastMonth.count || 0,
    total: total.count || 0
  };
}

async function getAdminData(env) {
  const [customers, products, productCategories, meetingPoints, aliasMap] = await Promise.all([
    env.DB.prepare("SELECT * FROM customers ORDER BY last_seen_at DESC").all(),
    getAllProducts(env),
    getAllProductCategories(env),
    getAllMeetingPoints(env),
    getProductAliasMap(env)
  ]);

  return {
    customers: customers.results,
    products,
    productCategories,
    meetingPoints,
    learnedPatterns: await getLearnedPatternsForAdmin(env),
    aiUsageStats: await getAiUsageStats(env),
    productAliasMap: aliasMap,
    settings: {
      admin_telegram_chat_id: await getSetting(env, "admin_telegram_chat_id") || "",
      working_hours_enabled: await getSetting(env, "working_hours_enabled") || "off",
      working_hours_timezone: await getSetting(env, "working_hours_timezone") || "Europe/Berlin",
      working_hours_start: await getSetting(env, "working_hours_start") || "10:00",
      working_hours_end: await getSetting(env, "working_hours_end") || "22:00",
      working_hours_closed_message: await getSetting(env, "working_hours_closed_message") || "",
      working_hours_message_mode: await getSetting(env, "working_hours_message_mode") || "custom",
      admin_view_language: await getSetting(env, "admin_view_language") || "en",
      allow_preferred_customer_location: await getSetting(env, "allow_preferred_customer_location") || "on",
      allow_new_customer_location: await getSetting(env, "allow_new_customer_location") || "on",
      allow_customer_pickup: await getSetting(env, "allow_customer_pickup") || "on",
      allowed_delivery_cities: await getAllowedDeliveryCities(env),
      ai_response_mode: await getSetting(env, "ai_response_mode") || "rule_base",
      ai_custom_instructions: await getSetting(env, "ai_custom_instructions") || ""
    }
  };
}

function renderAdminDashboard(data, section = "dashboard") {
  const ui = getAdminUiText(data.settings.admin_view_language);
  const superadminNav = data.session?.is_superadmin ? `<a href="/admin/superadmin"><button type="button">${ui.superadmin}</button></a>` : "";
  const adminText = ADMIN_TEXTS[data.settings.admin_view_language] || ADMIN_TEXTS.en;

  const productCategoryOptions = (selectedId = "") => [
    `<option value="">${escapeHtml(ui.no_category)}</option>`,
    ...(data.productCategories || []).map((category) =>
      `<option value="${category.id}" ${String(selectedId || "") === String(category.id) ? "selected" : ""}>${escapeHtml(category.name)}${category.is_active ? "" : " (inactive)"}</option>`
    )
  ].join("");

  const productRows = data.products.map((product) => `
    <tr
      data-product-id="${product.id}"
      data-product-name="${escapeHtml(product.name)}"
      data-product-aliases="${escapeHtml((data.productAliasMap[product.id] || []).join(" "))}"
      data-product-price="${escapeHtml(product.price)}"
      data-product-active="${product.is_active ? "active" : "inactive"}"
      data-product-category="${escapeHtml(product.category_id || "")}"
    >
      <form action="/admin/products/${product.id}/update" method="post">
        <td>${product.id}</td>
        <td><input type="text" name="name" value="${escapeHtml(product.name)}" required></td>
        <td><input type="number" step="0.01" name="price" value="${escapeHtml(product.price)}" required></td>
        <td>
          <select name="category_id">
            ${productCategoryOptions(product.category_id)}
          </select>
        </td>
        <td><textarea name="aliases" rows="2" cols="40">${escapeHtml((data.productAliasMap[product.id] || []).join(", "))}</textarea></td>
        <td><input type="checkbox" name="is_active" ${product.is_active ? "checked" : ""}></td>
        <td><button type="submit">${ui.save}</button>
      </form>
      <form action="/admin/products/${product.id}/delete" method="post" style="display:inline;">
        <button type="submit">${ui.delete}</button>
      </form></td>
    </tr>
  `).join("");

  const productCategoryRows = (data.productCategories || []).map((category) => `
    <tr
      data-category-id="${category.id}"
      data-category-name="${escapeHtml(category.name)}"
      data-category-active="${category.is_active ? "active" : "inactive"}"
    >
      <form action="/admin/product-categories/${category.id}/update" method="post">
        <td>${category.id}</td>
        <td><input type="text" name="name" value="${escapeHtml(category.name)}" required></td>
        <td><input type="checkbox" name="is_active" ${category.is_active ? "checked" : ""}></td>
        <td><button type="submit">${ui.save}</button>
      </form>
      <form action="/admin/product-categories/${category.id}/delete" method="post" style="display:inline;">
        <button type="submit">${ui.delete}</button>
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
          <br><a href="${escapeHtml(point.google_maps_link)}" target="_blank">${ui.open_map}</a>
        </td>
        <td>${Number(point.is_default) === 1 ? ui.true_value : ui.false_value}</td>
        <td><input type="checkbox" name="is_active" ${point.is_active ? "checked" : ""}></td>
        <td><button type="submit">${ui.save}</button>
      </form>
      ${point.is_active ? `
        <form action="/admin/meeting-points/${point.id}/default" method="post" style="display:inline;">
          <input type="hidden" name="is_default" value="${Number(point.is_default) === 1 ? "0" : "1"}">
          <button type="submit">${Number(point.is_default) === 1 ? ui.unset_preferred : ui.set_preferred}</button>
        </form>
      ` : ""}
      <form action="/admin/meeting-points/${point.id}/delete" method="post" style="display:inline;">
        <button type="submit">${ui.delete}</button>
      </form></td>
    </tr>
  `).join("");

  const learnedPatternRows = data.learnedPatterns.map((pattern) => `
    <tr>
      <td>${pattern.id}</td>
      <td>${escapeHtml(pattern.pattern_text)}</td>
      <td>${escapeHtml(i18nIntent(pattern.intent, ui._language))}</td>
      <td>${escapeHtml(pattern.product_name || "")}</td>
      <td>${escapeHtml(pattern.response_text || "")}</td>
      <td>${escapeHtml(i18nStatus(pattern.status, ui._language))}</td>
      <td>${escapeHtml(pattern.hit_count)}</td>
      <td>
        ${pattern.status === "pending" ? `
        <form action="/admin/learned-patterns/${pattern.id}/approve" method="post" style="display:inline;">
          <button type="submit">${ui.approve}</button>
        </form>
        <form action="/admin/learned-patterns/${pattern.id}/reject" method="post" style="display:inline;">
          <button type="submit">${ui.reject}</button>
        </form>
        ` : ""}
        <form action="/admin/learned-patterns/${pattern.id}/delete" method="post" style="display:inline;">
          <button type="submit">${ui.delete}</button>
        </form>
      </td>
    </tr>
  `).join("");

  const customerRows = data.customers.map((customer) => `
    <tr>
      <td>${customer.id}</td>
      <td>${escapeHtml(customer.full_name)}</td>
      <td>${escapeHtml(customer.username)}</td>
      <td>${escapeHtml(customer.language)}</td>
      <td>${escapeHtml(customer.last_seen_at)}</td>
      <td>
        <a href="/admin/customers/${customer.id}">
          <button type="button">${ui.open_customer || "Open Customer"}</button>
        </a>
        <button
          type="button"
          onclick="openCustomerMessageModal('${customer.id}', '${escapeHtml(customer.full_name || customer.username || customer.telegram_user_id || "")}')"
        >
          ${ui.message_customer || "Message Customer"}
        </button>
        <form action="/admin/customers/${customer.id}/delete" method="post" style="display:inline;" onsubmit="return confirm('Delete customer?');">
          <button type="submit" class="danger-button">${ui.delete || "Delete"}</button>
        </form>
      </td>
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
  <h1>${ui.title}</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">${ui.logout}</button></form>
    <a href="/admin/change-password"><button type="button">${ui.change_password}</button></a>
  </div>
</div>
<hr><hr>
<div class="page-actions">
  <a href="/admin"><button type="button">${ui.general}</button></a>
  <a href="/admin/openrequests/"><button type="button">${ui.open_requests}</button></a>
  <a href="/admin/orders"><button type="button">${ui.orders}</button></a>
  <a href="/admin/closedorders"><button type="button">${ui.closed_orders}</button></a>
  <a href="/admin/products"><button type="button">${ui.products}</button></a>
  <a href="/admin/meeting-points"><button type="button">${ui.meeting_points}</button></a>
  <a href="/admin/ai"><button type="button">${ui.ai_info}</button></a>
  <a href="/admin/customers"><button type="button">${ui.customers}</button></a>
  ${superadminNav}
</div>
<hr><hr>

${section === "dashboard" ? `
<h2>${ui.admin_language}</h2>
<form action="/admin/settings/admin-language" method="post">
  <label>${ui.view_language}</label><br>
  <select name="admin_view_language">
    <option value="en" ${selected(data.settings.admin_view_language, "en")}>English</option>
    <option value="de" ${selected(data.settings.admin_view_language, "de")}>Deutsch</option>
    <option value="tr" ${selected(data.settings.admin_view_language, "tr")}>Türkçe</option>
    <option value="ar" ${selected(data.settings.admin_view_language, "ar")}>العربية</option>
    <option value="ru" ${selected(data.settings.admin_view_language, "ru")}>Русский</option>
  </select>
  <button type="submit">${ui.save_language}</button>
</form>
<hr>

<h2>${ui.notification_settings}</h2>
<form action="/admin/settings/admin-telegram" method="post">
  <label>${ui.admin_telegram_chat_id}</label><br>
  <input type="text" name="admin_telegram_chat_id" value="${escapeHtml(data.settings.admin_telegram_chat_id)}" size="30" required>
  <button type="submit">${ui.save_notification_receiver}</button>
</form>
<hr>

<h2>${ui.working_hours}</h2>
<form action="/admin/settings/working-hours" method="post">
  <label><input type="checkbox" name="working_hours_enabled" value="on" ${checked(data.settings.working_hours_enabled === "on")}>${ui.enable_working_hours}</label>
  <br><br>
  <label>${ui.timezone}</label><br>
  <select name="working_hours_timezone" required>
    ${getAdminTimezoneOptions(data.settings.working_hours_timezone, ui._language)}
  </select>
  <br><br>
  <label>${ui.start_time}</label><br>
  <input type="time" name="working_hours_start" value="${escapeHtml(data.settings.working_hours_start)}" required>
  <br><br>
  <label>${ui.end_time}</label><br>
  <input type="time" name="working_hours_end" value="${escapeHtml(data.settings.working_hours_end)}" required>
  <br><br>
  <label>${ui.closed_hours_message_mode}</label><br>
  <label><input type="radio" name="working_hours_message_mode" value="auto" ${checked(data.settings.working_hours_message_mode === "auto")}>${ui.auto_message}</label>
  <br>
  <label><input type="radio" name="working_hours_message_mode" value="custom" ${checked(data.settings.working_hours_message_mode !== "auto")}>${ui.custom_message}</label>
  <br><br>
  <label>${ui.custom_closed_message}</label><br>
  <textarea name="working_hours_closed_message" rows="3" cols="80">${escapeHtml(data.settings.working_hours_closed_message)}</textarea>
  <p>${ui.working_hours_help}</p>
  <br><br>
  <button type="submit">${ui.save_working_hours}</button>
</form>
<hr>


<h2>${ui.fulfillment_options}</h2>
<form action="/admin/settings/fulfillment-options" method="post">
  <p class="admin-info-text">${escapeHtml(ui.fulfillment_options_help)}</p>

  <label>
    <input
      type="checkbox"
      name="allow_preferred_customer_location"
      value="on"
      ${checked(data.settings.allow_preferred_customer_location === "on")}
    >
    ${ui.allow_preferred_customer_location}
  </label>
  <br>

  <label>
    <input
      type="checkbox"
      name="allow_new_customer_location"
      value="on"
      ${checked(data.settings.allow_new_customer_location === "on")}
    >
    ${ui.allow_new_customer_location}
  </label>
  <br>

  <label>
    <input
      type="checkbox"
      name="allow_customer_pickup"
      value="on"
      ${checked(data.settings.allow_customer_pickup === "on")}
    >
    ${ui.allow_customer_pickup}
  </label>
  <br><br>

  <button type="submit">${ui.save_fulfillment_options}</button>
</form>

<hr>

<h2>${ui.delivery_cities}</h2>
<form action="/admin/settings/delivery-cities" method="post">
  <p class="admin-info-text">${ui.delivery_cities_help}</p>

  <label>${ui.allowed_cities}</label><br>
  <textarea name="allowed_delivery_cities" rows="3" cols="80">${escapeHtml((data.settings.allowed_delivery_cities || ["Berlin"]).join(", "))}</textarea>
  <p>${ui.allowed_cities_example}</p>

  <button type="submit">${ui.save_delivery_cities}</button>
</form>


<h2>${ui.bot_response_mode}</h2>
<form action="/admin/settings/ai-response-mode" method="post">
  <label>
    <input
      type="radio"
      name="ai_response_mode"
      value="rule_base"
      ${checked(data.settings.ai_response_mode !== "ai_fallback")}
    >
    ${ui.rule_base_mode}
  </label>
  <br>

  <label>
    <input
      type="radio"
      name="ai_response_mode"
      value="ai_fallback"
      ${checked(data.settings.ai_response_mode === "ai_fallback")}
    >
    ${ui.ai_fallback_mode}
  </label>

  <p class="admin-info-text">
    ${ui.ai_response_mode_help}
  </p>

  <label for="ai-custom-instructions">${ui.ai_project_instructions}</label>
  <br>
  <textarea
    id="ai-custom-instructions"
    name="ai_custom_instructions"
    rows="5"
    cols="80"
    placeholder="${ui.ai_project_placeholder}"
  >${escapeHtml(data.settings.ai_custom_instructions || "")}</textarea>

  <p class="admin-info-text">
    ${ui.ai_project_context_help}
  </p>

  <button type="submit">${ui.save_ai_response_mode}</button>
</form>

<hr>


` : ""}
${section === "products" ? `
<h2>${ui.products}</h2>

<style>
.products-top-layout-force {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(320px, 420px);
  gap: 16px;
  align-items: start;
  width: 100%;
  margin: 12px 0 18px;
}

.products-panel-force {
  background: #ffffff;
  border: 1px solid #d7dee8;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 14px 42px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.products-field-force {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.products-field-force label {
  font-weight: 600;
  white-space: nowrap;
}

.products-field-force input,
.products-field-force select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .products-top-layout-force {
    grid-template-columns: 1fr;
  }

  .products-field-force {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .products-field-force label {
    white-space: normal;
  }
}

.products-link-grid-force {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 12px;
}

.products-list-header-force {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 12px 0 18px;
}

@media (max-width: 640px) {
  .products-link-grid-force {
    grid-template-columns: 1fr;
  }

  .products-list-header-force {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<div class="products-top-layout-force">
  <section class="products-panel-force">
    <h3>${ui.add_product}</h3>

    <form action="/admin/products" method="post">
      <div class="products-field-force">
        <label for="new-product-name">${ui.product_name}</label>
        <input type="text" id="new-product-name" name="name" required>
      </div>

      <div class="products-field-force">
        <label for="new-product-price">${ui.price}</label>
        <input type="number" step="0.01" id="new-product-price" name="price" required>
      </div>

      <div class="products-field-force">
        <label for="new-product-category">${ui.category}</label>
        <select id="new-product-category" name="category_id">
          ${productCategoryOptions("")}
        </select>
      </div>

      <button type="submit">${ui.create_product}</button>
    </form>
  </section>

  <section class="products-panel-force">
    <h3>${ui.add_category}</h3>

    <form action="/admin/product-categories" method="post">
      <div class="products-field-force">
        <label for="new-category-name">${ui.category_name}</label>
        <input type="text" id="new-category-name" name="name" required>
      </div>

      <button type="submit">${ui.create_category}</button>
    </form>
  </section>
</div>

<div class="products-panel-force">
  <div class="products-link-grid-force">
    <a href="/admin/products/list"><button type="button">${ui.list_products}</button></a>
    <a href="/admin/product-categories/list"><button type="button">${ui.list_categories}</button></a>
  </div>
</div>

<hr>
` : ""}
${section === "product_list" ? `
<h2>${ui.product_list}</h2>

<style>
.products-top-layout-force {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(320px, 420px);
  gap: 16px;
  align-items: start;
  width: 100%;
  margin: 12px 0 18px;
}

.products-panel-force {
  background: #ffffff;
  border: 1px solid #d7dee8;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 14px 42px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.products-field-force {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.products-field-force label {
  font-weight: 600;
  white-space: nowrap;
}

.products-field-force input,
.products-field-force select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.products-list-header-force {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 12px 0 18px;
}

@media (max-width: 900px) {
  .products-top-layout-force {
    grid-template-columns: 1fr;
  }

  .products-field-force {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .products-field-force label {
    white-space: normal;
  }
}

@media (max-width: 640px) {
  .products-list-header-force {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<div class="products-list-header-force">
  <div></div>
  <a href="/admin/products"><button type="button">${ui.back_to_products}</button></a>
</div>

<section class="products-panel-force">
  <h3>${ui.search_filters}</h3>

  <div class="products-field-force">
    <label for="product-search-id">${ui.id_filter}</label>
    <input type="text" id="product-search-id" oninput="filterProductsTable()">
  </div>

  <div class="products-field-force">
    <label for="product-search-text">${ui.search_product}</label>
    <input type="text" id="product-search-text" oninput="filterProductsTable()">
  </div>

  <div class="products-field-force">
    <label for="product-price-min">${ui.price_min}</label>
    <input type="number" step="0.01" id="product-price-min" oninput="filterProductsTable()">
  </div>

  <div class="products-field-force">
    <label for="product-price-max">${ui.price_max}</label>
    <input type="number" step="0.01" id="product-price-max" oninput="filterProductsTable()">
  </div>

  <div class="products-field-force">
    <label for="product-search-active">${ui.active_status}</label>
    <select id="product-search-active" onchange="filterProductsTable()">
      <option value="">${ui.all_statuses}</option>
      <option value="active">${ui.active_only}</option>
      <option value="inactive">${ui.inactive_only}</option>
    </select>
  </div>

  <div class="products-field-force">
    <label for="product-search-category">${ui.category}</label>
    <select id="product-search-category" onchange="filterProductsTable()">
      <option value="">${ui.all_categories}</option>
      <option value="__none__">${ui.uncategorized}</option>
      ${(data.productCategories || []).map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("")}
    </select>
  </div>

  <p>${ui.fuzzy_cutoff_note}</p>
  <button type="button" onclick="clearProductsFilter()">${ui.clear_filters}</button>
</section>

<table id="products-table" border="1" cellpadding="10">
  <tr><th>${ui.id}</th><th>${ui.name}</th><th>${ui.price}</th><th>${ui.category}</th><th>${ui.aliases}</th><th>${ui.active}</th><th>${ui.action}</th></tr>
  ${productRows}
</table>

<hr>
` : ""}
${section === "product_categories" ? `
<h2>${ui.category_list}</h2>

<style>
.products-panel-force {
  background: #ffffff;
  border: 1px solid #d7dee8;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 14px 42px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.products-field-force {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.products-field-force label {
  font-weight: 600;
  white-space: nowrap;
}

.products-field-force input,
.products-field-force select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.products-list-header-force {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 12px 0 18px;
}

@media (max-width: 900px) {
  .products-field-force {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .products-field-force label {
    white-space: normal;
  }
}

@media (max-width: 640px) {
  .products-list-header-force {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<div class="products-list-header-force">
  <div></div>
  <a href="/admin/products"><button type="button">${ui.back_to_products}</button></a>
</div>

<section class="products-panel-force">
  <h3>${ui.search_filters}</h3>

  <div class="products-field-force">
    <label for="category-search-id">${ui.id_filter}</label>
    <input type="text" id="category-search-id" oninput="filterCategoryTable()">
  </div>

  <div class="products-field-force">
    <label for="category-search-text">${ui.search_category}</label>
    <input type="text" id="category-search-text" oninput="filterCategoryTable()">
  </div>

  <div class="products-field-force">
    <label for="category-search-active">${ui.active_status}</label>
    <select id="category-search-active" onchange="filterCategoryTable()">
      <option value="">${ui.all_statuses}</option>
      <option value="active">${ui.active_only}</option>
      <option value="inactive">${ui.inactive_only}</option>
    </select>
  </div>

  <button type="button" onclick="clearCategoryFilter()">${ui.clear_filters}</button>
</section>

<section class="products-panel-force">
  <table id="product-categories-table" border="1" cellpadding="10">
    <tr><th>${ui.id}</th><th>${ui.name}</th><th>${ui.active}</th><th>${ui.action}</th></tr>
    ${productCategoryRows}
  </table>
</section>

<hr>
` : ""}



${section === "meeting_points" ? `
<h2>${ui.meeting_points}</h2>
<table border="1" cellpadding="10">
  <tr><th>${ui.id}</th><th>${ui.name}</th><th>${ui.address}</th><th>${ui.google_maps}</th><th>${ui.preferred}</th><th>${ui.active}</th><th>${ui.action}</th></tr>
  ${pointRows}
</table>
<p class="admin-info-text">${escapeHtml(adminText.meeting_point_help)}</p>

<h3>${ui.add_meeting_point}</h3>
<input type="text" id="location-search" placeholder="${ui.search_location}" size="50">
<button onclick="searchLocation()">${ui.search}</button>
<div id="search-results"></div>
<br><br>
<form action="/admin/meeting-points" method="post">
  <label>${ui.name}</label><br>
  <input type="text" id="name" name="name" required>
  <br><br>
  <label>${ui.address}</label><br>
  <input type="text" id="address" name="address" size="80" required>
  <br><br>
  <label>${ui.google_maps_link}</label><br>
  <input type="text" id="google_maps_link" name="google_maps_link" size="80" required>
  <br><br>
  <label><input type="checkbox" name="is_default">${ui.set_as_preferred}</label>
  <br><br>
  <button type="submit">${ui.create_meeting_point}</button>
</form>
<hr>


` : ""}

${section === "ai" ? `
<h2>${ui.ai_counter}</h2>

<table border="1" cellpadding="10">
  <tr>
    <th>${ui.last_hour}</th>
    <th>${ui.last_24_hours}</th>
    <th>${ui.last_week}</th>
    <th>${ui.last_month}</th>
    <th>${ui.total}</th>
  </tr>
  <tr>
    <td>${data.aiUsageStats.lastHour}</td>
    <td>${data.aiUsageStats.last24Hours}</td>
    <td>${data.aiUsageStats.lastWeek}</td>
    <td>${data.aiUsageStats.lastMonth}</td>
    <td>${data.aiUsageStats.total}</td>
  </tr>
</table>

<hr>

<h2>${ui.ai_patterns}</h2>

<table border="1" cellpadding="10">
  <tr>
    <th>${ui.id}</th>
    <th>${ui.pattern}</th>
    <th>${ui.intent}</th>
    <th>${ui.product}</th>
    <th>${ui.response}</th>
    <th>${ui.status}</th>
    <th>${ui.hits}</th>
    <th>${ui.action}</th>
  </tr>
  ${learnedPatternRows}
</table>

<hr>


` : ""}

${section === "customers" ? `
<h2>${ui.customers}</h2>

<style>
.customers-filter-layout-force {
  display: grid;
  grid-template-columns: minmax(520px, 760px);
  gap: 16px;
  align-items: start;
  width: 100%;
  margin: 12px 0 18px;
}

.customers-panel-force {
  background: #ffffff;
  border: 1px solid #d7dee8;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 14px 42px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.customers-field-force {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.customers-field-force label {
  font-weight: 600;
  white-space: nowrap;
}

.customers-field-force input,
.customers-field-force select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .customers-filter-layout-force {
    grid-template-columns: 1fr;
  }

  .customers-field-force {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .customers-field-force label {
    white-space: normal;
  }
}
</style>

<div class="customers-filter-layout-force">
  <section class="customers-panel-force">
    <h3>${ui.search_filters}</h3>

    <div class="customers-field-force">
      <label for="customer-search-id">${ui.id_filter}</label>
      <input type="text" id="customer-search-id" oninput="filterCustomersTable()">
    </div>

    <div class="customers-field-force">
      <label for="customer-search-text">${ui.search_name_username}</label>
      <input type="text" id="customer-search-text" oninput="filterCustomersTable()">
    </div>

    <div class="customers-field-force">
      <label for="customer-search-language">${ui.language_filter}</label>
      <select id="customer-search-language" onchange="filterCustomersTable()">
        <option value="">${ui.all_languages}</option>
        <option value="en">English</option>
        <option value="de">Deutsch</option>
        <option value="tr">Türkçe</option>
        <option value="ar">العربية</option>
        <option value="ru">Русский</option>
        <option value="unknown">unknown</option>
      </select>
    </div>

    <div class="customers-field-force">
      <label for="customer-search-last-seen-from">${ui.last_seen_from}</label>
      <input type="datetime-local" id="customer-search-last-seen-from" onchange="filterCustomersTable()">
    </div>

    <div class="customers-field-force">
      <label for="customer-search-last-seen-to">${ui.last_seen_to}</label>
      <input type="datetime-local" id="customer-search-last-seen-to" onchange="filterCustomersTable()">
    </div>

    <p>${ui.fuzzy_cutoff_note}</p>
    <button type="button" onclick="clearCustomersFilter()">${ui.clear_filters}</button>
  </section>
</div>

<table id="customers-table" border="1" cellpadding="10">
  <tr><th>${ui.id}</th><th>${ui.full_name}</th><th>${ui.username}</th><th>${ui.language}</th><th>${ui.last_seen}</th><th>${ui.action}</th></tr>
  ${customerRows}
</table>

<div
  id="customer-message-modal"
  style="display:none; position:fixed; z-index:99999; inset:0; background:rgba(15,23,42,0.55); padding:24px; box-sizing:border-box; align-items:center; justify-content:center;"
>
  <div
    style="width:min(640px,100%); max-height:calc(100vh - 48px); overflow:auto; background:#fff; border-radius:16px; padding:24px; box-shadow:0 24px 80px rgba(15,23,42,0.35);"
  >
    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px;">
      <h3 style="margin:0;">${ui.message_customer || "Message Customer"}</h3>
      <button type="button" onclick="closeCustomerMessageModal()" style="font-size:24px; line-height:1;">×</button>
    </div>

    <p id="customer-message-modal-name"></p>

    <form id="customer-message-form" method="post">
      <textarea name="reply_text" rows="6" required style="width:100%; box-sizing:border-box;"></textarea>
      <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
        <button type="submit">${ui.send || "Send"}</button>
        <button type="button" onclick="closeCustomerMessageModal()">${ui.cancel || "Cancel"}</button>
      </div>
    </form>
  </div>
</div>

<hr>
` : ""}

<script>

window.addEventListener("click", (event) => {
  const modal = document.getElementById("customer-message-modal");

  if (modal && event.target === modal) {
    closeCustomerMessageModal();
  }
});



function openCustomerMessageModal(customerId, customerName) {
  const modal = document.getElementById("customer-message-modal");
  const form = document.getElementById("customer-message-form");
  const name = document.getElementById("customer-message-modal-name");

  if (!modal || !form || !name) return;

  form.action = "/admin/customers/" + customerId + "/reply";
  name.textContent = customerName || "";
  modal.style.display = "flex";

  const textarea = form.querySelector("textarea");
  if (textarea) textarea.focus();
}

function closeCustomerMessageModal() {
  const modal = document.getElementById("customer-message-modal");
  const form = document.getElementById("customer-message-form");

  if (modal) modal.style.display = "none";
  if (form) form.reset();
}

window.addEventListener("click", (event) => {
  const modal = document.getElementById("customer-message-modal");

  if (modal && event.target === modal) {
    closeCustomerMessageModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCustomerMessageModal();
  }
});


function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function levenshteinDistance(a, b) {
  a = normalizeSearchText(a);
  b = normalizeSearchText(b);

  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function fuzzyScore(query, value) {
  query = normalizeSearchText(query);
  value = normalizeSearchText(value);

  if (!query) return 100;
  if (!value) return 0;
  if (value.includes(query)) return 100;

  const parts = value.split(/[\s,;:/|]+/).filter(Boolean);
  let bestScore = 0;

  for (const part of parts) {
    const distance = levenshteinDistance(query, part);
    const maxLength = Math.max(query.length, part.length);
    const score = Math.round((1 - distance / maxLength) * 100);

    if (score > bestScore) bestScore = score;
  }

  const wholeDistance = levenshteinDistance(query, value);
  const wholeMaxLength = Math.max(query.length, value.length);
  const wholeScore = Math.round((1 - wholeDistance / wholeMaxLength) * 100);

  return Math.max(bestScore, wholeScore);
}

function rowCellText(row, index) {
  const cell = row.cells[index];

  if (!cell) return "";

  const input = cell.querySelector("input, textarea, select");

  if (input) {
    if (input.type === "checkbox") {
      return input.checked ? "active" : "inactive";
    }

    return input.value || input.textContent || "";
  }

  return cell.textContent || "";
}

function parseTableDate(value) {
  value = String(value || "").trim();

  if (!value) return null;

  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function parseProductPrice(value) {
  const cleaned = String(value || "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!cleaned) return null;

  const parsed = Number(cleaned);

  return Number.isNaN(parsed) ? null : parsed;
}

function filterProductsTable() {
  const idFilter = normalizeSearchText(document.getElementById("product-search-id")?.value || "");
  const textFilter = normalizeSearchText(document.getElementById("product-search-text")?.value || "");
  const activeFilter = document.getElementById("product-search-active")?.value || "";
  const categoryFilter = document.getElementById("product-search-category")?.value || "";
  const minPrice = Number(document.getElementById("product-price-min")?.value || "");
  const maxPrice = Number(document.getElementById("product-price-max")?.value || "");

  document.querySelectorAll("#products-table tr[data-product-id]").forEach((row) => {
    const id = normalizeSearchText(row.dataset.productId || "");
    const name = normalizeSearchText(row.dataset.productName || "");
    const aliases = normalizeSearchText(row.dataset.productAliases || "");
    const active = row.dataset.productActive || "";
    const category = row.dataset.productCategory || "";
    const price = Number(row.dataset.productPrice || 0);

    const idMatches = !idFilter || id.includes(idFilter);
    const textMatches =
      !textFilter
      || name.includes(textFilter)
      || aliases.includes(textFilter)
      || fuzzyIncludes(name, textFilter)
      || fuzzyIncludes(aliases, textFilter);

    const activeMatches = !activeFilter || active === activeFilter;
    const categoryMatches =
      !categoryFilter
      || (categoryFilter === "__none__" && !category)
      || category === categoryFilter;

    const minMatches = !minPrice || price >= minPrice;
    const maxMatches = !maxPrice || price <= maxPrice;

    row.style.display = idMatches && textMatches && activeMatches && categoryMatches && minMatches && maxMatches
      ? ""
      : "none";
  });
}

function clearProductsFilter() {
  const fields = [
    "product-search-id",
    "product-search-text",
    "product-price-min",
    "product-price-max",
    "product-search-active",
    "product-search-category"
  ];

  for (const id of fields) {
    const field = document.getElementById(id);
    if (field) field.value = "";
  }

  filterProductsTable();
}

function filterCategoryTable() {
  const idFilter = normalizeSearchText(document.getElementById("category-search-id")?.value || "");
  const textFilter = normalizeSearchText(document.getElementById("category-search-text")?.value || "");
  const activeFilter = document.getElementById("category-search-active")?.value || "";

  document.querySelectorAll("#product-categories-table tr[data-category-id]").forEach((row) => {
    const id = normalizeSearchText(row.dataset.categoryId || "");
    const name = normalizeSearchText(row.dataset.categoryName || "");
    const active = row.dataset.categoryActive || "";

    const idMatches = !idFilter || id.includes(idFilter);
    const textMatches =
      !textFilter
      || name.includes(textFilter)
      || fuzzyIncludes(name, textFilter);
    const activeMatches = !activeFilter || active === activeFilter;

    row.style.display = idMatches && textMatches && activeMatches ? "" : "none";
  });
}

function clearCategoryFilter() {
  const fields = [
    "category-search-id",
    "category-search-text",
    "category-search-active"
  ];

  for (const id of fields) {
    const field = document.getElementById(id);
    if (field) field.value = "";
  }

  filterCategoryTable();
}

function filterCustomersTable() {
  const table = document.getElementById("customers-table");

  if (!table) return;

  const idQuery = normalizeSearchText(document.getElementById("customer-search-id")?.value);
  const textQuery = document.getElementById("customer-search-text")?.value || "";
  const languageQuery = normalizeSearchText(document.getElementById("customer-search-language")?.value);
  const fromDate = parseTableDate(document.getElementById("customer-search-last-seen-from")?.value);
  const toDate = parseTableDate(document.getElementById("customer-search-last-seen-to")?.value);
  const cutoff = 80;

  Array.from(table.tBodies[0]?.rows || table.rows).forEach((row, index) => {
    if (index === 0 && row.querySelector("th")) return;

    const id = normalizeSearchText(rowCellText(row, 0));
    const fullName = rowCellText(row, 1);
    const username = rowCellText(row, 2);
    const language = normalizeSearchText(rowCellText(row, 3));
    const lastSeenValue = rowCellText(row, 4);
    const lastSeenDate = parseTableDate(lastSeenValue);

    const idMatches = !idQuery || id === idQuery;
    const languageMatches = !languageQuery || language === languageQuery;
    const fuzzyMatches = !textQuery || Math.max(
      fuzzyScore(textQuery, fullName),
      fuzzyScore(textQuery, username)
    ) >= cutoff;

    const fromMatches = !fromDate || (lastSeenDate && lastSeenDate >= fromDate);
    const toMatches = !toDate || (lastSeenDate && lastSeenDate <= toDate);

    row.style.display = (
      idMatches
      && languageMatches
      && fuzzyMatches
      && fromMatches
      && toMatches
    ) ? "" : "none";
  });
}

function clearCustomersFilter() {
  const ids = [
    "customer-search-id",
    "customer-search-text",
    "customer-search-language",
    "customer-search-last-seen-from",
    "customer-search-last-seen-to"
  ];

  ids.forEach((id) => {
    const element = document.getElementById(id);

    if (element) element.value = "";
  });

  filterCustomersTable();
}


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



function getOrderStatusLabel(status) {
  return {
    submitted: "Submitted",
    scheduled_for_next_online_order: "Scheduled",
    in_progress: "In progress",
    waiting_location: "Waiting location",
    ready_to_delivery: "Ready for delivery",
    on_the_way: "On the way",
    ready_to_pickup: "Ready to pick up",
    picked_up: "Picked up",
    cancelled: "Cancelled",
    not_delivered: "Not delivered",
    delivered: "Delivered",
    closed: "Closed"
  }[status] || status;
}

function getOrderStatusOptions(selectedStatus) {
  const statuses = [
    "submitted",
    "scheduled_for_next_online_order",
    "on_the_way",
    "ready_to_pickup",
    "not_delivered",
    "delivered",
    "cancelled"
  ];

  return statuses.map((status) =>
    `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${getOrderStatusLabel(status)}</option>`
  ).join("");
}

function formatOrderItemsText(itemsText) {
  if (!itemsText) return "";
  try {
    const items = JSON.parse(itemsText);
    return items.map((item) => {
      const quantity = Number(item.quantity || 1);
      const price = Number(item.price_snapshot || 0);
      const total = price * quantity;
      return `${escapeHtml(item.name || "")} x ${quantity}${price ? ` (${formatPrice(price)} x ${quantity} = ${formatPrice(total)})` : ""}`;
    }).join("<br>");
  } catch (error) {
    return "";
  }
}

async function getOrdersContext(env, closed = false) {
  const closedWhere = closed
    ? "COALESCE(o.order_status, o.status, '') IN ('delivered', 'closed', 'cancelled')"
    : "COALESCE(o.order_status, o.status, '') NOT IN ('delivered', 'closed', 'cancelled')";

  const rows = await env.DB.prepare(`
    SELECT
      o.id,
      o.public_order_code,
      CAST(REPLACE(o.session_token, 'app_customer_', '') AS INTEGER) AS customer_id,
      o.status,
      o.order_status,
      o.fulfillment_type,
      o.delivery_status,
      o.pickup_status,
      o.delivery_location_label,
      o.delivery_address,
      o.delivery_google_maps_link,
      o.notes AS delivery_note,
      o.currency,
      o.customer_name AS order_customer_name,
      o.phone AS order_customer_phone,
      NULL AS delivered_at,
      CASE
        WHEN COALESCE(o.order_status, o.status, '') IN ('delivered', 'closed', 'cancelled')
        THEN o.updated_at
        ELSE NULL
      END AS closed_at,
      o.admin_status_note,
      o.created_at,
      o.updated_at,
      (
        SELECT successor.id
        FROM customer_orders_v2 successor
        WHERE successor.recreated_from_order_id = o.id
          AND COALESCE(
            successor.order_status,
            successor.status,
            ''
          ) NOT IN ('cancelled', 'closed', 'delivered')
        ORDER BY
          datetime(successor.updated_at) DESC,
          successor.id DESC
        LIMIT 1
      ) AS active_recreated_order_id,
      (
        SELECT COUNT(*)
        FROM customer_orders_v2 successor
        WHERE successor.recreated_from_order_id = o.id
      ) AS recreated_order_count,
      COALESCE(
        NULLIF(customers.full_name, ''),
        NULLIF(o.customer_name, ''),
        ''
      ) AS full_name,
      customers.username,
      customers.telegram_user_id,
      customers.preferred_language,
      COUNT(i.id) AS item_count,
      COALESCE(
        NULLIF(o.total_amount, 0),
        SUM(
          CASE
            WHEN COALESCE(
              i.status_before_cancel,
              i.item_status,
              'confirmed'
            ) IN (
              'confirmed',
              'approved',
              'waiting_ready_to_pickup',
              'scheduled_for_next_online_order'
            )
            THEN COALESCE(i.line_total, 0)
            ELSE 0
          END
        ),
        0
      ) AS total_amount,
      json_group_array(
        json_object(
          'id', i.id,
          'name', i.product_name,
          'quantity', i.quantity,
          'price_snapshot', i.unit_price
        )
      ) AS items_json
    FROM customer_orders_v2 o
    LEFT JOIN customers
      ON o.session_token = ('app_customer_' || customers.id)
    LEFT JOIN customer_order_items_v2 i
      ON i.customer_order_id = o.id
    WHERE ${closedWhere}
    GROUP BY o.id
    HAVING item_count > 0
    ORDER BY datetime(o.updated_at) DESC, o.id DESC
  `).all();

  return rows.results || [];
}

function getAdminOrderUiText(language = "en") {
  return getAdminUiText(language);
}


function getAdminLanguageDisplayLabel(value, ui = getAdminOrderUiText("en")) {
  const lang = safeLang(String(value || ""));
  return ui[`language_${lang}`] || value || "";
}

function getAdminNoteDisplayText(note, ui = getAdminOrderUiText("en")) {
  const cleaned = String(note || "")
    .replace(/legacy admin route/g, "admin web")
    .replace(/legacy_admin_route/g, "admin_web")
    .replace(/admin route/g, "admin web");

  const knownNotes = {
    "Marked delivered from admin web": ui.note_marked_delivered_admin_web,
    "Marked on the way from admin web": ui.note_marked_on_the_way_admin_web,
    "Marked ready to pick up from admin web": ui.note_marked_ready_pickup_admin_web,
    "Marked not delivered from admin web": ui.note_marked_not_delivered_admin_web,
    "Cancelled from admin web": ui.note_cancelled_admin_web,
    "Updated from admin web": ui.note_updated_admin_web
  };

  return knownNotes[cleaned] || cleaned;
}

function getAdminOrderValueLabel(prefix, value, ui = getAdminOrderUiText("en")) {
  const normalized = String(value || "").replace(/-/g, "_");
  const key = `${prefix}_${normalized}`;
  return ui[key] || value || "";
}

function getAdminOrderStatusLabel(status, ui = getAdminOrderUiText("en")) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const key = `status_${normalized}`;
  return ui[key] || getOrderStatusLabel(status);
}

function renderOrdersNav(ui, session = null) {
  const superadminNav = session?.is_superadmin ? `<a href="/admin/superadmin"><button type="button">${ui.superadmin}</button></a>` : "";

  return `<div class="page-actions">
  <a href="/admin"><button type="button">${ui.general}</button></a>
  <a href="/admin/openrequests/"><button type="button">${ui.open_requests}</button></a>
  <a href="/admin/orders"><button type="button">${ui.orders}</button></a>
  <a href="/admin/closedorders"><button type="button">${ui.closed_orders}</button></a>
  <a href="/admin/products"><button type="button">${ui.products}</button></a>
  <a href="/admin/meeting-points"><button type="button">${ui.meeting_points}</button></a>
  <a href="/admin/ai"><button type="button">${ui.ai_info}</button></a>
  <a href="/admin/customers"><button type="button">${ui.customers}</button></a>
  ${superadminNav}
</div>`;
}

function renderAdminOrderStatusBadges(order, ui = getAdminOrderUiText("en")) {
  const parts = [];

  if (order.fulfillment_type) {
    parts.push(`${ui.fulfillment}: ${escapeHtml(getAdminOrderValueLabel("fulfillment", order.fulfillment_type, ui))}`);
  }

  if (order.order_status || order.status) {
    parts.push(`${ui.order}: ${escapeHtml(getAdminOrderStatusLabel(order.order_status || order.status, ui))}`);
  }

  if (order.delivery_status) {
    parts.push(`${ui.delivery}: ${escapeHtml(getAdminOrderStatusLabel(order.delivery_status, ui))}`);
  }

  if (order.pickup_status) {
    parts.push(`${ui.pickup}: ${escapeHtml(getAdminOrderStatusLabel(order.pickup_status, ui))}`);
  }

  return parts.map((part) => `<div>${part}</div>`).join("");
}

function renderAdminOrderLocationCell(order, ui = getAdminOrderUiText("en")) {
  const locationLabel = order.delivery_location_label || order.delivery_address || "";
  const mapLink = order.delivery_google_maps_link
    ? `<br><a href="${escapeHtml(order.delivery_google_maps_link)}" target="_blank">${ui.open_map}</a>`
    : "";

  if (!locationLabel && !mapLink) {
    return "";
  }

  return `${escapeHtml(locationLabel)}${mapLink}`;
}

function renderAdminCancelledOrderRecreationAction(
  order,
  ui = getAdminOrderUiText("en")
) {
  const activeSuccessorId =
    Number(order.active_recreated_order_id || 0);

  if (
    Number.isSafeInteger(activeSuccessorId) &&
    activeSuccessorId > 0
  ) {
    return `
      <a href="/admin/orders/${activeSuccessorId}">
        <button type="button">
          ${ui.already_recreated_as} #${activeSuccessorId}
        </button>
      </a>
    `;
  }

  const hasPreviousRecreation =
    Number(order.recreated_order_count || 0) > 0;
  const recreationKey = crypto.randomUUID();

  return `
    ${hasPreviousRecreation
      ? `<p><strong>${ui.recreate_another_order_warning}</strong></p>`
      : ""}
    <form action="/admin/orders/${order.id}/recreate" method="post">
      <input
        type="hidden"
        name="idempotency_key"
        value="${escapeHtml(recreationKey)}"
      >
      <input
        type="text"
        name="recreation_reason"
        required
        maxlength="500"
        placeholder="${escapeHtml(ui.recreation_reason)}"
      >
      <button type="submit">
        ${hasPreviousRecreation
          ? ui.recreate_another_order
          : ui.recreate_order}
      </button>
    </form>
  `;
}

function renderAdminOrderActionForms(order, closed = false, ui = getAdminOrderUiText("en")) {
  const currentStatus = order.order_status || order.status || "";
  const noteInput = `<input type="text" name="admin_status_note" value="${escapeHtml(order.admin_status_note || "")}" placeholder="${escapeHtml(ui.optional_admin_note)}">`;

  if (closed) {
    if (currentStatus === "cancelled") {
      return renderAdminCancelledOrderRecreationAction(
        order,
        ui
      );
    }

    return `
      <form action="/admin/orders/${order.id}/return" method="post" style="display:inline;">
        <button type="submit">${ui.return_not_delivered}</button>
      </form>
    `;
  }

  if (
    currentStatus === "draft" &&
    order.recreated_from_order_id
  ) {
    return `
      <a href="/admin/orders/${order.id}">
        <button type="button">${ui.details}</button>
      </a>
      <div><em>${ui.recreation_awaiting_confirmation}</em></div>
    `;
  }

  const forms = [];

  forms.push(`<a href="/admin/orders/${order.id}"><button type="button">${ui.details}</button></a>`);

  if (order.fulfillment_type === "delivery") {
    if (order.delivery_status !== "on_the_way" && currentStatus !== "delivered") {
      forms.push(`
        <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
          <input type="hidden" name="order_status" value="on_the_way">
          ${noteInput}
          <button type="submit">${ui.on_the_way}</button>
        </form>
      `);
    }

    forms.push(`
      <form action="/admin/orders/${order.id}/delivered" method="post" style="display:inline;">
        <button type="submit">${ui.delivered}</button>
      </form>
    `);

    forms.push(`
      <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
        <input type="hidden" name="order_status" value="not_delivered">
        <button type="submit">${ui.not_delivered}</button>
      </form>
    `);
  } else if (order.fulfillment_type === "pickup") {
    if (order.pickup_status !== "ready_to_pickup" && order.pickup_status !== "picked_up") {
      forms.push(`
        <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
          <input type="hidden" name="order_status" value="ready_to_pickup">
          ${noteInput}
          <button type="submit">${ui.ready_to_pick_up}</button>
        </form>
      `);
    }

    forms.push(`
      <form action="/admin/orders/${order.id}/delivered" method="post" style="display:inline;">
        <button type="submit">${ui.picked_up_delivered}</button>
      </form>
    `);
  } else {
    forms.push(`
      <form action="/admin/orders/${order.id}/status" method="post">
        <select name="order_status">
          ${getOrderStatusOptions(currentStatus || "submitted")}
        </select>
        ${noteInput}
        <button type="submit">${ui.update}</button>
      </form>
    `);
  }

  forms.push(`
    <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
      <input type="hidden" name="order_status" value="cancelled">
      <button type="submit">${ui.cancel}</button>
    </form>
  `);

  return forms.join("\n");
}

function formatAdminOrderTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  return raw
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC")
    .replace(/Z$/, " UTC");
}

function renderOrdersTable(orders, closed = false, ui = getAdminOrderUiText("en")) {
  const rows = orders.map((order) => {
    const customerLabel =
      order.full_name ||
      order.order_customer_name ||
      order.username ||
      order.telegram_user_id ||
      "";

    const customerMeta = [
      order.username,
      order.telegram_user_id
    ].filter(Boolean).join(" · ");

    return `<tr>
      <td class="order-id">
        <strong>${escapeHtml(order.id)}</strong>
        ${order.public_order_code
          ? `<br><small>${escapeHtml(order.public_order_code)}</small>`
          : ""}
      </td>
      <td class="order-customer">
        ${escapeHtml(customerLabel)}
        ${customerMeta
          ? `<br><small>${escapeHtml(customerMeta)}</small>`
          : ""}
      </td>
      <td class="order-status">${renderAdminOrderStatusBadges(order, ui)}</td>
      <td class="order-items">${formatOrderItemsText(order.items_json)}</td>
      <td class="order-total">${escapeHtml(formatPrice(order.total_amount || 0))}</td>
      <td class="order-location">${renderAdminOrderLocationCell(order, ui)}</td>
      <td class="order-dates">
        <time datetime="${escapeHtml(order.created_at || "")}">
          ${escapeHtml(formatAdminOrderTimestamp(order.created_at))}
        </time>
        <br>
        <time datetime="${escapeHtml(order.updated_at || "")}">
          ${escapeHtml(formatAdminOrderTimestamp(order.updated_at))}
        </time>
      </td>
      <td class="order-actions">
        ${order.admin_status_note
          ? `<div><small>${ui.note}: ${escapeHtml(order.admin_status_note)}</small></div>`
          : ""}
        ${renderAdminOrderActionForms(order, closed, ui)}
      </td>
    </tr>`;
  }).join("");

  return `<style>
    .orders-table-wrap {
      box-sizing: border-box;
      width: 100%;
      max-width: none !important;
      overflow-x: auto;
      border-radius: 14px;
    }

    .orders-table {
      box-sizing: border-box;
      width: 100%;
      min-width: 1180px;
      border-collapse: collapse;
      table-layout: auto;
    }

    .orders-table th,
    .orders-table td {
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
    }

    .orders-table .order-id {
      min-width: 80px;
    }

    .orders-table .order-customer {
      min-width: 150px;
    }

    .orders-table .order-status {
      min-width: 135px;
    }

    .orders-table .order-items {
      min-width: 180px;
    }

    .orders-table .order-total {
      min-width: 85px;
      white-space: nowrap;
    }

    .orders-table .order-location {
      min-width: 240px;
    }

    .orders-table .order-dates {
      min-width: 170px;
    }

    .orders-table .order-actions {
      min-width: 290px;
    }

    .orders-table .order-actions form {
      display: flex !important;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 6px 0;
    }

    .orders-table .order-actions input {
      flex: 1 1 180px;
      min-width: 0;
    }

    @media (max-width: 800px) {
      .orders-table {
        min-width: 1050px;
      }
    }
  </style>
  <div class="orders-table-wrap">
    <table class="orders-table" border="1" cellpadding="10">
      <thead>
        <tr>
          <th>${ui.order}</th>
          <th>${ui.customer}</th>
          <th>${ui.status}</th>
          <th>${ui.items}</th>
          <th>${ui.total}</th>
          <th>${ui.location}</th>
          <th>${ui.created_updated}</th>
          <th>${ui.action}</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="8">${ui.no_orders_found}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

async function getAdminOrderStatusHistory(env, orderId) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM customer_order_status_history_v2
    WHERE order_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
  `).bind(orderId).all();

  return result.results || [];
}


function getAdminActorDisplayLabel(value, ui = getAdminOrderUiText("en")) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ui[`actor_${normalized}`] || value || "";
}

function renderAdminOrderStatusHistory(history = [], ui = getAdminOrderUiText("en")) {
  const rows = (history || []).map((entry) => {
    const changedBy = entry.changed_by_admin_username || entry.changed_by_username || entry.changed_by || entry.admin_username || entry.created_by || "";
    const note = entry.note || entry.reason || entry.status_note || "";

    return `<tr>
      <td>${escapeHtml(getAdminOrderStatusLabel(entry.from_status || entry.previous_status || "", ui))}</td>
      <td>${escapeHtml(getAdminOrderStatusLabel(entry.to_status || entry.new_status || entry.status || "", ui))}</td>
      <td>${escapeHtml(getAdminNoteDisplayText(note, ui))}</td>
      <td>${escapeHtml(getAdminActorDisplayLabel(changedBy, ui))}</td>
      <td>${escapeHtml(entry.created_at || entry.changed_at || "")}</td>
    </tr>`;
  }).join("");

  return `<table border="1" cellpadding="8">
    <tr>
      <th>${ui.from_status}</th>
      <th>${ui.to_status}</th>
      <th>${ui.note}</th>
      <th>${ui.changed_by}</th>
      <th>${ui.changed_at}</th>
    </tr>
    ${rows || `<tr><td colspan="5">${ui.no_status_history}</td></tr>`}
  </table>`;
}

function renderAdminOrderDetailItems(items = [], ui = getAdminOrderUiText("en")) {
  const rows = (items || []).map((item) => `
    <tr>
      <td>${escapeHtml(item.name || item.product_name || "")}</td>
      <td>${escapeHtml(item.quantity || "")}</td>
      <td>${escapeHtml(formatPrice(item.unit_price || item.price_snapshot || 0))}</td>
      <td>${escapeHtml(formatPrice(item.line_total || 0))}</td>
      <td>${escapeHtml(getAdminOrderStatusLabel(item.item_status || "", ui))}</td>
      <td>${escapeHtml(item.admin_decision || "")}</td>
      <td>${escapeHtml(item.admin_decision_note || "")}</td>
    </tr>
  `).join("");

  return `<table border="1" cellpadding="8">
    <tr>
      <th>${ui.product}</th>
      <th>${ui.qty}</th>
      <th>${ui.unit}</th>
      <th>${ui.total}</th>
      <th>${ui.item_status}</th>
      <th>${ui.admin_decision}</th>
      <th>${ui.note}</th>
    </tr>
    ${rows || `<tr><td colspan="7">${ui.no_items}</td></tr>`}
  </table>`;
}

function renderAdminOrderDetailGroups(order, ui = getAdminOrderUiText("en")) {
  const groups = order.groups || [];

  if (!groups.length) {
    return `<p>${ui.no_item_groups}</p>`;
  }

  return groups.map((group) => {
    const groupActions = group.group_status === "pending_admin_approval" && order.fulfillment_type === "delivery"
      ? `
        <div class="page-actions">
          <form action="/admin/orders/${order.id}/groups/${group.id}/approve" method="post" style="display:inline;">
            <button type="submit">${ui.approve_group}</button>
          </form>
          <form action="/admin/orders/${order.id}/groups/${group.id}/reject" method="post" style="display:inline;">
            <input type="text" name="admin_decision_note" placeholder="${escapeHtml(ui.reject_note)}">
            <button type="submit">${ui.reject_group}</button>
          </form>
        </div>
      `
      : "";

    return `<div class="admin-section">
      <h3>${ui.group} ${escapeHtml(group.id)} — ${escapeHtml(getAdminOrderValueLabel("group_type", group.group_type, ui))}</h3>
      <p>
        <strong>${ui.status}:</strong> ${escapeHtml(getAdminOrderStatusLabel(group.group_status || "", ui))}
        <br><strong>${ui.fulfillment}:</strong> ${escapeHtml(getAdminOrderValueLabel("fulfillment", group.fulfillment_type, ui))}
        <br><strong>${ui.requires_admin_approval}:</strong> ${group.requires_admin_approval ? ui.yes : ui.no}
        <br><strong>${ui.total}:</strong> ${escapeHtml(group.total_formatted || formatPrice(group.total_amount || 0))}
      </p>
      ${groupActions}
      ${renderAdminOrderDetailItems(group.items || [], ui)}
    </div>`;
  }).join("");
}

function renderAdminOrderDetailActions(order, ui = getAdminOrderUiText("en")) {
  const currentStatus = order.order_status || order.status || "";

  if (currentStatus === "cancelled") {
    return renderAdminCancelledOrderRecreationAction(
      order,
      ui
    );
  }

  if (
    currentStatus === "draft" &&
    order.recreated_from_order_id
  ) {
    return `
      <p><em>${ui.recreation_awaiting_confirmation}</em></p>
      <form
        action="/admin/orders/${order.id}/confirm-recreation"
        method="post"
      >
        <button type="submit">
          ${ui.confirm_recreated_order}
        </button>
      </form>
    `;
  }

  const forms = [];

  if (order.fulfillment_type === "delivery") {
    if (order.delivery_status !== "on_the_way" && currentStatus !== "delivered") {
      forms.push(`
        <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
          <input type="hidden" name="order_status" value="on_the_way">
          <input type="text" name="admin_status_note" placeholder="${escapeHtml(ui.optional_admin_note)}">
          <button type="submit">${ui.on_the_way}</button>
        </form>
      `);
    }

    if (currentStatus !== "delivered") {
      forms.push(`
        <form action="/admin/orders/${order.id}/delivered" method="post" style="display:inline;">
          <button type="submit">${ui.delivered}</button>
        </form>
      `);
    }

    if (currentStatus !== "not_delivered") {
      forms.push(`
        <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
          <input type="hidden" name="order_status" value="not_delivered">
          <button type="submit">${ui.not_delivered}</button>
        </form>
      `);
    }
  }

  if (order.fulfillment_type === "pickup") {
    if (order.pickup_status !== "ready_to_pickup" && order.pickup_status !== "picked_up") {
      forms.push(`
        <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
          <input type="hidden" name="order_status" value="ready_to_pickup">
          <input type="text" name="admin_status_note" placeholder="${escapeHtml(ui.optional_admin_note)}">
          <button type="submit">${ui.ready_to_pick_up}</button>
        </form>
      `);
    }

    if (order.pickup_status !== "picked_up" && currentStatus !== "delivered") {
      forms.push(`
        <form action="/admin/orders/${order.id}/delivered" method="post" style="display:inline;">
          <button type="submit">${ui.picked_up_delivered}</button>
        </form>
      `);
    }
  }

  if (!["delivered", "cancelled", "not_delivered", "closed"].includes(currentStatus)) {
    forms.push(`
      <form action="/admin/orders/${order.id}/status" method="post" style="display:inline;">
        <input type="hidden" name="order_status" value="cancelled">
        <button type="submit">${ui.cancel}</button>
      </form>
    `);
  }

  return forms.join("\n") || `<em>${ui.no_available_action}</em>`;
}

async function handleAdminOrderDetailPage(env, session, orderId) {
  const language = await getSetting(env, "admin_view_language") || "en";
  const ui = getAdminUiText(language);
  const order = await getV2AdminOrder(env, orderId);
  const statusHistory = order ? await getAdminOrderStatusHistory(env, orderId) : [];

  if (!order) {
    return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${ui.order_not_found}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
${renderOrdersNav(ui, session)}
<h1>${ui.order_not_found}</h1>
<p><a href="/admin/orders">${ui.back_to_orders}</a></p>
</body>
</html>`, 404);
  }

  const customer = order.customer || {};
  const location = order.delivery_location_label || order.delivery_address || "";
  const mapLink = order.delivery_google_maps_link
    ? `<a href="${escapeHtml(order.delivery_google_maps_link)}" target="_blank">${ui.open_map}</a>`
    : "";

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${ui.order} ${escapeHtml(order.id)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div class="admin-header">
  <h1>${ui.order} ${escapeHtml(order.id)}</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">${ui.logout}</button></form>
    <a href="/admin/change-password"><button type="button">${ui.change_password}</button></a>
  </div>
</div>
<hr><hr>
${renderOrdersNav(ui, session)}
<hr><hr>

<p>
  <a href="/admin/orders"><button type="button">${ui.open_orders}</button></a>
  <a href="/admin/closedorders"><button type="button">${ui.closed_orders}</button></a>
</p>

<div class="admin-section">
  <h2>${ui.summary}</h2>
  <p>
    <strong>${ui.code}:</strong> ${escapeHtml(order.public_order_code || "")}
    ${order.recreated_from_order_id
      ? `<br><strong>${ui.recreated_from_order}:</strong> <a href="/admin/orders/${order.recreated_from_order_id}">#${escapeHtml(order.recreated_from_order_id)}</a>`
      : ""}
    <br><strong>${ui.fulfillment}:</strong> ${escapeHtml(getAdminOrderValueLabel("fulfillment", order.fulfillment_type, ui))}
    <br><strong>${ui.order_status}:</strong> ${escapeHtml(getAdminOrderStatusLabel(order.order_status || order.status || "", ui))}
    <br><strong>${ui.delivery_status}:</strong> ${escapeHtml(getAdminOrderStatusLabel(order.delivery_status || "", ui))}
    <br><strong>${ui.pickup_status}:</strong> ${escapeHtml(getAdminOrderStatusLabel(order.pickup_status || "", ui))}
    <br><strong>${ui.total}:</strong> ${escapeHtml(order.total_formatted || formatPrice(order.total_amount || 0))}
    <br><strong>${ui.admin_note}:</strong> ${escapeHtml(getAdminNoteDisplayText(order.admin_status_note || "", ui))}
  </p>
</div>

<div class="admin-section">
  <h2>${ui.customer}</h2>
  <p>
    <strong>${ui.customer_name}:</strong> ${escapeHtml(customer.full_name || "")}
    <br><strong>${ui.username}:</strong> ${escapeHtml(customer.username || "")}
    <br><strong>${ui.telegram}:</strong> ${escapeHtml(customer.telegram_user_id || "")}
    <br><strong>${ui.language}:</strong> ${escapeHtml(getAdminLanguageDisplayLabel(customer.preferred_language || "", ui))}
  </p>
</div>

<div class="admin-section">
  <h2>${ui.location}</h2>
  <p>
    ${escapeHtml(location || ui.no_delivery_location)}
    ${mapLink ? `<br>${mapLink}` : ""}
  </p>
</div>

<div class="admin-section">
  <h2>${ui.actions}</h2>
  ${renderAdminOrderDetailActions(order, ui)}
</div>

<div class="admin-section">
  <h2>${ui.groups_and_items}</h2>
  ${renderAdminOrderDetailGroups(order, ui)}
</div>

<div class="admin-section">
  <h2>${ui.status_history}</h2>
  ${renderAdminOrderStatusHistory(statusHistory, ui)}
</div>

</body>
</html>`);
}

async function handleAdminOrdersPage(env, session = null) {
  const language = await getSetting(env, "admin_view_language") || "en";
  const ui = getAdminUiText(language);
  const orders = await getOrdersContext(env, false);

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${ui.orders}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div class="admin-header">
  <h1>${ui.orders}</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">${ui.logout}</button></form>
    <a href="/admin/change-password"><button type="button">${ui.change_password}</button></a>
  </div>
</div>
<hr><hr>
${renderOrdersNav(ui, session)}
<hr><hr>
<h2>${ui.orders}</h2>
${renderOrdersTable(orders, false, ui)}
</body>
</html>`);
}

async function handleAdminClosedOrdersPage(env, session = null) {
  const language = await getSetting(env, "admin_view_language") || "en";
  const ui = getAdminUiText(language);
  const orders = await getOrdersContext(env, true);

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${ui.closed_orders}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div class="admin-header">
  <h1>${ui.closed_orders}</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">${ui.logout}</button></form>
    <a href="/admin/change-password"><button type="button">${ui.change_password}</button></a>
  </div>
</div>
<hr><hr>
${renderOrdersNav(ui, session)}
<hr><hr>
<h2>${ui.closed_orders}</h2>
${renderOrdersTable(orders, true, ui)}
</body>
</html>`);
}

async function getOrderById(env, orderId) {
  return env.DB.prepare(`
    SELECT
      o.*,
      customers.telegram_user_id,
      customers.preferred_language,
      customers.language
    FROM customer_orders_v2 o
    LEFT JOIN customers ON o.session_token = ('app_customer_' || customers.id)
    WHERE o.id = ?
  `).bind(orderId).first();
}

function getOrderStatusCustomerMessage(status, language = "en") {
  const messages = {
    in_progress: {
      en: "Your order is back in progress. You can send a product name to continue shopping or choose an option below.",
      de: "Ihre Bestellung ist wieder in Bearbeitung. Sie können einen Produktnamen senden oder unten eine Option wählen.",
      tr: "Siparişiniz tekrar devam ediyor. Alışverişe devam etmek için ürün adı yazabilir veya aşağıdan bir seçenek seçebilirsiniz.",
      ar: "عاد طلبك إلى قيد التنفيذ. يمكنك إرسال اسم منتج للمتابعة أو اختيار خيار بالأسفل.",
      ru: "Ваш заказ снова в процессе. Вы можете отправить название товара или выбрать вариант ниже."
    },
    waiting_location: {
      en: "Please type your delivery address or describe where we should deliver.",
      de: "Bitte geben Sie Ihre Lieferadresse ein oder beschreiben Sie den Lieferort.",
      tr: "Lütfen teslimat adresinizi yazın veya teslimatı nereye yapmamız gerektiğini tarif edin.",
      ar: "يرجى كتابة عنوان التوصيل أو وصف مكان التوصيل.",
      ru: "Напишите адрес доставки или опишите, куда доставить."
    },
    ready_to_delivery: {
      en: "Your order location is confirmed. We will prepare it for delivery.",
      de: "Ihr Standort ist bestätigt. Wir bereiten die Lieferung vor.",
      tr: "Sipariş konumunuz onaylandı. Teslimat için hazırlayacağız.",
      ar: "تم تأكيد موقع الطلب. سنجهزه للتوصيل.",
      ru: "Локация заказа подтверждена. Мы подготовим доставку."
    },
    on_the_way: {
      en: "Your order is on the way.",
      de: "Ihre Bestellung ist unterwegs.",
      tr: "Siparişiniz yolda.",
      ar: "طلبك في الطريق.",
      ru: "Ваш заказ в пути."
    },
    not_delivered: {
      en: "Your order was marked as not delivered. Please contact admin or choose an option below.",
      de: "Ihre Bestellung wurde als nicht geliefert markiert. Bitte kontaktieren Sie den Admin oder wählen Sie unten eine Option.",
      tr: "Siparişiniz teslim edilmedi olarak işaretlendi. Lütfen adminle iletişime geçin veya aşağıdan bir seçenek seçin.",
      ar: "تم تحديد طلبك كغير مُسلّم. يرجى التواصل مع المسؤول أو اختيار خيار بالأسفل.",
      ru: "Ваш заказ отмечен как не доставленный. Свяжитесь с админом или выберите вариант ниже."
    },
    delivered: {
      en: "Your order was marked as delivered. Thank you.",
      de: "Ihre Bestellung wurde als geliefert markiert. Danke.",
      tr: "Siparişiniz teslim edildi olarak işaretlendi. Teşekkürler.",
      ar: "تم تحديد طلبك كمُسلّم. شكراً.",
      ru: "Ваш заказ отмечен как доставленный. Спасибо."
    }
  };
  const lang = safeLang(language);
  return (messages[status] && (messages[status][lang] || messages[status].en)) || messages.in_progress.en;
}

async function notifyCustomerForOrderStatus(env, order, status) {
  const language = order.preferred_language || order.language || "en";
  const text = getOrderStatusCustomerMessage(status, language);

  let keyboard = null;
  if (status === "in_progress") keyboard = getCartKeyboard((await getTelegramCartItems(env, order.customer_id)).items || [], language);
  if (status === "waiting_location") keyboard = getCheckoutLocationKeyboard(language);
  if (status === "not_delivered") keyboard = getMenuKeyboard(language);

  if (/^\d+$/.test(String(order.telegram_user_id || ""))) {
    await sendTelegramMessage(env, order.telegram_user_id, text, keyboard);
  }

  await saveMessage(env, order.customer_id, "outgoing", text, language, "order_status");
}

function getCustomerIdFromV2Order(order = {}) {
  const raw = String(order.session_token || "");

  if (!raw.startsWith("app_customer_")) return null;

  const customerId = Number(raw.replace("app_customer_", ""));

  return Number.isFinite(customerId) ? customerId : null;
}

async function closeDeliveryLocationRequestsForV2Order(env, order, status = "done") {
  if (!order || order.fulfillment_type !== "delivery") return;

  const customerId = getCustomerIdFromV2Order(order);
  if (!customerId) return;

  const googleMapsLink = String(order.delivery_google_maps_link || "").trim();
  const locationLabel = String(order.delivery_location_label || "").trim();
  const deliveryAddress = String(order.delivery_address || "").trim();

  if (!googleMapsLink && !locationLabel && !deliveryAddress) return;

  await env.DB.prepare(`
    UPDATE customer_requests
    SET status = ?
    WHERE customer_id = ?
      AND request_type = 'delivery_location'
      AND status NOT IN ('done', 'cancelled')
      AND (
        (? != '' AND google_maps_link = ?)
        OR (? != '' AND location_label = ?)
        OR (? != '' AND request_text = ?)
      )
  `).bind(
    status,
    customerId,
    googleMapsLink,
    googleMapsLink,
    locationLabel,
    locationLabel,
    deliveryAddress,
    deliveryAddress
  ).run();
}

async function updateOrderStatusByAdmin(env, orderId, status, note = "") {
  const order = await getV2RawOrder(env, orderId);
  if (!order) return null;

  const previousStatus = order.order_status || order.status || null;

  if (status === "delivered") {
    return await markTelegramV2OrderDelivered(env, orderId, note || "Marked delivered from admin web");
  }

  if (status === "on_the_way") {
    if (order.fulfillment_type !== "delivery") return order;

    await env.DB.prepare(`
      UPDATE customer_orders_v2
      SET delivery_status = 'on_the_way',
          admin_status_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(note || null, orderId).run();

    await addV2OrderHistory(env, orderId, order.delivery_status || previousStatus, "delivery:on_the_way", { username: "admin_web" }, note || "Marked on the way from admin web");

    const updated = await getV2RawOrder(env, orderId);
    await notifyCustomerForV2Order(env, updated, getV2DeliveryOnTheWayText(), "order_status");
    return updated;
  }

  if (status === "ready_to_pickup") {
    if (order.fulfillment_type !== "pickup") return order;

    await env.DB.prepare(`
      UPDATE order_addition_groups_v2
      SET group_status = 'confirmed',
          updated_at = CURRENT_TIMESTAMP
      WHERE customer_order_id = ?
        AND group_status = 'waiting_ready_to_pickup'
    `).bind(orderId).run();

    await env.DB.prepare(`
      UPDATE customer_order_items_v2
      SET item_status = 'confirmed',
          decided_at = CURRENT_TIMESTAMP
      WHERE customer_order_id = ?
        AND item_status = 'waiting_ready_to_pickup'
    `).bind(orderId).run();

    await env.DB.prepare(`
      UPDATE customer_orders_v2
      SET pickup_status = 'ready_to_pickup',
          order_status = CASE
            WHEN order_status = 'draft' THEN 'submitted'
            ELSE order_status
          END,
          status = CASE
            WHEN status = 'draft' THEN 'submitted'
            ELSE status
          END,
          admin_status_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(note || null, orderId).run();

    await updateV2OrderConfirmedTotal(env, orderId);
    await addV2OrderHistory(env, orderId, order.pickup_status || previousStatus, "pickup:ready_to_pickup", { username: "admin_web" }, note || "Marked ready to pick up from admin web");

    const updated = await getV2RawOrder(env, orderId);
    await notifyCustomerForV2Order(env, updated, getV2PickupReadyText(), "order_status");
    return updated;
  }

  if (status === "not_delivered") {
    await env.DB.prepare(`
      UPDATE customer_orders_v2
      SET status = 'not_delivered',
          order_status = 'not_delivered',
          delivery_status = CASE
            WHEN fulfillment_type = 'delivery' THEN 'not_delivered'
            ELSE delivery_status
          END,
          pickup_status = CASE
            WHEN fulfillment_type = 'pickup' THEN 'not_delivered'
            ELSE pickup_status
          END,
          admin_status_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(note || null, orderId).run();

    await addV2OrderHistory(env, orderId, previousStatus, "not_delivered", { username: "admin_web" }, note || "Marked not delivered from admin web");

    const updated = await getV2RawOrder(env, orderId);
    await notifyCustomerForV2Order(env, updated, getV2OrderNotDeliveredText(), "order_status");
    return updated;
  }

  if (status === "cancelled") {
    await env.DB.prepare(`
      UPDATE customer_orders_v2
      SET status = 'cancelled',
          order_status = 'cancelled',
          delivery_status = CASE
            WHEN fulfillment_type = 'delivery' THEN 'cancelled'
            ELSE delivery_status
          END,
          pickup_status = CASE
            WHEN fulfillment_type = 'pickup' THEN 'cancelled'
            ELSE pickup_status
          END,
          cancelled_at = CURRENT_TIMESTAMP,
          cancel_reason = ?,
          admin_status_note = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(note || null, note || null, orderId).run();

    await env.DB.prepare(`
      UPDATE order_addition_groups_v2
      SET status_before_cancel = CASE
            WHEN group_status = 'cancelled'
            THEN status_before_cancel
            ELSE group_status
          END,
          group_status = 'cancelled',
          admin_decision = 'cancelled',
          admin_decision_note = ?,
          decided_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE customer_order_id = ?
    `).bind(note || null, orderId).run();

    await env.DB.prepare(`
      UPDATE customer_order_items_v2
      SET status_before_cancel = CASE
            WHEN item_status = 'cancelled'
            THEN status_before_cancel
            ELSE item_status
          END,
          item_status = 'cancelled',
          admin_decision = 'cancelled',
          admin_decision_note = ?,
          decided_at = CURRENT_TIMESTAMP
      WHERE customer_order_id = ?
    `).bind(note || null, orderId).run();

    await closeDeliveryLocationRequestsForV2Order(env, order, "cancelled");

    await addV2OrderHistory(env, orderId, previousStatus, "cancelled", { username: "admin_web" }, note || "Cancelled from admin web");

    const updated = await getV2RawOrder(env, orderId);
    await notifyCustomerForV2Order(env, updated, getV2OrderCancelledText(note), "order_status");
    return updated;
  }

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET status = ?,
        order_status = ?,
        admin_status_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, status, note || null, orderId).run();

  await addV2OrderHistory(env, orderId, previousStatus, status, { username: "admin_web" }, note || "Updated from admin web");

  return await getV2RawOrder(env, orderId);
}

async function handleAdminUpdateOrderStatus(request, env, orderId) {
  const form = await request.formData();
  const status = String(form.get("order_status") || "in_progress");
  const note = String(form.get("admin_status_note") || "").trim();
  await updateOrderStatusByAdmin(env, orderId, status, note);
  return redirectResponse(status === "delivered" ? "/admin/closedorders" : "/admin/orders");
}

async function handleAdminMarkOrderDelivered(env, orderId) {
  await updateOrderStatusByAdmin(env, orderId, "delivered", "");
  return redirectResponse("/admin/closedorders");
}

async function handleAdminReturnClosedOrder(env, orderId) {
  const order = await getV2RawOrder(env, orderId);
  if (!order) return redirectResponse("/admin/closedorders");

  await updateOrderStatusByAdmin(env, orderId, "not_delivered", "Returned from closed orders");
  return redirectResponse("/admin/orders");
}

async function renderAdminOrderRecreationFailure(
  env,
  session,
  error
) {
  const language =
    await getSetting(env, "admin_view_language") ||
    "en";
  const ui = getAdminUiText(language);
  const status = Number(error?.httpStatus || 500);

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(ui.recreation_failed)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
  ${renderOrdersNav(ui, session)}
  <h1>${escapeHtml(ui.recreation_failed)}</h1>
  <p>
    <a href="/admin/closedorders">
      ${escapeHtml(ui.closed_orders)}
    </a>
  </p>
</body>
</html>`, status);
}

async function handleAdminRecreateCancelledOrder(
  request,
  env,
  orderId,
  session
) {
  const form = await request.formData();
  const recreationKey = String(
    form.get("idempotency_key") || ""
  ).trim();
  const reason = String(
    form.get("recreation_reason") || ""
  ).trim();

  try {
    const result = await recreateCancelledV2Order(
      env,
      orderId,
      session,
      recreationKey,
      reason
    );

    await logAdminAction(
      env,
      request,
      session,
      result.replayed
        ? "admin_order_recreation_replayed"
        : "admin_order_recreated",
      `source_order:${orderId}:new_order:${result.order.id}`
    );

    return redirectResponse(
      `/admin/orders/${result.order.id}`
    );
  } catch (error) {
    return renderAdminOrderRecreationFailure(
      env,
      session,
      error
    );
  }
}

async function handleAdminConfirmRecreatedOrder(
  request,
  env,
  orderId,
  session
) {
  try {
    const result = await confirmRecreatedV2Order(
      env,
      orderId,
      session
    );

    await logAdminAction(
      env,
      request,
      session,
      result.replayed
        ? "admin_order_recreation_confirmation_replayed"
        : "admin_order_recreation_confirmed",
      `order:${orderId}`
    );

    return redirectResponse(`/admin/orders/${orderId}`);
  } catch (error) {
    return renderAdminOrderRecreationFailure(
      env,
      session,
      error
    );
  }
}

async function handleAdminOrderGroupApprove(env, orderId, groupId, session = {}) {
  const order = await getV2RawOrder(env, orderId);
  const group = await getV2RawGroup(env, groupId, orderId);

  if (!order || !group) {
    return redirectResponse(`/admin/orders/${orderId}`);
  }

  if (order.fulfillment_type !== "delivery" || group.group_status !== "pending_admin_approval") {
    return redirectResponse(`/admin/orders/${orderId}`);
  }

  await env.DB.prepare(`
    UPDATE order_addition_groups_v2
    SET group_status = 'approved',
        admin_decision = 'approved',
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND customer_order_id = ?
  `).bind(groupId, orderId).run();

  await env.DB.prepare(`
    UPDATE customer_order_items_v2
    SET item_status = 'confirmed',
        admin_decision = 'approved',
        decided_at = CURRENT_TIMESTAMP
    WHERE group_id = ? AND customer_order_id = ?
  `).bind(groupId, orderId).run();

  await updateV2OrderConfirmedTotal(env, orderId);
  await addV2OrderHistory(env, orderId, "group:pending_admin_approval", "group:approved", session, `Group ${groupId} approved from admin web`);
  await notifyCustomerForV2Order(env, order, getV2DeliveryAdditionApprovedText(), "order_addition");

  return redirectResponse(`/admin/orders/${orderId}`);
}

async function handleAdminOrderGroupReject(request, env, orderId, groupId, session = {}) {
  const form = await request.formData();
  const note = String(form.get("admin_decision_note") || "").trim();

  const order = await getV2RawOrder(env, orderId);
  const group = await getV2RawGroup(env, groupId, orderId);

  if (!order || !group) {
    return redirectResponse(`/admin/orders/${orderId}`);
  }

  if (order.fulfillment_type !== "delivery" || group.group_status !== "pending_admin_approval") {
    return redirectResponse(`/admin/orders/${orderId}`);
  }

  await env.DB.prepare(`
    UPDATE order_addition_groups_v2
    SET group_status = 'rejected',
        admin_decision = 'rejected',
        admin_decision_note = ?,
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND customer_order_id = ?
  `).bind(note || null, groupId, orderId).run();

  await env.DB.prepare(`
    UPDATE customer_order_items_v2
    SET item_status = 'rejected',
        admin_decision = 'rejected',
        admin_decision_note = ?,
        decided_at = CURRENT_TIMESTAMP
    WHERE group_id = ? AND customer_order_id = ?
  `).bind(note || null, groupId, orderId).run();

  await updateV2OrderConfirmedTotal(env, orderId);
  await addV2OrderHistory(env, orderId, "group:pending_admin_approval", "group:rejected", session, `Group ${groupId} rejected from admin web${note ? ": " + note : ""}`);
  await notifyCustomerForV2Order(env, order, getV2DeliveryAdditionRejectedText(), "order_addition");

  return redirectResponse(`/admin/orders/${orderId}`);
}

async function handleAdminProductsPage(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data, "products"));
}

async function handleAdminProductListPage(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data, "product_list"));
}

async function handleAdminProductCategoriesPage(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data, "product_categories"));
}

async function handleAdminMeetingPointsPage(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data, "meeting_points"));
}

async function handleAdminAiPage(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data, "ai"));
}

async function handleAdminCustomersPage(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data, "customers"));
}

async function handleAdminHome(env, session = null) {
  const data = await getAdminData(env);
  data.session = session;
  return htmlResponse(renderAdminDashboard(data));
}

async function handleAdminSuperadminPage(env, session) {
  const language = await getSetting(env, "admin_view_language") || "en";
  const ui = getAdminUiText(language);
  const admins = await getAdminUsersForSuperadmin(env);
  const logs = await getAdminAuditLogs(env);

  const adminRows = admins.map((admin) => {
    const isCurrentSessionAdmin = admin.username === session?.username;
    const canToggleAccess = !admin.protected && !isCurrentSessionAdmin;
    const accessButtonLabel = Number(admin.is_active) === 1 ? ui.deny_access : ui.grant_access;

    return `
    <tr>
      <td>${escapeHtml(admin.username)}</td>
      <td>${escapeHtml(admin.email || "")}</td>
      <td>${escapeHtml(admin.role)}</td>
      <td>${Number(admin.is_active) === 1 ? escapeHtml(ui.active) : escapeHtml(ui.inactive)}</td>
      <td>${escapeHtml(admin.source || "")}</td>
      <td>${escapeHtml(admin.created_at || "")}</td>
      <td>${escapeHtml(admin.last_login_at || "")}</td>
      <td>
        ${canToggleAccess ? `
          <form action="/admin/superadmin/admins/${admin.id}/toggle" method="post" style="display:inline;">
            <button type="submit">${escapeHtml(accessButtonLabel)}</button>
          </form>
          <form action="/admin/superadmin/admins/${admin.id}/delete" method="post" style="display:inline;">
            <button type="submit" onclick="return confirm('Delete this admin credential?')">${escapeHtml(ui.delete_credential)}</button>
          </form>
        ` : ""}
      </td>
    </tr>
  `;
  }).join("");

  const logRows = logs.map((log) => `
    <tr>
      <td>${escapeHtml(log.created_at || "")}</td>
      <td>${escapeHtml(log.admin_username || "")}</td>
      <td>${escapeHtml(log.admin_role || "")}</td>
      <td>${escapeHtml(log.action_type || "")}</td>
      <td>${escapeHtml(log.action_detail || "")}</td>
      <td>${escapeHtml(log.method || "")}</td>
      <td>${escapeHtml(log.path || "")}</td>
      <td>${escapeHtml(log.ip || "")}</td>
      <td>${escapeHtml(log.user_agent || "")}</td>
    </tr>
  `).join("");

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(ui.superadmin)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div class="admin-header">
  <h1>${escapeHtml(ui.superadmin)}</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">${escapeHtml(ui.logout)}</button></form>
    <a href="/admin/change-password"><button type="button">${escapeHtml(ui.change_password)}</button></a>
  </div>
</div>
<hr><hr>
${renderOrdersNav(ui, session)}
<hr><hr>

<h2>${escapeHtml(ui.admin_management)}</h2>
<table>
  <tr>
    <th>${escapeHtml(ui.username)}</th>
    <th>${escapeHtml(ui.email_address)}</th>
    <th>${escapeHtml(ui.role)}</th>
    <th>${escapeHtml(ui.active)}</th>
    <th>${escapeHtml(ui.source)}</th>
    <th>${escapeHtml(ui.created_at)}</th>
    <th>${escapeHtml(ui.last_login_at)}</th>
    <th></th>
  </tr>
  ${adminRows}
</table>

<h2>${escapeHtml(ui.create_admin)}</h2>
<form action="/admin/superadmin/admins" method="post">
  <label>${escapeHtml(ui.username)}</label><br>
  <input type="text" name="username" required>
  <br><br>
  <label>${escapeHtml(ui.email_address)}</label><br>
  <input type="email" name="email" required>
  <br><br>
  <label>${escapeHtml(ui.password)}</label><br>
  <input type="password" name="password" required>
  <br><br>
  <label>${escapeHtml(ui.role)}</label><br>
  <select name="role">
    <option value="admin">admin</option>
    <option value="superadmin">superadmin</option>
  </select>
  <br><br>
  <button type="submit">${escapeHtml(ui.create_admin)}</button>
</form>

<h2>${escapeHtml(ui.audit_logs)}</h2>
<p class="admin-info-text">${escapeHtml(ui.last_30_days_only)}</p>
<table>
  <tr>
    <th>${escapeHtml(ui.created_at)}</th>
    <th>${escapeHtml(ui.username)}</th>
    <th>${escapeHtml(ui.role)}</th>
    <th>${escapeHtml(ui.action_type)}</th>
    <th>${escapeHtml(ui.action_detail)}</th>
    <th>${escapeHtml(ui.method)}</th>
    <th>${escapeHtml(ui.path)}</th>
    <th>${escapeHtml(ui.ip)}</th>
    <th>${escapeHtml(ui.user_agent)}</th>
  </tr>
  ${logRows}
</table>
</body>
</html>`);
}

async function handleSuperadminCreateAdmin(request, env, session) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const emailInput = String(form.get("email") || "").trim();
  const roleInput = String(form.get("role") || "admin");
  const role = roleInput === "superadmin" ? "superadmin" : "admin";

  if (!username || !password || !emailInput) return redirectResponse("/admin/superadmin");

  let email;
  try {
    email = normalizeEmailAddress(emailInput);
  } catch {
    return redirectResponse("/admin/superadmin");
  }

  const normalizedUsername = username.toLowerCase();
  const protectedAccount = await env.DB.prepare(`
    SELECT id
    FROM admin_users
    WHERE username_normalized = ?
      AND is_protected = 1
    LIMIT 1
  `).bind(normalizedUsername).first();
  if (
    protectedAccount
    || normalizedUsername === String(env.ADMIN_USERNAME || "").trim().toLowerCase()
    || normalizedUsername === String(env.SUPERADMIN_USERNAME || "").trim().toLowerCase()
  ) {
    return redirectResponse("/admin/superadmin");
  }

  const existing = await env.DB.prepare(`
    SELECT id, auth_account_id
    FROM admin_users
    WHERE lower(trim(username)) = ?
    LIMIT 1
  `).bind(normalizedUsername).first();

  const statements = await buildSuperadminCreateStatements(env, {
    username,
    normalizedUsername,
    passwordHash: await hashAdminPassword(env, password),
    role,
    displayEmail: email.displayEmail,
    normalizedEmail: email.normalizedEmail,
    existing
  });
  await env.DB.batch(statements);

  await logAdminAction(env, request, session, "admin_created_or_updated", `${username}:${role}`);
  return redirectResponse("/admin/superadmin");
}

async function buildSuperadminCreateStatements(env, {
  username,
  normalizedUsername,
  passwordHash,
  role,
  displayEmail,
  normalizedEmail,
  existing
}) {
  const statements = [];
  let accountId = existing?.auth_account_id || null;

  if (!accountId) {
    accountId = createOpaqueId();
    const webauthnUserHandle = createOpaqueId();
    statements.push(env.DB.prepare(`
      INSERT INTO auth_accounts (
        id, webauthn_user_handle, realm, status, auth_version, enrollment_state
      ) VALUES (?, ?, 'staff', 'active', 1, 'not_required')
    `).bind(accountId, webauthnUserHandle));
    if (existing) {
      statements.push(env.DB.prepare(`
        UPDATE admin_users
        SET auth_account_id = ?
        WHERE id = ?
      `).bind(accountId, existing.id));
    }
  }

  statements.push(env.DB.prepare(`
    UPDATE auth_email_addresses
    SET status = 'replaced',
        replaced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE auth_account_id = ?
      AND realm = 'staff'
      AND status NOT IN ('replaced', 'revoked', 'deleted')
  `).bind(accountId));

  const emailAddressId = createOpaqueId();
  statements.push(env.DB.prepare(`
    INSERT INTO auth_email_addresses (
      id, auth_account_id, realm, normalized_email, normalization_version,
      display_email, status, is_primary, verified_at
    ) VALUES (?, ?, 'staff', ?, 1, ?, 'verified', 1, CURRENT_TIMESTAMP)
  `).bind(emailAddressId, accountId, normalizedEmail, displayEmail));

  statements.push(env.DB.prepare(`
    INSERT INTO admin_users (
      username, password_hash, role, is_active, created_at,
      auth_account_id, username_normalized, is_protected
    ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?, 0)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      role = excluded.role,
      is_active = 1,
      auth_account_id = COALESCE(admin_users.auth_account_id, excluded.auth_account_id)
  `).bind(username, passwordHash, role, accountId, normalizedUsername));

  return statements;
}

async function handleSuperadminToggleAdmin(request, env, session, adminId) {
  const admin = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?").bind(adminId).first();
  if (!admin) return redirectResponse("/admin/superadmin");
  if (admin.username === session?.username) return redirectResponse("/admin/superadmin");
  if (Number(admin.is_protected) === 1) return redirectResponse("/admin/superadmin");

  const activeSuperadminCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM admin_users WHERE role = 'superadmin' AND is_active = 1"
  ).first();

  if (
    admin.role === "superadmin"
    && Number(admin.is_active) === 1
    && Number(activeSuperadminCount?.count || 0) <= 1
    && !env.SUPERADMIN_USERNAME
  ) {
    return redirectResponse("/admin/superadmin");
  }

  const nextActive = Number(admin.is_active) === 1 ? 0 : 1;

  await env.DB.prepare(
    "UPDATE admin_users SET is_active = ? WHERE id = ?"
  ).bind(nextActive, adminId).run();

  await logAdminAction(env, request, session, nextActive ? "admin_activated" : "admin_deactivated", admin.username);
  return redirectResponse("/admin/superadmin");
}

async function handleSuperadminDeleteAdmin(request, env, session, adminId) {
  const admin = await env.DB.prepare("SELECT * FROM admin_users WHERE id = ?").bind(adminId).first();
  if (!admin) return redirectResponse("/admin/superadmin");
  if (admin.username === session?.username) return redirectResponse("/admin/superadmin");
  if (Number(admin.is_protected) === 1) return redirectResponse("/admin/superadmin");

  const activeSuperadminCount = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM admin_users WHERE role = 'superadmin' AND is_active = 1"
  ).first();

  if (
    admin.role === "superadmin"
    && Number(admin.is_active) === 1
    && Number(activeSuperadminCount?.count || 0) <= 1
    && !env.SUPERADMIN_USERNAME
  ) {
    return redirectResponse("/admin/superadmin");
  }

  await env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(adminId).run();
  await logAdminAction(env, request, session, "admin_credential_deleted", admin.username);
  return redirectResponse("/admin/superadmin");
}

async function handleCreateProduct(request, env) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const price = Number(form.get("price") || 0);
  const categoryIdRaw = String(form.get("category_id") || "").trim();
  const categoryId = categoryIdRaw ? Number(categoryIdRaw) : null;

  if (name && price > 0) {
    const inserted = await env.DB.prepare(
      "INSERT INTO products (name, price, category_id, is_active) VALUES (?, ?, ?, 1) RETURNING id"
    ).bind(name, price, categoryId).first();

    if (inserted && inserted.id) {
      await syncAutoAliases(env, inserted.id, name);
    }
  }

  return redirectResponse("/admin/products");
}

async function handleUpdateProduct(request, env, productId) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const price = Number(form.get("price") || 0);
  const aliases = String(form.get("aliases") || "");
  const isActive = form.get("is_active") ? 1 : 0;
  const categoryIdRaw = String(form.get("category_id") || "").trim();
  const categoryId = categoryIdRaw ? Number(categoryIdRaw) : null;

  if (name && price > 0) {
    await env.DB.prepare(
      "UPDATE products SET name = ?, price = ?, category_id = ?, is_active = ? WHERE id = ?"
    ).bind(name, price, categoryId, isActive, productId).run();

    if (aliases.trim()) {
      await replaceManualAliases(env, productId, aliases);
    } else {
      await syncAutoAliases(env, productId, name);
    }
  }

  return redirectResponse("/admin/products/list");
}

async function handleDeleteProduct(env, productId) {
  await env.DB.prepare(
    "DELETE FROM product_aliases WHERE product_id = ?"
  ).bind(productId).run();

  await env.DB.prepare(
    "DELETE FROM products WHERE id = ?"
  ).bind(productId).run();

  return redirectResponse("/admin/products/list");
}

async function handleCreateProductCategory(request, env) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();

  if (name) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO product_categories (name, is_active) VALUES (?, 1)"
    ).bind(name).run();
  }

  return redirectResponse("/admin/products");
}

async function handleUpdateProductCategory(request, env, categoryId) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const isActive = form.get("is_active") ? 1 : 0;

  if (name) {
    await env.DB.prepare(
      "UPDATE product_categories SET name = ?, is_active = ? WHERE id = ?"
    ).bind(name, isActive, categoryId).run();
  }

  return redirectResponse("/admin/product-categories/list");
}

async function handleDeleteProductCategory(env, categoryId) {
  await env.DB.prepare(
    "UPDATE products SET category_id = NULL WHERE category_id = ?"
  ).bind(categoryId).run();

  await env.DB.prepare(
    "DELETE FROM product_categories WHERE id = ?"
  ).bind(categoryId).run();

  return redirectResponse("/admin/product-categories/list");
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

async function handleSetPreferredMeetingPoint(request, env, pointId) {
  const form = await request.formData();
  const requestedValue = String(form.get("is_default") ?? "").trim();

  if (requestedValue !== "0" && requestedValue !== "1") {
    return jsonResponse({ error: "Invalid preferred status" }, 400);
  }

  const point = await env.DB.prepare(
    "SELECT id, name, address, google_maps_link, is_default, is_active FROM meeting_points WHERE id = ?"
  ).bind(pointId).first();

  if (!point) {
    return jsonResponse({ error: "Meeting point not found" }, 404);
  }

  const isDefault = requestedValue === "1";

  if (isDefault) {
    await env.DB.prepare(
      "UPDATE meeting_points SET is_default = 1, is_active = 1 WHERE id = ?"
    ).bind(pointId).run();

    if (Number(point.is_default) !== 1) {
      await notifyCustomersAboutLocationChange(env, {
        ...point,
        is_default: 1,
        is_active: 1
      });
    }
  } else {
    await env.DB.prepare(
      "UPDATE meeting_points SET is_default = 0 WHERE id = ?"
    ).bind(pointId).run();
  }

  return redirectResponse("/admin/meeting-points");
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


async function handleUpdateFulfillmentOptions(request, env) {
  const form = await request.formData();

  await setSetting(
    env,
    "allow_preferred_customer_location",
    form.get("allow_preferred_customer_location") ? "on" : "off"
  );

  await setSetting(
    env,
    "allow_new_customer_location",
    form.get("allow_new_customer_location") ? "on" : "off"
  );

  await setSetting(
    env,
    "allow_customer_pickup",
    form.get("allow_customer_pickup") ? "on" : "off"
  );

  return redirectResponse("/admin");
}

async function handleUpdateDeliveryCities(request, env) {
  const form = await request.formData();
  const raw = String(form.get("allowed_delivery_cities") || "");
  const cities = raw
    .split(",")
    .map((city) => city.trim())
    .filter(Boolean);

  await setAllowedDeliveryCities(env, cities);

  return redirectResponse("/admin");
}

async function handleUpdateAdminLanguage(request, env) {
  const form = await request.formData();
  let language = String(form.get("admin_view_language") || "en");
  if (!SUPPORTED_LANGUAGES.includes(language)) language = "en";
  await setSetting(env, "admin_view_language", language);
  return redirectResponse("/admin");
}

async function handleUpdateAiResponseMode(request, env) {
  const form = await request.formData();
  const mode = String(form.get("ai_response_mode") || "rule_base");
  const customInstructions = String(
    form.get("ai_custom_instructions") || ""
  ).trim();

  if (mode === "ai_fallback") {
    await setSetting(env, "ai_response_mode", "ai_fallback");
  } else {
    await setSetting(env, "ai_response_mode", "rule_base");
  }

  await setSetting(
    env,
    "ai_custom_instructions",
    customInstructions
  );

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

function renderOpenRequestsTable(context, ui = i18nAdmin("en")) {
  const rows = context.openRequests.map((item) => {
    const customer = context.customerMap[item.customer_id];
    const customerLabel = customer
      ? (customer.full_name || customer.username || customer.telegram_user_id)
      : "Unknown";
    const quantity = item.request_type === "product_specific"
      ? (item.quantity || "")
      : item.request_count;

    return `<tr>
      <td>${escapeHtml(customerLabel)}</td>
      <td>${escapeHtml(i18nRequestType(item.request_type || "delivery_location", ui._language))}</td>
      <td>${escapeHtml(item.item_name || "")}</td>
      <td>${escapeHtml(quantity || "")}</td>
      <td>${escapeHtml(item.request_count || "")}</td>
      <td>${escapeHtml(i18nStatus(item.status, ui._language))}</td>
      <td>${escapeHtml(item.latest_text || "")}${item.google_maps_link ? `<br><a href="${escapeHtml(item.google_maps_link)}" target="_blank">${ui.open_map}</a>` : ""}</td>
      <td>${escapeHtml(item.latest_created_at || "")}</td>
      <td>${customer ? `<a href="/admin/customers/${customer.id}"><button type="button" class="request-action-button">${ui.open_customer}</button></a><button type="button" class="request-action-button" onclick="openCustomerMessageModal('${customer.id}', '${escapeHtml(customerLabel)}')">${ui.answer}</button>` : ""}</td>
      <td>
        <form action="/admin/customer-requests/group/done" method="post">
          <input type="hidden" name="customer_id" value="${escapeHtml(item.customer_id)}">
          <input type="hidden" name="request_type" value="${escapeHtml(item.request_type)}">
          <input type="hidden" name="item_name" value="${escapeHtml(item.item_name || "")}">
          <button type="submit">${ui.done}</button>
        </form>
      </td>
    </tr>`;
  }).join("");

  return `<table border="1" cellpadding="10">
    <tr>
      <th>${ui.customer}</th>
      <th>${ui.type}</th>
      <th>${ui.item}</th>
      <th>${ui.quantity}</th>
      <th>${ui.request_count}</th>
      <th>${ui.status}</th>
      <th>${ui.latest_text}</th>
      <th>${ui.latest_created_at}</th>
      <th>${ui.action}</th>
      <th>${ui.done}</th>
    </tr>
    ${rows}
  </table>`;
}

async function handleOpenRequestsPage(env, session = null) {
  const language = await getSetting(env, "admin_view_language") || "en";
  const ui = getAdminUiText(language);
  const table = renderOpenRequestsTable(await getOpenRequestContext(env), ui);

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${ui.open_requests}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<div class="admin-header">
  <h1>${ui.title}</h1>
  <div class="header-actions">
    <form action="/admin/logout" method="post"><button type="submit">${ui.logout}</button></form>
    <a href="/admin/change-password"><button type="button">${ui.change_password}</button></a>
  </div>
</div>
<hr><hr>
${renderOrdersNav(ui, session)}
<hr><hr>

<h2>${ui.open_requests}</h2>
<div class="open-requests-table-actions">
  <form action="/admin/customer-requests/all/done" method="post"><button type="submit">${ui.all_done}</button></form>
</div>
<div id="open-requests-container">${table}</div>

<div
  id="customer-message-modal"
  style="display:none; position:fixed; z-index:99999; inset:0; background:rgba(15,23,42,0.55); padding:24px; box-sizing:border-box;"
>
  <div style="background:white; max-width:720px; margin:40px auto; padding:20px; border-radius:14px; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <h3 id="customer-message-title" style="margin:0;">${ui.message_customer}</h3>
      <button type="button" onclick="closeCustomerMessageModal()">×</button>
    </div>
    <form id="customer-message-form" method="post" style="margin-top:16px;">
      <textarea name="message" rows="6" style="width:100%;" required></textarea>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button type="submit">${ui.send}</button>
        <button type="button" onclick="closeCustomerMessageModal()">${ui.cancel}</button>
      </div>
    </form>
  </div>
</div>

<script>
function openCustomerMessageModal(customerId, customerLabel) {
  const modal = document.getElementById("customer-message-modal");
  const form = document.getElementById("customer-message-form");
  const title = document.getElementById("customer-message-title");
  form.action = "/admin/customers/" + customerId + "/message";
  title.textContent = ${JSON.stringify(ui.message_customer)} + ": " + customerLabel;
  modal.style.display = "block";
}

function closeCustomerMessageModal() {
  const modal = document.getElementById("customer-message-modal");
  const form = document.getElementById("customer-message-form");
  form.reset();
  modal.style.display = "none";
}

async function refreshOpenRequests() {
  const response = await fetch("/admin/open-requests", { credentials: "same-origin" });
  if (!response.ok) return;
  const html = await response.text();
  document.getElementById("open-requests-container").innerHTML = html;
}
setInterval(refreshOpenRequests, 10000);
</script>
</body>
</html>`);
}

async function handleOpenRequestsPartial(env) {
  const ui = getAdminUiText(await getSetting(env, "admin_view_language") || "en");
  return htmlResponse(renderOpenRequestsTable(await getOpenRequestContext(env), ui));
}

async function handleCustomerDetail(env, customerId) {
  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?")
    .bind(customerId)
    .first();

  if (!customer) return redirectResponse("/admin");

  const ui = getAdminUiText(await getSetting(env, "admin_view_language") || "en");

  const messages = await env.DB.prepare(
    "SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC"
  ).bind(customerId).all();

  const requests = await env.DB.prepare(
    "SELECT * FROM customer_requests WHERE customer_id = ? ORDER BY created_at DESC"
  ).bind(customerId).all();

  const locations = await env.DB.prepare(`
    SELECT *
    FROM customer_locations_v2
    WHERE customer_id = ?
       OR session_token = ?
    ORDER BY is_preferred DESC, datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
  `).bind(customerId, getCustomerOrderSessionToken(customerId)).all();

  const requestRows = requests.results.map((item) => `<tr>
    <td>${item.id}</td>
    <td>${escapeHtml(i18nRequestType(item.request_type, ui._language))}</td>
    <td>${escapeHtml(i18nStatus(item.status, ui._language))}</td>
    <td>${escapeHtml(item.description || "")}</td>
    <td>${escapeHtml(item.quantity || "")}</td>
    <td>${escapeHtml(item.description || "")}${item.google_maps_link ? `<br><a href="${escapeHtml(item.google_maps_link)}" target="_blank">${ui.open_map}</a>` : ""}</td>
    <td>${escapeHtml(item.created_at || "")}</td>
    <td>
      <form action="/admin/customer-requests/${item.id}/status" method="post">
        <select name="status">
          <option value="new" ${item.status === "new" ? "selected" : ""}>${ui.new_status}</option>
          <option value="in_progress" ${item.status === "in_progress" ? "selected" : ""}>${ui.in_progress_status}</option>
          <option value="done" ${item.status === "done" ? "selected" : ""}>${ui.done_status}</option>
        </select>
        <button type="submit">${ui.save}</button>
      </form>
    </td>
  </tr>`).join("");

  const locationRows = locations.results.map((item) => {
    const hasLatitude = item.latitude !== null && item.latitude !== undefined && String(item.latitude) !== "";
    const hasLongitude = item.longitude !== null && item.longitude !== undefined && String(item.longitude) !== "";
    const hasCoordinates = hasLatitude && hasLongitude;

    const sourceLabel = item.source === "telegram_location"
      ? (ui.telegram_location || "Telegram location")
      : (item.source === "typed_address" || item.source === "manual_address"
        ? (ui.typed_address || "Typed address")
        : (ui.manual_location || "Manual location"));

    const description = (
      item.label
      || item.address
      || item.google_maps_link
      || ""
    );

    return `<tr>
      <td>${item.id}</td>
      <td>${escapeHtml(i18nRequestType(item.request_type, ui._language))}</td>
      <td>${escapeHtml(description)}</td>
      <td>${escapeHtml(item.latitude || "")}</td>
      <td>${escapeHtml(item.longitude || "")}</td>
      <td>${item.google_maps_link ? `<a href="${escapeHtml(item.google_maps_link)}" target="_blank">${ui.open_map || "Open Map"}</a>` : ""}</td>
      <td>${escapeHtml(sourceLabel)}</td>
      <td>${item.is_preferred ? "Yes" : ""}</td>
      <td>${escapeHtml(item.created_at || "")}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="9">${escapeHtml(ui.no_locations || "No customer locations yet.")}</td></tr>`;

  const messageRows = messages.results.map((message) => `<tr>
    <td>${message.id}</td>
    <td>${escapeHtml(i18nDirection(message.direction, ui._language))}</td>
    <td>${escapeHtml(i18nMessageSource(formatMessageSource(message.message_type, message.direction), ui._language))}</td>
    <td>${escapeHtml(message.content || "")}</td>
    <td>${escapeHtml(message.language || "")}</td>
    <td>${escapeHtml(message.created_at || "")}</td>
  </tr>`).join("");

  return htmlResponse(`<!DOCTYPE html>
<html>
<head>
  <title>${ui.customer_detail}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
<h1>${ui.customer_detail}</h1>
<div class="page-actions">
  <a href="/admin/customers"><button type="button">${ui.customers}</button></a>
  <a href="/admin"><button type="button">${ui.back_to_dashboard}</button></a>
</div>

<h2>${ui.customer}</h2>
<table border="1" cellpadding="8" class="customer-info-grid">
  <tr>
    <th>${ui.id}</th>
    <td>${customer.id}</td>
    <th>Telegram ID</th>
    <td>${escapeHtml(customer.telegram_user_id)}</td>
  </tr>
  <tr>
    <th>${ui.username}</th>
    <td>${escapeHtml(customer.username)}</td>
    <th>${ui.full_name}</th>
    <td>${escapeHtml(customer.full_name)}</td>
  </tr>
  <tr>
    <th>${ui.language}</th>
    <td>${escapeHtml(customer.language)}</td>
    <th>${ui.preferred_language}</th>
    <td>${escapeHtml(customer.preferred_language)}</td>
  </tr>
  <tr>
    <th>${ui.blocked}</th>
    <td>${i18nBoolean(customer.is_blocked, ui._language)}</td>
    <th>${ui.last_seen}</th>
    <td>${escapeHtml(customer.last_seen_at)}</td>
  </tr>
</table>

<h2 id="send-reply">${ui.message_customer || "Message Customer"} - ${escapeHtml(customer.full_name || customer.username || customer.telegram_user_id || "")}</h2>
<form action="/admin/customers/${customer.id}/reply" method="post">
  <textarea name="reply_text" rows="4" cols="80" required></textarea>
  <br><br>
  <button type="submit">${ui.send || "Send"}</button>
</form>

<div class="page-actions customer-detail-tabs">
  <button type="button" id="structured-requests-tab-button" onclick="showCustomerDetailTab('structured-requests')">${ui.structured_requests}</button>
  <button type="button" id="customer-locations-tab-button" onclick="showCustomerDetailTab('customer-locations')">${ui.customer_locations || "Customer Locations"}</button>
  <button type="button" id="conversation-history-tab-button" onclick="showCustomerDetailTab('conversation-history')">${ui.conversation_history}</button>
</div>

<section id="structured-requests-tab">
  <h2>${ui.structured_requests}</h2>
  <table border="1" cellpadding="8">
    <tr><th>${ui.id}</th><th>${ui.type}</th><th>${ui.status}</th><th>${ui.item}</th><th>${ui.quantity}</th><th>${ui.text}</th><th>${ui.created_at}</th><th>${ui.action}</th></tr>
    ${requestRows}
  </table>
</section>

<section id="customer-locations-tab" style="display:none;">
  <h2>${ui.customer_locations || "Customer Locations"}</h2>
  <table border="1" cellpadding="8">
    <tr>
      <th>${ui.id}</th>
      <th>${ui.type}</th>
      <th>${ui.location_description || "Location / Description"}</th>
      <th>${ui.latitude || "Latitude"}</th>
      <th>${ui.longitude || "Longitude"}</th>
      <th>${ui.google_maps || "Google Maps"}</th>
      <th>${ui.source || "Source"}</th>
      <th>${ui.preferred || "Preferred"}</th>
      <th>${ui.created_at}</th>
    </tr>
    ${locationRows}
  </table>
</section>

<section id="conversation-history-tab" style="display:none;">
  <h2>${ui.conversation_history}</h2>
  <table border="1" cellpadding="8">
    <tr><th>${ui.id}</th><th>${ui.direction}</th><th>${ui.source}</th><th>${ui.message}</th><th>${ui.language}</th><th>${ui.created_at}</th></tr>
    ${messageRows}
  </table>
</section>

<script>
function showCustomerDetailTab(tabName) {
  const structuredTab = document.getElementById("structured-requests-tab");
  const locationsTab = document.getElementById("customer-locations-tab");
  const historyTab = document.getElementById("conversation-history-tab");
  const structuredButton = document.getElementById("structured-requests-tab-button");
  const locationsButton = document.getElementById("customer-locations-tab-button");
  const historyButton = document.getElementById("conversation-history-tab-button");

  if (
    !structuredTab
    || !locationsTab
    || !historyTab
    || !structuredButton
    || !locationsButton
    || !historyButton
  ) return;

  const showStructured = tabName === "structured-requests";
  const showLocations = tabName === "customer-locations";
  const showHistory = tabName === "conversation-history";

  structuredTab.style.display = showStructured ? "block" : "none";
  locationsTab.style.display = showLocations ? "block" : "none";
  historyTab.style.display = showHistory ? "block" : "none";

  structuredButton.classList.toggle("active-tab", showStructured);
  locationsButton.classList.toggle("active-tab", showLocations);
  historyButton.classList.toggle("active-tab", showHistory);
}

showCustomerDetailTab("structured-requests");
</script>
</body>
</html>`);
}

async function deleteCustomerData(env, customerId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);

  await env.DB.batch([
    env.DB.prepare(`
      DELETE FROM customer_order_status_history_v2
      WHERE order_id IN (
        SELECT id FROM customer_orders_v2 WHERE session_token = ?
      )
    `).bind(sessionToken),
    env.DB.prepare(`
      DELETE FROM order_addition_groups_v2
      WHERE customer_order_id IN (
        SELECT id FROM customer_orders_v2 WHERE session_token = ?
      )
    `).bind(sessionToken),
    env.DB.prepare(`
      DELETE FROM customer_order_items_v2
      WHERE customer_order_id IN (
        SELECT id FROM customer_orders_v2 WHERE session_token = ?
      )
    `).bind(sessionToken),
    env.DB.prepare(
      "DELETE FROM customer_orders_v2 WHERE session_token = ?"
    ).bind(sessionToken),
    env.DB.prepare(
      "DELETE FROM customer_cart_items_v2 WHERE session_token = ?"
    ).bind(sessionToken),
    env.DB.prepare(
      "DELETE FROM customer_cart_sessions WHERE session_token = ?"
    ).bind(sessionToken),
    env.DB.prepare(`
      DELETE FROM shopping_cart_items
      WHERE cart_id IN (
        SELECT id FROM shopping_carts WHERE customer_id = ?
      )
    `).bind(customerId),
    env.DB.prepare(
      "DELETE FROM shopping_carts WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(`
      DELETE FROM shop_order_parts
      WHERE checkout_id IN (
        SELECT id FROM customer_checkouts WHERE customer_id = ?
      )
    `).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_checkouts WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_app_sessions WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_locations WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_locations_v2 WHERE customer_id = ? OR session_token = ?"
    ).bind(customerId, sessionToken),
    env.DB.prepare(
      "DELETE FROM messages WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_requests WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_shop_memberships WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_payment_methods WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(
      "DELETE FROM customer_preferred_providers WHERE customer_id = ?"
    ).bind(customerId),
    env.DB.prepare(`
      DELETE FROM app_settings
      WHERE key IN (?, ?)
    `).bind(
      `address_search_results_${customerId}`,
      `pending_product_fulfillment_request_${customerId}`
    ),
    env.DB.prepare(
      "DELETE FROM customers WHERE id = ?"
    ).bind(customerId)
  ]);
}

async function handleDeleteCustomer(env, customerId) {
  const customer = await env.DB.prepare(
    "SELECT id FROM customers WHERE id = ?"
  ).bind(customerId).first();

  if (!customer) {
    return redirectResponse("/admin/customers");
  }

  await deleteCustomerData(env, customerId);
  return redirectResponse("/admin/customers");
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

  return redirectResponse("/admin/openrequests/");
}

async function handleMarkAllDone(env) {
  await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE status != 'done'").run();
  return redirectResponse("/admin/openrequests/");
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
<form action="/admin/forgot-password" method="post">
  <label>Username</label><br>
  <input type="text" name="username" required><br><br>
  <button type="submit">Send recovery email</button>
</form>
</body></html>`);
}

async function handleSendForgotPasswordCode(request, env) {
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  if (!username) {
    return handleForgotPasswordPage("Enter a username.", null);
  }

  const recoveryRequest = new Request(
    "https://crm.local/api/v1/admin/auth/recovery/start",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username })
    }
  );

  const response = await handleIdentityApi(recoveryRequest, env);
  if (!response || response.status >= 400) {
    return handleForgotPasswordPage("Recovery email could not be sent.", null);
  }
  return handleForgotPasswordPage(null, "If the account exists, a recovery email has been sent.");
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
  const language = customer.preferred_language || customer.language || "en";

  if (!points.length) {
    const replyText = t("no_active_locations", language);
    await forwardLocationNeeded(env, customer, incomingText);
    await sendTelegramMessage(env, chatId, replyText, getBackToCheckoutKeyboard(language));
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    return;
  }

  if (points.length === 1) {
    const point = points[0];
    const replyText = getOurLocationApprovalPrompt(point, language);
    await sendTelegramMessage(env, chatId, replyText, getMeetingPointApprovalKeyboard(point.id, language));
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    return;
  }

  const replyText = t("choose_location", language);
  await sendTelegramMessage(env, chatId, replyText, getMeetingPointChoiceKeyboard(points));
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
}

async function getTelegramLocationReceivedText(language = "en") {
  const replies = {
    en: "Location received. We will confirm delivery shortly.",
    de: "Standort erhalten. Wir bestätigen die Lieferung in Kürze.",
    tr: "Konum alındı. Teslimatı kısa süre içinde onaylayacağız.",
    ar: "تم استلام الموقع. سنؤكد التوصيل قريباً.",
    ru: "Локация получена. Мы скоро подтвердим доставку."
  };

  return replies[safeLang(language)] || replies.en;
}

async function handleLocationMessage(env, message) {
  const detectedLanguage = "unknown";
  const customer = await upsertCustomer(env, message.from, detectedLanguage);
  const language = customer.preferred_language || customer.language || "en";
  const latitude = String(message.location.latitude);
  const longitude = String(message.location.longitude);
  const googleMapsLink = makeGoogleMapsLink(latitude, longitude);
  const locationLabel = `Telegram shared location: ${latitude}, ${longitude}`;

  const cityValidation = await validateDeliveryLocationAgainstAllowedCities(env, {
    label: locationLabel,
    google_maps_link: googleMapsLink,
    latitude,
    longitude
  });

  if (!cityValidation.ok) {
    const replyText = getUnsupportedCityReply(language, cityValidation.allowed_cities || await getAllowedDeliveryCities(env));
    await saveMessage(env, customer.id, "outgoing", replyText, language);
    await sendTelegramMessage(env, message.chat.id, replyText, getBackToCheckoutKeyboard(language));
    return;
  }

  await saveMessage(env, customer.id, "incoming", googleMapsLink, customer.preferred_language, "telegram_location");

  if (customer.conversation_state === "awaiting_typed_address") {
    const checkout = await submitTelegramV2Checkout(env, customer, "delivery", {
      location_label: locationLabel,
      address: locationLabel,
      google_maps_link: googleMapsLink,
      latitude,
      longitude,
      delivery_note: "telegram_bot_shared_location"
    });

    if (!checkout.ok) {
      await sendTelegramMessage(env, message.chat.id, checkout.message, getBackToCheckoutKeyboard(language));
      return;
    }

    await setCustomerState(env, customer.id, null);

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

    await sendTelegramMessage(
      env,
      message.chat.id,
      getTelegramCheckoutSuccessText(checkout.order, "delivery", language)
    );

    const customerLocationId = Number(checkout.order?.delivery_location_id || 0);
    if (customerLocationId) {
      await sendTelegramMessage(
        env,
        message.chat.id,
        getSetPreferredLocationText(language),
        getSetPreferredLocationKeyboard(customerLocationId)
      );
    }

    return;
  }

  const sessionToken = getCustomerOrderSessionToken(customer.id);
  const location = await createCustomerLocationV2(env, customer.id, sessionToken, {
    label: locationLabel,
    address: locationLabel,
    google_maps_link: googleMapsLink,
    latitude,
    longitude,
    source: "telegram_location"
  });

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

  await sendTelegramMessage(
    env,
    message.chat.id,
    getSetPreferredLocationText(language),
    getSetPreferredLocationKeyboard(location.id)
  );

  const replyText = getTelegramLocationReceivedText(language);
  await sendTelegramMessage(env, message.chat.id, replyText);
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
}


async function getCustomerHistoryForAi(env, customerId) {
  const result = await env.DB.prepare(
    `
    SELECT direction, content, message_type, created_at
    FROM messages
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 20
    `
  ).bind(customerId).all();

  return result.results.reverse();
}

function isOpeningMessage(text) {
  const clean = normalizeText(text);

  const openings = [
    "hello",
    "hi",
    "hey",
    "hey man",
    "naber",
    "nbr",
    "naber arkadas",
    "naber genc",
    "selam",
    "merhaba",
    "nasilsin",
    "nasilsin arkadasim",
    "hallo",
    "servus",
    "moin",
    "salut",
    "salam"
  ];

  return openings.some((opening) => (
    clean === opening
    || clean.startsWith(opening + " ")
  ));
}

function isRandomKeyboardInput(text) {
  const clean = String(text || "").trim();

  if (!clean) return true;

  if (isOpeningMessage(clean)) return false;

  if (clean.length < 2) return true;

  if (/^[^a-zA-Z0-9\u00c0-\u024f\u0600-\u06ff\u0400-\u04ff]+$/.test(clean)) {
    return true;
  }

  if (clean.length >= 8) {
    const letters = clean.replace(/[^a-zA-Z]/g, "");
    const vowels = letters.match(/[aeiouAEIOU]/g) || [];

    if (letters.length >= 8 && vowels.length / letters.length < 0.15) {
      return true;
    }
  }

  return false;
}

function extractOpenAiOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item.content)) {
        continue;
      }

      for (const content of item.content) {
        if (typeof content.text === "string" && content.text.trim()) {
          return content.text.trim();
        }

        if (typeof content.output_text === "string" && content.output_text.trim()) {
          return content.output_text.trim();
        }
      }
    }
  }

  if (
    Array.isArray(data.choices)
    && data.choices[0]
    && data.choices[0].message
    && typeof data.choices[0].message.content === "string"
  ) {
    return data.choices[0].message.content.trim();
  }

  return "";
}


function isAbusiveOrInsult(text) {
  const clean = normalizeText(text);

  const abusiveWords = [
    "salak",
    "aptal",
    "gerizekali",
    "mal",
    "fuck",
    "fucker",
    "idiot",
    "stupid",
    "bitch",
    "asshole",
    "dumb",
    "dumm",
    "arschloch",
    "hurensohn",
    "orospu"
  ];

  return abusiveWords.some((word) => (
    clean === word
    || clean.includes(` ${word} `)
    || clean.startsWith(`${word} `)
    || clean.endsWith(` ${word}`)
  ));
}

function shouldCreatePendingLearnedPattern(incomingText, aiResult) {
  if (!aiResult || aiResult.handled !== true) {
    return false;
  }

  if (!aiResult.reply || !String(aiResult.reply).trim()) {
    return false;
  }

  if (isRandomKeyboardInput(incomingText)) {
    return false;
  }

  if (isAbusiveOrInsult(incomingText)) {
    return false;
  }

  if (isOpeningMessage(incomingText)) {
    return true;
  }

  const intent = String(aiResult.intent || "general_answer");

  if (
    intent === "general_answer"
    || intent === "product_list"
    || intent === "product_specific"
    || intent === "location"
  ) {
    return true;
  }

  return aiResult.learnable === true;
}

async function getAiFallbackReply(env, customer, incomingText, replyLanguage) {
  if (!env.OPENAI_API_KEY) {
    console.log("AI fallback skipped: OPENAI_API_KEY missing");
    return { handled: false, reply: "" };
  }

  if (isRandomKeyboardInput(incomingText)) {
    console.log("AI fallback skipped: random input");
    return { handled: false, reply: "" };
  }

  const products = await getActiveProducts(env);
  const meetingPoints = await getActiveMeetingPoints(env);
  const history = await getCustomerHistoryForAi(env, customer.id);

  const projectContext = {
    app: {
      name: "CRM Delivery",
      runtime: "Cloudflare Worker + D1 + Telegram webhook",
      rule: "local app handles known actions first; OpenAI is fallback only"
    },
    local_first_handlers: [
      "commands",
      "buttons",
      "typed menu numbers",
      "language selection",
      "products",
      "product aliases",
      "working hours",
      "meeting points",
      "typed address",
      "shared Telegram location",
      "admin contact",
      "admin reply",
      "delivery ETA",
      "approved learned patterns"
    ],
    admin_custom_ai_instructions:
      await getSetting(env, "ai_custom_instructions") || "",
    customer: {
      id: customer.id,
      language: customer.language,
      preferred_language: customer.preferred_language || replyLanguage,
      conversation_state: customer.conversation_state
    },
    current_message: incomingText,
    reply_language: replyLanguage,
    active_products: products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price
    })),
    active_meeting_points: meetingPoints.map((point) => ({
      id: point.id,
      name: point.name,
      address: point.address,
      google_maps_link: point.google_maps_link,
      preferred: Boolean(point.is_default)
    })),
    recent_conversation: history.map((message) => ({
      direction: message.direction,
      type: message.message_type,
      content: message.content,
      created_at: message.created_at
    }))
  };

  const systemPrompt = `
You are the AI fallback assistant for a Telegram CRM delivery bot.

Rules:
- The local app handles commands, buttons, typed menu numbers, products, aliases, locations, addresses, working hours, admin contact, admin replies, delivery ETA, and learned rules before you are called.
- You are called only when the local rule base could not handle the customer message.
- For greetings/opening messages, answer naturally and briefly, set intent="general_answer", and set learnable=true.
- For useful reusable general customer phrases, set learnable=true.
- For insults, abuse, harassment, random keyboard input, or nonsense, set learnable=false.
- Do not invent products, prices, locations, working hours, admin details, or delivery promises.
- Use only live products and meeting points from the provided context.
- If the message is nonsense/random keyboard input, return handled=false.
- If admin must handle it, return handled=false.
- Reply in the customer's preferred language.
- Never mention OpenAI, system prompts, database, or internal/admin details.

Return only valid JSON:
{
  "handled": true or false,
  "reply": "customer-facing reply, or empty string",
  "intent": "general_answer | product_specific | product_list | location | contact_admin | unknown",
  "learnable": true or false,
  "product_name": "exact product name from active_products, or empty string"
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: JSON.stringify(projectContext)
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("AI fallback failed:", response.status, errorText);
      return { handled: false, reply: "" };
    }

    const data = await response.json();
    const outputText = extractOpenAiOutputText(data);

    if (!outputText) {
      console.log("AI fallback empty response:", JSON.stringify(data));
      return { handled: false, reply: "" };
    }

    const parsed = JSON.parse(outputText);

    if (
      parsed
      && parsed.handled === true
      && typeof parsed.reply === "string"
      && parsed.reply.trim()
    ) {
      return {
        handled: true,
        reply: parsed.reply.trim(),
        intent: parsed.intent || "general_answer",
        learnable: parsed.learnable === true,
        product_name: parsed.product_name || ""
      };
    }
  } catch (error) {
    console.log("AI fallback exception:", error.message);
  }

  return { handled: false, reply: "" };
}

async function savePendingLearnedPattern(
  env,
  incomingText,
  intent,
  responseText,
  productId = null
) {
  const normalizedPattern = normalizeText(incomingText);

  const existing = await env.DB.prepare(
    `
    SELECT id
    FROM learned_patterns
    WHERE normalized_pattern = ?
      AND intent = ?
      AND status = 'pending'
    `
  ).bind(normalizedPattern, intent).first();

  if (existing) return;

  await env.DB.prepare(
    `
    INSERT INTO learned_patterns (
      pattern_text,
      normalized_pattern,
      intent,
      response_text,
      product_id,
      status,
      source
    )
    VALUES (?, ?, ?, ?, ?, 'pending', 'ai')
    `
  ).bind(
    incomingText,
    normalizedPattern,
    intent,
    responseText,
    productId
  ).run();
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

  if (customer.conversation_state === "awaiting_cart_quantity") {
    const language = customer.preferred_language || customer.language || "en";
    const ui = getCartUiText(language);
    const itemId = await getPendingCartQuantityChange(env, customer.id);
    const quantity = extractQuantity(incomingText);

    if (!itemId) {
      await clearPendingCartQuantityChange(env, customer.id);
      await setCustomerState(env, customer.id, null);
      await sendTelegramMessage(env, message.chat.id, getInvalidProductQuantityText(language));
      return;
    }

    const item = await getCartItemForCustomer(env, customer.id, itemId);

    if (!item) {
      await clearPendingCartQuantityChange(env, customer.id);
      await setCustomerState(env, customer.id, null);
      await sendTelegramMessage(env, message.chat.id, ui.cart_empty);
      return;
    }

    if (!quantity || Number(quantity) < 1) {
      await sendTelegramMessage(env, message.chat.id, getInvalidProductQuantityText(language));
      return;
    }

    const sessionToken = getCustomerOrderSessionToken(customer.id);
    await env.DB.prepare(`
      UPDATE customer_cart_items_v2
      SET quantity = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND session_token = ?
    `).bind(Math.floor(Number(quantity)), itemId, sessionToken).run();

    await clearPendingCartQuantityChange(env, customer.id);
    await setCustomerState(env, customer.id, null);

    await sendTelegramMessage(env, message.chat.id, ui.cart_quantity_updated);
    await sendCartView(env, customer, message.chat.id);
    return;
  }

  if (customer.conversation_state === "awaiting_product_quantity") {
    const language = customer.preferred_language || customer.language || "en";
    const pendingProduct = await getPendingProductQuantity(env, customer.id);
    const quantity = extractQuantity(incomingText);

    if (!pendingProduct || !pendingProduct.product_id) {
      await clearPendingProductQuantity(env, customer.id);
      await setCustomerState(env, customer.id, null);
      const replyText = getInvalidProductQuantityText(language);
      await saveMessage(env, customer.id, "outgoing", replyText, language);
      await sendTelegramMessage(env, message.chat.id, replyText);
      return;
    }

    if (!quantity || Number(quantity) < 1) {
      const replyText = getInvalidProductQuantityText(language);
      await saveMessage(env, customer.id, "outgoing", replyText, language);
      await sendTelegramMessage(env, message.chat.id, replyText);
      return;
    }

    const product = await env.DB.prepare(
      "SELECT id, name, price, is_active FROM products WHERE id = ? AND is_active = 1"
    ).bind(pendingProduct.product_id).first();

    if (!product) {
      await clearPendingProductQuantity(env, customer.id);
      await setCustomerState(env, customer.id, null);
      const replyText = getInvalidProductQuantityText(language);
      await saveMessage(env, customer.id, "outgoing", replyText, language);
      await sendTelegramMessage(env, message.chat.id, replyText);
      return;
    }

    await addProductToTelegramCart(env, customer.id, product, quantity, customer);
    await clearPendingProductQuantity(env, customer.id);
    await setCustomerState(env, customer.id, null);
    await sendAddedToCart(env, customer, message.chat.id, product, quantity);
    return;
  }

  if (
    !["awaiting_product_quantity", "awaiting_cart_quantity", "awaiting_special_request"].includes(customer.conversation_state || "")
    && await handleProductRequestFromText(env, customer, message.chat.id, incomingText, customer.preferred_language || customer.language || "en")
  ) {
    return;
  }

  if (customer.conversation_state === "awaiting_location_description") {
    const language = customer.preferred_language || customer.language || "en";
    const description = incomingText.trim();

    await setCustomerState(env, customer.id, null);
    await setSetting(env, `telegram_v2_pending_location_description_${customer.id}`, description);

    await logCustomerRequest(env, customer.id, "delivery_location", description, null, "location_description", description, null, null, null);
    await forwardUnresolvedMessage(env, customer, `Customer location description: ${description}`);

    const replyText = getLocationDescriptionReceivedText(language);
    await saveMessage(env, customer.id, "outgoing", replyText, language);
    await sendTelegramMessage(env, message.chat.id, replyText);
    return;
  }

  if (customer.conversation_state === "awaiting_typed_address") {
    const language = customer.preferred_language || customer.language || "en";

    if (await handleProductRequestFromText(env, customer, message.chat.id, incomingText, language)) {
      return;
    }

    const allowedCities = await getAllowedDeliveryCities(env);
    const unsupportedCity = detectUnsupportedDeliveryCity(incomingText, allowedCities);

    if (unsupportedCity) {
      const replyText = getUnsupportedCityReply(customer.preferred_language || "en", allowedCities);
      await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
      await sendTelegramMessage(env, message.chat.id, replyText, getAddressNotFoundKeyboard(language));
      return;
    }

    const results = (await searchLocations(env, incomingText)).slice(0, 7);

    if (results.length) {
      await setSetting(env, `address_search_results_${customer.id}`, JSON.stringify(results));
      const replyText = "Please choose the correct location from the list.";
      await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
      await sendTelegramMessage(env, message.chat.id, replyText, getAddressChoicesKeyboard(results));
      return;
    }

    const replyText = t("address_not_found", customer.preferred_language || "en");
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    await sendTelegramMessage(env, message.chat.id, replyText, getAddressNotFoundKeyboard(language));
    return;
  }

  if (customer.conversation_state === "awaiting_special_request") {
    const language = customer.preferred_language || customer.language || "en";
    const ui = getCustomerProductUiText(language);

    await setCustomerState(env, customer.id, null);
    await logCustomerRequest(env, customer.id, "special_product_request", incomingText, 1, "Special request");
    await forwardUnresolvedMessage(env, customer, `Special product request: ${incomingText}`);

    const replyText = ui.special_request_received;
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    await sendTelegramMessage(env, message.chat.id, replyText);
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
    } else if (selectedMenuOption.reply_trigger === "products") {
      await sendProductMenu(env, message.chat.id, replyLanguage);
      return;
    } else {
      replyText = await getRuleBasedReply(env, selectedMenuOption.reply_trigger, replyLanguage);
    }
  }

  if (replyText === null && await isProductListRequestText(incomingText)) {
    await sendProductMenu(env, message.chat.id, replyLanguage);
    return;
  }

  if (replyText === null && await handleProductRequestFromText(env, customer, message.chat.id, incomingText, replyLanguage)) {
    return;
  }

  if (replyText === null && looksLikeAddress(incomingText)) {
    const allowedCities = await getAllowedDeliveryCities(env);
    const unsupportedCity = detectUnsupportedDeliveryCity(incomingText, allowedCities);

    if (unsupportedCity) {
      replyText = getUnsupportedCityReply(customer.preferred_language || "en", allowedCities);
      await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
      await sendTelegramMessage(env, message.chat.id, replyText, getAddressNotFoundKeyboard(language));
      return;
    }

    await setCustomerState(env, customer.id, "awaiting_typed_address");
    const results = (await searchLocations(env, incomingText)).slice(0, 7);

    if (results.length) {
      await setSetting(env, `address_search_results_${customer.id}`, JSON.stringify(results));
      replyText = "Please choose the correct location from the list.";
      await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
      await sendTelegramMessage(env, message.chat.id, replyText, getAddressChoicesKeyboard(results));
      return;
    }

    replyText = t("address_not_found", customer.preferred_language || "en");
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    await sendTelegramMessage(env, message.chat.id, replyText, getAddressNotFoundKeyboard(language));
    return;
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
        await addProductToTelegramCart(env, customer.id, matchedProduct, quantity, customer);
        await sendAddedToCart(env, customer, message.chat.id, matchedProduct, quantity);
        return;
      }
    }
  }

  if (replyText === null && looksLikeAddress(incomingText)) {
    replyText = t("address_not_found", customer.preferred_language || "en");
    await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language);
    await sendTelegramMessage(env, message.chat.id, replyText, getAddressNotFoundKeyboard(language));
    return;
  }

  if (replyText === null) {
    const aiResponseMode = await getSetting(env, "ai_response_mode") || "rule_base";

    if (aiResponseMode === "ai_fallback") {
      const aiResult = await getAiFallbackReply(
        env,
        customer,
        incomingText,
        replyLanguage
      );

      if (aiResult.handled) {
        replyText = aiResult.reply;

        if (shouldCreatePendingLearnedPattern(incomingText, aiResult)) {
          let productId = null;

          if (aiResult.product_name) {
            const product = await env.DB.prepare(
              "SELECT id FROM products WHERE name = ? AND is_active = 1"
            ).bind(aiResult.product_name).first();

            if (product) productId = product.id;
          }

          await savePendingLearnedPattern(
            env,
            incomingText,
            aiResult.intent || "general_answer",
            replyText,
            productId
          );
        }

        await saveMessage(
          env,
          customer.id,
          "outgoing",
          replyText,
          detectedLanguage,
          "ai_reply"
        );

        await sendTelegramMessage(env, message.chat.id, replyText);
        return;
      }
    }

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
    const language = customer.preferred_language || customer.language || "en";

    await setCustomerState(env, customer.id, null);
    await setSetting(env, `pending_product_quantity_${customer.id}`, "");
    await setSetting(env, `pending_cart_quantity_item_${customer.id}`, "");
    await setSetting(env, `pending_product_fulfillment_request_${customer.id}`, "");
    await sendTelegramMessage(
      env,
      message.chat.id,
      "CRM Delivery Bot is running. Choose an option:",
      getMenuKeyboard(language)
    );
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

  if (command === "/o") {
    if (!(await isActiveAdmin(env, message.chat.id))) {
      await sendTelegramMessage(env, message.chat.id, "You are not allowed to view orders.");
      return;
    }
    await sendTelegramAdminOrdersList(env, message.chat.id);
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

async function handlePreferredLocationSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";

  if (callbackQuery.data.startsWith("preferred_location_yes_")) {
    const locationId = Number(callbackQuery.data.replace("preferred_location_yes_", ""));

    if (locationId) {
      await setPreferredCustomerLocation(env, customer.id, locationId);
    }

    await sendTelegramMessage(
      env,
      callbackQuery.message.chat.id,
      getPreferredLocationSavedText(language)
    );
    return;
  }

  if (callbackQuery.data.startsWith("preferred_location_no_")) {
    await sendTelegramMessage(
      env,
      callbackQuery.message.chat.id,
      getPreferredLocationSkippedText(language)
    );
  }
}

async function handleBackToCheckout(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  await sendCheckoutPrompt(env, customer, callbackQuery.message.chat.id);
}

async function handleLocationContactAdmin(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";

  await setCustomerState(env, customer.id, "awaiting_location_description");
  await setSetting(env, `telegram_v2_pending_checkout_${customer.id}`, "location_description");
  await logCustomerRequest(env, customer.id, "location_description_started", "Customer selected contact admin to describe location");
  await forwardUnresolvedMessage(env, customer, "Customer selected: Contact admin to describe location");

  const replyText = getLocationDescriptionPrompt(language);
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText, getBackToCheckoutKeyboard(language));
}

async function handleMeetingPointApproval(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const pointId = Number(callbackQuery.data.replace("meeting_point_approve_", ""));
  const point = await env.DB.prepare("SELECT * FROM meeting_points WHERE id = ? AND is_active = 1").bind(pointId).first();

  if (!point) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, t("no_active_locations", language), getBackToCheckoutKeyboard(language));
    return;
  }

  const locationLabel = point.name || point.address || "Meeting point";
  const checkout = await submitTelegramV2Checkout(env, customer, "delivery", {
    location_label: locationLabel,
    address: point.address || locationLabel,
    google_maps_link: point.google_maps_link || "",
    delivery_note: "telegram_bot_meeting_point_approved"
  });

  if (!checkout.ok) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, checkout.message);
    return;
  }

  await setCustomerState(env, customer.id, null);
  await logCustomerRequest(env, customer.id, "location", "Customer approved delivery at our location", null, point.name, point.address, null, null, point.google_maps_link);

  const replyText = getTelegramCheckoutSuccessText(checkout.order, "delivery", language);
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText);
}

async function handleCancelLocationEntry(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";

  await setCustomerState(env, customer.id, null);
  await setSetting(env, `telegram_v2_pending_checkout_${customer.id}`, "");
  await setSetting(env, `telegram_v2_pending_location_description_${customer.id}`, "");

  const replies = {
    en: "Location entry cancelled. You can now send a product name or choose an option.",
    de: "Standorteingabe abgebrochen. Sie können jetzt einen Produktnamen senden oder eine Option auswählen.",
    tr: "Konum girişi iptal edildi. Şimdi ürün adı gönderebilir veya bir seçenek seçebilirsiniz.",
    ar: "تم إلغاء إدخال الموقع. يمكنك الآن إرسال اسم منتج أو اختيار خيار.",
    ru: "Ввод локации отменён. Теперь вы можете отправить название товара или выбрать вариант."
  };

  await sendTelegramMessage(
    env,
    callbackQuery.message.chat.id,
    replies[safeLang(language)] || replies.en,
    getMenuKeyboard(language)
  );
}

async function handleAddressSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
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
  const latitude = String(selected.latitude || "");
  const longitude = String(selected.longitude || "");
  const googleMapsLink = selected.google_maps_link || (latitude && longitude ? makeGoogleMapsLink(latitude, longitude) : "");
  const locationLabel = selected.address || selected.label || "";

  const checkout = await submitTelegramV2Checkout(env, customer, "delivery", {
    location_label: locationLabel,
    address: locationLabel,
    google_maps_link: googleMapsLink,
    latitude,
    longitude,
    delivery_note: "telegram_bot_typed_address"
  });

  if (!checkout.ok) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, checkout.message, getBackToCheckoutKeyboard(language));
    return;
  }

  await setCustomerState(env, customer.id, null);
  await setSetting(env, `address_search_results_${customer.id}`, "");

  const customerLocationId = Number(checkout.order?.delivery_location_id || 0);
  const pendingProductRequestId = Number(await getSetting(env, `pending_product_fulfillment_request_${customer.id}`) || 0);

  if (pendingProductRequestId) {
    const request = await getCustomerRequest(env, pendingProductRequestId);

    if (request && Number(request.customer_id) === Number(customer.id)) {
      await updateRequestLocation(
        env,
        pendingProductRequestId,
        locationLabel,
        latitude,
        longitude,
        googleMapsLink
      );

      await setSetting(env, `pending_product_fulfillment_request_${customer.id}`, "");

      const updatedRequest = await getCustomerRequest(env, pendingProductRequestId);
      await saveMessage(env, customer.id, "incoming", locationLabel, customer.preferred_language, "typed_address_location");

      await forwardProductRequestWithFulfillment(
        env,
        customer,
        updatedRequest,
        `New customer location: ${locationLabel}`,
        googleMapsLink
      );

      await sendTelegramMessage(
        env,
        callbackQuery.message.chat.id,
        getTelegramCheckoutSuccessText(checkout.order, "delivery", language)
      );

      if (customerLocationId) {
        await sendTelegramMessage(
          env,
          callbackQuery.message.chat.id,
          getSetPreferredLocationText(language),
          getSetPreferredLocationKeyboard(customerLocationId)
        );
      }

      return;
    }
  }

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

  await sendTelegramMessage(
    env,
    callbackQuery.message.chat.id,
    getTelegramCheckoutSuccessText(checkout.order, "delivery", language)
  );

  if (customerLocationId) {
    await sendTelegramMessage(
      env,
      callbackQuery.message.chat.id,
      getSetPreferredLocationText(language),
      getSetPreferredLocationKeyboard(customerLocationId)
    );
  }
}

async function handleMeetingPointSelection(env, callbackQuery) {
  const customer = await upsertCustomer(env, callbackQuery.from);
  const language = customer.preferred_language || customer.language || "en";
  const pointId = Number(callbackQuery.data.replace("meeting_point_select_", ""));
  const point = await env.DB.prepare("SELECT * FROM meeting_points WHERE id = ? AND is_active = 1").bind(pointId).first();

  if (!point) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, t("no_active_locations", language), getBackToCheckoutKeyboard(language));
    return;
  }

  const replyText = getOurLocationApprovalPrompt(point, language);

  await setCustomerState(env, customer.id, "awaiting_typed_address");
  await setSetting(env, `telegram_v2_pending_checkout_${customer.id}`, "meeting_point_selection");
  await saveMessage(env, customer.id, "outgoing", replyText, language);
  await sendTelegramMessage(env, callbackQuery.message.chat.id, replyText, getMeetingPointApprovalKeyboard(point.id, language));
}

async function getTelegramActionableOrders(env) {
  const rows = await env.DB.prepare(`
    SELECT
      o.id,
      o.public_order_code,
      o.session_token,
      o.status,
      o.order_status,
      o.fulfillment_type,
      o.delivery_status,
      o.pickup_status,
      o.delivery_location_label,
      o.delivery_google_maps_link,
      o.delivery_address,
      o.updated_at,
      customers.full_name,
      customers.username,
      customers.telegram_user_id,
      COUNT(i.id) AS item_count,
      COALESCE(
        NULLIF(o.total_amount, 0),
        SUM(
          CASE
            WHEN COALESCE(
              i.status_before_cancel,
              i.item_status,
              'confirmed'
            ) IN (
              'confirmed',
              'approved',
              'waiting_ready_to_pickup',
              'scheduled_for_next_online_order'
            )
            THEN COALESCE(i.line_total, 0)
            ELSE 0
          END
        ),
        0
      ) AS total_amount,
      json_group_array(
        json_object(
          'name', i.product_name,
          'quantity', i.quantity,
          'price_snapshot', i.unit_price
        )
      ) AS items_json
    FROM customer_orders_v2 o
    LEFT JOIN customers ON o.session_token = ('app_customer_' || customers.id)
    LEFT JOIN customer_order_items_v2 i ON i.customer_order_id = o.id
    WHERE COALESCE(o.order_status, o.status, '') NOT IN ('cancelled', 'closed', 'delivered')
      AND (
        o.fulfillment_type = 'delivery'
        OR (
          o.fulfillment_type = 'pickup'
          AND o.pickup_status = 'ready_to_pickup'
        )
      )
    GROUP BY o.id
    HAVING item_count > 0
    ORDER BY
      CASE
        WHEN o.fulfillment_type = 'delivery' AND o.delivery_status = 'on_the_way' THEN 1
        WHEN o.fulfillment_type = 'delivery' THEN 2
        WHEN o.fulfillment_type = 'pickup' AND o.pickup_status = 'ready_to_pickup' THEN 3
        ELSE 4
      END,
      datetime(o.updated_at) DESC,
      o.id DESC
  `).all();

  return rows.results || [];
}

function formatTelegramOrderItems(itemsJson) {
  try {
    const items = JSON.parse(itemsJson || "[]").filter((item) => item.name);
    return items.map((item) => {
      const quantity = Number(item.quantity || 1);
      return `${item.name} x ${quantity}`;
    }).join(", ");
  } catch (error) {
    return "";
  }
}

function formatTelegramAdminOrdersText(orders) {
  if (!orders.length) {
    return "No active V2 delivery or pickup-ready orders.";
  }

  const lines = ["V2 actionable orders:", ""];

  for (const order of orders) {
    const customerLabel = order.full_name || order.username || order.telegram_user_id || "Unknown";
    const itemsText = formatTelegramOrderItems(order.items_json);
    const fulfillment = order.fulfillment_type || "unknown";
    const statusText = fulfillment === "delivery"
      ? `delivery:${order.delivery_status || order.order_status || order.status || ""}`
      : `pickup:${order.pickup_status || order.order_status || order.status || ""}`;
    const publicCode = order.public_order_code ? ` (${order.public_order_code})` : "";

    lines.push(`#${order.id}${publicCode} - ${statusText}`);
    lines.push(`Customer: ${customerLabel}`);
    lines.push(`Items: ${itemsText}`);
    lines.push(`Total: ${formatPrice(order.total_amount || 0)}`);

    if (order.delivery_location_label) {
      lines.push(`Location: ${order.delivery_location_label}`);
    }

    if (order.delivery_google_maps_link) {
      lines.push(`Map: ${order.delivery_google_maps_link}`);
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function getTelegramAdminOrdersKeyboard(orders) {
  if (!orders.length) return null;

  return {
    inline_keyboard: orders.map((order) => [
      {
        text: `Delivered #${order.id}`,
        callback_data: `admin_order_delivered_${order.id}`
      }
    ])
  };
}

async function markTelegramV2OrderDelivered(env, orderId, note = "") {
  const order = await getV2RawOrder(env, orderId);
  if (!order) return null;

  const previousStatus = order.order_status || order.status || null;

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET status = 'delivered',
        order_status = 'delivered',
        delivery_status = CASE
          WHEN fulfillment_type = 'delivery' THEN 'delivered'
          ELSE delivery_status
        END,
        pickup_status = CASE
          WHEN fulfillment_type = 'pickup' THEN 'picked_up'
          ELSE pickup_status
        END,
        admin_status_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(note || null, orderId).run();

  await addV2OrderHistory(
    env,
    orderId,
    previousStatus,
    "delivered",
    { username: "telegram_bot" },
    note || "Marked delivered from Telegram /o"
  );

  const updatedOrder = await getV2RawOrder(env, orderId);
  await closeDeliveryLocationRequestsForV2Order(env, updatedOrder, "done");
  await notifyCustomerForV2Order(env, updatedOrder, getV2OrderDeliveredText(), "order_status");

  return updatedOrder;
}

async function getLatestTelegramV2DeliveryOrderForCustomer(env, customerId) {
  const sessionToken = getCustomerOrderSessionToken(customerId);

  return env.DB.prepare(`
    SELECT *
    FROM customer_orders_v2
    WHERE session_token = ?
      AND fulfillment_type = 'delivery'
      AND COALESCE(order_status, status, '') NOT IN ('cancelled', 'closed', 'delivered', 'not_delivered')
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT 1
  `).bind(sessionToken).first();
}

async function updateTelegramV2DeliveryStatusForCustomer(env, customerId, deliveryStatus, orderStatus = null, note = "") {
  const order = await getLatestTelegramV2DeliveryOrderForCustomer(env, customerId);
  if (!order) return null;

  const previousStatus = order.delivery_status || order.order_status || order.status || null;
  const nextOrderStatus = orderStatus || order.order_status || order.status || "submitted";

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET status = ?,
        order_status = ?,
        delivery_status = ?,
        admin_status_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    nextOrderStatus,
    nextOrderStatus,
    deliveryStatus,
    note || null,
    order.id
  ).run();

  await addV2OrderHistory(
    env,
    order.id,
    previousStatus,
    deliveryStatus,
    { username: "telegram_bot" },
    note || `Telegram delivery status: ${deliveryStatus}`
  );

  return await getV2RawOrder(env, order.id);
}

async function sendTelegramAdminOrdersList(env, chatId) {
  const orders = await getTelegramActionableOrders(env);
  await sendTelegramMessage(
    env,
    chatId,
    formatTelegramAdminOrdersText(orders),
    getTelegramAdminOrdersKeyboard(orders)
  );
}

async function handleAdminOrderDeliveredSelection(env, callbackQuery) {
  if (!(await isActiveAdmin(env, callbackQuery.from.id))) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "You are not allowed to update orders.");
    return;
  }

  const orderId = Number(callbackQuery.data.replace("admin_order_delivered_", ""));
  const updatedOrder = await markTelegramV2OrderDelivered(env, orderId, "Marked delivered from Telegram /o");

  if (!updatedOrder) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "V2 order was not found.");
    return;
  }

  const orders = await getTelegramActionableOrders(env);
  await editMessageReplyMarkup(
    env,
    callbackQuery.message.chat.id,
    callbackQuery.message.message_id,
    getTelegramAdminOrdersKeyboard(orders) || { inline_keyboard: [] }
  );

  await sendTelegramMessage(
    env,
    callbackQuery.message.chat.id,
    formatTelegramAdminOrdersText(orders),
    getTelegramAdminOrdersKeyboard(orders)
  );
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

  await sendProductMenu(env, callbackQuery.message.chat.id, customer.preferred_language || "en");
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

  if (["done", "cancelled"].includes(String(requestRow.status || ""))) {
    await sendTelegramMessage(env, callbackQuery.message.chat.id, "Delivery request is already closed.");
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
  let updatedOrder = null;
  let nextRequestStatus = "in_progress";

  if (etaText === null) {
    etaValue = "No delivery";
    replyText = t("no_delivery", customer.preferred_language || "en");
    nextRequestStatus = "done";

    updatedOrder = await updateTelegramV2DeliveryStatusForCustomer(
      env,
      customer.id,
      "not_delivered",
      "not_delivered",
      "Telegram admin selected no delivery"
    );
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

    updatedOrder = await updateTelegramV2DeliveryStatusForCustomer(
      env,
      customer.id,
      "on_the_way",
      null,
      `Telegram ETA: ${etaText}`
    );
  }

  if (!updatedOrder) {
    await env.DB.prepare("UPDATE customer_requests SET status = 'cancelled' WHERE id = ?")
      .bind(requestId)
      .run();

    await sendTelegramMessage(env, callbackQuery.message.chat.id, "No active V2 delivery order found for this customer. Delivery request was closed.");
    return;
  }

  await env.DB.prepare("UPDATE customer_requests SET status = ? WHERE id = ?")
    .bind(nextRequestStatus, requestId)
    .run();

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

  if (callbackQuery.data === "noop") return;
  if (callbackQuery.data.startsWith("cart_")) return handleCartSelection(env, callbackQuery);
  if (callbackQuery.data === "checkout_pickup") return handleTelegramPickupCheckout(env, callbackQuery);
  if (callbackQuery.data === "checkout_type_address") return handleTelegramTypeAddressCheckout(env, callbackQuery);
  if (callbackQuery.data === "checkout_preferred_location") return handleTelegramPreferredLocationCheckout(env, callbackQuery);
  if (callbackQuery.data === "checkout_saved_locations") return handleTelegramSavedLocationsCheckout(env, callbackQuery);
  if (callbackQuery.data.startsWith("checkout_saved_location_")) return handleTelegramSavedLocationCheckout(env, callbackQuery);
  if (callbackQuery.data.startsWith("product_fulfillment_")) return handleProductFulfillmentSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("product_")) return handleProductMenuSelection(env, callbackQuery);
  if (callbackQuery.data === "location_contact_admin") return handleLocationContactAdmin(env, callbackQuery);
  if (callbackQuery.data === "location_cancel") return handleCancelLocationEntry(env, callbackQuery);
  if (callbackQuery.data === "location_back_checkout") return handleBackToCheckout(env, callbackQuery);
  if (callbackQuery.data.startsWith("meeting_point_approve_")) return handleMeetingPointApproval(env, callbackQuery);
  if (callbackQuery.data.startsWith("preferred_location_")) return handlePreferredLocationSelection(env, callbackQuery);
  if (callbackQuery.data === "location_show_meeting_points") {
    const customer = await upsertCustomer(env, callbackQuery.from);
    return sendMeetingPointChoiceOrDirect(env, customer, callbackQuery.message.chat.id, "Customer selected see our locations during checkout");
  }
  if (callbackQuery.data === "cancel_location_entry") return handleCancelLocationEntry(env, callbackQuery);
  if (callbackQuery.data.startsWith("address_select_")) return handleAddressSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("meeting_point_select_")) return handleMeetingPointSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("delivery_")) return handleDeliveryEtaSelection(env, callbackQuery);
  if (callbackQuery.data.startsWith("admin_order_delivered_")) return handleAdminOrderDeliveredSelection(env, callbackQuery);
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


const API_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-customer-session-token",
  "access-control-max-age": "86400"
};

function apiCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: API_CORS_HEADERS
  });
}

function apiResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...API_CORS_HEADERS
    }
  });
}

function apiOk(data = {}, status = 200) {
  return apiResponse({ ok: true, ...data }, status);
}


async function handlePublicShopsApi(env) {
  const result = await env.DB.prepare(`
    SELECT
      s.id,
      s.name,
      s.slug,
      s.description,
      s.address,
      s.google_maps_link,
      s.phone,
      s.is_active,
      GROUP_CONCAT(
        CASE
          WHEN spm.is_enabled = 1 AND pm.is_active = 1
          THEN pm.code || ':' || pm.name
        END,
        '|'
      ) AS payment_methods
    FROM shops s
    LEFT JOIN shop_payment_methods spm ON spm.shop_id = s.id
    LEFT JOIN payment_methods pm ON pm.code = spm.payment_method_code
    WHERE s.is_active = 1
    GROUP BY s.id
    ORDER BY s.name ASC
  `).all();

  const shops = (result.results || []).map((shop) => ({
    id: Number(shop.id),
    name: shop.name || "",
    slug: shop.slug || "",
    description: shop.description || "",
    address: shop.address || "",
    google_maps_link: shop.google_maps_link || "",
    phone: shop.phone || "",
    is_active: Number(shop.is_active || 0) === 1,
    payment_methods: String(shop.payment_methods || "")
      .split("|")
      .filter(Boolean)
      .map((item) => {
        const [code, ...nameParts] = item.split(":");
        return {
          code,
          name: nameParts.join(":")
        };
      })
  }));

  return jsonResponse({ shops });
}

async function handlePublicPaymentMethodsApi(env) {
  const result = await env.DB.prepare(`
    SELECT code, name, is_active
    FROM payment_methods
    WHERE is_active = 1
    ORDER BY id ASC
  `).all();

  return jsonResponse({
    payment_methods: (result.results || []).map((method) => ({
      code: method.code || "",
      name: method.name || "",
      is_active: Number(method.is_active || 0) === 1
    }))
  });
}

function apiError(code, message, status = 400, details = null) {
  const body = {
    ok: false,
    error: {
      code,
      message
    }
  };

  if (details !== null) body.error.details = details;

  return apiResponse(body, status);
}

async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function getApiAdminSession(request, env) {
  const token = getBearerToken(request) || parseCookies(request)[ADMIN_COOKIE_NAME];
  const payload = await verifyAdminToken(env, token);

  if (!payload) return null;

  return {
    username: payload.sub,
    role: payload.role || "admin",
    is_superadmin: payload.is_superadmin === true
  };
}

function getApiCapabilities(env) {
  return {
    app_name: APP_CAPABILITIES.app_name,
    runtime: APP_CAPABILITIES.runtime,
    api_version: "v1",
    supported_languages: SUPPORTED_LANGUAGES,
    clients: [
      "telegram_bot",
      "admin_web",
      "admin_android_app",
      "customer_android_app"
    ],
    routes: {
      health: "/api/v1/health",
      capabilities: "/api/v1/capabilities",
      admin_login: "/api/v1/admin/login",
      admin_logout: "/api/v1/admin/logout",
      admin_change_password: "/api/v1/admin/password",
      admin_me: "/api/v1/admin/me",
      admin_dashboard: "/api/v1/admin/dashboard",
      admin_orders: "/api/v1/admin/orders",
      admin_closed_orders: "/api/v1/admin/closed-orders",
      admin_order_status: "/api/v1/admin/orders/{order_id}/status",
      admin_order_delivered: "/api/v1/admin/orders/{order_id}/delivered",
      admin_order_return: "/api/v1/admin/orders/{order_id}/return",
      admin_open_requests: "/api/v1/admin/open-requests",
      admin_products: "/api/v1/admin/products",
      admin_product_categories: "/api/v1/admin/product-categories",
      admin_meeting_points: "/api/v1/admin/meeting-points",
      admin_customers: "/api/v1/admin/customers",
      admin_settings: "/api/v1/admin/settings"
    },
    public: {
      catalog: "/api/v1/public/catalog",
      meeting_points: "/api/v1/public/meeting-points"
    },
    customer: {
      session_start: "/api/v1/customer/session/start",
      session_verify: "/api/v1/customer/session/verify",
      session_logout: "/api/v1/customer/session/logout",
      me: "/api/v1/customer/me",
      update_profile: "/api/v1/customer/me",
      locations: "/api/v1/customer/locations",
      cart: "/api/v1/customer/cart",
      cart_items: "/api/v1/customer/cart/items",
      checkout_address: "/api/v1/customer/checkout/address",
      checkout_pickup: "/api/v1/customer/checkout/pickup",
      orders: "/api/v1/customer/orders"
    },
    production_rules: {
      telegram_webhook_unchanged: "/telegram/webhook",
      shared_backend: true,
      shared_database: true,
      android_separate_webhook: false,
      android_separate_database: false
    },
    identity: getIdentityCapabilities(env),
    roadmap_stage: "phase_1_api_foundation"
  };
}

async function handleApiAdminLogin(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !password) {
    return apiError("missing_credentials", "Username and password are required.", 400);
  }

  const auth = await authenticateAdmin(env, username, password);

  if (!auth) {
    await logAdminAction(env, request, { username, role: "" }, "api_admin_login_failed", username);
    return apiError("invalid_credentials", "Invalid username or password.", 401);
  }

  await cleanupOldAdminAuditLogs(env);
  await logAdminAction(env, request, auth, "api_admin_login_success", auth.source || "");

  const token = await createAdminToken(env, auth.username, auth.role);

  return apiOk({
    token_type: "Bearer",
    access_token: token,
    expires_in: 43200,
    admin: {
      username: auth.username,
      role: auth.role || "admin",
      is_superadmin: auth.is_superadmin === true
    }
  });
}


async function handleApiAdminLogout(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const token = getBearerToken(request) || parseCookies(request)[ADMIN_COOKIE_NAME];

  if (!token) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const payload = await verifyAdminToken(env, token);

  if (!payload) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  await revokeAdminToken(env, token, payload.sub || "", payload.exp ? new Date(payload.exp * 1000).toISOString() : null);

  return apiOk({
    logged_out: true
  });
}



// ADMIN_SUPERADMIN_API_V1
function mapApiManagedAdmin(admin) {
  const parsedId = Number(admin?.id);
  return {
    id: Number.isFinite(parsedId) ? parsedId : null,
    username: String(admin?.username || ""),
    email: String(admin?.email || ""),
    role: String(admin?.role || "admin"),
    is_active: Number(admin?.is_active) === 1,
    source: String(admin?.source || ""),
    created_at: String(admin?.created_at || ""),
    last_login_at: String(admin?.last_login_at || ""),
    protected:
      admin?.protected === true ||
      Number(admin?.is_protected) === 1
  };
}

function mapApiAdminAuditLog(row) {
  return {
    id: Number(row?.id || 0),
    username: String(row?.admin_username || ""),
    role: String(row?.admin_role || ""),
    action_type: String(row?.action_type || ""),
    action_detail: String(row?.action_detail || ""),
    method: String(row?.method || ""),
    path: String(row?.path || ""),
    ip: String(row?.ip || ""),
    user_agent: String(row?.user_agent || ""),
    created_at: String(row?.created_at || "")
  };
}

async function buildApiSuperadminOverview(env, session) {
  const [admins, auditLogs] = await Promise.all([
    getAdminUsersForSuperadmin(env),
    getAdminAuditLogs(env)
  ]);

  return {
    current_admin: {
      username: String(session.username || ""),
      role: String(session.role || ""),
      is_superadmin: true
    },
    admins: admins.map(mapApiManagedAdmin),
    audit_logs: auditLogs.map(mapApiAdminAuditLog)
  };
}

async function requireApiSuperadmin(request, env) {
  const session = await getApiAdminSession(request, env);
  if (!session) {
    return {
      response: apiError(
        "authentication_required",
        "Authentication is required.",
        401
      )
    };
  }

  if (!session.is_superadmin) {
    return {
      response: apiError(
        "superadmin_required",
        "Superadmin access is required.",
        403
      )
    };
  }

  return { session };
}

async function handleApiAdminSuperadminOverview(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const auth = await requireApiSuperadmin(request, env);
  if (auth.response) return auth.response;

  return apiOk({
    ok: true,
    ...(await buildApiSuperadminOverview(env, auth.session))
  });
}

async function handleApiAdminSuperadminCreate(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const auth = await requireApiSuperadmin(request, env);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const username = String(body?.username || "").trim();
  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");
  const role = String(body?.role || "admin").trim().toLowerCase();

  if (!username || !email || !password) {
    return apiError(
      "invalid_request",
      "Username, email address and password are required.",
      400
    );
  }

  if (!["admin", "superadmin"].includes(role)) {
    return apiError("invalid_role", "Role must be admin or superadmin.", 400);
  }

  if (password.length < 8) {
    return apiError(
      "weak_password",
      "Password must contain at least 8 characters.",
      400
    );
  }

  const normalizedUsername = username.toLowerCase();
  const before = await env.DB.prepare(
    "SELECT id FROM admin_users WHERE username_normalized = ? LIMIT 1"
  ).bind(normalizedUsername).first();

  if (before) {
    return apiError(
      "username_exists",
      "An administrator with this username already exists.",
      409
    );
  }

  const form = new FormData();
  form.set("username", username);
  form.set("email", email);
  form.set("password", password);
  form.set("role", role);

  const headers = new Headers(request.headers);
  headers.delete("content-type");
  headers.delete("content-length");

  const forwarded = new Request(request.url, {
    method: "POST",
    headers,
    body: form
  });

  await handleSuperadminCreateAdmin(
    forwarded,
    env,
    auth.session
  );

  const created = await env.DB.prepare(
    "SELECT id FROM admin_users WHERE username_normalized = ? LIMIT 1"
  ).bind(normalizedUsername).first();

  if (!created) {
    return apiError(
      "admin_create_failed",
      "The administrator could not be created.",
      409
    );
  }

  return apiOk({
    ok: true,
    ...(await buildApiSuperadminOverview(env, auth.session))
  });
}

async function handleApiAdminSuperadminToggle(request, env, adminId) {
  if (!["POST", "PATCH"].includes(request.method)) {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const auth = await requireApiSuperadmin(request, env);
  if (auth.response) return auth.response;

  const numericId = Number(adminId);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return apiError("invalid_admin_id", "Invalid administrator ID.", 400);
  }

  const before = await env.DB.prepare(
    "SELECT id, is_active FROM admin_users WHERE id = ? LIMIT 1"
  ).bind(numericId).first();

  if (!before) {
    return apiError("admin_not_found", "Administrator not found.", 404);
  }

  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers
  });

  await handleSuperadminToggleAdmin(
    forwarded,
    env,
    auth.session,
    numericId
  );

  const after = await env.DB.prepare(
    "SELECT id, is_active FROM admin_users WHERE id = ? LIMIT 1"
  ).bind(numericId).first();

  if (!after || Number(after.is_active) === Number(before.is_active)) {
    return apiError(
      "admin_toggle_rejected",
      "The administrator access state could not be changed.",
      409
    );
  }

  return apiOk({
    ok: true,
    ...(await buildApiSuperadminOverview(env, auth.session))
  });
}

async function handleApiAdminSuperadminDelete(request, env, adminId) {
  if (request.method !== "DELETE") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const auth = await requireApiSuperadmin(request, env);
  if (auth.response) return auth.response;

  const numericId = Number(adminId);
  if (!Number.isInteger(numericId) || numericId < 1) {
    return apiError("invalid_admin_id", "Invalid administrator ID.", 400);
  }

  const before = await env.DB.prepare(
    "SELECT id FROM admin_users WHERE id = ? LIMIT 1"
  ).bind(numericId).first();

  if (!before) {
    return apiError("admin_not_found", "Administrator not found.", 404);
  }

  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers
  });

  await handleSuperadminDeleteAdmin(
    forwarded,
    env,
    auth.session,
    numericId
  );

  const after = await env.DB.prepare(
    "SELECT id FROM admin_users WHERE id = ? LIMIT 1"
  ).bind(numericId).first();

  if (after) {
    return apiError(
      "admin_delete_rejected",
      "The administrator credential could not be deleted.",
      409
    );
  }

  return apiOk({
    ok: true,
    ...(await buildApiSuperadminOverview(env, auth.session))
  });
}

async function handleApiAdminPasswordChange(request, env) {
  if (request.method !== "POST" && request.method !== "PATCH" && request.method !== "PUT") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const token = getBearerToken(request) || parseCookies(request)[ADMIN_COOKIE_NAME];
  const session = await getApiAdminSession(request, env);

  if (!session || !token) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");
  const confirmPassword = body.confirm_password === undefined ? newPassword : String(body.confirm_password || "");

  if (!currentPassword || !newPassword) {
    return apiError("missing_password", "Current password and new password are required.", 400);
  }

  if (newPassword !== confirmPassword) {
    return apiError("password_mismatch", "New password and confirmation do not match.", 400);
  }

  if (newPassword.length < 8) {
    return apiError("weak_password", "New password must be at least 8 characters.", 400);
  }

  const auth = await authenticateAdmin(env, session.username, currentPassword);

  if (!auth) {
    await logAdminAction(env, request, session, "api_admin_password_change_failed", "wrong_current_password");
    return apiError("invalid_current_password", "Current password is incorrect.", 401);
  }

  if (session.username === env.ADMIN_USERNAME) {
    await setSetting(env, "admin_password_override", newPassword);
  } else if (env.SUPERADMIN_USERNAME && session.username === env.SUPERADMIN_USERNAME) {
    await setSetting(env, "superadmin_password_override", newPassword);
  } else {
    const result = await env.DB.prepare(
      "UPDATE admin_users SET password_hash = ? WHERE username = ? AND is_active = 1"
    ).bind(await hashAdminPassword(env, newPassword), session.username).run();

    if (Number(result.meta?.changes || 0) === 0) {
      return apiError("admin_not_found", "Active admin user was not found.", 404);
    }
  }

  await revokeAdminToken(env, token, session.username, null);
  await logAdminAction(env, request, session, "api_admin_password_changed", session.username);

  return apiOk({
    password_changed: true,
    current_token_revoked: true,
    login_required: true
  });
}


async function handleApiAdminMe(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await getApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  return apiOk({
    admin: {
      username: session.username,
      role: session.role || "admin",
      is_superadmin: session.is_superadmin === true
    }
  });
}


function parseApiJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.name) : [];
  } catch {
    return [];
  }
}

function mapOrderForApi(order) {
  const items = parseApiJsonArray(order.items_json).map((item) => {
    const quantity = Number(item.quantity || 1);
    const priceSnapshot = item.price_snapshot === null || item.price_snapshot === undefined
      ? null
      : Number(item.price_snapshot);

    return {
      id: item.id === null || item.id === undefined ? null : Number(item.id),
      name: item.name || "",
      quantity,
      price_snapshot: priceSnapshot,
      line_total: priceSnapshot === null ? null : priceSnapshot * quantity
    };
  });

  return {
    id: Number(order.id),
    customer_id: Number(order.customer_id),
    status: order.status || "",
    order_status: order.order_status || "in_progress",
    order_status_label: getOrderStatusLabel(order.order_status || "in_progress"),
    delivery_location_label: order.delivery_location_label || "",
    delivery_google_maps_link: order.delivery_google_maps_link || "",
    delivery_note: order.delivery_note || "",
    delivered_at: order.delivered_at || null,
    closed_at: order.closed_at || null,
    admin_status_note: order.admin_status_note || "",
    created_at: order.created_at || "",
    updated_at: order.updated_at || "",
    customer: {
      full_name: order.full_name || "",
      username: order.username || "",
      telegram_user_id: order.telegram_user_id || "",
      preferred_language: order.preferred_language || ""
    },
    item_count: Number(order.item_count || items.length || 0),
    total_amount: Number(order.total_amount || 0),
    total_amount_formatted: formatPrice(order.total_amount || 0),
    items
  };
}

function mapOpenRequestForApi(item, customerMap) {
  const customer = customerMap[item.customer_id] || null;

  return {
    customer_id: Number(item.customer_id),
    request_type: item.request_type || "",
    request_type_label: i18nRequestType(item.request_type || "", "en"),
    item_name: item.item_name || "",
    quantity: item.quantity === null || item.quantity === undefined ? null : Number(item.quantity || 0),
    request_count: Number(item.request_count || 0),
    status: item.status || "",
    latest_text: item.latest_text || "",
    latest_created_at: item.latest_created_at || "",
    google_maps_link: item.google_maps_link || "",
    customer: customer ? {
      id: Number(customer.id),
      full_name: customer.full_name || "",
      username: customer.username || "",
      telegram_user_id: customer.telegram_user_id || "",
      language: customer.language || "",
      preferred_language: customer.preferred_language || "",
      last_seen_at: customer.last_seen_at || ""
    } : null
  };
}

async function requireApiAdminSession(request, env) {
  const session = await getApiAdminSession(request, env);
  return session || null;
}


async function handleApiAdminDashboard(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const [
    openOrders,
    closedOrders,
    openRequestContext,
    activeCustomersRow,
    activeProductsRow,
    activeMeetingPointsRow
  ] = await Promise.all([
    getOrdersContext(env, false),
    getOrdersContext(env, true),
    getOpenRequestContext(env),
    env.DB.prepare("SELECT COUNT(*) AS count FROM customers").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active = 1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM meeting_points WHERE is_active = 1").first()
  ]);

  const latestOrders = openOrders.slice(0, 5).map(mapOrderForApi);
  const latestRequests = openRequestContext.openRequests.slice(0, 5).map((item) =>
    mapOpenRequestForApi(item, openRequestContext.customerMap)
  );

  return apiOk({
    summary: {
      open_orders_count: openOrders.length,
      closed_orders_count: closedOrders.length,
      open_requests_count: openRequestContext.openRequests.length,
      active_customers_count: Number(activeCustomersRow?.count || 0),
      active_products_count: Number(activeProductsRow?.count || 0),
      active_meeting_points_count: Number(activeMeetingPointsRow?.count || 0)
    },
    latest_orders: latestOrders,
    latest_requests: latestRequests
  });
}


async function handleApiAdminOrders(request, env, closed = false) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const orders = await getOrdersContext(env, closed);

  return apiOk({
    orders: orders.map(mapOrderForApi),
    count: orders.length,
    closed
  });
}

async function getV2AdminOrders(env, orderId = null) {
  const whereOrder = orderId ? "WHERE o.id = ?" : "";
  const stmt = env.DB.prepare(`
    SELECT
      o.*,
      (
        SELECT successor.id
        FROM customer_orders_v2 successor
        WHERE successor.recreated_from_order_id = o.id
          AND COALESCE(
            successor.order_status,
            successor.status,
            ''
          ) NOT IN ('cancelled', 'closed', 'delivered')
        ORDER BY
          datetime(successor.updated_at) DESC,
          successor.id DESC
        LIMIT 1
      ) AS active_recreated_order_id,
      (
        SELECT COUNT(*)
        FROM customer_orders_v2 successor
        WHERE successor.recreated_from_order_id = o.id
      ) AS recreated_order_count,
      c.id AS customer_id,
      c.full_name AS customer_full_name,
      c.username AS customer_username,
      c.telegram_user_id AS customer_telegram_user_id,
      c.preferred_language AS customer_preferred_language,
      c.language AS customer_language
    FROM customer_orders_v2 o
    LEFT JOIN customers c ON o.session_token = ('app_customer_' || c.id)
    ${whereOrder}
    ORDER BY datetime(o.updated_at) DESC, o.id DESC
    LIMIT 300
  `);

  const result = orderId ? await stmt.bind(orderId).all() : await stmt.all();
  const orders = [];

  for (const order of result.results || []) {
    orders.push(await mapV2OrderForApi(env, order));
  }

  return orders;
}

async function getV2AdminOrder(env, orderId) {
  const orders = await getV2AdminOrders(env, orderId);
  return orders[0] || null;
}

async function getV2RawOrder(env, orderId) {
  return await env.DB.prepare("SELECT * FROM customer_orders_v2 WHERE id = ?")
    .bind(orderId)
    .first();
}

async function getV2RawGroup(env, groupId, orderId = null) {
  if (orderId) {
    return await env.DB.prepare(`
      SELECT *
      FROM order_addition_groups_v2
      WHERE id = ? AND customer_order_id = ?
    `).bind(groupId, orderId).first();
  }

  return await env.DB.prepare("SELECT * FROM order_addition_groups_v2 WHERE id = ?")
    .bind(groupId)
    .first();
}

async function addV2OrderHistory(env, orderId, previousStatus, newStatus, session, note = "") {
  await env.DB.prepare(`
    INSERT INTO customer_order_status_history_v2 (
      order_id,
      previous_status,
      new_status,
      changed_by_admin_id,
      changed_by_admin_username,
      note,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderId,
    previousStatus || null,
    newStatus,
    session.admin?.id || session.id || null,
    session.admin?.username || session.username || null,
    note || null,
    new Date().toISOString()
  ).run();
}

async function getCustomerForV2Order(env, order) {
  const sessionToken = String(order?.session_token || "");
  const appCustomerMatch = sessionToken.match(/^app_customer_(\d+)$/);

  if (appCustomerMatch) {
    return await env.DB.prepare("SELECT * FROM customers WHERE id = ?")
      .bind(Number(appCustomerMatch[1]))
      .first();
  }

  return null;
}

async function notifyCustomerForV2Order(env, order, text, messageType = "order_status") {
  const customer = await getCustomerForV2Order(env, order);

  if (!customer) return;

  const language = customer.preferred_language || customer.language || "en";
  await saveMessage(env, customer.id, "outgoing", text, language, messageType, "telegram");

  if (customer.telegram_user_id) {
    await sendTelegramMessage(env, customer.telegram_user_id, text);
  }
}


function getV2OrderNotDeliveredText() {
  return "Your order could not be delivered.";
}

function getV2OrderDeliveredText() {
  return "Your order has been delivered.";
}
function getV2OrderCancelledText(reason = "") {
  const suffix = reason ? `\nReason: ${reason}` : "";
  return `Your order was cancelled by admin.${suffix}`;
}

function getV2DeliveryOnTheWayText() {
  return "Your order is on the way.";
}

function getV2PickupReadyText() {
  return "Your order is ready to pick up.";
}

function getV2DeliveryAdditionApprovedText() {
  return "Your additional products were approved and added to your order.";
}

function getV2DeliveryAdditionRejectedText() {
  return "Your additional products were rejected. Do you want to create a new order with these items?";
}

async function handleApiAdminCustomerAppOrderDetail(request, env, orderId) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const order = await getV2AdminOrder(env, orderId);
  if (!order) {
    return apiError("not_found", "Customer app order not found.", 404);
  }

  return apiOk({ order });
}

async function handleApiAdminCustomerAppOrders(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const orders = await getV2AdminOrders(env);

  return apiOk({
    orders,
    count: orders.length
  });
}

async function handleApiAdminCustomerAppOrderStatus(request, env, orderId) {
  if (request.method !== "PATCH" && request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const status = String(body.status || body.order_status || "").trim();
  const note = String(body.note || body.admin_status_note || "").trim();

  const allowedStatuses = new Set([
    "submitted",
    "preparing",
    "scheduled_for_next_online_order",
    "cancelled",
    "closed"
  ]);

  if (!allowedStatuses.has(status)) {
    return apiError("invalid_status", "Invalid order status.", 400, {
      allowed_statuses: Array.from(allowedStatuses)
    });
  }

  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    return apiError("not_found", "Customer app order not found.", 404);
  }

  const previousStatus = order.order_status || order.status || null;

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET status = ?,
        order_status = ?,
        admin_status_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, status, note || null, orderId).run();

  await addV2OrderHistory(env, orderId, previousStatus, status, session, note);
  await logAdminAction(env, request, session, "api_v2_order_status_updated", `order:${orderId}:${status}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

async function handleApiAdminV2DeliveryOnTheWay(request, env, orderId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  if (order.fulfillment_type !== "delivery") {
    return apiError("not_delivery_order", "Only delivery orders can be marked on the way.", 400);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_cancelled", "Cancelled orders cannot be marked on the way.", 400);
  }

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET delivery_status = 'on_the_way',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(orderId).run();

  await addV2OrderHistory(env, orderId, order.delivery_status || null, "delivery:on_the_way", session, "Delivery marked on the way");
  await notifyCustomerForV2Order(env, order, getV2DeliveryOnTheWayText(), "order_status");
  await logAdminAction(env, request, session, "api_v2_order_on_the_way", `order:${orderId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

async function handleApiAdminV2ReadyToPickup(request, env, orderId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  if (order.fulfillment_type !== "pickup") {
    return apiError("not_pickup_order", "Only pickup orders can be marked ready to pick up.", 400);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_cancelled", "Cancelled orders cannot be marked ready to pick up.", 400);
  }

  await env.DB.prepare(`
    UPDATE order_addition_groups_v2
    SET group_status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
    WHERE customer_order_id = ?
      AND group_status = 'waiting_ready_to_pickup'
  `).bind(orderId).run();

  await env.DB.prepare(`
    UPDATE customer_order_items_v2
    SET item_status = 'confirmed',
        decided_at = CURRENT_TIMESTAMP
    WHERE customer_order_id = ?
      AND item_status = 'waiting_ready_to_pickup'
  `).bind(orderId).run();

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET pickup_status = 'ready_to_pickup',
        order_status = CASE
          WHEN order_status = 'draft' THEN 'submitted'
          ELSE order_status
        END,
        status = CASE
          WHEN status = 'draft' THEN 'submitted'
          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(orderId).run();

  await updateV2OrderConfirmedTotal(env, orderId);
  await addV2OrderHistory(env, orderId, order.pickup_status || null, "pickup:ready_to_pickup", session, "Pickup marked ready");
  await notifyCustomerForV2Order(env, order, getV2PickupReadyText(), "order_status");
  await logAdminAction(env, request, session, "api_v2_order_ready_to_pickup", `order:${orderId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

async function handleApiAdminV2OrderDelivered(request, env, orderId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const note = String(body.note || body.admin_status_note || "").trim();

  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_cancelled", "Cancelled orders cannot be marked delivered.", 400);
  }

  await updateOrderStatusByAdmin(env, orderId, "delivered", note || "Marked delivered from admin API");
  await logAdminAction(env, request, session, "api_v2_order_delivered", `order:${orderId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

async function handleApiAdminV2OrderNotDelivered(request, env, orderId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const note = String(body.note || body.admin_status_note || body.reason || "").trim();

  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_cancelled", "Cancelled orders cannot be marked not delivered.", 400);
  }

  await updateOrderStatusByAdmin(env, orderId, "not_delivered", note || "Marked not delivered from admin API");
  await logAdminAction(env, request, session, "api_v2_order_not_delivered", `order:${orderId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

async function handleApiAdminV2ApproveGroup(request, env, orderId, groupId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const order = await getV2RawOrder(env, orderId);
  const group = await getV2RawGroup(env, groupId, orderId);

  if (!order || !group) {
    return apiError("not_found", "Order or group was not found.", 404);
  }

  if (order.fulfillment_type !== "delivery") {
    return apiError("not_delivery_order", "Only delivery pending additions use approve/reject.", 400);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_cancelled", "Cancelled orders cannot be updated.", 400);
  }

  if (group.group_status !== "pending_admin_approval") {
    return apiError("invalid_group_status", "Only pending groups can be approved.", 400);
  }

  await env.DB.prepare(`
    UPDATE order_addition_groups_v2
    SET group_status = 'approved',
        admin_decision = 'approved',
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND customer_order_id = ?
  `).bind(groupId, orderId).run();

  await env.DB.prepare(`
    UPDATE customer_order_items_v2
    SET item_status = 'confirmed',
        admin_decision = 'approved',
        decided_at = CURRENT_TIMESTAMP
    WHERE group_id = ? AND customer_order_id = ?
  `).bind(groupId, orderId).run();

  await updateV2OrderConfirmedTotal(env, orderId);
  await addV2OrderHistory(env, orderId, "group:pending_admin_approval", "group:approved", session, `Group ${groupId} approved`);
  await notifyCustomerForV2Order(env, order, getV2DeliveryAdditionApprovedText(), "order_addition");
  await logAdminAction(env, request, session, "api_v2_order_group_approved", `order:${orderId}:group:${groupId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

async function handleApiAdminV2RejectGroup(request, env, orderId, groupId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const note = String(body.note || body.admin_decision_note || "").trim();

  const order = await getV2RawOrder(env, orderId);
  const group = await getV2RawGroup(env, groupId, orderId);

  if (!order || !group) {
    return apiError("not_found", "Order or group was not found.", 404);
  }

  if (order.fulfillment_type !== "delivery") {
    return apiError("not_delivery_order", "Only delivery pending additions use approve/reject.", 400);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_cancelled", "Cancelled orders cannot be updated.", 400);
  }

  if (group.group_status !== "pending_admin_approval") {
    return apiError("invalid_group_status", "Only pending groups can be rejected.", 400);
  }

  await env.DB.prepare(`
    UPDATE order_addition_groups_v2
    SET group_status = 'rejected',
        admin_decision = 'rejected',
        admin_decision_note = ?,
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND customer_order_id = ?
  `).bind(note || null, groupId, orderId).run();

  await env.DB.prepare(`
    UPDATE customer_order_items_v2
    SET item_status = 'rejected',
        admin_decision = 'rejected',
        admin_decision_note = ?,
        decided_at = CURRENT_TIMESTAMP
    WHERE group_id = ? AND customer_order_id = ?
  `).bind(note || null, groupId, orderId).run();

  await updateV2OrderConfirmedTotal(env, orderId);
  await addV2OrderHistory(env, orderId, "group:pending_admin_approval", "group:rejected", session, `Group ${groupId} rejected${note ? ": " + note : ""}`);
  await notifyCustomerForV2Order(env, order, getV2DeliveryAdditionRejectedText(), "order_addition");
  await logAdminAction(env, request, session, "api_v2_order_group_rejected", `order:${orderId}:group:${groupId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}

function createOrderRecreationError(
  code,
  message,
  httpStatus = 400,
  details = null
) {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  error.details = details;
  return error;
}

function normalizeOrderRecreationKey(value) {
  const key = String(value || "").trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    throw createOrderRecreationError(
      "invalid_recreation_key",
      "A valid idempotency key containing 8-128 safe characters is required."
    );
  }

  return key;
}

async function resolveAdminActorId(env, session = {}) {
  const directId = Number(
    session.admin?.id ||
    session.id ||
    0
  );

  if (Number.isSafeInteger(directId) && directId > 0) {
    return directId;
  }

  const username = String(
    session.admin?.username ||
    session.username ||
    ""
  ).trim();

  if (!username) return null;

  const row = await env.DB.prepare(
    "SELECT id FROM admin_users WHERE username = ?"
  ).bind(username).first();

  return row?.id ? Number(row.id) : null;
}

function getOrderRecreationAdminUsername(session = {}) {
  return String(
    session.admin?.username ||
    session.username ||
    ""
  ).trim();
}

async function getExistingRecreatedOrder(
  env,
  recreationKey
) {
  return await env.DB.prepare(`
    SELECT *
    FROM customer_orders_v2
    WHERE recreation_key = ?
  `).bind(recreationKey).first();
}

async function getActiveRecreatedOrder(
  env,
  sourceOrderId
) {
  return await env.DB.prepare(`
    SELECT *
    FROM customer_orders_v2
    WHERE recreated_from_order_id = ?
      AND COALESCE(
        order_status,
        status,
        ''
      ) NOT IN ('cancelled', 'closed', 'delivered')
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT 1
  `).bind(sourceOrderId).first();
}

function activeRecreatedOrderError(order) {
  return createOrderRecreationError(
    "active_recreated_order_exists",
    "This cancelled order already has an active recreated order.",
    409,
    {
      active_order_id: Number(order.id)
    }
  );
}

async function getSourceOrderRecreationItems(env, sourceOrderId) {
  const result = await env.DB.prepare(`
    SELECT
      i.id,
      i.product_id,
      i.shop_id,
      i.quantity,
      i.item_status,
      i.status_before_cancel,
      p.name AS current_product_name,
      p.price AS current_product_price,
      p.shop_id AS current_shop_id,
      p.is_active AS current_product_active
    FROM customer_order_items_v2 i
    LEFT JOIN products p
      ON p.id = i.product_id
    WHERE i.customer_order_id = ?
    ORDER BY i.id
  `).bind(sourceOrderId).all();

  return result.results || [];
}

function buildRecreatedOrderItems(sourceItems) {
  const eligibleStatuses = new Set([
    "confirmed",
    "approved",
    "waiting_ready_to_pickup",
    "scheduled_for_next_online_order"
  ]);

  const eligible = sourceItems.filter((item) => {
    const effectiveStatus = String(
      item.status_before_cancel ||
      item.item_status ||
      ""
    );

    return eligibleStatuses.has(effectiveStatus);
  });

  if (!eligible.length) {
    throw createOrderRecreationError(
      "no_eligible_items",
      "The cancelled order has no eligible items to recreate."
    );
  }

  const unavailable = eligible
    .filter((item) =>
      !item.current_product_name ||
      Number(item.current_product_active || 0) !== 1
    )
    .map((item) => ({
      item_id: Number(item.id),
      product_id: Number(item.product_id)
    }));

  if (unavailable.length) {
    throw createOrderRecreationError(
      "products_unavailable",
      "One or more products are no longer available.",
      409,
      { products: unavailable }
    );
  }

  const grouped = new Map();

  for (const item of eligible) {
    const productId = Number(item.product_id);
    const shopId = item.current_shop_id ?? item.shop_id ?? null;
    const key = `${productId}:${shopId ?? ""}`;
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.current_product_price);

    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      throw createOrderRecreationError(
        "invalid_source_item",
        "The cancelled order contains an invalid item.",
        409,
        { item_id: Number(item.id || 0) }
      );
    }

    const current = grouped.get(key) || {
      product_id: productId,
      product_name: String(item.current_product_name),
      shop_id: shopId === null ? null : Number(shopId),
      quantity: 0,
      unit_price: unitPrice,
      line_total: 0
    };

    current.quantity += quantity;
    current.line_total = current.quantity * unitPrice;
    grouped.set(key, current);
  }

  return [...grouped.values()];
}

async function recreateCancelledV2Order(
  env,
  sourceOrderId,
  session,
  recreationKeyValue,
  reasonValue
) {
  const recreationKey =
    normalizeOrderRecreationKey(recreationKeyValue);
  const reason = String(reasonValue || "").trim();

  if (!reason || reason.length > 500) {
    throw createOrderRecreationError(
      "invalid_recreation_reason",
      "A recreation reason of 1-500 characters is required."
    );
  }

  const existing = await getExistingRecreatedOrder(
    env,
    recreationKey
  );

  if (existing) {
    if (
      Number(existing.recreated_from_order_id) !==
      Number(sourceOrderId)
    ) {
      throw createOrderRecreationError(
        "recreation_key_conflict",
        "The idempotency key belongs to another source order.",
        409
      );
    }

    return {
      order: await getV2AdminOrder(env, existing.id),
      replayed: true
    };
  }

  const source = await getV2RawOrder(env, sourceOrderId);

  if (!source) {
    throw createOrderRecreationError(
      "source_order_not_found",
      "The source order was not found.",
      404
    );
  }

  if (
    String(source.order_status || source.status || "") !==
    "cancelled"
  ) {
    throw createOrderRecreationError(
      "source_order_not_cancelled",
      "Only cancelled orders can be recreated.",
      409
    );
  }

  const activeSuccessor = await getActiveRecreatedOrder(
    env,
    sourceOrderId
  );

  if (activeSuccessor) {
    throw activeRecreatedOrderError(activeSuccessor);
  }

  const sourceItems =
    await getSourceOrderRecreationItems(env, sourceOrderId);
  const recreatedItems =
    buildRecreatedOrderItems(sourceItems);
  const totalAmount = recreatedItems.reduce(
    (sum, item) => sum + item.line_total,
    0
  );

  const publicOrderCode = makePublicOrderCode();
  const actorId = await resolveAdminActorId(env, session);
  const actorUsername =
    getOrderRecreationAdminUsername(session);
  const now = new Date().toISOString();
  const fulfillmentType =
    String(source.fulfillment_type || "");
  const deliveryStatus =
    fulfillmentType === "delivery" ? "not_started" : null;
  const pickupStatus =
    fulfillmentType === "pickup" ? "preparing" : null;

  const statements = [
    env.DB.prepare(`
      INSERT INTO customer_orders_v2 (
        public_order_code,
        session_token,
        status,
        order_status,
        fulfillment_type,
        delivery_status,
        pickup_status,
        delivery_location_id,
        delivery_location_label,
        delivery_google_maps_link,
        delivery_address,
        scheduled_for_next_online_order,
        next_online_order_at,
        active_shop_id,
        total_amount,
        currency,
        customer_name,
        phone,
        payment_method_code,
        notes,
        admin_status_note,
        recreated_from_order_id,
        recreation_key,
        recreated_by_admin_id,
        recreation_reason,
        created_at,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).bind(
      publicOrderCode,
      source.session_token,
      "draft",
      "draft",
      fulfillmentType,
      deliveryStatus,
      pickupStatus,
      source.delivery_location_id || null,
      source.delivery_location_label || "",
      source.delivery_google_maps_link || "",
      source.delivery_address || "",
      0,
      null,
      source.active_shop_id || null,
      totalAmount,
      source.currency || "EUR",
      source.customer_name || "",
      source.phone || "",
      source.payment_method_code || "",
      source.notes || "",
      reason,
      sourceOrderId,
      recreationKey,
      actorId,
      reason,
      now,
      now
    ),
    env.DB.prepare(`
      INSERT INTO order_addition_groups_v2 (
        customer_order_id,
        group_type,
        group_status,
        fulfillment_type,
        requires_admin_approval,
        scheduled_for_next_online_order,
        next_online_order_at,
        admin_decision_note
      )
      VALUES (
        (
          SELECT id
          FROM customer_orders_v2
          WHERE recreation_key = ?
        ),
        ?, ?, ?, 0, 0, NULL, ?
      )
    `).bind(
      recreationKey,
      "recreated_order",
      "draft",
      fulfillmentType,
      reason
    )
  ];

  for (const item of recreatedItems) {
    statements.push(
      env.DB.prepare(`
        INSERT INTO customer_order_items_v2 (
          customer_order_id,
          group_id,
          product_id,
          product_name,
          shop_id,
          quantity,
          unit_price,
          line_total,
          item_status,
          added_phase,
          requires_admin_approval
        )
        VALUES (
          (
            SELECT id
            FROM customer_orders_v2
            WHERE recreation_key = ?
          ),
          (
            SELECT g.id
            FROM order_addition_groups_v2 g
            JOIN customer_orders_v2 o
              ON o.id = g.customer_order_id
            WHERE o.recreation_key = ?
              AND g.group_type = 'recreated_order'
            ORDER BY g.id DESC
            LIMIT 1
          ),
          ?, ?, ?, ?, ?, ?, ?, ?, 0
        )
      `).bind(
        recreationKey,
        recreationKey,
        item.product_id,
        item.product_name,
        item.shop_id,
        item.quantity,
        item.unit_price,
        item.line_total,
        "draft",
        "recreated_order"
      )
    );
  }

  statements.push(
    env.DB.prepare(`
      INSERT INTO customer_order_status_history_v2 (
        order_id,
        previous_status,
        new_status,
        changed_by_admin_id,
        changed_by_admin_username,
        note,
        created_at
      )
      VALUES (
        (
          SELECT id
          FROM customer_orders_v2
          WHERE recreation_key = ?
        ),
        NULL,
        'draft',
        ?,
        ?,
        ?,
        ?
      )
    `).bind(
      recreationKey,
      actorId,
      actorUsername || null,
      `Recreated from order ${sourceOrderId}: ${reason}`,
      now
    )
  );

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const raced = await getExistingRecreatedOrder(
      env,
      recreationKey
    );

    if (
      raced &&
      Number(raced.recreated_from_order_id) ===
        Number(sourceOrderId)
    ) {
      return {
        order: await getV2AdminOrder(env, raced.id),
        replayed: true
      };
    }

    const racedActiveSuccessor =
      await getActiveRecreatedOrder(
        env,
        sourceOrderId
      );

    if (racedActiveSuccessor) {
      throw activeRecreatedOrderError(
        racedActiveSuccessor
      );
    }

    throw error;
  }

  const created = await getExistingRecreatedOrder(
    env,
    recreationKey
  );

  if (!created) {
    throw createOrderRecreationError(
      "recreation_failed",
      "The recreated order could not be loaded.",
      500
    );
  }

  return {
    order: await getV2AdminOrder(env, created.id),
    replayed: false
  };
}

function getV2RecreatedOrderConfirmedText(
  language,
  publicOrderCode
) {
  const code = String(publicOrderCode || "");
  const messages = {
    en: `Your cancelled order was recreated and confirmed as ${code}.`,
    de: `Ihre stornierte Bestellung wurde als ${code} neu erstellt und bestätigt.`,
    tr: `İptal edilen siparişiniz ${code} olarak yeniden oluşturuldu ve onaylandı.`,
    ar: `تمت إعادة إنشاء طلبك الملغي وتأكيده بالرمز ${code}.`,
    ru: `Ваш отменённый заказ был создан заново и подтверждён как ${code}.`
  };

  return messages[safeLang(language)] || messages.en;
}

async function notifyCustomerForConfirmedRecreation(
  env,
  order
) {
  const customer = await getCustomerForV2Order(env, order);
  if (!customer) return;

  const language =
    customer.preferred_language ||
    customer.language ||
    "en";
  const text = getV2RecreatedOrderConfirmedText(
    language,
    order.public_order_code
  );

  await saveMessage(
    env,
    customer.id,
    "outgoing",
    text,
    language,
    "order_recreated",
    "telegram"
  );

  if (customer.telegram_user_id) {
    await sendTelegramMessage(
      env,
      customer.telegram_user_id,
      text
    );
  }
}

async function confirmRecreatedV2Order(
  env,
  orderId,
  session
) {
  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    throw createOrderRecreationError(
      "order_not_found",
      "The recreated order was not found.",
      404
    );
  }

  if (!order.recreated_from_order_id) {
    throw createOrderRecreationError(
      "not_recreated_order",
      "Only recreated orders can use this confirmation route.",
      409
    );
  }

  if (
    order.recreation_confirmed_at &&
    String(order.order_status || order.status || "") !== "draft"
  ) {
    return {
      order: await getV2AdminOrder(env, orderId),
      replayed: true
    };
  }

  if (
    String(order.order_status || order.status || "") !== "draft"
  ) {
    throw createOrderRecreationError(
      "recreated_order_not_draft",
      "Only a draft recreated order can be confirmed.",
      409
    );
  }

  const itemResult = await env.DB.prepare(`
    SELECT
      i.id,
      i.product_id,
      i.unit_price,
      p.price AS current_price,
      p.is_active
    FROM customer_order_items_v2 i
    LEFT JOIN products p
      ON p.id = i.product_id
    WHERE i.customer_order_id = ?
  `).bind(orderId).all();

  const items = itemResult.results || [];

  if (!items.length) {
    throw createOrderRecreationError(
      "recreated_order_empty",
      "The recreated order has no items.",
      409
    );
  }

  const changedProducts = items
    .filter((item) =>
      Number(item.is_active || 0) !== 1 ||
      Number(item.current_price) !== Number(item.unit_price)
    )
    .map((item) => ({
      item_id: Number(item.id),
      product_id: Number(item.product_id)
    }));

  if (changedProducts.length) {
    throw createOrderRecreationError(
      "recreated_products_changed",
      "Product availability or pricing changed after recreation.",
      409,
      { products: changedProducts }
    );
  }

  const fulfillmentType =
    String(order.fulfillment_type || "");
  const nextGroupStatus =
    fulfillmentType === "pickup"
      ? "waiting_ready_to_pickup"
      : "confirmed";
  const nextItemStatus = nextGroupStatus;
  const actorId = await resolveAdminActorId(env, session);
  const actorUsername =
    getOrderRecreationAdminUsername(session);
  const now = new Date().toISOString();

  const confirmationResults = await env.DB.batch([
    env.DB.prepare(`
      UPDATE customer_orders_v2
      SET status = 'submitted',
          order_status = 'submitted',
          delivery_status = CASE
            WHEN fulfillment_type = 'delivery'
            THEN 'not_started'
            ELSE delivery_status
          END,
          pickup_status = CASE
            WHEN fulfillment_type = 'pickup'
            THEN 'preparing'
            ELSE pickup_status
          END,
          recreation_confirmed_at = ?,
          updated_at = ?
      WHERE id = ?
        AND order_status = 'draft'
        AND recreated_from_order_id IS NOT NULL
    `).bind(now, now, orderId),
    env.DB.prepare(`
      UPDATE order_addition_groups_v2
      SET group_status = ?,
          admin_decision = 'approved',
          admin_decision_note = NULL,
          decided_at = ?,
          updated_at = ?
      WHERE customer_order_id = ?
        AND group_type = 'recreated_order'
        AND group_status = 'draft'
    `).bind(
      nextGroupStatus,
      now,
      now,
      orderId
    ),
    env.DB.prepare(`
      UPDATE customer_order_items_v2
      SET item_status = ?,
          admin_decision = 'approved',
          admin_decision_note = NULL,
          decided_at = ?
      WHERE customer_order_id = ?
        AND added_phase = 'recreated_order'
        AND item_status = 'draft'
    `).bind(
      nextItemStatus,
      now,
      orderId
    ),
    env.DB.prepare(`
      INSERT INTO customer_order_status_history_v2 (
        order_id,
        previous_status,
        new_status,
        changed_by_admin_id,
        changed_by_admin_username,
        note,
        created_at
      )
      SELECT ?, 'draft', 'submitted', ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM customer_order_status_history_v2
        WHERE order_id = ?
          AND previous_status = 'draft'
          AND new_status = 'submitted'
      )
    `).bind(
      orderId,
      actorId,
      actorUsername || null,
      `Recreated order confirmed from source ${order.recreated_from_order_id}`,
      now,
      orderId
    )
  ]);

  const confirmationApplied =
    Number(confirmationResults?.[0]?.meta?.changes || 0) === 1;

  const confirmed = await getV2AdminOrder(env, orderId);

  if (!confirmationApplied) {
    return {
      order: confirmed,
      replayed: true
    };
  }

  await notifyCustomerForConfirmedRecreation(
    env,
    confirmed
  );

  return {
    order: confirmed,
    replayed: false
  };
}

function orderRecreationApiError(error) {
  return apiError(
    error?.code || "order_recreation_failed",
    error?.message || "Order recreation failed.",
    Number(error?.httpStatus || 500),
    error?.details ?? null
  );
}

async function handleApiAdminV2RecreateOrder(
  request,
  env,
  orderId
) {
  if (request.method !== "POST") {
    return apiError(
      "method_not_allowed",
      "Method not allowed.",
      405
    );
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError(
      "unauthorized",
      "Valid admin bearer token is required.",
      401
    );
  }

  const body = await readJsonBody(request) || {};
  const recreationKey =
    request.headers.get("idempotency-key") ||
    body.idempotency_key ||
    body.recreation_key;
  const reason =
    body.reason ||
    body.recreation_reason ||
    body.note;

  try {
    const result = await recreateCancelledV2Order(
      env,
      orderId,
      session,
      recreationKey,
      reason
    );

    await logAdminAction(
      env,
      request,
      session,
      result.replayed
        ? "api_v2_order_recreation_replayed"
        : "api_v2_order_recreated",
      `source_order:${orderId}:new_order:${result.order.id}`
    );

    return apiOk(
      {
        order: result.order,
        source_order:
          await getV2AdminOrder(env, orderId),
        replayed: result.replayed
      },
      result.replayed ? 200 : 201
    );
  } catch (error) {
    return orderRecreationApiError(error);
  }
}

async function handleApiAdminV2ConfirmRecreation(
  request,
  env,
  orderId
) {
  if (request.method !== "POST") {
    return apiError(
      "method_not_allowed",
      "Method not allowed.",
      405
    );
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError(
      "unauthorized",
      "Valid admin bearer token is required.",
      401
    );
  }

  try {
    const result = await confirmRecreatedV2Order(
      env,
      orderId,
      session
    );

    await logAdminAction(
      env,
      request,
      session,
      result.replayed
        ? "api_v2_order_recreation_confirmation_replayed"
        : "api_v2_order_recreation_confirmed",
      `order:${orderId}`
    );

    return apiOk({
      order: result.order,
      replayed: result.replayed
    });
  } catch (error) {
    return orderRecreationApiError(error);
  }
}

async function handleApiAdminV2CancelOrder(request, env, orderId) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const reason = String(body.reason || body.cancel_reason || body.note || "").trim();

  const order = await getV2RawOrder(env, orderId);

  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  if (String(order.order_status || order.status || "") === "cancelled") {
    return apiError("order_already_cancelled", "Order is already cancelled.", 400);
  }

  const previousStatus = order.order_status || order.status || null;

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET status = 'cancelled',
        order_status = 'cancelled',
        delivery_status = CASE
          WHEN fulfillment_type = 'delivery' THEN 'cancelled'
          ELSE delivery_status
        END,
        pickup_status = CASE
          WHEN fulfillment_type = 'pickup' THEN 'cancelled'
          ELSE pickup_status
        END,
        cancelled_at = CURRENT_TIMESTAMP,
        cancelled_by_admin_id = ?,
        cancel_reason = ?,
        admin_status_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    session.admin?.id || session.id || null,
    reason || null,
    reason || null,
    orderId
  ).run();

  await env.DB.prepare(`
    UPDATE order_addition_groups_v2
    SET status_before_cancel = CASE
          WHEN group_status = 'cancelled'
          THEN status_before_cancel
          ELSE group_status
        END,
        group_status = 'cancelled',
        admin_decision = 'cancelled',
        admin_decision_note = ?,
        decided_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE customer_order_id = ?
  `).bind(reason || null, orderId).run();

  await env.DB.prepare(`
    UPDATE customer_order_items_v2
    SET status_before_cancel = CASE
          WHEN item_status = 'cancelled'
          THEN status_before_cancel
          ELSE item_status
        END,
        item_status = 'cancelled',
        admin_decision = 'cancelled',
        admin_decision_note = ?,
        decided_at = CURRENT_TIMESTAMP
    WHERE customer_order_id = ?
  `).bind(reason || null, orderId).run();

  await closeDeliveryLocationRequestsForV2Order(env, order, "cancelled");

  await addV2OrderHistory(env, orderId, previousStatus, "cancelled", session, reason);
  await notifyCustomerForV2Order(env, order, getV2OrderCancelledText(reason), "order_status");
  await logAdminAction(env, request, session, "api_v2_order_cancelled", `order:${orderId}`);

  return apiOk({
    order: await getV2AdminOrder(env, orderId)
  });
}



const API_ALLOWED_ORDER_STATUSES = new Set([
  "submitted",
  "scheduled_for_next_online_order",
  "in_progress",
  "waiting_location",
  "ready_to_delivery",
  "on_the_way",
  "not_delivered",
  "delivered",
  "cancelled"
]);



async function getOrderApiRowById(env, orderId) {
  const openRows = await getOrdersContext(env, false);
  const closedRows = await getOrdersContext(env, true);
  return [...openRows, ...closedRows].find((order) => Number(order.id) === Number(orderId)) || null;
}

async function handleApiAdminOrderStatus(request, env, orderId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "PATCH" && request.method !== "PUT") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const status = String(body.order_status || body.status || "").trim();
  const note = String(body.admin_status_note || body.note || "").trim();

  if (!API_ALLOWED_ORDER_STATUSES.has(status)) {
    return apiError("invalid_order_status", "Invalid order status.", 400, {
      allowed_statuses: Array.from(API_ALLOWED_ORDER_STATUSES)
    });
  }

  const order = await getV2RawOrder(env, orderId);
  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  await updateOrderStatusByAdmin(env, orderId, status, note);
  await logAdminAction(env, request, session, "api_order_status_updated_v2_compat", `order:${orderId}:${status}`);

  const updated = await getOrderApiRowById(env, orderId);

  return apiOk({
    order: updated ? mapOrderForApi(updated) : null
  });
}

async function handleApiAdminOrderDelivered(request, env, orderId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const order = await getV2RawOrder(env, orderId);
  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  await updateOrderStatusByAdmin(env, orderId, "delivered", "");
  await logAdminAction(env, request, session, "api_order_delivered_v2_compat", `order:${orderId}`);

  const updated = await getOrderApiRowById(env, orderId);

  return apiOk({
    order: updated ? mapOrderForApi(updated) : null
  });
}

async function handleApiAdminOrderReturn(request, env, orderId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const order = await getV2RawOrder(env, orderId);
  if (!order) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  await updateOrderStatusByAdmin(env, orderId, "not_delivered", "Returned from closed orders");
  await logAdminAction(env, request, session, "api_order_returned_v2_compat", `order:${orderId}`);

  const updated = await getOrderApiRowById(env, orderId);

  return apiOk({
    order: updated ? mapOrderForApi(updated) : null
  });
}



function mapLearnedPatternForApi(pattern) {
  return {
    id: Number(pattern.id || 0),
    pattern_text: String(
      pattern.pattern ||
      pattern.pattern_text ||
      pattern.original_pattern ||
      pattern.normalized_pattern ||
      ""
    ),
    intent: String(pattern.intent || ""),
    product_id: pattern.product_id == null ? null : Number(pattern.product_id),
    product_name: String(pattern.product_name || ""),
    response_text: String(pattern.response_text || pattern.response || ""),
    status: String(pattern.status || "pending"),
    hit_count: Number(pattern.hit_count || pattern.hits || 0)
  };
}

async function handleApiAdminAiInfo(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError(
      "unauthorized",
      "Valid admin bearer token is required.",
      401
    );
  }

  const [usage, learnedPatterns] = await Promise.all([
    getAiUsageStats(env),
    getLearnedPatternsForAdmin(env)
  ]);

  const patterns = (learnedPatterns || []).map(mapLearnedPatternForApi);

  return apiOk({
    usage: {
      last_hour: Number(usage.lastHour || 0),
      last_24_hours: Number(usage.last24Hours || 0),
      last_week: Number(usage.lastWeek || 0),
      last_month: Number(usage.lastMonth || 0),
      total: Number(usage.total || 0)
    },
    learned_patterns: patterns,
    count: patterns.length
  });
}

async function handleApiAdminLearnedPatternAction(
  request,
  env,
  patternId,
  action
) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError(
      "unauthorized",
      "Valid admin bearer token is required.",
      401
    );
  }

  if (
    !Number.isSafeInteger(patternId) ||
    patternId <= 0 ||
    !["approve", "reject", "delete"].includes(action)
  ) {
    return apiError(
      "invalid_pattern_action",
      "The learned-pattern action is invalid.",
      400
    );
  }

  const pattern = await env.DB.prepare(
    `
    SELECT lp.*, p.name AS product_name
    FROM learned_patterns lp
    LEFT JOIN products p ON p.id = lp.product_id
    WHERE lp.id = ?
    LIMIT 1
    `
  ).bind(patternId).first();

  if (!pattern) {
    return apiError(
      "learned_pattern_not_found",
      "Learned pattern was not found.",
      404
    );
  }

  if (action === "approve") {
    await env.DB.prepare(
      `
      UPDATE learned_patterns
      SET status = 'approved',
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `
    ).bind(patternId).run();

    const alias = String(pattern.normalized_pattern || "").trim();

    if (
      pattern.intent === "product_specific" &&
      pattern.product_id &&
      alias
    ) {
      const existingAlias = await env.DB.prepare(
        `
        SELECT 1 AS found
        FROM product_aliases
        WHERE product_id = ?
          AND lower(alias) = lower(?)
        LIMIT 1
        `
      ).bind(pattern.product_id, alias).first();

      if (!existingAlias) {
        await env.DB.prepare(
          "INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)"
        ).bind(pattern.product_id, alias).run();
      }
    }
  } else if (action === "reject") {
    await env.DB.prepare(
      "UPDATE learned_patterns SET status = 'rejected' WHERE id = ?"
    ).bind(patternId).run();
  } else {
    await env.DB.prepare(
      "DELETE FROM learned_patterns WHERE id = ?"
    ).bind(patternId).run();
  }

  await logAdminAction(
    env,
    request,
    session,
    `api_learned_pattern_${action}`,
    `pattern:${patternId}`
  );

  return apiOk({
    pattern_id: patternId,
    action
  });
}

async function handleApiAdminOpenRequests(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const context = await getOpenRequestContext(env);
  const requests = context.openRequests.map((item) => mapOpenRequestForApi(item, context.customerMap));

  return apiOk({
    open_requests: requests,
    count: requests.length
  });
}

async function handleApiAdminOpenRequestStatus(request, env, requestId) {
  if (request.method !== "PATCH" && request.method !== "PUT") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const status = String(body.status || "").trim();

  if (!["new", "in_progress", "done"].includes(status)) {
    return apiError("invalid_status", "Status must be new, in_progress, or done.", 400);
  }

  const existing = await env.DB.prepare("SELECT * FROM customer_requests WHERE id = ?")
    .bind(requestId)
    .first();

  if (!existing) {
    return apiError("not_found", "Open request not found.", 404);
  }

  await env.DB.prepare("UPDATE customer_requests SET status = ? WHERE id = ?")
    .bind(status, requestId)
    .run();

  const updated = await env.DB.prepare("SELECT * FROM customer_requests WHERE id = ?")
    .bind(requestId)
    .first();

  const customer = updated?.customer_id
    ? await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(updated.customer_id).first()
    : null;

  return apiOk({
    request: mapOpenRequestForApi(updated, customer ? new Map([[Number(customer.id), customer]]) : new Map())
  });
}

async function handleApiAdminOpenRequestGroupDone(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const body = await readJsonBody(request) || {};
  const customerId = Number(body.customer_id);
  const requestType = String(body.request_type || "").trim();
  const hasItemName = Object.prototype.hasOwnProperty.call(body, "item_name") && body.item_name !== null && String(body.item_name).trim() !== "";
  const itemName = hasItemName ? String(body.item_name).trim() : "";

  if (!customerId || !requestType) {
    return apiError("invalid_request", "customer_id and request_type are required.", 400);
  }

  let result;

  if (hasItemName) {
    result = await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE customer_id = ? AND request_type = ? AND status != 'done' AND item_name = ?")
      .bind(customerId, requestType, itemName)
      .run();
  } else {
    result = await env.DB.prepare("UPDATE customer_requests SET status = 'done' WHERE customer_id = ? AND request_type = ? AND status != 'done' AND item_name IS NULL")
      .bind(customerId, requestType)
      .run();
  }

  return apiOk({
    updated: result?.meta?.changes || 0,
    customer_id: customerId,
    request_type: requestType,
    item_name: hasItemName ? itemName : null
  });
}

async function handleApiAdminOpenRequestAllDone(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const result = await env.DB.prepare(
    "UPDATE customer_requests SET status = 'done' WHERE status != 'done' AND request_type != 'product_list'"
  ).run();

  return apiOk({
    updated: result?.meta?.changes || 0
  });
}



function mapProductForApi(product, aliasMap = {}) {
  return {
    id: Number(product.id),
    name: product.name || "",
    price: Number(product.price || 0),
    price_formatted: formatPrice(product.price || 0),
    is_active: Number(product.is_active) === 1,
    category_id: product.category_id === null || product.category_id === undefined ? null : Number(product.category_id),
    category_name: product.category_name || "",
    aliases: aliasMap[product.id] || []
  };
}

function mapProductCategoryForApi(category) {
  return {
    id: Number(category.id),
    name: category.name || "",
    is_active: Number(category.is_active) === 1
  };
}

async function handleApiAdminProducts(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method === "GET") {
    const products = await getAllProducts(env);
    const categories = await getAllProductCategories(env);
    const aliasMap = await getProductAliasMap(env);

    return apiOk({
      products: products.map((product) => mapProductForApi(product, aliasMap)),
      categories: categories.map(mapProductCategoryForApi),
      count: products.length
    });
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const name = String(body.name || "").trim();
    const price = Number(body.price || 0);
    const categoryId = body.category_id === null || body.category_id === undefined || body.category_id === ""
      ? null
      : Number(body.category_id);
    const aliasesText = Array.isArray(body.aliases) ? body.aliases.join(",") : String(body.aliases || "");

    if (!name || price <= 0) {
      return apiError("invalid_product", "Product name and positive price are required.", 400);
    }

    const inserted = await env.DB.prepare(
      "INSERT INTO products (name, price, category_id, is_active) VALUES (?, ?, ?, 1) RETURNING id"
    ).bind(name, price, categoryId).first();

    if (inserted && inserted.id) {
      if (aliasesText.trim()) {
        await replaceManualAliases(env, inserted.id, aliasesText);
      } else {
        await syncAutoAliases(env, inserted.id, name);
      }

      await logAdminAction(env, request, session, "api_product_created", `${inserted.id}:${name}`);
    }

    return apiOk({
      product_id: inserted?.id ? Number(inserted.id) : null
    }, 201);
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function handleApiAdminProductDetail(request, env, productId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const product = await env.DB.prepare(
    `SELECT
       p.id,
       p.name,
       p.price,
       p.is_active,
       p.category_id,
       pc.name AS category_name
     FROM products p
     LEFT JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.id = ?`
  ).bind(productId).first();

  if (!product) {
    return apiError("not_found", "Product not found.", 404);
  }

  if (request.method === "GET") {
    const aliasMap = await getProductAliasMap(env);

    return apiOk({
      product: mapProductForApi(product, aliasMap)
    });
  }

  if (request.method === "PUT" || request.method === "PATCH") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const name = String(body.name ?? product.name ?? "").trim();
    const price = Number(body.price ?? product.price ?? 0);
    const isActive = body.is_active === undefined ? Number(product.is_active) : (body.is_active ? 1 : 0);
    const categoryId = body.category_id === null || body.category_id === ""
      ? null
      : (body.category_id === undefined ? product.category_id : Number(body.category_id));
    const aliasesText = Array.isArray(body.aliases) ? body.aliases.join(",") : String(body.aliases || "");

    if (!name || price <= 0) {
      return apiError("invalid_product", "Product name and positive price are required.", 400);
    }

    await env.DB.prepare(
      "UPDATE products SET name = ?, price = ?, category_id = ?, is_active = ? WHERE id = ?"
    ).bind(name, price, categoryId, isActive, productId).run();

    if (body.aliases !== undefined) {
      if (aliasesText.trim()) {
        await replaceManualAliases(env, productId, aliasesText);
      } else {
        await syncAutoAliases(env, productId, name);
      }
    }

    await logAdminAction(env, request, session, "api_product_updated", `${productId}:${name}`);

    return apiOk({
      product_id: Number(productId)
    });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM product_aliases WHERE product_id = ?").bind(productId).run();
    await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();

    await logAdminAction(env, request, session, "api_product_deleted", String(productId));

    return apiOk({
      product_id: Number(productId),
      deleted: true
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function handleApiAdminProductCategories(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method === "GET") {
    const categories = await getAllProductCategories(env);

    return apiOk({
      categories: categories.map(mapProductCategoryForApi),
      count: categories.length
    });
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const name = String(body.name || "").trim();

    if (!name) {
      return apiError("invalid_category", "Category name is required.", 400);
    }

    await env.DB.prepare(
      "INSERT OR IGNORE INTO product_categories (name, is_active) VALUES (?, 1)"
    ).bind(name).run();

    await logAdminAction(env, request, session, "api_product_category_created", name);

    return apiOk({
      name
    }, 201);
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function handleApiAdminProductCategoryDetail(request, env, categoryId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const category = await env.DB.prepare(
    "SELECT id, name, is_active FROM product_categories WHERE id = ?"
  ).bind(categoryId).first();

  if (!category) {
    return apiError("not_found", "Product category not found.", 404);
  }

  if (request.method === "GET") {
    return apiOk({
      category: mapProductCategoryForApi(category)
    });
  }

  if (request.method === "PUT" || request.method === "PATCH") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const name = String(body.name ?? category.name ?? "").trim();
    const isActive = body.is_active === undefined ? Number(category.is_active) : (body.is_active ? 1 : 0);

    if (!name) {
      return apiError("invalid_category", "Category name is required.", 400);
    }

    await env.DB.prepare(
      "UPDATE product_categories SET name = ?, is_active = ? WHERE id = ?"
    ).bind(name, isActive, categoryId).run();

    await logAdminAction(env, request, session, "api_product_category_updated", `${categoryId}:${name}`);

    return apiOk({
      category_id: Number(categoryId)
    });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("UPDATE products SET category_id = NULL WHERE category_id = ?").bind(categoryId).run();
    await env.DB.prepare("DELETE FROM product_categories WHERE id = ?").bind(categoryId).run();

    await logAdminAction(env, request, session, "api_product_category_deleted", String(categoryId));

    return apiOk({
      category_id: Number(categoryId),
      deleted: true
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}



function mapMeetingPointForApi(point) {
  return {
    id: Number(point.id),
    name: point.name || "",
    address: point.address || "",
    google_maps_link: point.google_maps_link || "",
    is_default: Number(point.is_default) === 1,
    is_active: Number(point.is_active) === 1
  };
}

async function handleApiAdminLocationSearch(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const query = new URL(request.url).searchParams.get("query")?.trim() || "";

  if (!query) {
    return apiOk({
      locations: [],
      count: 0
    });
  }

  const locations = await searchLocations(env, query);

  return apiOk({
    locations,
    count: locations.length
  });
}


async function handleApiAdminMeetingPoints(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method === "GET") {
    const points = await getAllMeetingPoints(env);

    return apiOk({
      meeting_points: points.map(mapMeetingPointForApi),
      count: points.length
    });
  }

  if (request.method === "POST") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const name = String(body.name || "").trim();
    const address = String(body.address || "").trim();
    const googleMapsLink = String(body.google_maps_link || "").trim();
    const isDefault = body.is_default ? 1 : 0;

    if (!name || !googleMapsLink) {
      return apiError("invalid_meeting_point", "Meeting point name and Google Maps link are required.", 400);
    }

    const result = await env.DB.prepare(
      "INSERT INTO meeting_points (name, address, google_maps_link, is_default, is_active) VALUES (?, ?, ?, ?, 1)"
    ).bind(name, address, googleMapsLink, isDefault).run();

    const pointId = result.meta.last_row_id;

    if (isDefault) {
      await notifyCustomersAboutLocationChange(env, {
        id: pointId,
        name,
        address,
        google_maps_link: googleMapsLink
      });
    }

    await logAdminAction(env, request, session, "api_meeting_point_created", `${pointId}:${name}`);

    return apiOk({
      meeting_point_id: Number(pointId)
    }, 201);
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function handleApiAdminMeetingPointDetail(request, env, pointId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const point = await env.DB.prepare(
    "SELECT id, name, address, google_maps_link, is_default, is_active FROM meeting_points WHERE id = ?"
  ).bind(pointId).first();

  if (!point) {
    return apiError("not_found", "Meeting point not found.", 404);
  }

  if (request.method === "GET") {
    return apiOk({
      meeting_point: mapMeetingPointForApi(point)
    });
  }

  if (request.method === "PUT" || request.method === "PATCH") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const name = String(body.name ?? point.name ?? "").trim();
    const address = String(body.address ?? point.address ?? "").trim();
    const googleMapsLink = String(body.google_maps_link ?? point.google_maps_link ?? "").trim();
    const requestedActive = body.is_active === undefined ? Number(point.is_active) : (body.is_active ? 1 : 0);
    const hasDefaultUpdate = Object.prototype.hasOwnProperty.call(body, "is_default");

    if (hasDefaultUpdate && typeof body.is_default !== "boolean") {
      return apiError("invalid_preferred_status", "Preferred status must be a boolean.", 400);
    }

    const requestedDefault = hasDefaultUpdate
      ? body.is_default
      : Number(point.is_default) === 1;

    let isActive = requestedActive;
    let isDefault = requestedDefault ? 1 : 0;

    if (hasDefaultUpdate && requestedDefault) {
      isActive = 1;
    }

    if (!isActive) {
      isDefault = 0;
    }

    if (!name || !googleMapsLink) {
      return apiError("invalid_meeting_point", "Meeting point name and Google Maps link are required.", 400);
    }

    await env.DB.prepare(
      "UPDATE meeting_points SET name = ?, address = ?, google_maps_link = ?, is_active = ?, is_default = ? WHERE id = ?"
    ).bind(name, address, googleMapsLink, isActive, isDefault, pointId).run();

    if (Number(point.is_default) === 1 && Number(point.is_active) === 1 && !isActive) {
      await notifyCustomersLocationUnavailable(env);
    }

    if (hasDefaultUpdate && isDefault === 1 && Number(point.is_default) !== 1) {
      await notifyCustomersAboutLocationChange(env, {
        id: pointId,
        name,
        address,
        google_maps_link: googleMapsLink
      });
    }

    await logAdminAction(env, request, session, "api_meeting_point_updated", `${pointId}:${name}`);

    return apiOk({
      meeting_point_id: Number(pointId)
    });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM meeting_points WHERE id = ?").bind(pointId).run();

    await logAdminAction(env, request, session, "api_meeting_point_deleted", String(pointId));

    return apiOk({
      meeting_point_id: Number(pointId),
      deleted: true
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}



function mapCustomerForApi(customer) {
  return {
    id: Number(customer.id),
    telegram_user_id: customer.telegram_user_id || "",
    username: customer.username || "",
    full_name: customer.full_name || "",
    language: customer.language || "",
    preferred_language: customer.preferred_language || "",
    is_blocked: Number(customer.is_blocked || 0) === 1,
    last_seen_at: customer.last_seen_at || "",
    created_at: customer.created_at || ""
  };
}

function mapMessageForApi(message) {
  return {
    id: Number(message.id),
    direction: message.direction || "",
    message_type: message.message_type || "",
    source_label: formatMessageSource(message.message_type, message.direction),
    content: message.content || "",
    language: message.language || "",
    created_at: message.created_at || ""
  };
}

function mapCustomerRequestForApi(item) {
  return {
    id: Number(item.id),
    customer_id: Number(item.customer_id),
    request_type: item.request_type || "",
    request_type_label: i18nRequestType(item.request_type || "", "en"),
    status: item.status || "",
    status_label: i18nStatus(item.status || "", "en"),
    item_name: item.item_name || "",
    description: item.description || "",
    request_text: item.request_text || "",
    quantity: item.quantity === null || item.quantity === undefined ? null : Number(item.quantity || 0),
    google_maps_link: item.google_maps_link || "",
    created_at: item.created_at || ""
  };
}

function mapCustomerLocationForApi(item) {
  return {
    id: Number(item.id),
    customer_id: item.customer_id === null || item.customer_id === undefined ? null : Number(item.customer_id),
    session_token: item.session_token || "",
    request_type: item.request_type || "delivery_location",
    label: item.label || "",
    address: item.address || "",
    description: item.label || item.address || item.google_maps_link || "",
    latitude: item.latitude === null || item.latitude === undefined || item.latitude === "" ? null : Number(item.latitude),
    longitude: item.longitude === null || item.longitude === undefined || item.longitude === "" ? null : Number(item.longitude),
    google_maps_link: item.google_maps_link || "",
    source: item.source || "",
    is_preferred: Number(item.is_preferred || 0) === 1,
    created_at: item.created_at || "",
    updated_at: item.updated_at || ""
  };
}

async function handleApiAdminCustomers(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const url = new URL(request.url);
  const search = String(url.searchParams.get("search") || "").trim().toLowerCase();
  const language = String(url.searchParams.get("language") || "").trim();
  const active = String(url.searchParams.get("active") || "").trim();
  const limitRaw = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 250) : 100;

  let customers = (await env.DB.prepare("SELECT * FROM customers ORDER BY last_seen_at DESC").all()).results || [];

  if (search) {
    customers = customers.filter((customer) => {
      const haystack = [
        customer.id,
        customer.telegram_user_id,
        customer.username,
        customer.full_name,
        customer.language,
        customer.preferred_language
      ].map((value) => String(value || "").toLowerCase()).join(" ");
      return haystack.includes(search);
    });
  }

  if (language) {
    customers = customers.filter((customer) => (
      String(customer.preferred_language || customer.language || "") === language
    ));
  }

  if (active === "active") {
    customers = customers.filter((customer) => Number(customer.is_blocked || 0) !== 1);
  }

  if (active === "blocked") {
    customers = customers.filter((customer) => Number(customer.is_blocked || 0) === 1);
  }

  customers = customers.slice(0, limit);

  return apiOk({
    customers: customers.map(mapCustomerForApi),
    count: customers.length
  });
}

async function handleApiAdminCustomerDetail(request, env, customerId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(customerId).first();

  if (!customer) {
    return apiError("not_found", "Customer not found.", 404);
  }

  if (request.method === "GET") {
    const [messages, requests, locations] = await Promise.all([
      env.DB.prepare("SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC").bind(customerId).all(),
      env.DB.prepare("SELECT * FROM customer_requests WHERE customer_id = ? ORDER BY created_at DESC").bind(customerId).all(),
      env.DB.prepare(`
        SELECT *
        FROM customer_locations_v2
        WHERE customer_id = ?
           OR session_token = ?
        ORDER BY is_preferred DESC, datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
      `).bind(customerId, getCustomerOrderSessionToken(customerId)).all()
    ]);

    return apiOk({
      customer: mapCustomerForApi(customer),
      messages: (messages.results || []).map(mapMessageForApi),
      requests: (requests.results || []).map(mapCustomerRequestForApi),
      locations: (locations.results || []).map(mapCustomerLocationForApi)
    });
  }

  if (request.method === "DELETE") {
    await deleteCustomerData(env, customerId);
    await logAdminAction(env, request, session, "api_customer_deleted", String(customerId));

    return apiOk({
      customer_id: Number(customerId),
      deleted: true
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function handleApiAdminCustomerReply(request, env, customerId) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const replyText = String(body.reply_text || body.message || "").trim();

  if (!replyText) {
    return apiError("missing_message", "Reply text is required.", 400);
  }

  const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(customerId).first();

  if (!customer) {
    return apiError("not_found", "Customer not found.", 404);
  }

  await sendTelegramMessage(env, customer.telegram_user_id, replyText);
  await saveMessage(env, customer.id, "outgoing", replyText, customer.preferred_language, "admin_reply");
  await logAdminAction(env, request, session, "api_customer_reply_sent", String(customerId));

  return apiOk({
    customer_id: Number(customerId),
    sent: true
  });
}



async function getApiAdminSettings(env) {
  return {
    admin_telegram_chat_id: await getSetting(env, "admin_telegram_chat_id") || "",
    working_hours_enabled: await getSetting(env, "working_hours_enabled") || "off",
    working_hours_timezone: await getSetting(env, "working_hours_timezone") || "Europe/Berlin",
    working_hours_start: await getSetting(env, "working_hours_start") || "10:00",
    working_hours_end: await getSetting(env, "working_hours_end") || "22:00",
    working_hours_closed_message: await getSetting(env, "working_hours_closed_message") || "",
    working_hours_message_mode: await getSetting(env, "working_hours_message_mode") || "custom",
    admin_view_language: await getSetting(env, "admin_view_language") || "en",
    allow_preferred_customer_location: await getSetting(env, "allow_preferred_customer_location") || "on",
    allow_new_customer_location: await getSetting(env, "allow_new_customer_location") || "on",
    allow_customer_pickup: await getSetting(env, "allow_customer_pickup") || "on",
    allowed_delivery_cities: await getAllowedDeliveryCities(env),
    ai_response_mode: await getSetting(env, "ai_response_mode") || "rule_base",
    ai_custom_instructions: await getSetting(env, "ai_custom_instructions") || ""
  };
}

function normalizeOnOff(value, fallback = "off") {
  if (value === true || value === "on" || value === "true" || value === 1 || value === "1") return "on";
  if (value === false || value === "off" || value === "false" || value === 0 || value === "0") return "off";
  return fallback;
}

async function handleApiAdminSettings(request, env) {
  const session = await requireApiAdminSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid admin bearer token is required.", 401);
  }

  if (request.method === "GET") {
    return apiOk({
      settings: await getApiAdminSettings(env)
    });
  }

  if (request.method === "PUT" || request.method === "PATCH") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    if (body.admin_telegram_chat_id !== undefined) {
      await setSetting(env, "admin_telegram_chat_id", String(body.admin_telegram_chat_id || ""));
    }

    if (body.working_hours_enabled !== undefined) {
      await setSetting(env, "working_hours_enabled", normalizeOnOff(body.working_hours_enabled, "off"));
    }

    if (body.working_hours_timezone !== undefined) {
      await setSetting(env, "working_hours_timezone", String(body.working_hours_timezone || "Europe/Berlin"));
    }

    if (body.working_hours_start !== undefined) {
      await setSetting(env, "working_hours_start", String(body.working_hours_start || "10:00"));
    }

    if (body.working_hours_end !== undefined) {
      await setSetting(env, "working_hours_end", String(body.working_hours_end || "22:00"));
    }

    if (body.working_hours_message_mode !== undefined) {
      const mode = String(body.working_hours_message_mode || "custom");
      await setSetting(env, "working_hours_message_mode", mode === "default" ? "default" : "custom");
    }

    if (body.working_hours_closed_message !== undefined) {
      await setSetting(env, "working_hours_closed_message", String(body.working_hours_closed_message || ""));
    }

    if (body.admin_view_language !== undefined) {
      const language = SUPPORTED_LANGUAGES.includes(String(body.admin_view_language)) ? String(body.admin_view_language) : "en";
      await setSetting(env, "admin_view_language", language);
    }

    if (body.allow_preferred_customer_location !== undefined) {
      await setSetting(env, "allow_preferred_customer_location", normalizeOnOff(body.allow_preferred_customer_location, "on"));
    }

    if (body.allow_new_customer_location !== undefined) {
      await setSetting(env, "allow_new_customer_location", normalizeOnOff(body.allow_new_customer_location, "on"));
    }

    if (body.allow_customer_pickup !== undefined) {
      await setSetting(env, "allow_customer_pickup", normalizeOnOff(body.allow_customer_pickup, "on"));
    }

    if (body.allowed_delivery_cities !== undefined) {
      const cities = Array.isArray(body.allowed_delivery_cities)
        ? body.allowed_delivery_cities.map((city) => String(city || "").trim()).filter(Boolean)
        : String(body.allowed_delivery_cities || "").split(",").map((city) => city.trim()).filter(Boolean);
      await setAllowedDeliveryCities(env, cities);
    }

    if (body.ai_response_mode !== undefined) {
      const mode = String(body.ai_response_mode || "rule_base");
      await setSetting(env, "ai_response_mode", mode === "ai_fallback" ? "ai_fallback" : "rule_base");
    }

    if (body.ai_custom_instructions !== undefined) {
      await setSetting(env, "ai_custom_instructions", String(body.ai_custom_instructions || "").trim());
    }

    await logAdminAction(env, request, session, "api_settings_updated", "admin_settings");

    return apiOk({
      settings: await getApiAdminSettings(env)
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}



async function getPublicCatalog(env) {
  const productsResult = await env.DB.prepare(
    `SELECT
       p.id,
       p.name,
       p.price,
       p.is_active,
       p.category_id,
       pc.name AS category_name
     FROM products p
     LEFT JOIN product_categories pc ON pc.id = p.category_id
     WHERE p.is_active = 1
     ORDER BY pc.name ASC, p.name ASC`
  ).all();

  const categories = await getActiveProductCategories(env);
  const meetingPoints = await getActiveMeetingPoints(env);
  const fulfillmentSettings = await getFulfillmentSettings(env);

  return {
    products: (productsResult.results || []).map((product) => mapProductForApi(product, {})),
    categories: categories.map((category) => ({
      id: Number(category.id),
      name: category.name || ""
    })),
    meeting_points: meetingPoints.map(mapMeetingPointForApi),
    fulfillment: {
      allow_preferred_customer_location: fulfillmentSettings.allowPreferred,
      allow_new_customer_location: fulfillmentSettings.allowNew,
      allow_customer_pickup: fulfillmentSettings.allowPickup
    },
    allowed_delivery_cities: await getAllowedDeliveryCities(env),
    languages: SUPPORTED_LANGUAGES,
    app: {
      name: env.APP_NAME || "CRM Delivery",
      api_version: "v1"
    }
  };
}

async function handleApiPublicCatalog(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  return apiOk({
    catalog: await getPublicCatalog(env)
  });
}

async function handleApiPublicMeetingPoints(request, env) {
  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const meetingPoints = await getActiveMeetingPoints(env);

  return apiOk({
    meeting_points: meetingPoints.map(mapMeetingPointForApi),
    count: meetingPoints.length
  });
}



function makeMobileCustomerIdentity() {
  return `app:${crypto.randomUUID()}`;
}

function normalizeCustomerAppLanguage(language) {
  const value = String(language || "en").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(value) ? value : "en";
}

function mapCustomerSessionProfile(customer) {
  const preferredLanguage = normalizeCustomerAppLanguage(
    customer?.preferred_language || customer?.language || "en"
  );

  return {
    id: Number(customer.id),
    full_name: customer.full_name || "",
    username: customer.username || "",
    language: preferredLanguage,
    preferred_language: preferredLanguage,
    conversation_state: customer.conversation_state || null,
    created_at: customer.created_at || "",
    last_seen_at: customer.last_seen_at || ""
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashCustomerSessionToken(env, token) {
  return sha256Hex(`${env.ADMIN_JWT_SECRET || "fallback-secret"}:customer:${token}`);
}

function createCustomerRawToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function getExistingAppCustomerByDeviceId(env, deviceId) {
  const cleanDeviceId = String(deviceId || "").trim();

  if (!cleanDeviceId) return null;

  return env.DB.prepare(`
    SELECT c.*
    FROM customer_app_sessions s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.device_id = ?
      AND c.telegram_user_id LIKE 'app:%'
    ORDER BY s.last_seen_at DESC, s.created_at DESC
    LIMIT 1
  `).bind(cleanDeviceId).first();
}

async function createAppCustomer(env, body) {
  const preferredLanguage = normalizeCustomerAppLanguage(body.language || body.preferred_language || "en");
  const fullName = String(body.full_name || body.name || "").trim() || null;
  const username = String(body.username || "").trim() || null;
  const deviceId = String(body.device_id || "").trim();
  const existing = await getExistingAppCustomerByDeviceId(env, deviceId);

  if (existing) {
    await env.DB.prepare(
      `UPDATE customers
       SET username = ?,
           full_name = ?,
           language = ?,
           preferred_language = ?,
           last_seen_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      username || existing.username || null,
      fullName || existing.full_name || null,
      preferredLanguage,
      preferredLanguage,
      existing.id
    ).run();

    return env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(existing.id).first();
  }

  const mobileIdentity = makeMobileCustomerIdentity();

  const result = await env.DB.prepare(
    "INSERT INTO customers (telegram_user_id, username, full_name, language, preferred_language) VALUES (?, ?, ?, ?, ?)"
  ).bind(mobileIdentity, username, fullName, preferredLanguage, preferredLanguage).run();

  return env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(result.meta.last_row_id).first();
}

async function createCustomerAppSession(env, customerId, body) {
  const token = createCustomerRawToken();
  const tokenHash = await hashCustomerSessionToken(env, token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();

  await env.DB.prepare(
    `INSERT INTO customer_app_sessions
     (customer_id, token_hash, device_id, platform, app_version, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    customerId,
    tokenHash,
    String(body.device_id || "").trim() || null,
    String(body.platform || "android").trim() || "android",
    String(body.app_version || "").trim() || null,
    expiresAt
  ).run();

  return {
    access_token: token,
    token_type: "Bearer",
    expires_at: expiresAt
  };
}

function getCustomerBearerToken(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

async function getApiCustomerSession(request, env) {
  const token = getCustomerBearerToken(request);
  if (!token) return null;

  const tokenHash = await hashCustomerSessionToken(env, token);
  const row = await env.DB.prepare(
    `SELECT
       s.id AS session_id,
       s.expires_at,
       s.is_active,
       c.*
     FROM customer_app_sessions s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = ?
       AND s.is_active = 1
       AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`
  ).bind(tokenHash).first();

  if (!row) return null;

  await env.DB.prepare(
    "UPDATE customer_app_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(row.session_id).run();

  await env.DB.prepare(
    "UPDATE customers SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(row.id).run();

  return {
    session_id: Number(row.session_id),
    expires_at: row.expires_at,
    customer: row
  };
}

async function requireApiCustomerSession(request, env) {
  const session = await getApiCustomerSession(request, env);
  return session || null;
}

async function handleApiCustomerSessionStart(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const customer = await createAppCustomer(env, body);
  const session = await createCustomerAppSession(env, customer.id, body);

  return apiOk({
    session,
    customer: mapCustomerSessionProfile(customer)
  }, 201);
}


async function handleApiCustomerSessionLogout(request, env) {
  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const token = getCustomerBearerToken(request);

  if (!token) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  const tokenHash = await hashCustomerSessionToken(env, token);

  const result = await env.DB.prepare(
    `UPDATE customer_app_sessions
     SET is_active = 0,
         revoked_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP
     WHERE token_hash = ?
       AND is_active = 1`
  ).bind(tokenHash).run();

  return apiOk({
    logged_out: true,
    revoked_count: Number(result.meta?.changes || 0)
  });
}


async function handleApiCustomerSessionVerify(request, env) {
  if (request.method !== "POST" && request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  return apiOk({
    valid: true,
    expires_at: session.expires_at,
    customer: mapCustomerSessionProfile(session.customer)
  });
}

async function handleApiCustomerMe(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method === "GET") {
    return apiOk({
      customer: mapCustomerSessionProfile(session.customer)
    });
  }

  if (request.method !== "PATCH" && request.method !== "PUT") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const fullName = body.full_name === undefined
    ? session.customer.full_name
    : String(body.full_name || "").trim() || null;

  const username = body.username === undefined
    ? session.customer.username
    : String(body.username || "").trim() || null;

  const preferredLanguage = body.preferred_language === undefined && body.language === undefined
    ? session.customer.preferred_language
    : normalizeCustomerAppLanguage(body.preferred_language || body.language || "en");

  await env.DB.prepare(
    `UPDATE customers
     SET full_name = ?,
         username = ?,
         preferred_language = ?,
         language = ?,
         last_seen_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(fullName, username, preferredLanguage, preferredLanguage, session.customer.id).run();

  const updatedCustomer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?")
    .bind(session.customer.id)
    .first();

  return apiOk({
    customer: mapCustomerSessionProfile(updatedCustomer)
  });
}



async function getApiCustomerLocations(env, customerId, sessionToken) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM customer_locations_v2
    WHERE customer_id = ?
       OR session_token = ?
    ORDER BY is_preferred DESC, datetime(updated_at) DESC, datetime(created_at) DESC, id DESC
    LIMIT 20
  `).bind(customerId, sessionToken).all();

  return (result.results || []).map(mapCustomerLocationForApi);
}

async function handleApiCustomerLocations(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  const customerId = Number(session.customer.id);
  const sessionToken = getCustomerOrderSessionToken(customerId);

  if (request.method === "GET") {
    const locations = await getApiCustomerLocations(env, customerId, sessionToken);

    return apiOk({
      locations,
      count: locations.length
    });
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const label = String(body.label || body.location_label || body.address || "").trim();
  const address = String(body.address || body.location_label || body.label || "").trim();
  const googleMapsLink = String(body.google_maps_link || "").trim();
  const latitude = body.latitude !== undefined && body.latitude !== null ? String(body.latitude).trim() : "";
  const longitude = body.longitude !== undefined && body.longitude !== null ? String(body.longitude).trim() : "";
  const hasCoordinates = Boolean(latitude && longitude);

  if (!label && !address && !googleMapsLink) {
    return apiError("delivery_location_required", "Location label, address, Google Maps link, or coordinates are required.", 400);
  }

  if (!googleMapsLink && !hasCoordinates) {
    return apiError(
      "delivery_location_needs_confirmation",
      "Please add a Google Maps link or latitude and longitude before saving this delivery location.",
      400,
      { address: address || label }
    );
  }

  const created = await createCustomerLocationV2(env, customerId, sessionToken, {
    label,
    address,
    google_maps_link: googleMapsLink,
    latitude,
    longitude,
    is_preferred: body.is_preferred || body.save_as_preferred || false,
    source: "customer_app_saved"
  });

  if (body.is_preferred || body.save_as_preferred) {
    await setPreferredCustomerLocation(env, customerId, created.id);
  }

  const updated = await env.DB.prepare("SELECT * FROM customer_locations_v2 WHERE id = ?")
    .bind(created.id)
    .first();

  const locations = await getApiCustomerLocations(env, customerId, sessionToken);

  return apiOk({
    location: mapCustomerLocationForApi(updated || created),
    locations,
    count: locations.length
  }, 201);
}


function getCustomerOrderSessionToken(customerId) {
  return `app_customer_${customerId}`;
}

function normalizeFulfillmentType(value) {
  const clean = String(value || "").trim().toLowerCase();
  return clean === "pickup" ? "pickup" : "delivery";
}

function normalizeOrderStatusLabel(status) {
  const labels = {
    draft: "Draft",
    submitted: "Submitted",
    preparing: "Preparing",
    scheduled_for_next_online_order: "Scheduled for next online order time",
    cancelled: "Cancelled",
    closed: "Closed",
    delivered: "Delivered"
  };
  return labels[status] || status || "Draft";
}

function normalizeDeliveryStatusLabel(status) {
  const labels = {
    not_started: "Not started",
    on_the_way: "On the way",
    cancelled: "Cancelled",
    delivered: "Delivered",
    not_delivered: "Not delivered"
  };
  return labels[String(status || "")] || status || "";
}

function normalizePickupStatusLabel(status) {
  const labels = {
    preparing: "Preparing",
    ready_to_pickup: "Ready to pick up",
    cancelled: "Cancelled",
    picked_up: "Picked up",
    closed: "Closed"
  };
  return labels[String(status || "")] || status || "";
}

function normalizeGroupStatusLabel(status) {
  const labels = {
    draft: "Draft",
    submitted: "Submitted",
    pending_admin_approval: "Waiting for admin approval",
    approved: "Approved",
    rejected: "Rejected",
    waiting_ready_to_pickup: "Waiting until ready to pick up",
    confirmed: "Confirmed",
    scheduled_for_next_online_order: "Scheduled for next online order time",
    cancelled: "Cancelled"
  };
  return labels[status] || status || "";
}

function makePublicOrderCode() {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function isTerminalOrderStatus(status) {
  return ["cancelled", "closed", "delivered"].includes(String(status || ""));
}

async function getOnlineOrderingStatus(env) {
  const isOpen = await isWithinWorkingHours(env);
  const timezone = await getSetting(env, "working_hours_timezone") || "Europe/Berlin";
  const startValue = await getSetting(env, "working_hours_start") || "10:00";

  const now = new Date();
  const yyyyMmDd = now.toISOString().slice(0, 10);
  let nextOnlineOrderAt = `${yyyyMmDd}T${startValue}:00`;

  if (!isOpen) {
    nextOnlineOrderAt = `${yyyyMmDd}T${startValue}:00`;
  }

  return {
    is_open: isOpen,
    wording: "online_ordering",
    timezone,
    next_online_order_at: nextOnlineOrderAt
  };
}

async function ensureV2CartSession(env, sessionToken, customer = null) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO customer_cart_sessions (session_token, customer_name, phone)
    VALUES (?, ?, ?)
  `).bind(
    sessionToken,
    customer?.full_name || "",
    ""
  ).run();

  await env.DB.prepare(`
    UPDATE customer_cart_sessions
    SET updated_at = CURRENT_TIMESTAMP,
        customer_name = COALESCE(NULLIF(?, ''), customer_name)
    WHERE session_token = ?
  `).bind(customer?.full_name || "", sessionToken).run();
}

async function getV2CartItems(env, sessionToken) {
  const result = await env.DB.prepare(`
    SELECT
      ci.id,
      ci.session_token,
      ci.product_id,
      ci.quantity,
      ci.created_at,
      ci.updated_at,
      p.name AS product_name,
      p.price AS unit_price,
      COALESCE(p.shop_id, 1) AS shop_id,
      s.name AS shop_name,
      (ci.quantity * p.price) AS line_total
    FROM customer_cart_items_v2 ci
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN shops s ON s.id = COALESCE(p.shop_id, 1)
    WHERE ci.session_token = ?
    ORDER BY ci.created_at ASC, ci.id ASC
  `).bind(sessionToken).all();

  return result.results || [];
}

function mapV2CartItemForApi(item) {
  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.unit_price || item.price_snapshot || 0);

  return {
    id: Number(item.id),
    product_id: Number(item.product_id),
    item_type: "product",
    name: item.product_name || item.name || "",
    quantity,
    unit_price: unitPrice,
    price_snapshot: unitPrice,
    line_total: Number(item.line_total || unitPrice * quantity),
    shop_id: item.shop_id !== null && item.shop_id !== undefined ? Number(item.shop_id) : null,
    shop_name: item.shop_name || "",
    created_at: item.created_at || "",
    updated_at: item.updated_at || ""
  };
}

async function getActiveV2Order(env, sessionToken) {
  return await env.DB.prepare(`
    SELECT
      o.*,
      c.id AS customer_id,
      c.full_name AS customer_full_name,
      c.username AS customer_username,
      c.telegram_user_id AS customer_telegram_user_id,
      c.language AS customer_language,
      c.preferred_language AS customer_preferred_language
    FROM customer_orders_v2 o
    LEFT JOIN customers c ON o.session_token = ('app_customer_' || c.id)
    WHERE o.session_token = ?
      AND COALESCE(o.order_status, o.status, 'draft') NOT IN ('cancelled', 'closed', 'delivered')
    ORDER BY datetime(o.updated_at) DESC, o.id DESC
    LIMIT 1
  `).bind(sessionToken).first();
}

async function getScheduledV2Order(env, sessionToken, fulfillmentType) {
  return await env.DB.prepare(`
    SELECT *
    FROM customer_orders_v2
    WHERE session_token = ?
      AND fulfillment_type = ?
      AND scheduled_for_next_online_order = 1
      AND COALESCE(order_status, '') != 'cancelled'
    ORDER BY datetime(updated_at) DESC, id DESC
    LIMIT 1
  `).bind(sessionToken, fulfillmentType).first();
}

async function getV2OrderGroups(env, orderId) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM order_addition_groups_v2
    WHERE customer_order_id = ?
    ORDER BY id ASC
  `).bind(orderId).all();

  return result.results || [];
}

async function getV2OrderItems(env, orderId) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM customer_order_items_v2
    WHERE customer_order_id = ?
    ORDER BY id ASC
  `).bind(orderId).all();

  return result.results || [];
}

function mapV2OrderItemForApi(item) {
  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.unit_price || 0);
  const lineTotal = Number(item.line_total || unitPrice * quantity);

  return {
    id: Number(item.id),
    customer_order_id: Number(item.customer_order_id),
    group_id: item.group_id !== null && item.group_id !== undefined ? Number(item.group_id) : null,
    product_id: Number(item.product_id),
    name: item.product_name || "",
    product_name: item.product_name || "",
    quantity,
    unit_price: unitPrice,
    line_total: lineTotal,
    item_status: item.item_status || "confirmed",
    added_phase: item.added_phase || "initial_checkout",
    requires_admin_approval: Number(item.requires_admin_approval || 0) === 1,
    admin_decision: item.admin_decision || "",
    admin_decision_note: item.admin_decision_note || "",
    decided_at: item.decided_at || "",
    created_at: item.created_at || ""
  };
}

function calculateOrderSectionTotals(items) {
  const sections = {
    confirmed: { item_count: 0, total_amount: 0 },
    pending_admin_approval: { item_count: 0, total_amount: 0 },
    waiting_ready_to_pickup: { item_count: 0, total_amount: 0 },
    rejected: { item_count: 0, total_amount: 0 },
    scheduled_for_next_online_order: { item_count: 0, total_amount: 0 },
    cancelled: { item_count: 0, total_amount: 0 }
  };

  for (const item of items) {
    const status = item.item_status || "confirmed";
    const bucket = sections[status] ? status : "confirmed";
    sections[bucket].item_count += Number(item.quantity || 0);
    sections[bucket].total_amount += Number(item.line_total || 0);
  }

  return sections;
}

function mapV2OrderGroupForApi(group, items) {
  const groupItems = items.filter((item) => Number(item.group_id || 0) === Number(group.id));
  const total = groupItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);

  return {
    id: Number(group.id),
    customer_order_id: Number(group.customer_order_id),
    group_type: group.group_type || "initial_checkout",
    group_status: group.group_status || "draft",
    group_status_label: normalizeGroupStatusLabel(group.group_status || "draft"),
    fulfillment_type: group.fulfillment_type || "",
    requires_admin_approval: Number(group.requires_admin_approval || 0) === 1,
    scheduled_for_next_online_order: Number(group.scheduled_for_next_online_order || 0) === 1,
    next_online_order_at: group.next_online_order_at || "",
    admin_decision: group.admin_decision || "",
    admin_decision_note: group.admin_decision_note || "",
    decided_at: group.decided_at || "",
    total_amount: total,
    total_formatted: formatPrice(total),
    item_count: groupItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    items: groupItems,
    created_at: group.created_at || "",
    updated_at: group.updated_at || ""
  };
}

async function mapV2OrderForApi(env, order) {
  if (!order) return null;

  const rawItems = await getV2OrderItems(env, order.id);
  const items = rawItems.map(mapV2OrderItemForApi);
  const groups = (await getV2OrderGroups(env, order.id)).map((group) => mapV2OrderGroupForApi(group, items));
  const sectionTotals = calculateOrderSectionTotals(items);
  const confirmedTotal = sectionTotals.confirmed.total_amount;
  const activeTotal =
    sectionTotals.confirmed.total_amount +
    sectionTotals.pending_admin_approval.total_amount +
    sectionTotals.waiting_ready_to_pickup.total_amount +
    sectionTotals.scheduled_for_next_online_order.total_amount;
  const historicalStatuses = new Set([
    "confirmed",
    "approved",
    "waiting_ready_to_pickup",
    "scheduled_for_next_online_order"
  ]);
  const historicalTotal = rawItems.reduce((total, item) => {
    const historicalStatus =
      item.status_before_cancel ||
      item.item_status ||
      "confirmed";

    if (!historicalStatuses.has(historicalStatus)) {
      return total;
    }

    return total + Number(item.line_total || 0);
  }, 0);
  const displayTotal =
    confirmedTotal ||
    Number(order.total_amount || 0) ||
    activeTotal ||
    historicalTotal;

  return {
    id: Number(order.id),
    public_order_code: order.public_order_code || "",
    session_token: order.session_token || "",
    customer: {
      id: order.customer_id !== null && order.customer_id !== undefined ? Number(order.customer_id) : null,
      full_name: order.customer_full_name || "",
      username: order.customer_username || "",
      telegram_user_id: order.customer_telegram_user_id || "",
      preferred_language: order.customer_preferred_language || order.customer_language || ""
    },
    status: order.status || order.order_status || "draft",
    order_status: order.order_status || order.status || "draft",
    order_status_label: normalizeOrderStatusLabel(order.order_status || order.status || "draft"),
    fulfillment_type: order.fulfillment_type || "",
    delivery_status: order.delivery_status || "",
    delivery_status_label: normalizeDeliveryStatusLabel(order.delivery_status || ""),
    pickup_status: order.pickup_status || "",
    pickup_status_label: normalizePickupStatusLabel(order.pickup_status || ""),
    delivery_location_id: order.delivery_location_id || null,
    delivery_location_label: order.delivery_location_label || order.delivery_address || "",
    delivery_google_maps_link: order.delivery_google_maps_link || "",
    delivery_address: order.delivery_address || "",
    scheduled_for_next_online_order: Number(order.scheduled_for_next_online_order || 0) === 1,
    next_online_order_at: order.next_online_order_at || "",
    active_shop_id: order.active_shop_id || null,
    admin_status_note: order.admin_status_note || "",
    cancelled_at: order.cancelled_at || "",
    cancel_reason: order.cancel_reason || "",
    recreated_from_order_id:
      order.recreated_from_order_id === null ||
      order.recreated_from_order_id === undefined
        ? null
        : Number(order.recreated_from_order_id),
    recreated_by_admin_id:
      order.recreated_by_admin_id === null ||
      order.recreated_by_admin_id === undefined
        ? null
        : Number(order.recreated_by_admin_id),
    recreation_reason: order.recreation_reason || "",
    recreation_confirmed_at:
      order.recreation_confirmed_at || "",
    active_recreated_order_id:
      order.active_recreated_order_id === null ||
      order.active_recreated_order_id === undefined
        ? null
        : Number(order.active_recreated_order_id),
    recreated_order_count:
      Number(order.recreated_order_count || 0),
    currency: order.currency || "EUR",
    total_amount: displayTotal,
    total_formatted: formatPrice(displayTotal),
    section_totals: {
      confirmed: { ...sectionTotals.confirmed, total_formatted: formatPrice(sectionTotals.confirmed.total_amount) },
      pending_admin_approval: { ...sectionTotals.pending_admin_approval, total_formatted: formatPrice(sectionTotals.pending_admin_approval.total_amount) },
      waiting_ready_to_pickup: { ...sectionTotals.waiting_ready_to_pickup, total_formatted: formatPrice(sectionTotals.waiting_ready_to_pickup.total_amount) },
      rejected: { ...sectionTotals.rejected, total_formatted: formatPrice(sectionTotals.rejected.total_amount) },
      scheduled_for_next_online_order: { ...sectionTotals.scheduled_for_next_online_order, total_formatted: formatPrice(sectionTotals.scheduled_for_next_online_order.total_amount) },
      cancelled: { ...sectionTotals.cancelled, total_formatted: formatPrice(sectionTotals.cancelled.total_amount) }
    },
    groups,
    items,
    created_at: order.created_at || "",
    updated_at: order.updated_at || ""
  };
}

async function getV2CartPayload(env, customer) {
  const sessionToken = getCustomerOrderSessionToken(customer.id);
  await ensureV2CartSession(env, sessionToken, customer);

  const items = (await getV2CartItems(env, sessionToken)).map(mapV2CartItemForApi);
  const total = items.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  const activeOrder = await getActiveV2Order(env, sessionToken);

  return {
    id: null,
    session_token: sessionToken,
    status: "active",
    order_status: activeOrder?.order_status || "draft",
    active_order_id: activeOrder ? Number(activeOrder.id) : null,
    active_order: activeOrder ? await mapV2OrderForApi(env, activeOrder) : null,
    item_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    total_amount: total,
    total_formatted: formatPrice(total),
    currency: "EUR",
    items
  };
}

async function createCustomerLocationV2(env, customerId, sessionToken, data) {
  const label = String(data.label || data.location_label || data.address || "").trim();
  const address = String(data.address || data.location_label || "").trim();
  const googleMapsLink = String(data.google_maps_link || "").trim();
  const latitude = data.latitude !== undefined && data.latitude !== null ? String(data.latitude).trim() : "";
  const longitude = data.longitude !== undefined && data.longitude !== null ? String(data.longitude).trim() : "";
  const finalMapLink = googleMapsLink || (latitude && longitude ? makeGoogleMapsLink(latitude, longitude) : "");

  const insert = await env.DB.prepare(`
    INSERT INTO customer_locations_v2 (
      customer_id,
      session_token,
      label,
      address,
      google_maps_link,
      latitude,
      longitude,
      is_preferred,
      source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    customerId,
    sessionToken,
    label || address,
    address || label,
    finalMapLink,
    latitude || null,
    longitude || null,
    data.is_preferred ? 1 : 0,
    String(data.source || "customer_app_saved")
  ).run();

  return await env.DB.prepare("SELECT * FROM customer_locations_v2 WHERE id = ?")
    .bind(insert.meta.last_row_id)
    .first();
}

async function getCustomerLocationForCheckout(env, customerId, sessionToken, body) {
  const savedLocationId = Number(body.saved_location_id || body.location_id || body.delivery_location_id || 0);

  if (savedLocationId) {
    const saved = await env.DB.prepare(`
      SELECT *
      FROM customer_locations_v2
      WHERE id = ?
        AND (customer_id = ? OR session_token = ?)
      LIMIT 1
    `).bind(savedLocationId, customerId, sessionToken).first();

    if (saved) return saved;
  }

  if (body.use_preferred_location || body.preferred_location) {
    const preferred = await env.DB.prepare(`
      SELECT *
      FROM customer_locations_v2
      WHERE (customer_id = ? OR session_token = ?)
        AND is_preferred = 1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).bind(customerId, sessionToken).first();

    if (preferred) return preferred;
  }

  const latitude = body.latitude !== undefined && body.latitude !== null ? String(body.latitude).trim() : "";
  const longitude = body.longitude !== undefined && body.longitude !== null ? String(body.longitude).trim() : "";
  const googleMapsLink = String(body.google_maps_link || "").trim() || (latitude && longitude ? makeGoogleMapsLink(latitude, longitude) : "");
  const address = String(body.address || body.location_label || body.description || "").trim();

  if (!address && !googleMapsLink) return null;

  if (!googleMapsLink) {
    return {
      weak_location: true,
      label: address,
      address,
      google_maps_link: "",
      latitude: "",
      longitude: ""
    };
  }

  return await createCustomerLocationV2(env, customerId, sessionToken, {
    label: String(body.location_label || address).trim(),
    address,
    google_maps_link: googleMapsLink,
    latitude,
    longitude,
    is_preferred: body.save_as_preferred || false,
    source: "customer_app_checkout"
  });
}

async function createV2Order(env, sessionToken, customer, fulfillmentType, fields = {}) {
  const code = makePublicOrderCode();
  const now = new Date().toISOString();

  const insert = await env.DB.prepare(`
    INSERT INTO customer_orders_v2 (
      public_order_code,
      session_token,
      status,
      order_status,
      fulfillment_type,
      delivery_status,
      pickup_status,
      delivery_location_id,
      delivery_location_label,
      delivery_google_maps_link,
      delivery_address,
      scheduled_for_next_online_order,
      next_online_order_at,
      active_shop_id,
      total_amount,
      currency,
      customer_name,
      phone,
      payment_method_code,
      notes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'EUR', ?, '', ?, ?, ?, ?)
  `).bind(
    code,
    sessionToken,
    fields.status || fields.order_status || "submitted",
    fields.order_status || fields.status || "submitted",
    fulfillmentType,
    fields.delivery_status || (fulfillmentType === "delivery" ? "not_started" : null),
    fields.pickup_status || (fulfillmentType === "pickup" ? "preparing" : null),
    fields.delivery_location_id || null,
    fields.delivery_location_label || "",
    fields.delivery_google_maps_link || "",
    fields.delivery_address || "",
    fields.scheduled_for_next_online_order ? 1 : 0,
    fields.next_online_order_at || null,
    fields.active_shop_id || null,
    customer?.full_name || "",
    fields.payment_method_code || "",
    fields.notes || "",
    now,
    now
  ).run();

  return await env.DB.prepare("SELECT * FROM customer_orders_v2 WHERE id = ?")
    .bind(insert.meta.last_row_id)
    .first();
}

async function createV2OrderGroup(env, orderId, fields) {
  const insert = await env.DB.prepare(`
    INSERT INTO order_addition_groups_v2 (
      customer_order_id,
      group_type,
      group_status,
      fulfillment_type,
      requires_admin_approval,
      scheduled_for_next_online_order,
      next_online_order_at,
      admin_decision_note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderId,
    fields.group_type || "initial_checkout",
    fields.group_status || "submitted",
    fields.fulfillment_type || "",
    fields.requires_admin_approval ? 1 : 0,
    fields.scheduled_for_next_online_order ? 1 : 0,
    fields.next_online_order_at || null,
    fields.admin_decision_note || null
  ).run();

  return await env.DB.prepare("SELECT * FROM order_addition_groups_v2 WHERE id = ?")
    .bind(insert.meta.last_row_id)
    .first();
}

async function moveV2CartItemsToOrderGroup(env, sessionToken, orderId, group, itemStatus, addedPhase, requiresApproval) {
  const cartItems = await getV2CartItems(env, sessionToken);

  for (const item of cartItems) {
    await env.DB.prepare(`
      INSERT INTO customer_order_items_v2 (
        customer_order_id,
        group_id,
        product_id,
        product_name,
        shop_id,
        quantity,
        unit_price,
        line_total,
        item_status,
        added_phase,
        requires_admin_approval
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      group.id,
      item.product_id,
      item.product_name,
      item.shop_id,
      item.quantity,
      item.unit_price,
      item.line_total,
      itemStatus,
      addedPhase,
      requiresApproval ? 1 : 0
    ).run();
  }

  await env.DB.prepare("DELETE FROM customer_cart_items_v2 WHERE session_token = ?")
    .bind(sessionToken)
    .run();

  return cartItems;
}

async function updateV2OrderConfirmedTotal(env, orderId) {
  const totalRow = await env.DB.prepare(`
    SELECT COALESCE(SUM(line_total), 0) AS total
    FROM customer_order_items_v2
    WHERE customer_order_id = ?
      AND item_status IN ('confirmed', 'approved')
  `).bind(orderId).first();

  await env.DB.prepare(`
    UPDATE customer_orders_v2
    SET total_amount = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(Number(totalRow?.total || 0), orderId).run();
}

async function handleApiCustomerCart(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method === "GET") {
    return apiOk({
      cart: await getV2CartPayload(env, session.customer)
    });
  }

  if (request.method === "DELETE") {
    const sessionToken = getCustomerOrderSessionToken(session.customer.id);
    await env.DB.prepare("DELETE FROM customer_cart_items_v2 WHERE session_token = ?")
      .bind(sessionToken)
      .run();

    return apiOk({
      cart: await getV2CartPayload(env, session.customer)
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function handleApiCustomerCartItems(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const productId = Number(body.product_id || 0);
  const quantity = Math.max(1, Math.floor(Number(body.quantity || 1)));

  if (!productId) {
    return apiError("invalid_product", "product_id is required.", 400);
  }

  const product = await env.DB.prepare(`
    SELECT id, name, price, is_active, COALESCE(shop_id, 1) AS shop_id
    FROM products
    WHERE id = ? AND is_active = 1
  `).bind(productId).first();

  if (!product) {
    return apiError("product_not_found", "Product is not available.", 404);
  }

  const sessionToken = getCustomerOrderSessionToken(session.customer.id);
  await ensureV2CartSession(env, sessionToken, session.customer);

  await env.DB.prepare(`
    INSERT INTO customer_cart_items_v2 (session_token, product_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(session_token, product_id)
    DO UPDATE SET
      quantity = quantity + excluded.quantity,
      updated_at = CURRENT_TIMESTAMP
  `).bind(sessionToken, productId, quantity).run();

  return apiOk({
    cart: await getV2CartPayload(env, session.customer)
  }, 201);
}

async function handleApiCustomerCartItemDetail(request, env, itemId) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  const sessionToken = getCustomerOrderSessionToken(session.customer.id);

  const item = await env.DB.prepare(`
    SELECT *
    FROM customer_cart_items_v2
    WHERE id = ? AND session_token = ?
  `).bind(itemId, sessionToken).first();

  if (!item) {
    return apiError("item_not_found", "Cart item was not found.", 404);
  }

  if (request.method === "PATCH" || request.method === "PUT") {
    const body = await readJsonBody(request);

    if (!body) {
      return apiError("invalid_json", "Request body must be valid JSON.", 400);
    }

    const quantity = Math.max(1, Math.floor(Number(body.quantity || item.quantity || 1)));

    await env.DB.prepare(`
      UPDATE customer_cart_items_v2
      SET quantity = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND session_token = ?
    `).bind(quantity, itemId, sessionToken).run();

    return apiOk({
      cart: await getV2CartPayload(env, session.customer)
    });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM customer_cart_items_v2 WHERE id = ? AND session_token = ?")
      .bind(itemId, sessionToken)
      .run();

    return apiOk({
      cart: await getV2CartPayload(env, session.customer)
    });
  }

  return apiError("method_not_allowed", "Method not allowed.", 405);
}

async function ensureV2CartHasItems(env, sessionToken) {
  const items = await getV2CartItems(env, sessionToken);

  if (!items.length) {
    return { error: apiError("cart_empty", "Cart is empty.", 400), items: [] };
  }

  return { items };
}

async function submitV2Checkout(env, session, body, fulfillmentType) {
  const customer = session.customer;
  const sessionToken = getCustomerOrderSessionToken(customer.id);
  await ensureV2CartSession(env, sessionToken, customer);

  const cartCheck = await ensureV2CartHasItems(env, sessionToken);
  if (cartCheck.error) return { error: cartCheck.error };

  const onlineOrdering = await getOnlineOrderingStatus(env);
  const activeOrder = await getActiveV2Order(env, sessionToken);

  let location = null;

  if (fulfillmentType === "delivery") {
    location = await getCustomerLocationForCheckout(env, customer.id, sessionToken, body);

    if (!location) {
      return {
        error: apiError(
          "delivery_location_required",
          "Please choose your preferred location, choose one of your saved locations, share a location, or enter a confirmed address before delivery checkout.",
          400,
          {
            checkout_choices: [
              "delivery_to_preferred_location",
              "choose_saved_location",
              "delivery_to_new_address",
              "pickup_from_shop"
            ]
          }
        )
      };
    }

    if (location.weak_location) {
      return {
        error: apiError(
          "delivery_location_needs_confirmation",
          "This delivery address is not confirmed. Please choose a saved location, share a map location, or select a geocoded address.",
          400,
          { address: location.address || location.label || "" }
        )
      };
    }

    const cityValidation = await validateDeliveryLocationAgainstAllowedCities(env, location);

    if (!cityValidation.ok) {
      return {
        error: apiError(
          cityValidation.code || "delivery_city_not_allowed",
          cityValidation.message || "Delivery is not available for this location.",
          400,
          {
            allowed_cities: cityValidation.allowed_cities || [],
            detected_city: cityValidation.detected_city || "",
            delivery_location_label: location.label || location.address || ""
          }
        )
      };
    }
  }

  let order = null;
  let groupFields = null;
  let itemStatus = "confirmed";
  let addedPhase = "initial_checkout";
  let requiresApproval = false;

  if (!onlineOrdering.is_open) {
    order = await getScheduledV2Order(env, sessionToken, fulfillmentType);

    if (!order) {
      order = await createV2Order(env, sessionToken, customer, fulfillmentType, {
        status: "scheduled_for_next_online_order",
        order_status: "scheduled_for_next_online_order",
        delivery_status: fulfillmentType === "delivery" ? "not_started" : null,
        pickup_status: fulfillmentType === "pickup" ? "preparing" : null,
        delivery_location_id: location?.id || null,
        delivery_location_label: location?.label || location?.address || "",
        delivery_google_maps_link: location?.google_maps_link || "",
        delivery_address: location?.address || "",
        scheduled_for_next_online_order: true,
        next_online_order_at: onlineOrdering.next_online_order_at,
        notes: body.delivery_note || body.notes || ""
      });
    }

    groupFields = {
      group_type: fulfillmentType === "delivery" ? "scheduled_next_online_order_delivery" : "scheduled_next_online_order_pickup",
      group_status: "scheduled_for_next_online_order",
      fulfillment_type: fulfillmentType,
      requires_admin_approval: false,
      scheduled_for_next_online_order: true,
      next_online_order_at: onlineOrdering.next_online_order_at
    };
    itemStatus = "scheduled_for_next_online_order";
    addedPhase = "scheduled_next_online_order";
  } else if (!activeOrder) {
    order = await createV2Order(env, sessionToken, customer, fulfillmentType, {
      status: "submitted",
      order_status: "submitted",
      delivery_status: fulfillmentType === "delivery" ? "not_started" : null,
      pickup_status: fulfillmentType === "pickup" ? "preparing" : null,
      delivery_location_id: location?.id || null,
      delivery_location_label: location?.label || location?.address || "",
      delivery_google_maps_link: location?.google_maps_link || "",
      delivery_address: location?.address || "",
      notes: body.delivery_note || body.notes || ""
    });

    if (fulfillmentType === "pickup") {
      groupFields = {
        group_type: "initial_checkout",
        group_status: "waiting_ready_to_pickup",
        fulfillment_type: "pickup",
        requires_admin_approval: false
      };
      itemStatus = "waiting_ready_to_pickup";
      addedPhase = "initial_checkout";
    } else {
      groupFields = {
        group_type: "initial_checkout",
        group_status: "confirmed",
        fulfillment_type: "delivery",
        requires_admin_approval: false
      };
      itemStatus = "confirmed";
      addedPhase = "initial_checkout";
    }
  } else if (fulfillmentType === "delivery") {
    order = activeOrder;

    if (order.fulfillment_type && order.fulfillment_type !== "delivery") {
      order = await createV2Order(env, sessionToken, customer, "delivery", {
        status: "submitted",
        order_status: "submitted",
        delivery_status: "not_started",
        delivery_location_id: location?.id || null,
        delivery_location_label: location?.label || location?.address || "",
        delivery_google_maps_link: location?.google_maps_link || "",
        delivery_address: location?.address || "",
        notes: body.delivery_note || body.notes || ""
      });
      groupFields = {
        group_type: "initial_checkout",
        group_status: "confirmed",
        fulfillment_type: "delivery",
        requires_admin_approval: false
      };
      itemStatus = "confirmed";
      addedPhase = "initial_checkout";
    } else {
      groupFields = {
        group_type: "delivery_pending_addition",
        group_status: "pending_admin_approval",
        fulfillment_type: "delivery",
        requires_admin_approval: true
      };
      itemStatus = "pending_admin_approval";
      addedPhase = "after_checkout";
      requiresApproval = true;
    }
  } else {
    order = activeOrder;

    if (order.fulfillment_type && order.fulfillment_type !== "pickup") {
      order = await createV2Order(env, sessionToken, customer, "pickup", {
        status: "submitted",
        order_status: "submitted",
        pickup_status: "preparing",
        notes: body.delivery_note || body.notes || ""
      });
    } else {
      await env.DB.prepare(`
        UPDATE customer_orders_v2
        SET pickup_status = 'preparing',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(order.id).run();
    }

    groupFields = {
      group_type: "pickup_waiting_ready_confirmation",
      group_status: "waiting_ready_to_pickup",
      fulfillment_type: "pickup",
      requires_admin_approval: false
    };
    itemStatus = "waiting_ready_to_pickup";
    addedPhase = "after_checkout";
  }

  const group = await createV2OrderGroup(env, order.id, groupFields);
  await moveV2CartItemsToOrderGroup(env, sessionToken, order.id, group, itemStatus, addedPhase, requiresApproval);
  await updateV2OrderConfirmedTotal(env, order.id);

  const updatedOrder = await getV2OrderByIdForApi(env, order.id);

  return {
    order: await mapV2OrderForApi(env, updatedOrder),
    cart: await getV2CartPayload(env, customer),
    online_ordering: onlineOrdering
  };
}

async function handleApiCustomerCheckoutAddress(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const result = await submitV2Checkout(env, session, body, "delivery");
  if (result.error) return result.error;

  return apiOk(result, 201);
}

async function handleApiCustomerCheckoutPickup(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const body = await readJsonBody(request);

  if (!body) {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const result = await submitV2Checkout(env, session, body, "pickup");
  if (result.error) return result.error;

  return apiOk(result, 201);
}

async function getV2OrderByIdForApi(env, orderId) {
  return await env.DB.prepare(`
    SELECT
      o.*,
      c.id AS customer_id,
      c.full_name AS customer_full_name,
      c.username AS customer_username,
      c.telegram_user_id AS customer_telegram_user_id,
      c.language AS customer_language,
      c.preferred_language AS customer_preferred_language
    FROM customer_orders_v2 o
    LEFT JOIN customers c ON o.session_token = ('app_customer_' || c.id)
    WHERE o.id = ?
    LIMIT 1
  `).bind(orderId).first();
}

async function getV2CustomerOrders(env, sessionToken, orderId = null) {
  const whereOrder = orderId ? "AND o.id = ?" : "";
  const stmt = env.DB.prepare(`
    SELECT
      o.*,
      c.id AS customer_id,
      c.full_name AS customer_full_name,
      c.username AS customer_username,
      c.telegram_user_id AS customer_telegram_user_id,
      c.language AS customer_language,
      c.preferred_language AS customer_preferred_language
    FROM customer_orders_v2 o
    LEFT JOIN customers c ON o.session_token = ('app_customer_' || c.id)
    WHERE o.session_token = ?
      ${whereOrder}
    ORDER BY datetime(o.updated_at) DESC, o.id DESC
  `);

  const result = orderId
    ? await stmt.bind(sessionToken, orderId).all()
    : await stmt.bind(sessionToken).all();

  const orders = [];

  for (const order of result.results || []) {
    orders.push(await mapV2OrderForApi(env, order));
  }

  return orders;
}

async function handleApiCustomerOrders(request, env) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const sessionToken = getCustomerOrderSessionToken(session.customer.id);
  const orders = await getV2CustomerOrders(env, sessionToken);

  return apiOk({
    orders,
    count: orders.length
  });
}

async function handleApiCustomerOrderDetail(request, env, orderId) {
  const session = await requireApiCustomerSession(request, env);

  if (!session) {
    return apiError("unauthorized", "Valid customer bearer token is required.", 401);
  }

  if (request.method !== "GET") {
    return apiError("method_not_allowed", "Method not allowed.", 405);
  }

  const sessionToken = getCustomerOrderSessionToken(session.customer.id);
  const orders = await getV2CustomerOrders(env, sessionToken, orderId);

  if (!orders.length) {
    return apiError("order_not_found", "Order was not found.", 404);
  }

  return apiOk({
    order: orders[0]
  });
}


async function handleApiV1(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/v1/health" && request.method === "GET") {
    return apiOk({
      app: "CRM Delivery Worker",
      status: "ok",
      api_version: "v1"
    });
  }

  if (url.pathname === "/api/v1/capabilities" && request.method === "GET") {
    return apiOk({
      capabilities: getApiCapabilities(env)
    });
  }

  if (url.pathname === "/api/v1/admin/login") {
    return handleApiAdminLogin(request, env);
  }

  if (url.pathname === "/api/v1/admin/logout") {
    return handleApiAdminLogout(request, env);
  }

  if (url.pathname === "/api/v1/admin/password") {
    return handleApiAdminPasswordChange(request, env);
  }

  if (url.pathname === "/api/v1/admin/me") {
    return handleApiAdminMe(request, env);
  }

  // ADMIN_SUPERADMIN_API_V1_ROUTES
  if (url.pathname === "/api/v1/admin/superadmin") {
    return handleApiAdminSuperadminOverview(request, env);
  }

  if (url.pathname === "/api/v1/admin/superadmin/admins") {
    return handleApiAdminSuperadminCreate(request, env);
  }

  const superadminToggleMatch = url.pathname.match(
    /^\/api\/v1\/admin\/superadmin\/admins\/(\d+)\/toggle$/
  );
  if (superadminToggleMatch) {
    return handleApiAdminSuperadminToggle(
      request,
      env,
      superadminToggleMatch[1]
    );
  }

  const superadminDeleteMatch = url.pathname.match(
    /^\/api\/v1\/admin\/superadmin\/admins\/(\d+)$/
  );
  if (superadminDeleteMatch) {
    return handleApiAdminSuperadminDelete(
      request,
      env,
      superadminDeleteMatch[1]
    );
  }

  if (url.pathname === "/api/v1/admin/dashboard") {
    return handleApiAdminDashboard(request, env);
  }

  if (url.pathname === "/api/v1/admin/ai-info") {
    return handleApiAdminAiInfo(request, env);
  }

  const adminLearnedPatternActionMatch = url.pathname.match(
    /^\/api\/v1\/admin\/learned-patterns\/(\d+)\/(approve|reject|delete)$/
  );

  if (adminLearnedPatternActionMatch) {
    return handleApiAdminLearnedPatternAction(
      request,
      env,
      Number(adminLearnedPatternActionMatch[1]),
      adminLearnedPatternActionMatch[2]
    );
  }

  if (url.pathname === "/api/v1/admin/orders") {
    return handleApiAdminOrders(request, env, false);
  }

  if (url.pathname === "/api/v1/admin/closed-orders") {
    return handleApiAdminOrders(request, env, true);
  }

  if (url.pathname === "/api/v1/admin/customer-app-orders") {
    return handleApiAdminCustomerAppOrders(request, env);
  }

  const adminV2OrderDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)$/);
  if (adminV2OrderDetailMatch) {
    return handleApiAdminCustomerAppOrderDetail(request, env, Number(adminV2OrderDetailMatch[1]));
  }

  const adminV2OrderStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/status$/);
  if (adminV2OrderStatusMatch) {
    return handleApiAdminCustomerAppOrderStatus(request, env, Number(adminV2OrderStatusMatch[1]));
  }

  const adminV2OrderOnTheWayMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/on-the-way$/);
  if (adminV2OrderOnTheWayMatch) {
    return handleApiAdminV2DeliveryOnTheWay(request, env, Number(adminV2OrderOnTheWayMatch[1]));
  }

  const adminV2OrderReadyPickupMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/ready-to-pickup$/);
  if (adminV2OrderReadyPickupMatch) {
    return handleApiAdminV2ReadyToPickup(request, env, Number(adminV2OrderReadyPickupMatch[1]));
  }

  const adminV2OrderDeliveredMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/delivered$/);
  if (adminV2OrderDeliveredMatch) {
    return handleApiAdminV2OrderDelivered(request, env, Number(adminV2OrderDeliveredMatch[1]));
  }

  const adminV2OrderNotDeliveredMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/not-delivered$/);
  if (adminV2OrderNotDeliveredMatch) {
    return handleApiAdminV2OrderNotDelivered(request, env, Number(adminV2OrderNotDeliveredMatch[1]));
  }

  const adminV2OrderRecreateMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/recreate$/);
  if (adminV2OrderRecreateMatch) {
    return handleApiAdminV2RecreateOrder(request, env, Number(adminV2OrderRecreateMatch[1]));
  }

  const adminV2OrderConfirmRecreationMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/confirm-recreation$/);
  if (adminV2OrderConfirmRecreationMatch) {
    return handleApiAdminV2ConfirmRecreation(request, env, Number(adminV2OrderConfirmRecreationMatch[1]));
  }

  const adminV2OrderCancelMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/cancel$/);
  if (adminV2OrderCancelMatch) {
    return handleApiAdminV2CancelOrder(request, env, Number(adminV2OrderCancelMatch[1]));
  }

  const adminV2OrderGroupApproveMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/groups\/(\d+)\/approve$/);
  if (adminV2OrderGroupApproveMatch) {
    return handleApiAdminV2ApproveGroup(request, env, Number(adminV2OrderGroupApproveMatch[1]), Number(adminV2OrderGroupApproveMatch[2]));
  }

  const adminV2OrderGroupRejectMatch = url.pathname.match(/^\/api\/v1\/admin\/customer-app-orders\/(\d+)\/groups\/(\d+)\/reject$/);
  if (adminV2OrderGroupRejectMatch) {
    return handleApiAdminV2RejectGroup(request, env, Number(adminV2OrderGroupRejectMatch[1]), Number(adminV2OrderGroupRejectMatch[2]));
  }

  const adminOrderStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/(\d+)\/status$/);
  if (adminOrderStatusMatch) {
    return handleApiAdminOrderStatus(request, env, Number(adminOrderStatusMatch[1]));
  }

  const adminOrderDeliveredMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/(\d+)\/delivered$/);
  if (adminOrderDeliveredMatch) {
    return handleApiAdminOrderDelivered(request, env, Number(adminOrderDeliveredMatch[1]));
  }

  const adminOrderReturnMatch = url.pathname.match(/^\/api\/v1\/admin\/orders\/(\d+)\/return$/);
  if (adminOrderReturnMatch) {
    return handleApiAdminOrderReturn(request, env, Number(adminOrderReturnMatch[1]));
  }

  if (url.pathname === "/api/v1/admin/open-requests") {
    return handleApiAdminOpenRequests(request, env);
  }

  const adminOpenRequestStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/open-requests\/(\d+)\/status$/);
  if (adminOpenRequestStatusMatch) {
    return handleApiAdminOpenRequestStatus(request, env, Number(adminOpenRequestStatusMatch[1]));
  }

  if (url.pathname === "/api/v1/admin/open-requests/group/done") {
    return handleApiAdminOpenRequestGroupDone(request, env);
  }

  if (url.pathname === "/api/v1/admin/open-requests/all/done") {
    return handleApiAdminOpenRequestAllDone(request, env);
  }

  if (url.pathname === "/api/v1/admin/products") {
    return handleApiAdminProducts(request, env);
  }

  const productDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/products\/(\d+)$/);
  if (productDetailMatch) {
    return handleApiAdminProductDetail(request, env, Number(productDetailMatch[1]));
  }

  if (url.pathname === "/api/v1/admin/product-categories") {
    return handleApiAdminProductCategories(request, env);
  }

  const productCategoryDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/product-categories\/(\d+)$/);
  if (productCategoryDetailMatch) {
    return handleApiAdminProductCategoryDetail(request, env, Number(productCategoryDetailMatch[1]));
  }

  if (url.pathname === "/api/v1/admin/search-location") {
    return handleApiAdminLocationSearch(request, env);
  }

  if (url.pathname === "/api/v1/admin/meeting-points") {
    return handleApiAdminMeetingPoints(request, env);
  }

  const meetingPointDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/meeting-points\/(\d+)$/);
  if (meetingPointDetailMatch) {
    return handleApiAdminMeetingPointDetail(request, env, Number(meetingPointDetailMatch[1]));
  }

  if (url.pathname === "/api/v1/admin/customers") {
    return handleApiAdminCustomers(request, env);
  }

  const customerReplyMatch = url.pathname.match(/^\/api\/v1\/admin\/customers\/(\d+)\/reply$/);
  if (customerReplyMatch) {
    return handleApiAdminCustomerReply(request, env, Number(customerReplyMatch[1]));
  }

  const customerDetailMatch = url.pathname.match(/^\/api\/v1\/admin\/customers\/(\d+)$/);
  if (customerDetailMatch) {
    return handleApiAdminCustomerDetail(request, env, Number(customerDetailMatch[1]));
  }

  if (url.pathname === "/api/v1/admin/settings") {
    return handleApiAdminSettings(request, env);
  }

  if (url.pathname === "/api/v1/public/shops" && request.method === "GET") {
    return handlePublicShopsApi(env);
  }

  if (url.pathname === "/api/v1/public/payment-methods" && request.method === "GET") {
    return handlePublicPaymentMethodsApi(env);
  }

  if (url.pathname === "/api/v1/public/catalog") {
    return handleApiPublicCatalog(request, env);
  }

  if (url.pathname === "/api/v1/public/meeting-points") {
    return handleApiPublicMeetingPoints(request, env);
  }

  if (url.pathname === "/api/v1/customer/session/start") {
    return handleApiCustomerSessionStart(request, env);
  }

  if (url.pathname === "/api/v1/customer/session/verify") {
    return handleApiCustomerSessionVerify(request, env);
  }

  if (url.pathname === "/api/v1/customer/session/logout") {
    return handleApiCustomerSessionLogout(request, env);
  }

  if (url.pathname === "/api/v1/customer/me") {
    return handleApiCustomerMe(request, env);
  }

  if (url.pathname === "/api/v1/customer/locations") {
    return handleApiCustomerLocations(request, env);
  }

  if (url.pathname === "/api/v1/customer/cart") {
    return handleApiCustomerCart(request, env);
  }

  if (url.pathname === "/api/v1/customer/cart/items") {
    return handleApiCustomerCartItems(request, env);
  }

  const customerCartItemMatch = url.pathname.match(/^\/api\/v1\/customer\/cart\/items\/(\d+)$/);
  if (customerCartItemMatch) {
    return handleApiCustomerCartItemDetail(request, env, Number(customerCartItemMatch[1]));
  }

  if (url.pathname === "/api/v1/customer/checkout/address") {
    return handleApiCustomerCheckoutAddress(request, env);
  }

  if (url.pathname === "/api/v1/customer/checkout/pickup") {
    return handleApiCustomerCheckoutPickup(request, env);
  }

  if (url.pathname === "/api/v1/customer/orders") {
    return handleApiCustomerOrders(request, env);
  }

  const customerOrderMatch = url.pathname.match(/^\/api\/v1\/customer\/orders\/(\d+)$/);
  if (customerOrderMatch) {
    return handleApiCustomerOrderDetail(request, env, Number(customerOrderMatch[1]));
  }

  return apiError("not_found", "API route not found.", 404, { path: url.pathname });
}










async function handleHealth() {
  return jsonResponse({ app: "CRM Delivery Worker", status: "ok" });
}

async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS" && url.pathname.startsWith("/api/v1/")) {
    return apiCorsPreflight();
  }

  if (url.pathname === "/health") return handleHealth();

  if (url.pathname.startsWith("/api/v1/")) {
    const identityResponse = await handleIdentityApi(request, env, ctx);
    if (identityResponse) return identityResponse;
    return handleApiV1(request, env);
  }

  if (url.pathname === "/static/admin.css") {
    return new Response(ADMIN_CSS, { headers: { "content-type": "text/css; charset=utf-8" } });
  }

  const telegramMiniAppAssetResponse = getTelegramMiniAppAssetResponse(url.pathname);
  if (telegramMiniAppAssetResponse) {
    return telegramMiniAppAssetResponse;
  }

  if (url.pathname === "/telegram/webhook" && request.method === "POST") {
    return handleTelegramWebhook(request, env);
  }

  if (url.pathname === "/" || url.pathname === "") {
    return jsonResponse({ status: "running", app: "CRM Delivery" });
  }

  if (
    url.pathname === ADMIN_INVITATION_LANDING_ROUTE
    && getIdentityCapabilities(env).staff_bootstrap_enrollment === true
  ) {
    return handleAdminInvitationLanding(request);
  }

  if (url.pathname === ADMIN_RECOVERY_LANDING_ROUTE && getIdentityCapabilities(env).staff_recovery === true) {
    return handleAdminRecoveryLanding(request);
  }

  if (url.pathname === "/admin/login" && request.method === "GET") return handleLoginPage();
  if (url.pathname === "/admin/login" && request.method === "POST") return handleAdminLogin(request, env);
  if (url.pathname === "/admin/forgot-password" && request.method === "GET") return handleForgotPasswordPage();
  if (url.pathname === "/admin/forgot-password" && request.method === "POST") return handleSendForgotPasswordCode(request, env);
  if (url.pathname === "/admin/reset-password" && request.method === "GET") return handleResetPasswordPage();
  if (url.pathname === "/admin/reset-password" && request.method === "POST") return handleResetPassword(request, env);

  let adminSession = null;

  if (url.pathname.startsWith("/admin")) {
    adminSession = await getAdminSession(request, env);
    if (!adminSession) {
      return redirectResponse("/admin/login");
    }

    await cleanupOldAdminAuditLogs(env);

    if (request.method === "POST" && url.pathname !== "/admin/logout") {
      await logAdminAction(env, request, adminSession, "admin_post_action", url.pathname);
    }
  }


  if ((url.pathname === "/admin" || url.pathname === "/admin/") && request.method === "GET") return handleAdminHome(env, adminSession);
  if ((url.pathname === "/admin/orders" || url.pathname === "/admin/orders/") && request.method === "GET") return handleAdminOrdersPage(env, adminSession);
  if ((url.pathname === "/admin/closedorders" || url.pathname === "/admin/closedorders/") && request.method === "GET") return handleAdminClosedOrdersPage(env, adminSession);
  if ((url.pathname === "/admin/superadmin" || url.pathname === "/admin/superadmin/") && request.method === "GET") {
    if (!adminSession?.is_superadmin) return jsonResponse({ error: "Forbidden" }, 403);
    return handleAdminSuperadminPage(env, adminSession);
  }
  if (url.pathname === "/admin/superadmin/admins" && request.method === "POST") {
    if (!adminSession?.is_superadmin) return jsonResponse({ error: "Forbidden" }, 403);
    return handleSuperadminCreateAdmin(request, env, adminSession);
  }
  const superadminToggleAdmin = url.pathname.match(/^\/admin\/superadmin\/admins\/(\d+)\/toggle$/);
  if (superadminToggleAdmin && request.method === "POST") {
    if (!adminSession?.is_superadmin) return jsonResponse({ error: "Forbidden" }, 403);
    return handleSuperadminToggleAdmin(request, env, adminSession, Number(superadminToggleAdmin[1]));
  }

  const superadminDeleteAdmin = url.pathname.match(/^\/admin\/superadmin\/admins\/(\d+)\/delete$/);
  if (superadminDeleteAdmin && request.method === "POST") {
    if (!adminSession?.is_superadmin) return jsonResponse({ error: "Forbidden" }, 403);
    return handleSuperadminDeleteAdmin(request, env, adminSession, Number(superadminDeleteAdmin[1]));
  }
  if ((url.pathname === "/admin/products" || url.pathname === "/admin/products/") && request.method === "GET") return handleAdminProductsPage(env, adminSession);
  if ((url.pathname === "/admin/products/list" || url.pathname === "/admin/products/list/") && request.method === "GET") return handleAdminProductListPage(env, adminSession);
  if ((url.pathname === "/admin/product-categories/list" || url.pathname === "/admin/product-categories/list/") && request.method === "GET") return handleAdminProductCategoriesPage(env, adminSession);
  if ((url.pathname === "/admin/meeting-points" || url.pathname === "/admin/meeting-points/") && request.method === "GET") return handleAdminMeetingPointsPage(env, adminSession);
  if ((url.pathname === "/admin/ai" || url.pathname === "/admin/ai/") && request.method === "GET") return handleAdminAiPage(env, adminSession);
  if ((url.pathname === "/admin/customers" || url.pathname === "/admin/customers/") && request.method === "GET") return handleAdminCustomersPage(env, adminSession);
  const customerDelete = url.pathname.match(/^\/admin\/customers\/(\d+)\/delete$/);
  if (customerDelete && request.method === "POST") return handleDeleteCustomer(env, Number(customerDelete[1]));
  if (url.pathname === "/admin/logout" && request.method === "POST") return handleAdminLogout();
  if (url.pathname === "/admin/change-password" && request.method === "GET") return handleChangePasswordPage();
  if (url.pathname === "/admin/change-password" && request.method === "POST") return handleChangePassword(request, env);

  if (url.pathname === "/admin/openrequests/" || url.pathname === "/admin/openrequests") return handleOpenRequestsPage(env, adminSession);
  if (url.pathname === "/admin/open-requests") return handleOpenRequestsPartial(env);

  if (url.pathname === "/admin/search-location" && request.method === "GET") {
    return jsonResponse(await searchLocations(env, url.searchParams.get("query") || ""));
  }

  if (url.pathname === "/admin/settings/admin-telegram" && request.method === "POST") return handleUpdateAdminTelegram(request, env);
  if (url.pathname === "/admin/settings/working-hours" && request.method === "POST") return handleUpdateWorkingHours(request, env);
  if (url.pathname === "/admin/settings/fulfillment-options" && request.method === "POST") return handleUpdateFulfillmentOptions(request, env);
  if (url.pathname === "/admin/settings/delivery-cities" && request.method === "POST") return handleUpdateDeliveryCities(request, env);
  if (url.pathname === "/admin/settings/admin-language" && request.method === "POST") return handleUpdateAdminLanguage(request, env);
  if (url.pathname === "/admin/settings/ai-response-mode" && request.method === "POST") return handleUpdateAiResponseMode(request, env);

  const adminOrderDetail = url.pathname.match(/^\/admin\/orders\/(\d+)$/);
  if (adminOrderDetail && request.method === "GET") return handleAdminOrderDetailPage(env, adminSession, Number(adminOrderDetail[1]));

  const orderRecreate = url.pathname.match(/^\/admin\/orders\/(\d+)\/recreate$/);
  if (orderRecreate && request.method === "POST") {
    return handleAdminRecreateCancelledOrder(
      request,
      env,
      Number(orderRecreate[1]),
      adminSession
    );
  }

  const orderConfirmRecreation = url.pathname.match(/^\/admin\/orders\/(\d+)\/confirm-recreation$/);
  if (orderConfirmRecreation && request.method === "POST") {
    return handleAdminConfirmRecreatedOrder(
      request,
      env,
      Number(orderConfirmRecreation[1]),
      adminSession
    );
  }

  const orderGroupApprove = url.pathname.match(/^\/admin\/orders\/(\d+)\/groups\/(\d+)\/approve$/);
  if (orderGroupApprove && request.method === "POST") {
    return handleAdminOrderGroupApprove(env, Number(orderGroupApprove[1]), Number(orderGroupApprove[2]), adminSession);
  }

  const orderGroupReject = url.pathname.match(/^\/admin\/orders\/(\d+)\/groups\/(\d+)\/reject$/);
  if (orderGroupReject && request.method === "POST") {
    return handleAdminOrderGroupReject(request, env, Number(orderGroupReject[1]), Number(orderGroupReject[2]), adminSession);
  }

  const orderStatusUpdate = url.pathname.match(/^\/admin\/orders\/(\d+)\/status$/);
  if (orderStatusUpdate && request.method === "POST") return handleAdminUpdateOrderStatus(request, env, Number(orderStatusUpdate[1]));

  const orderDelivered = url.pathname.match(/^\/admin\/orders\/(\d+)\/delivered$/);
  if (orderDelivered && request.method === "POST") return handleAdminMarkOrderDelivered(env, Number(orderDelivered[1]));

  const orderReturn = url.pathname.match(/^\/admin\/orders\/(\d+)\/return$/);
  if (orderReturn && request.method === "POST") return handleAdminReturnClosedOrder(env, Number(orderReturn[1]));

  if (url.pathname === "/admin/products" && request.method === "POST") return handleCreateProduct(request, env);

  if (url.pathname === "/admin/product-categories" && request.method === "POST") return handleCreateProductCategory(request, env);
  const productCategoryUpdate = url.pathname.match(/^\/admin\/product-categories\/(\d+)\/update$/);
  if (productCategoryUpdate && request.method === "POST") return handleUpdateProductCategory(request, env, Number(productCategoryUpdate[1]));
  const productCategoryDelete = url.pathname.match(/^\/admin\/product-categories\/(\d+)\/delete$/);
  if (productCategoryDelete && request.method === "POST") return handleDeleteProductCategory(env, Number(productCategoryDelete[1]));

  const productUpdate = url.pathname.match(/^\/admin\/products\/(\d+)\/update$/);
  if (productUpdate && request.method === "POST") return handleUpdateProduct(request, env, Number(productUpdate[1]));
  const productDelete = url.pathname.match(/^\/admin\/products\/(\d+)\/delete$/);
  if (productDelete && request.method === "POST") return handleDeleteProduct(env, Number(productDelete[1]));

  if (url.pathname === "/admin/meeting-points" && request.method === "POST") return handleCreateMeetingPoint(request, env);
  const pointUpdate = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/update$/);
  if (pointUpdate && request.method === "POST") return handleUpdateMeetingPoint(request, env, Number(pointUpdate[1]));
  const pointDefault = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/default$/);
  if (pointDefault && request.method === "POST") return handleSetPreferredMeetingPoint(request, env, Number(pointDefault[1]));
  const pointDelete = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/delete$/);
  if (pointDelete && request.method === "POST") return handleDeleteMeetingPoint(env, Number(pointDelete[1]));

  const learnedApprove = url.pathname.match(/^\/admin\/learned-patterns\/(\d+)\/approve$/);
  if (learnedApprove && request.method === "POST") return handleApproveLearnedPattern(env, Number(learnedApprove[1]));

  const learnedReject = url.pathname.match(/^\/admin\/learned-patterns\/(\d+)\/reject$/);
  if (learnedReject && request.method === "POST") return handleRejectLearnedPattern(env, Number(learnedReject[1]));

  const learnedDelete = url.pathname.match(/^\/admin\/learned-patterns\/(\d+)\/delete$/);
  if (learnedDelete && request.method === "POST") return handleDeleteLearnedPattern(env, Number(learnedDelete[1]));

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
  async fetch(request, env, ctx) {
    return routeRequest(request, env, ctx);
  },

  async queue(batch, env) {
    if (batch?.queue === "crm-auth-email-outbox-dlq") {
      await processAuthEmailDeadLetterQueue(batch);
      return;
    }
    await processAuthEmailQueue(batch, env);
  },

  async scheduled(_controller, env, ctx) {
    const configuredLimit = Number(
      env.CRM_AUTH_EMAIL_OUTBOX_DISPATCH_BATCH_SIZE || 10
    );
    const limit = Number.isSafeInteger(configuredLimit)
      ? Math.max(1, Math.min(configuredLimit, 100))
      : 10;
    ctx.waitUntil(sweepExpiredIdempotencyKeys(env));
    ctx.waitUntil(sweepAuthEmailOutbox(env, { limit }));
  }
};
