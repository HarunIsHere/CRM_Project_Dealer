package com.horizend.crmdelivery.shared.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import java.util.UUID

object CustomerApiClient {
    private const val customerApiBaseUrl = "https://crm.ayartuerk.me/api/v1"

    private val httpClient = HttpClient {
        expectSuccess = true
        install(ContentNegotiation) {
            json(
                Json {
                    encodeDefaults = true
                    ignoreUnknownKeys = true
                    isLenient = true
                }
            )
        }
    }

    private fun bearer(accessToken: String): String = "Bearer $accessToken"

    private fun idempotencyKey(): String = UUID.randomUUID().toString().replace("-", "")

    suspend fun startCustomerEmailAuthentication(
        email: String,
        language: String,
        initiationNonce: String
    ): CustomerEmailAuthStartResponse =
        httpClient.post("$customerApiBaseUrl/customer/auth/email/start") {
            header("Idempotency-Key", idempotencyKey())
            contentType(ContentType.Application.Json)
            setBody(
                CustomerEmailAuthStartRequest(
                    email = email,
                    locale = language,
                    initiationNonce = initiationNonce
                )
            )
        }.body()

    suspend fun completeCustomerEmailAuthentication(
        attemptId: String,
        manualCode: String,
        initiationNonce: String
    ): CustomerEmailAuthCompleteResponse =
        httpClient.post("$customerApiBaseUrl/customer/auth/email/complete") {
            header("Idempotency-Key", idempotencyKey())
            contentType(ContentType.Application.Json)
            setBody(
                CustomerEmailAuthCompleteRequest(
                    attemptId = attemptId,
                    manualCode = manualCode,
                    initiationNonce = initiationNonce
                )
            )
        }.body()

    suspend fun getCustomerEmailAuthenticationSession(
        accessToken: String
    ): CustomerEmailAuthSessionResponse =
        httpClient.get("$customerApiBaseUrl/customer/auth/session") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun logoutCustomerEmailAuthentication(
        accessToken: String
    ): CustomerLogoutResponse =
        httpClient.post("$customerApiBaseUrl/customer/auth/logout") {
            header("Authorization", bearer(accessToken))
        }.body()

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

    suspend fun verifyCustomerSession(accessToken: String): CustomerSessionVerifyResponse =
        httpClient.post("$customerApiBaseUrl/customer/session/verify") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun logoutCustomerSession(accessToken: String): CustomerLogoutResponse =
        httpClient.post("$customerApiBaseUrl/customer/session/logout") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun getCustomerProfile(accessToken: String): CustomerProfileResponse =
        httpClient.get("$customerApiBaseUrl/customer/me") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun updateCustomerProfile(
        accessToken: String,
        fullName: String,
        username: String = "",
        preferredLanguage: String = "en"
    ): CustomerProfileResponse =
        httpClient.patch("$customerApiBaseUrl/customer/me") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(
                CustomerProfileUpdateRequest(
                    fullName = fullName,
                    username = username,
                    preferredLanguage = preferredLanguage
                )
            )
        }.body()

    suspend fun getCustomerLocations(accessToken: String): CustomerLocationsResponse =
        httpClient.get("$customerApiBaseUrl/customer/locations") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun createCustomerLocation(
        accessToken: String,
        label: String = "",
        address: String = "",
        googleMapsLink: String = "",
        latitude: String = "",
        longitude: String = "",
        saveAsPreferred: Boolean = false
    ): CustomerLocationResponse =
        httpClient.post("$customerApiBaseUrl/customer/locations") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(
                CreateCustomerLocationRequest(
                    label = label,
                    address = address,
                    googleMapsLink = googleMapsLink,
                    latitude = latitude,
                    longitude = longitude,
                    saveAsPreferred = saveAsPreferred
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

    suspend fun removeCustomerCartItem(accessToken: String, itemId: Int): CustomerCartResponse =
        httpClient.delete("$customerApiBaseUrl/customer/cart/items/$itemId") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun checkoutCustomerCart(
        accessToken: String,
        deliveryAddress: String = "",
        notes: String,
        savedLocationId: Int? = null,
        usePreferredLocation: Boolean = false,
        locationLabel: String = deliveryAddress,
        googleMapsLink: String = "",
        latitude: String = "",
        longitude: String = "",
        saveAsPreferred: Boolean = false
    ): CustomerOrderResponse =
        httpClient.post("$customerApiBaseUrl/customer/checkout/address") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(
                CheckoutRequest(
                    savedLocationId = savedLocationId,
                    usePreferredLocation = usePreferredLocation,
                    address = deliveryAddress,
                    locationLabel = locationLabel,
                    googleMapsLink = googleMapsLink,
                    latitude = latitude,
                    longitude = longitude,
                    deliveryNote = notes,
                    saveAsPreferred = saveAsPreferred
                )
            )
        }.body()

    suspend fun checkoutCustomerPickup(
        accessToken: String,
        notes: String = "",
        paymentMethodCode: String = ""
    ): CustomerOrderResponse =
        httpClient.post("$customerApiBaseUrl/customer/checkout/pickup") {
            header("Authorization", bearer(accessToken))
            contentType(ContentType.Application.Json)
            setBody(
                CheckoutPickupRequest(
                    notes = notes,
                    paymentMethodCode = paymentMethodCode
                )
            )
        }.body()

    suspend fun getCustomerOrders(accessToken: String): CustomerOrdersResponse =
        httpClient.get("$customerApiBaseUrl/customer/orders") {
            header("Authorization", bearer(accessToken))
        }.body()

    suspend fun getCustomerOrderDetail(accessToken: String, orderId: Int): CustomerOrderResponse =
        httpClient.get("$customerApiBaseUrl/customer/orders/$orderId") {
            header("Authorization", bearer(accessToken))
        }.body()
}
