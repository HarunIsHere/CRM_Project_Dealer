package com.horizend.crmdelivery.shared.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CustomerCartResponse(
    val ok: Boolean,
    val cart: CustomerCart
)

@Serializable
data class CustomerCart(
    @SerialName("session_token")
    val sessionToken: String,
    val items: List<CustomerCartItem>,
    @SerialName("total_amount")
    val totalAmount: Int,
    val currency: String,
    @SerialName("item_count")
    val itemCount: Int
)

@Serializable
data class CustomerCartItem(
    @SerialName("product_id")
    val productId: Int,
    val quantity: Int,
    @SerialName("product_name")
    val productName: String,
    @SerialName("unit_price")
    val unitPrice: Int,
    @SerialName("shop_id")
    val shopId: Int? = null,
    @SerialName("shop_name")
    val shopName: String? = null,
    @SerialName("line_total")
    val lineTotal: Int
)

@Serializable
data class AddCartItemRequest(
    @SerialName("session_token")
    val sessionToken: String,
    @SerialName("product_id")
    val productId: Int,
    val quantity: Int
)

@Serializable
data class UpdateCartItemRequest(
    @SerialName("session_token")
    val sessionToken: String,
    val quantity: Int
)

@Serializable
data class CheckoutRequest(
    @SerialName("session_token")
    val sessionToken: String,
    @SerialName("customer_name")
    val customerName: String,
    val phone: String,
    @SerialName("delivery_address")
    val deliveryAddress: String,
    @SerialName("payment_method_code")
    val paymentMethodCode: String,
    val notes: String
)

@Serializable
data class CustomerOrderResponse(
    val ok: Boolean,
    val order: CustomerOrder
)

@Serializable
data class CustomerOrdersResponse(
    val ok: Boolean,
    val orders: List<CustomerOrderSummary>
)

@Serializable
data class CustomerOrderSummary(
    val id: Int,
    @SerialName("public_order_code")
    val publicOrderCode: String,
    val status: String,
    @SerialName("total_amount")
    val totalAmount: Int,
    val currency: String,
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
    val updatedAt: String? = null
)

@Serializable
data class CustomerOrder(
    val id: Int,
    @SerialName("public_order_code")
    val publicOrderCode: String,
    @SerialName("session_token")
    val sessionToken: String,
    val status: String,
    @SerialName("total_amount")
    val totalAmount: Int,
    val currency: String,
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
    val items: List<CustomerOrderItem> = emptyList()
)

@Serializable
data class CustomerOrderItem(
    val id: Int,
    @SerialName("customer_order_id")
    val customerOrderId: Int,
    @SerialName("product_id")
    val productId: Int,
    @SerialName("product_name")
    val productName: String,
    @SerialName("shop_id")
    val shopId: Int? = null,
    val quantity: Int,
    @SerialName("unit_price")
    val unitPrice: Int,
    @SerialName("line_total")
    val lineTotal: Int,
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
