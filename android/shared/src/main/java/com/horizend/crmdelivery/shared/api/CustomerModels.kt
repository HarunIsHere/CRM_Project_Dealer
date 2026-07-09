package com.horizend.crmdelivery.shared.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CustomerSessionStartRequest(
    @SerialName("device_id")
    val deviceId: String,
    val platform: String,
    @SerialName("app_version")
    val appVersion: String,
    @SerialName("full_name")
    val fullName: String,
    val username: String = "",
    val language: String = "en"
)

@Serializable
data class CustomerSessionStartResponse(
    val ok: Boolean,
    val session: CustomerSession,
    val customer: CustomerProfile? = null
)

@Serializable
data class CustomerSession(
    @SerialName("access_token")
    val accessToken: String,
    @SerialName("token_type")
    val tokenType: String = "Bearer",
    @SerialName("expires_at")
    val expiresAt: String? = null
)

@Serializable
data class CustomerProfile(
    val id: Int,
    @SerialName("full_name")
    val fullName: String = "",
    val username: String = "",
    val language: String = "unknown",
    @SerialName("preferred_language")
    val preferredLanguage: String = "en",
    @SerialName("conversation_state")
    val conversationState: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("last_seen_at")
    val lastSeenAt: String? = null
)

@Serializable
data class CustomerSessionVerifyResponse(
    val ok: Boolean,
    val valid: Boolean,
    @SerialName("expires_at")
    val expiresAt: String? = null,
    val customer: CustomerProfile? = null
)

@Serializable
data class CustomerLogoutResponse(
    val ok: Boolean,
    @SerialName("logged_out")
    val loggedOut: Boolean = false,
    @SerialName("revoked_count")
    val revokedCount: Int = 0
)

@Serializable
data class CustomerProfileResponse(
    val ok: Boolean,
    val customer: CustomerProfile
)

@Serializable
data class CustomerProfileUpdateRequest(
    @SerialName("full_name")
    val fullName: String,
    val username: String = "",
    @SerialName("preferred_language")
    val preferredLanguage: String = "en"
)

@Serializable
data class CustomerLocation(
    val id: Int,
    @SerialName("customer_id")
    val customerId: Int? = null,
    @SerialName("session_token")
    val sessionToken: String = "",
    @SerialName("request_type")
    val requestType: String = "delivery_location",
    val label: String = "",
    val address: String = "",
    val description: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("google_maps_link")
    val googleMapsLink: String = "",
    val source: String = "",
    @SerialName("is_preferred")
    val isPreferred: Boolean = false,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null
)

@Serializable
data class CustomerLocationsResponse(
    val ok: Boolean,
    val locations: List<CustomerLocation> = emptyList(),
    val count: Int = 0
)

@Serializable
data class CustomerLocationResponse(
    val ok: Boolean,
    val location: CustomerLocation,
    val locations: List<CustomerLocation> = emptyList(),
    val count: Int = 0
)

@Serializable
data class CreateCustomerLocationRequest(
    val label: String = "",
    val address: String = "",
    @SerialName("google_maps_link")
    val googleMapsLink: String = "",
    val latitude: String = "",
    val longitude: String = "",
    @SerialName("save_as_preferred")
    val saveAsPreferred: Boolean = false
)

@Serializable
data class CustomerCartResponse(
    val ok: Boolean,
    val cart: CustomerCart
)

@Serializable
data class CustomerCart(
    val id: Int? = null,
    val status: String = "active",
    @SerialName("order_status")
    val orderStatus: String = "in_progress",
    @SerialName("delivery_location_label")
    val deliveryLocationLabel: String? = null,
    @SerialName("delivery_google_maps_link")
    val deliveryGoogleMapsLink: String? = null,
    @SerialName("delivery_note")
    val deliveryNote: String? = null,
    @SerialName("admin_status_note")
    val adminStatusNote: String? = null,
    @SerialName("session_token")
    val sessionToken: String = "",
    val items: List<CustomerCartItem> = emptyList(),
    @SerialName("total_amount")
    val totalAmount: Int = 0,
    @SerialName("total_formatted")
    val totalFormatted: String? = null,
    val currency: String = "EUR",
    @SerialName("item_count")
    val itemCount: Int = 0,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null
)

