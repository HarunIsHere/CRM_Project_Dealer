from lingua import Language
from lingua import LanguageDetectorBuilder


SUPPORTED_LANGUAGES = {
    Language.ENGLISH: "en",
    Language.GERMAN: "de",
    Language.TURKISH: "tr",
    Language.ARABIC: "ar",
    Language.RUSSIAN: "ru",
}

LANGUAGE_KEYWORDS = {
    "en": [
        "location",
        "address",
        "where",
        "meet",
        "meeting",
        "product",
        "products",
        "price",
        "hello",
        "hi",
    ],
    "de": [
        "standort",
        "adresse",
        "wo",
        "treffen",
        "produkt",
        "produkte",
        "preis",
        "hallo",
        "guten",
    ],
    "tr": [
        "mekan",
        "konum",
        "adres",
        "nerede",
        "buluş",
        "buluşma",
        "lokasyon",
        "ürün",
        "urun",
        "fiyat",
        "selam",
        "merhaba",
    ],
    "ar": [
        "مكان",
        "موقع",
        "عنوان",
        "اين",
        "وين",
        "منتج",
        "منتجات",
        "سعر",
        "مرحبا",
    ],
    "ru": [
        "место",
        "локация",
        "адрес",
        "где",
        "встреча",
        "товар",
        "товары",
        "цена",
        "привет",
        "здравствуйте",
    ],
}

detector = LanguageDetectorBuilder.from_languages(
    Language.ENGLISH,
    Language.GERMAN,
    Language.TURKISH,
    Language.ARABIC,
    Language.RUSSIAN,
).build()


def detect_language(text: str) -> str:
    clean_text = text.lower().strip()

    if not clean_text:
        return "unknown"

    keyword_language = detect_language_by_keywords(clean_text)
    if keyword_language != "unknown":
        return keyword_language

    words = clean_text.split()

    if len(clean_text) < 12 and len(words) <= 2:
        return "unknown"

    confidence_values = detector.compute_language_confidence_values(
        clean_text
    )

    best = confidence_values[0]

    if best.value < 0.85:
        return "unknown"

    return SUPPORTED_LANGUAGES.get(
        best.language,
        "unknown"
    )


def detect_language_by_keywords(text: str) -> str:
    for language, keywords in LANGUAGE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return language

    return "unknown"
