package com.horizend.crmdelivery.shared.api

import com.horizend.crmdelivery.shared.ApiConfig
import java.net.URL
import org.json.JSONObject

object PublicApiClient {
    fun getPublicShops(): List<Shop> {
        val json = JSONObject(URL(ApiConfig.PUBLIC_SHOPS).readText())
        val shops = json.getJSONArray("shops")

        return List(shops.length()) { index ->
            val item = shops.getJSONObject(index)
            val paymentMethodsJson = item.optJSONArray("payment_methods")

            val paymentMethods = if (paymentMethodsJson == null) {
                emptyList()
            } else {
                List(paymentMethodsJson.length()) { methodIndex ->
                    val method = paymentMethodsJson.getJSONObject(methodIndex)
                    PaymentMethod(
                        code = method.optString("code"),
                        name = method.optString("name"),
                        isActive = method.optBoolean("is_active", true)
                    )
                }
            }

            Shop(
                id = item.optLong("id"),
                name = item.optString("name"),
                slug = item.optString("slug"),
                description = item.optString("description"),
                address = item.optString("address"),
                googleMapsLink = item.optString("google_maps_link"),
                phone = item.optString("phone"),
                isActive = item.optBoolean("is_active", true),
                paymentMethods = paymentMethods
            )
        }
    }

    fun getPublicPaymentMethods(): List<PaymentMethod> {
        val json = JSONObject(URL(ApiConfig.PUBLIC_PAYMENT_METHODS).readText())
        val methods = json.getJSONArray("payment_methods")

        return List(methods.length()) { index ->
            val item = methods.getJSONObject(index)
            PaymentMethod(
                code = item.optString("code"),
                name = item.optString("name"),
                isActive = item.optBoolean("is_active", true)
            )
        }
    }
}