@Serializable
data class CustomerCartItem(
    val id: Int? = null,
    @SerialName("product_id")
    val productId: Int? = null,
    @SerialName("item_type")
    val itemType: String? = null,
    val quantity: Int = 1,
    @SerialName("product_name")
    val productName: String? = null,
    val name: String? = null,
    @SerialName("unit_price")
    val unitPrice: Int? = null,
    @SerialName("price_snapshot")
    val priceSnapshot: Int? = null,
    @SerialName("shop_id")
    val shopId: Int? = null,
    @SerialName("shop_name")
    val shopName: String? = null,
    @SerialName("line_total")
    val lineTotal: Int? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class AddCartItemRequest(
    @SerialName("product_id")
    val productId: Int,
    val quantity: Int
)

@Serializable
data class UpdateCartItemRequest(
    val quantity: Int
)

@Serializable
data class CheckoutRequest(
    @SerialName("saved_location_id")
    val savedLocationId: Int? = null,
    @SerialName("use_preferred_location")
    val usePreferredLocation: Boolean = false,
    val address: String = "",
    @SerialName("location_label")
    val locationLabel: String = "",
    @SerialName("google_maps_link")
    val googleMapsLink: String = "",
    val latitude: String = "",
    val longitude: String = "",
    @SerialName("delivery_note")
    val deliveryNote: String,
    @SerialName("save_as_preferred")
    val saveAsPreferred: Boolean = false
)

@Serializable
data class CheckoutPickupRequest(
    val notes: String = "",
    @SerialName("payment_method_code")
    val paymentMethodCode: String = ""
)

@Serializable
data class CustomerOrderResponse(
    val ok: Boolean,
    val order: CustomerOrder? = null,
    val cart: CustomerCart? = null
)

@Serializable
data class CustomerOrdersResponse(
    val ok: Boolean,
    val orders: List<CustomerOrderSummary> = emptyList()
)

@Serializable
data class CustomerOrderStatusHistory(
    val id: Int? = null,
    @SerialName("order_id")
    val orderId: Int? = null,
    @SerialName("previous_status")
    val previousStatus: String? = null,
    @SerialName("new_status")
    val newStatus: String,
    @SerialName("changed_by_admin_username")
    val changedByAdminUsername: String? = null,
    val note: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerOrderSummary(
    val id: Int,
    @SerialName("public_order_code")
    val publicOrderCode: String = "",
    val status: String = "active",
    @SerialName("order_status")
    val orderStatus: String? = null,
    @SerialName("order_status_label")
    val orderStatusLabel: String? = null,
    @SerialName("delivery_location_label")
    val deliveryLocationLabel: String? = null,
    @SerialName("delivery_google_maps_link")
    val deliveryGoogleMapsLink: String? = null,
    @SerialName("delivery_note")
    val deliveryNote: String? = null,
    @SerialName("admin_status_note")
    val adminStatusNote: String? = null,
    @SerialName("total_amount")
    val totalAmount: Int = 0,
    @SerialName("total_formatted")
    val totalFormatted: String? = null,
    val currency: String = "EUR",
    @SerialName("item_count")
    val itemCount: Int = 0,
    @SerialName("customer_name")
    val customerName: String? = null,
    val phone: String? = null,
    @SerialName("delivery_address")
    val deliveryAddress: String? = null,
    @SerialName("payment_method_code")
    val paymentMethodCode: String? = null,
    val notes: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null,
    @SerialName("status_history")
    val statusHistory: List<CustomerOrderStatusHistory> = emptyList()
)

@Serializable
data class CustomerOrder(
    val id: Int,
    @SerialName("public_order_code")
    val publicOrderCode: String = "",
    @SerialName("session_token")
    val sessionToken: String = "",
    val status: String = "active",
    @SerialName("order_status")
    val orderStatus: String? = null,
    @SerialName("order_status_label")
    val orderStatusLabel: String? = null,
    @SerialName("delivery_location_label")
    val deliveryLocationLabel: String? = null,
    @SerialName("delivery_google_maps_link")
    val deliveryGoogleMapsLink: String? = null,
    @SerialName("delivery_note")
    val deliveryNote: String? = null,
    @SerialName("admin_status_note")
    val adminStatusNote: String? = null,
    @SerialName("total_amount")
    val totalAmount: Int = 0,
    @SerialName("total_formatted")
    val totalFormatted: String? = null,
    val currency: String = "EUR",
    @SerialName("item_count")
    val itemCount: Int = 0,
    @SerialName("customer_name")
    val customerName: String? = null,
    val phone: String? = null,
    @SerialName("delivery_address")
    val deliveryAddress: String? = null,
    @SerialName("payment_method_code")
    val paymentMethodCode: String? = null,
    val notes: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null,
    @SerialName("status_history")
    val statusHistory: List<CustomerOrderStatusHistory> = emptyList(),
    val items: List<CustomerOrderItem> = emptyList()
)

@Serializable
data class CustomerOrderItem(
    val id: Int? = null,
    @SerialName("customer_order_id")
    val customerOrderId: Int? = null,
    @SerialName("product_id")
    val productId: Int? = null,
    @SerialName("product_name")
    val productName: String? = null,
    val name: String? = null,
    @SerialName("shop_id")
    val shopId: Int? = null,
    val quantity: Int = 1,
    @SerialName("unit_price")
    val unitPrice: Int? = null,
    @SerialName("price_snapshot")
    val priceSnapshot: Int? = null,
    @SerialName("line_total")
    val lineTotal: Int? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerCatalogResponse(
    val ok: Boolean = true,
    val catalog: CustomerCatalog
)

@Serializable
data class CustomerCatalog(
    val products: List<CustomerProduct> = emptyList()
)

@Serializable
data class CustomerProduct(
    val id: Int,
    val name: String,
    val price: Int,
    @SerialName("category_id")
    val categoryId: Int? = null,
    @SerialName("category_name")
    val categoryName: String? = null,
    @SerialName("shop_id")
    val shopId: Int? = null,
    @SerialName("shop_name")
    val shopName: String? = null
)
