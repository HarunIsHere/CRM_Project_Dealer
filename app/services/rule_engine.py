import unicodedata

from rapidfuzz import fuzz, process

from app.models.product import Product
from app.models.product_alias import ProductAlias
from app.services.meeting_point_service import format_meeting_point_reply
from app.services.working_hours_service import get_closed_hours_reply
from app.services.working_hours_service import is_within_working_hours


LOCATION_KEYWORDS = [
    "where",
    "location",
    "address",
    "meet",
    "meeting point",
    "place",
    "center",
    "centre",
    "spot",
    "standort",
    "adresse",
    "wo",
    "treffen",
    "treffpunkt",
    "platz",
    "ort",
    "lokation",
    "nerede",
    "konum",
    "adres",
    "mekan",
    "lokasyon",
    "buluş",
    "buluşma",
    "buluşma noktası",
    "مكان",
    "موقع",
    "عنوان",
    "اين",
    "وين",
    "مركز",
    "لقاء",
    "место",
    "локация",
    "адрес",
    "где",
    "встреча",
    "точка встречи",
]

GREETING_KEYWORDS = [
    "hello",
    "hi",
    "hey",
    "good morning",
    "good evening",
    "hallo",
    "guten tag",
    "guten morgen",
    "guten abend",
    "merhaba",
    "selam",
    "مرحبا",
    "السلام",
    "привет",
    "здравствуйте",
    "добрый день",
]

PRODUCT_KEYWORDS = [
    "product",
    "products",
    "price",
    "prices",
    "menu",
    "list",
    "buy",
    "available",
    "order",
    "produkt",
    "produkte",
    "preis",
    "preise",
    "liste",
    "menü",
    "kaufen",
    "bestellen",
    "ürün",
    "urun",
    "ürünler",
    "urunler",
    "fiyat",
    "fiyatlar",
    "liste",
    "menü",
    "sipariş",
    "قائمة",
    "سعر",
    "أسعار",
    "منتج",
    "منتجات",
    "طلب",
    "товар",
    "товары",
    "цена",
    "цены",
    "список",
    "меню",
    "купить",
    "заказать",
]


def get_rule_based_reply(db, text: str, language: str) -> str | None:
    clean_text = normalize_text(text)

    if is_close_match(clean_text, LOCATION_KEYWORDS):
        if not is_within_working_hours(db):
            return get_closed_hours_reply(db, language)

        return format_meeting_point_reply(db, language)

    if is_close_match(clean_text, GREETING_KEYWORDS):
        return get_greeting_reply(language)

    product_reply = get_product_reply_if_matched(
        db,
        clean_text,
        language
    )
    if product_reply is not None:
        return product_reply

    return None


def get_matching_product(db, text: str) -> Product | None:
    clean_text = normalize_text(text)

    if is_close_match(clean_text, GREETING_KEYWORDS):
        return None

    aliases = db.query(ProductAlias).all()

    alias_values = [
        normalize_text(alias.alias)
        for alias in aliases
    ]

    if alias_values:
        best_alias = process.extractOne(
            clean_text,
            alias_values,
            scorer=fuzz.partial_ratio,
        )

        if best_alias is not None and best_alias[1] >= 75:
            matched_alias = aliases[best_alias[2]]
            return db.query(Product).filter(
                Product.id == matched_alias.product_id,
                Product.is_active.is_(True)
            ).first()

        words = [
            word
            for word in clean_text.split()
            if len(word) >= 3
        ]

        for word in words:
            candidate = process.extractOne(
                word,
                alias_values,
                scorer=fuzz.partial_ratio,
            )

            if candidate is not None and candidate[1] >= 75:
                matched_alias = aliases[candidate[2]]
                return db.query(Product).filter(
                    Product.id == matched_alias.product_id,
                    Product.is_active.is_(True)
                ).first()

    products = db.query(Product).filter(
        Product.is_active.is_(True)
    ).all()

    if not products:
        return None

    product_names = [normalize_text(product.name) for product in products]

    best_match = process.extractOne(
        clean_text,
        product_names,
        scorer=fuzz.partial_ratio,
    )

    if best_match is None:
        return None

    if best_match[1] < 75:
        words = [
            word
            for word in clean_text.split()
            if len(word) >= 4
        ]

        for word in words:
            candidate = process.extractOne(
                word,
                product_names,
                scorer=fuzz.partial_ratio,
            )

            if candidate is not None and candidate[1] >= 75:
                best_match = candidate
                break
        else:
            return None

    return products[best_match[2]]


def get_product_reply_if_matched(db, text: str, language: str) -> str | None:
    products = db.query(Product).filter(
        Product.is_active.is_(True)
    ).all()

    if not products:
        return None

    if is_close_match(text, PRODUCT_KEYWORDS):
        return format_product_list_reply(products, language)

    matched_product = get_matching_product(
        db,
        text
    )

    if matched_product is None:
        return None

    if not is_within_working_hours(db):
        return get_closed_hours_reply(db, language)

    return format_single_product_reply(matched_product, language)


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower().strip())
    return "".join(
        char
        for char in normalized
        if not unicodedata.combining(char)
    )


def is_close_match(text: str, keywords: list[str], min_score: int = 78) -> bool:
    normalized_keywords = [
        normalize_text(keyword)
        for keyword in keywords
    ]

    if any(keyword in text for keyword in normalized_keywords):
        return True

    best_match = process.extractOne(
        text,
        normalized_keywords,
        scorer=fuzz.WRatio,
    )

    if best_match is None:
        return False

    return best_match[1] >= min_score


def format_product_list_reply(products: list[Product], language: str) -> str:
    lines = [
        f"- {product.name}: {product.price:g}"
        for product in products
    ]

    headers = {
        "en": "Available products:",
        "de": "Verfügbare Produkte:",
        "tr": "Mevcut ürünler:",
        "ar": "المنتجات المتوفرة:",
        "ru": "Доступные товары:",
    }

    return headers.get(language, headers["en"]) + "\n" + "\n".join(lines)


def format_single_product_reply(product: Product, language: str) -> str:
    templates = {
        "en": "{name}: {price:g}",
        "de": "{name}: {price:g}",
        "tr": "{name}: {price:g}",
        "ar": "{name}: {price:g}",
        "ru": "{name}: {price:g}",
    }

    template = templates.get(language, templates["en"])
    return template.format(
        name=product.name,
        price=product.price
    )


def get_greeting_reply(language: str) -> str:
    replies = {
        "en": "Hello. How can I help you?",
        "de": "Hallo. Wie kann ich helfen?",
        "tr": "Merhaba. Nasıl yardımcı olabilirim?",
        "ar": "مرحبا. كيف يمكنني مساعدتك؟",
        "ru": "Здравствуйте. Чем могу помочь?",
    }

    return replies.get(language, replies["en"])
