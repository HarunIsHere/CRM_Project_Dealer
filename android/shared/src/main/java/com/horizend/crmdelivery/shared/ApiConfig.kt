package com.horizend.crmdelivery.shared

object ApiConfig {
    const val BASE_URL = "https://crm.ayartuerk.me"
    const val API_V1 = "$BASE_URL/api/v1"

    const val PUBLIC_SHOPS = "$API_V1/public/shops"
    const val PUBLIC_PAYMENT_METHODS = "$API_V1/public/payment-methods"
    const val PUBLIC_CATALOG = "$API_V1/public/catalog"
    const val PUBLIC_MEETING_POINTS = "$API_V1/public/meeting-points"
}
