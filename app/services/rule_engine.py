import unicodedata

from rapidfuzz import fuzz, process

from app.models.product import Product
from app.services.meeting_point_service import format_meeting_point_reply


LOCATION_KEYWORDS = [
    "where",
    "location",
    "address",
    "meet",
    "meeting point",
    "place",
    "nerede",
    "konum",
    "adres",
    "buluş",
    "buluşma",
    "wo",
    "adresse",
    "treffen",
    "مكان",
    "عنوان",
]

GREETING_KEYWORDS = [
    "hello",
    "hi",
    "hey",
    "merhaba",
    "selam",
    "hallo",
    "guten tag",
    "مرحبا",
    "السلام",
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
    "ürün",
    "ürünler",
    "fiyat",
    "fiyatlar",
    "liste",
    "menü",
    "kaufen",
    "preis",
    "preise",
    "produkt",
    "produkte",
    "قائمة",
    "سعر",
    "أسعار",
    "منتج",
    "منتجات",
]


def get_rule_based_reply(db, text: str, language: str) -> str | None:
    clean_text = normalize_text(text)

    if is_close_match(clean_text, LOCATION_KEYWORDS):
        return format_meeting_point_reply(db, language)

    product_reply = get_product_reply_if_matched(
        db,
        clean_text,
        language
    )
    if product_reply is not None:
        return product_reply

    if is_close_match(clean_text, GREETING_KEYWORDS):
        return get_greeting_reply(language)

    return None


def get_product_reply_if_matched(db, text: str, language: str) -> str | None:
    products = db.query(Product).filter(
        Product.is_active.is_(True)
    ).all()

    if not products:
        return None

    product_names = [normalize_text(product.name) for product in products]

    if is_close_match(text, PRODUCT_KEYWORDS):
        return format_product_list_reply(products, language)

    best_match = process.extractOne(
        text,
        product_names,
        scorer=fuzz.partial_ratio,
    )

    if best_match is None:
        return None

    if best_match[1] < 75:
        words = [
            word
            for word in text.split()
            if len(word) >= 4
        ]

        word_match = None
        for word in words:
            candidate = process.extractOne(
                word,
                product_names,
                scorer=fuzz.partial_ratio,
            )

            if candidate is not None and candidate[1] >= 75:
                word_match = candidate
                break

        if word_match is None:
            return None

        best_match = word_match

    matched_product = products[best_match[2]]
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
    }

    return headers.get(language, headers["en"]) + "\n" + "\n".join(lines)


def format_single_product_reply(product: Product, language: str) -> str:
    templates = {
        "en": "{name}: {price:g}",
        "de": "{name}: {price:g}",
        "tr": "{name}: {price:g}",
        "ar": "{name}: {price:g}",
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
    }

    return replies.get(language, replies["en"])
