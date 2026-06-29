package com.horizend.crmdelivery.shared.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

object CustomerApiClient {
    private const val customerApiBaseUrl = "https://crm.ayartuerk.me/api/v1"

    private val httpClient = HttpClient {
        install(ContentNegotiation) {
            json(
                Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                }
            )
        }
    }

    private fun bearer(accessToken: String): String = "Bearer $accessToken"

    suspend fun getCustomerProducts(): List<CustomerProduct> =
        httpClient.get("$customerApiBaseUrl/public/catalog")
            .body<CustomerCatalogResponse>()
            .catalog
            .products

    suspend fun startCustomerSession(
        deviceId: String,
        platform: String,
        appVersion: String,
        fullName: String,
        username: String = "",
        language: String = "en"
    ): CustomerSessionStartResponse =
        httpClient.post("$customerApiBaseUrl/customer/session/start") {
            contentType(ContentType.Application.Json)
            setBody(
                CustomerSessionStartRequest(
                    deviceId = deviceId,
                    platform = platform,
                    appVersion = appVersion,
                    fullName = fullName,
                    username = username,
                    language = language
                )
            )
        }.body()

    suspend fun getCustomerCart(accessToken: String): CustomerCartResponse =
        httpClient.get("$customerApiBaseUrl/customer/cart") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun addCustomerCartItem(accessToken: String, productId: Int, quantity: Int): CustomerCartResponse =
        httpClient.post("$customerApiBaseUrl/customer/cart/items") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(AddCartItemRequest(productId = productId, quantity = quantity))
        }.body()

    suspend fun updateCustomerCartItem(accessToken: String, itemId: Int, quantity: Int): CustomerCartResponse =
        httpClient.patch("$customerApiBaseUrl/customer/cart/items/$itemId") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(UpdateCartItemRequest(quantity = quantity))
        }.body()

    suspend fun checkoutCustomerCart(
        accessToken: String,
        deliveryAddress: String,
        notes: String
    ): CustomerOrderResponse =
        httpClient.post("$customerApiBaseUrl/customer/checkout/address") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(
                CheckoutRequest(
                    address = deliveryAddress,
                    locationLabel = deliveryAddress,
                    deliveryNote = notes
                )
            )
        }.body()

    suspend fun getCustomerOrders(accessToken: String): CustomerOrdersResponse =
        httpClient.get("$customerApiBaseUrl/customer/orders") {
            header("Authorization", bearer(accessToken))
        }.body()
}
