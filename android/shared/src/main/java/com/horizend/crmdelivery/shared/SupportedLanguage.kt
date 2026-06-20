package com.horizend.crmdelivery.shared

enum class SupportedLanguage(val code: String, val label: String, val isRtl: Boolean = false) {
    English("en", "English"),
    German("de", "Deutsch"),
    Turkish("tr", "Türkçe"),
    Arabic("ar", "العربية", isRtl = true),
    Russian("ru", "Русский")
}
