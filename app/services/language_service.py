from lingua import Language
from lingua import LanguageDetectorBuilder


SUPPORTED_LANGUAGES = {
    Language.ENGLISH: "en",
    Language.GERMAN: "de",
    Language.TURKISH: "tr",
    Language.ARABIC: "ar"
}

detector = LanguageDetectorBuilder.from_languages(
    Language.ENGLISH,
    Language.GERMAN,
    Language.TURKISH,
    Language.ARABIC
).build()


def detect_language(text: str) -> str:
    clean_text = text.strip()

    if not clean_text:
        return "unknown"

    confidence_values = detector.compute_language_confidence_values(
        clean_text
    )

    best = confidence_values[0]

    if best.value < 0.65:
        return "unknown"

    return SUPPORTED_LANGUAGES.get(
        best.language,
        "unknown"
    )
