package com.horizend.crmdelivery.shared.i18n

import java.util.Locale

data class SupportedLanguageOption(
    val code: String,
    val nativeLabel: String,
    val isRightToLeft: Boolean = false
)

object SupportedLanguages {
    val all = listOf(
        SupportedLanguageOption("en", "English"),
        SupportedLanguageOption("de", "Deutsch"),
        SupportedLanguageOption("tr", "Türkçe"),
        SupportedLanguageOption("ar", "العربية", true),
        SupportedLanguageOption("ru", "Русский")
    )

    fun resolve(code: String?): String {
        val explicit = code?.trim()?.lowercase(Locale.ROOT)
        if (all.any { it.code == explicit }) return explicit!!

        return when (Locale.getDefault().language.lowercase(Locale.ROOT)) {
            "de" -> "de"
            "tr" -> "tr"
            "ar" -> "ar"
            "ru" -> "ru"
            else -> "en"
        }
    }

    fun label(code: String): String =
        all.firstOrNull { it.code == resolve(code) }?.nativeLabel ?: "English"

    fun isRightToLeft(code: String): Boolean =
        all.firstOrNull { it.code == resolve(code) }?.isRightToLeft ?: false
}

object CustomerSharedTexts {
    private val texts: Map<String, Map<String, String>> = mapOf(
        "en" to mapOf(
            "active_order_fallback" to "active order",
            "active_status" to "active",
            "add_failed_template" to "Add failed: {error}",
            "add_to_cart" to "Add to cart",
            "added_template" to "Added: {name}",
            "cart_error_template" to "Cart error: {error}",
            "cart_section" to "Cart",
            "checkout" to "Checkout",
            "checkout_failed_template" to "Checkout failed: {error}",
            "checkout_submitted_template" to "Checkout submitted: {order}",
            "customer_shop_title" to "Customer Shop",
            "device" to "Device",
            "eight_digit_code" to "Eight-digit code",
            "email_access" to "Customer account",
            "email_access_failed_template" to "Email access failed: {error}",
            "email_access_ready" to "Email verified. Your customer account is ready.",
            "email_address" to "Email address",
            "in_progress_status" to "in progress",
            "items" to "Items",
            "language" to "Language",
            "language_section" to "Language",
            "last_update" to "Last update",
            "loading_failed_template" to "Loading failed: {error}",
            "loading_shop" to "Loading shop...",
            "location" to "Location",
            "no_orders_yet" to "No orders yet",
            "order_number_template" to "Order #{id}",
            "orders_error_template" to "Orders error: {error}",
            "orders_section" to "Orders",
            "product_fallback" to "Product",
            "products_section" to "Products",
            "shop" to "Shop",
            "shop_loaded" to "Shop loaded",
            "sign_out" to "Log out",
            "signed_out" to "Logged out. Guest shopping is ready.",
            "send_verification_code" to "Send verification code",
            "signed_in_email_template" to "Signed in as {email}",
            "status" to "Status",
            "status_section" to "Status",
            "total" to "Total",
            "updated" to "Updated",
            "use_another_email" to "Use another email",
            "verification_code_sent" to "Check your email and enter the eight-digit code.",
            "verify_and_continue" to "Verify and continue"
        ),
        "de" to mapOf(
            "active_order_fallback" to "aktive Bestellung",
            "active_status" to "aktiv",
            "add_failed_template" to "Hinzufügen fehlgeschlagen: {error}",
            "add_to_cart" to "In den Warenkorb",
            "added_template" to "Hinzugefügt: {name}",
            "cart_error_template" to "Warenkorbfehler: {error}",
            "cart_section" to "Warenkorb",
            "checkout" to "Zur Kasse",
            "checkout_failed_template" to "Checkout fehlgeschlagen: {error}",
            "checkout_submitted_template" to "Checkout gesendet: {order}",
            "customer_shop_title" to "Kundenshop",
            "device" to "Gerät",
            "eight_digit_code" to "Achtstelliger Code",
            "email_access" to "Kundenkonto",
            "email_access_failed_template" to "E-Mail-Zugang fehlgeschlagen: {error}",
            "email_access_ready" to "E-Mail bestätigt. Ihr Kundenkonto ist bereit.",
            "email_address" to "E-Mail-Adresse",
            "in_progress_status" to "in Bearbeitung",
            "items" to "Artikel",
            "language" to "Sprache",
            "language_section" to "Sprache",
            "last_update" to "Letzte Aktualisierung",
            "loading_failed_template" to "Laden fehlgeschlagen: {error}",
            "loading_shop" to "Shop wird geladen...",
            "location" to "Standort",
            "no_orders_yet" to "Noch keine Bestellungen",
            "order_number_template" to "Bestellung #{id}",
            "orders_error_template" to "Bestellfehler: {error}",
            "orders_section" to "Bestellungen",
            "product_fallback" to "Produkt",
            "products_section" to "Produkte",
            "shop" to "Shop",
            "shop_loaded" to "Shop geladen",
            "sign_out" to "Abmelden",
            "signed_out" to "Abgemeldet. Einkaufen als Gast ist möglich.",
            "send_verification_code" to "Bestätigungscode senden",
            "signed_in_email_template" to "Angemeldet als {email}",
            "status" to "Status",
            "status_section" to "Status",
            "total" to "Gesamt",
            "updated" to "Aktualisiert",
            "use_another_email" to "Andere E-Mail verwenden",
            "verification_code_sent" to "Prüfen Sie Ihre E-Mail und geben Sie den achtstelligen Code ein.",
            "verify_and_continue" to "Bestätigen und fortfahren"
        ),
        "tr" to mapOf(
            "active_order_fallback" to "aktif sipariş",
            "active_status" to "aktif",
            "add_failed_template" to "Ekleme başarısız: {error}",
            "add_to_cart" to "Sepete ekle",
            "added_template" to "Eklendi: {name}",
            "cart_error_template" to "Sepet hatası: {error}",
            "cart_section" to "Sepet",
            "checkout" to "Siparişi Tamamla",
            "checkout_failed_template" to "Ödeme başarısız: {error}",
            "checkout_submitted_template" to "Ödeme gönderildi: {order}",
            "customer_shop_title" to "Müşteri Mağazası",
            "device" to "Cihaz",
            "eight_digit_code" to "Sekiz haneli kod",
            "email_access" to "Müşteri hesabı",
            "email_access_failed_template" to "E-posta erişimi başarısız: {error}",
            "email_access_ready" to "E-posta doğrulandı. Müşteri hesabınız hazır.",
            "email_address" to "E-posta adresi",
            "in_progress_status" to "devam ediyor",
            "items" to "Öğeler",
            "language" to "Dil",
            "language_section" to "Dil",
            "last_update" to "Son güncelleme",
            "loading_failed_template" to "Yükleme başarısız: {error}",
            "loading_shop" to "Mağaza yükleniyor...",
            "location" to "Konum",
            "no_orders_yet" to "Henüz sipariş yok",
            "order_number_template" to "Sipariş #{id}",
            "orders_error_template" to "Sipariş hatası: {error}",
            "orders_section" to "Siparişler",
            "product_fallback" to "Ürün",
            "products_section" to "Ürünler",
            "shop" to "Mağaza",
            "shop_loaded" to "Mağaza yüklendi",
            "sign_out" to "Çıkış yap",
            "signed_out" to "Çıkış yapıldı. Misafir alışverişi hazır.",
            "send_verification_code" to "Doğrulama kodu gönder",
            "signed_in_email_template" to "{email} olarak oturum açıldı",
            "status" to "Durum",
            "status_section" to "Durum",
            "total" to "Toplam",
            "updated" to "Güncellendi",
            "use_another_email" to "Başka e-posta kullan",
            "verification_code_sent" to "E-postanızı kontrol edin ve sekiz haneli kodu girin.",
            "verify_and_continue" to "Doğrula ve devam et"
        ),
        "ar" to mapOf(
            "active_order_fallback" to "طلب نشط",
            "active_status" to "نشط",
            "add_failed_template" to "فشلت الإضافة: {error}",
            "add_to_cart" to "أضف إلى السلة",
            "added_template" to "تمت الإضافة: {name}",
            "cart_error_template" to "خطأ في السلة: {error}",
            "cart_section" to "السلة",
            "checkout" to "إتمام الطلب",
            "checkout_failed_template" to "فشل إتمام الطلب: {error}",
            "checkout_submitted_template" to "تم إرسال إتمام الطلب: {order}",
            "customer_shop_title" to "متجر العميل",
            "device" to "الجهاز",
            "eight_digit_code" to "الرمز المكون من ثمانية أرقام",
            "email_access" to "حساب العميل",
            "email_access_failed_template" to "فشل الوصول عبر البريد: {error}",
            "email_access_ready" to "تم التحقق من البريد. حساب العميل جاهز.",
            "email_address" to "عنوان البريد الإلكتروني",
            "in_progress_status" to "قيد التنفيذ",
            "items" to "العناصر",
            "language" to "اللغة",
            "language_section" to "اللغة",
            "last_update" to "آخر تحديث",
            "loading_failed_template" to "فشل التحميل: {error}",
            "loading_shop" to "جارٍ تحميل المتجر...",
            "location" to "الموقع",
            "no_orders_yet" to "لا توجد طلبات بعد",
            "order_number_template" to "الطلب #{id}",
            "orders_error_template" to "خطأ في الطلبات: {error}",
            "orders_section" to "الطلبات",
            "product_fallback" to "المنتج",
            "products_section" to "المنتجات",
            "shop" to "المتجر",
            "shop_loaded" to "تم تحميل المتجر",
            "sign_out" to "تسجيل الخروج",
            "signed_out" to "تم تسجيل الخروج. التسوق كضيف متاح.",
            "send_verification_code" to "إرسال رمز التحقق",
            "signed_in_email_template" to "تم تسجيل الدخول باسم {email}",
            "status" to "الحالة",
            "status_section" to "الحالة",
            "total" to "الإجمالي",
            "updated" to "تم التحديث",
            "use_another_email" to "استخدام بريد آخر",
            "verification_code_sent" to "تحقق من بريدك وأدخل الرمز المكون من ثمانية أرقام.",
            "verify_and_continue" to "تحقق وتابع"
        ),
        "ru" to mapOf(
            "active_order_fallback" to "активный заказ",
            "active_status" to "активен",
            "add_failed_template" to "Ошибка добавления: {error}",
            "add_to_cart" to "Добавить в корзину",
            "added_template" to "Добавлено: {name}",
            "cart_error_template" to "Ошибка корзины: {error}",
            "cart_section" to "Корзина",
            "checkout" to "Оформить заказ",
            "checkout_failed_template" to "Ошибка оформления заказа: {error}",
            "checkout_submitted_template" to "Заказ оформлен: {order}",
            "customer_shop_title" to "Магазин клиента",
            "device" to "Устройство",
            "eight_digit_code" to "Восьмизначный код",
            "email_access" to "Учетная запись клиента",
            "email_access_failed_template" to "Ошибка доступа по почте: {error}",
            "email_access_ready" to "Почта подтверждена. Учетная запись клиента готова.",
            "email_address" to "Адрес электронной почты",
            "in_progress_status" to "в процессе",
            "items" to "Позиции",
            "language" to "Язык",
            "language_section" to "Язык",
            "last_update" to "Последнее обновление",
            "loading_failed_template" to "Ошибка загрузки: {error}",
            "loading_shop" to "Загрузка магазина...",
            "location" to "Локация",
            "no_orders_yet" to "Заказов пока нет",
            "order_number_template" to "Заказ #{id}",
            "orders_error_template" to "Ошибка заказов: {error}",
            "orders_section" to "Заказы",
            "product_fallback" to "Товар",
            "products_section" to "Товары",
            "shop" to "Магазин",
            "shop_loaded" to "Магазин загружен",
            "sign_out" to "Выйти",
            "signed_out" to "Вы вышли. Покупки в гостевом режиме доступны.",
            "send_verification_code" to "Отправить код подтверждения",
            "signed_in_email_template" to "Вход выполнен как {email}",
            "status" to "Статус",
            "status_section" to "Статус",
            "total" to "Итого",
            "updated" to "Обновлено",
            "use_another_email" to "Использовать другую почту",
            "verification_code_sent" to "Проверьте почту и введите восьмизначный код.",
            "verify_and_continue" to "Подтвердить и продолжить"
        )
    )

    fun text(language: String, key: String): String {
        val normalized = resolve(language)
        return texts[normalized]?.get(key)
            ?: texts["en"]?.get(key)
            ?: key
    }

    private fun resolve(language: String): String = SupportedLanguages.resolve(language)
}
