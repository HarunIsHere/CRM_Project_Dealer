package com.horizend.crmdelivery.shared.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.parameter
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


    suspend fun getCustomerProducts(): List<CustomerProduct> =
        httpClient.get("$customerApiBaseUrl/public/catalog")
            .body<CustomerCatalogResponse>()
            .catalog
            .products

    suspend fun getCustomerCart(sessionToken: String): CustomerCartResponse =
        httpClient.get("$customerApiBaseUrl/customer/cart") {
            parameter("session_token", sessionToken)
        }.body()

    suspend fun addCustomerCartItem(sessionToken: String, productId: Int, quantity: Int): CustomerCartResponse =
        httpClient.post("$customerApiBaseUrl/customer/cart/items") {
            contentType(ContentType.Application.Json)
            setBody(AddCartItemRequest(sessionToken = sessionToken, productId = productId, quantity = quantity))
        }.body()

    suspend fun updateCustomerCartItem(sessionToken: String, productId: Int, quantity: Int): CustomerCartResponse =
        httpClient.patch("$customerApiBaseUrl/customer/cart/items/$productId") {
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
        httpClient.post("$customerApiBaseUrl/customer/checkout") {
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
        httpClient.get("$customerApiBaseUrl/customer/orders") {
            parameter("session_token", sessionToken)
        }.body()
}
