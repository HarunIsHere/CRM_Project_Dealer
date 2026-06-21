package com.horizend.crmdelivery.shared.api

import io.ktor.http.contentType

import io.ktor.http.ContentType

import io.ktor.client.request.setBody

import io.ktor.client.request.parameter

import com.horizend.crmdelivery.shared.ApiConfig
import java.net.URL
import org.json.JSONArray
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
                    parsePaymentMethod(paymentMethodsJson.getJSONObject(methodIndex))
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
            parsePaymentMethod(methods.getJSONObject(index))
        }
    }

    fun getPublicCatalog(): PublicCatalog {
        val json = JSONObject(URL(ApiConfig.PUBLIC_CATALOG).readText())
        val catalog = json.getJSONObject("catalog")

        val products = catalog.getJSONArray("products").toObjectList { item ->
            CatalogProduct(
                id = item.optLong("id"),
                name = item.optString("name"),
                price = item.optLong("price"),
                priceFormatted = item.optString("price_formatted"),
                isActive = item.optBoolean("is_active", true),
                categoryId = if (item.isNull("category_id")) null else item.optLong("category_id"),
                categoryName = item.optString("category_name"),
                aliases = item.optJSONArray("aliases").toStringList()
            )
        }

        val categories = catalog.getJSONArray("categories").toObjectList { item ->
            CatalogCategory(
                id = item.optLong("id"),
                name = item.optString("name")
            )
        }

        val meetingPoints = catalog.getJSONArray("meeting_points").toObjectList { item ->
            parseMeetingPoint(item)
        }

        val fulfillmentJson = catalog.optJSONObject("fulfillment") ?: JSONObject()

        return PublicCatalog(
            products = products,
            categories = categories,
            meetingPoints = meetingPoints,
            fulfillment = FulfillmentOptions(
                allowPreferredCustomerLocation = fulfillmentJson.optBoolean("allow_preferred_customer_location", true),
                allowNewCustomerLocation = fulfillmentJson.optBoolean("allow_new_customer_location", true),
                allowCustomerPickup = fulfillmentJson.optBoolean("allow_customer_pickup", true)
            ),
            allowedDeliveryCities = catalog.optJSONArray("allowed_delivery_cities").toStringList(),
            languages = catalog.optJSONArray("languages").toStringList()
        )
    }

    fun getPublicMeetingPoints(): List<MeetingPoint> {
        val json = JSONObject(URL(ApiConfig.PUBLIC_MEETING_POINTS).readText())
        return json.getJSONArray("meeting_points").toObjectList { item ->
            parseMeetingPoint(item)
        }
    }

    private fun parsePaymentMethod(item: JSONObject): PaymentMethod {
        return PaymentMethod(
            code = item.optString("code"),
            name = item.optString("name"),
            isActive = item.optBoolean("is_active", true)
        )
    }

    private fun parseMeetingPoint(item: JSONObject): MeetingPoint {
        return MeetingPoint(
            id = item.optLong("id"),
            name = item.optString("name"),
            address = item.optString("address"),
            googleMapsLink = item.optString("google_maps_link"),
            isDefault = item.optBoolean("is_default", false),
            isActive = item.optBoolean("is_active", true)
        )
    }

    private fun JSONArray?.toStringList(): List<String> {
        if (this == null) return emptyList()
        return List(length()) { index -> optString(index) }
    }

    private fun <T> JSONArray.toObjectList(mapper: (JSONObject) -> T): List<T> {
        return List(length()) { index -> mapper(getJSONObject(index)) }
    }


    suspend fun getCustomerCart(sessionToken: String): CustomerCartResponse =
        client.get("${ApiConfig.apiBaseUrl}/customer/cart") {
            parameter("session_token", sessionToken)
        }.body()

    suspend fun addCustomerCartItem(sessionToken: String, productId: Int, quantity: Int): CustomerCartResponse =
        client.post("${ApiConfig.apiBaseUrl}/customer/cart/items") {
            contentType(ContentType.Application.Json)
            setBody(AddCartItemRequest(sessionToken = sessionToken, productId = productId, quantity = quantity))
        }.body()

    suspend fun updateCustomerCartItem(sessionToken: String, productId: Int, quantity: Int): CustomerCartResponse =
        client.patch("${ApiConfig.apiBaseUrl}/customer/cart/items/$productId") {
            contentType(ContentType.Application.Json)
            setBody(UpdateCartItemRequest(sessionToken = sessionToken, quantity = quantity))
        }.body()

    suspend fun checkoutCustomerCart(
        sessionToken: String,
        customerName: String,
        phone: String,
        deliveryAddress: String,
        paymentMethodCode: String,
        notes: String
    ): CustomerOrderResponse =
        client.post("${ApiConfig.apiBaseUrl}/customer/checkout") {
            contentType(ContentType.Application.Json)
            setBody(
                CheckoutRequest(
                    sessionToken = sessionToken,
                    customerName = customerName,
                    phone = phone,
                    deliveryAddress = deliveryAddress,
                    paymentMethodCode = paymentMethodCode,
                    notes = notes
                )
            )
        }.body()

    suspend fun getCustomerOrders(sessionToken: String): CustomerOrdersResponse =
        client.get("${ApiConfig.apiBaseUrl}/customer/orders") {
            parameter("session_token", sessionToken)
        }.body()

}
