package me.ayartuerk.crmadmin.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

interface AdminApi {
    @POST("admin/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("admin/me")
    suspend fun me(@Header("Authorization") authorization: String): MeResponse

    @GET("admin/dashboard")
    suspend fun dashboard(@Header("Authorization") authorization: String): DashboardResponse

    @POST("admin/logout")
    suspend fun logout(@Header("Authorization") authorization: String): BasicResponse

    @GET("admin/customer-app-orders")
    suspend fun customerAppOrders(@Header("Authorization") authorization: String): CustomerAppOrdersResponse

    @GET("admin/customer-app-orders/{orderId}")
    suspend fun customerAppOrderDetail(
        @Header("Authorization") authorization: String,
        @Path("orderId") orderId: Long
    ): CustomerAppOrderDetailResponse

    @GET("admin/products")
    suspend fun products(@Header("Authorization") authorization: String): ProductsResponse

    @GET("admin/product-categories")
    suspend fun productCategories(@Header("Authorization") authorization: String): ProductCategoriesResponse

    @GET("admin/customers")
    suspend fun customers(@Header("Authorization") authorization: String): CustomersResponse

    @GET("admin/customers/{customerId}")
    suspend fun customerDetail(
        @Header("Authorization") authorization: String,
        @Path("customerId") customerId: Long
    ): CustomerDetailResponse

    @POST("admin/customers/{customerId}/reply")
    suspend fun replyToCustomer(
        @Header("Authorization") authorization: String,
        @Path("customerId") customerId: Long,
        @Body body: CustomerReplyRequest
    ): BasicResponse

    @GET("admin/open-requests")
    suspend fun openRequests(@Header("Authorization") authorization: String): OpenRequestsResponse

    @PATCH("admin/open-requests/{requestId}/status")
    suspend fun updateOpenRequestStatus(
        @Header("Authorization") authorization: String,
        @Path("requestId") requestId: Long,
        @Body body: OpenRequestStatusRequest
    ): OpenRequestDetailResponse

    @POST("admin/open-requests/group/done")
    suspend fun markOpenRequestGroupDone(
        @Header("Authorization") authorization: String,
        @Body body: OpenRequestGroupDoneRequest
    ): OpenRequestGroupDoneResponse
}

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginResponse(
    val ok: Boolean = false,
    @SerialName("access_token")
    val accessToken: String? = null,
    @SerialName("token_type")
    val tokenType: String? = null,
    @SerialName("expires_in")
    val expiresIn: Long? = null,
    val admin: AdminUser? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class MeResponse(
    val ok: Boolean = false,
    val admin: AdminUser? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class DashboardResponse(
    val ok: Boolean = false,
    val summary: DashboardSummary? = null,
    @SerialName("latest_orders")
    val latestOrders: List<AdminOrderPreview> = emptyList(),
    @SerialName("latest_requests")
    val latestRequests: List<AdminRequestPreview> = emptyList(),
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class BasicResponse(
    val ok: Boolean = false,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class CustomerAppOrdersResponse(
    val ok: Boolean = false,
    val orders: List<CustomerAppOrder> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class CustomerAppOrderDetailResponse(
    val ok: Boolean = false,
    val order: CustomerAppOrder? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class ProductsResponse(
    val ok: Boolean = false,
    val products: List<Product> = emptyList(),
    val categories: List<ProductCategory> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class ProductCategoriesResponse(
    val ok: Boolean = false,
    val categories: List<ProductCategory> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class CustomersResponse(
    val ok: Boolean = false,
    val customers: List<Customer> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class CustomerDetailResponse(
    val ok: Boolean = false,
    val customer: Customer? = null,
    val messages: List<CustomerMessage> = emptyList(),
    val requests: List<CustomerRequest> = emptyList(),
    val locations: List<CustomerLocation> = emptyList(),
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class CustomerReplyRequest(
    val message: String
)

@Serializable
data class OpenRequestsResponse(
    val ok: Boolean = false,
    @SerialName("open_requests")
    val openRequests: List<OpenRequest> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class OpenRequestDetailResponse(
    val ok: Boolean = false,
    val request: OpenRequest? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class OpenRequestStatusRequest(
    val status: String
)

@Serializable
data class OpenRequestGroupDoneRequest(
    @SerialName("customer_id")
    val customerId: Long,
    @SerialName("request_type")
    val requestType: String,
    @SerialName("item_name")
    val itemName: String? = null
)

@Serializable
data class OpenRequestGroupDoneResponse(
    val ok: Boolean = false,
    val updated: Int? = null,
    @SerialName("customer_id")
    val customerId: Long? = null,
    @SerialName("request_type")
    val requestType: String? = null,
    @SerialName("item_name")
    val itemName: String? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class ApiErrorEnvelope(
    val code: String? = null,
    val message: String? = null
)

@Serializable
data class AdminUser(
    val id: Long? = null,
    val username: String? = null,
    val role: String? = null,
    val name: String? = null
)

@Serializable
data class DashboardSummary(
    @SerialName("open_orders")
    val openOrders: Int? = null,
    @SerialName("closed_orders")
    val closedOrders: Int? = null,
    @SerialName("open_requests")
    val openRequests: Int? = null,
    val customers: Int? = null
)

@Serializable
data class AdminOrderPreview(
    val id: Long? = null,
    val status: String? = null,
    @SerialName("order_status")
    val orderStatus: String? = null,
    @SerialName("customer_name")
    val customerName: String? = null,
    val total: Double? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class AdminRequestPreview(
    val id: Long? = null,
    val status: String? = null,
    @SerialName("request_type")
    val requestType: String? = null,
    @SerialName("customer_name")
    val customerName: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerAppOrder(
    val id: Long? = null,
    val status: String? = null,
    @SerialName("order_status")
    val orderStatus: String? = null,
    @SerialName("delivery_status")
    val deliveryStatus: String? = null,
    @SerialName("pickup_status")
    val pickupStatus: String? = null,
    @SerialName("fulfillment_type")
    val fulfillmentType: String? = null,
    @SerialName("customer_id")
    val customerId: Long? = null,
    @SerialName("customer_name")
    val customerName: String? = null,
    @SerialName("customer_phone")
    val customerPhone: String? = null,
    @SerialName("delivery_address")
    val deliveryAddress: String? = null,
    @SerialName("delivery_maps_url")
    val deliveryMapsUrl: String? = null,
    val total: Double? = null,
    @SerialName("confirmed_total")
    val confirmedTotal: Double? = null,
    val items: List<CustomerAppOrderItem> = emptyList(),
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerAppOrderItem(
    val id: Long? = null,
    @SerialName("product_name")
    val productName: String? = null,
    val quantity: Int? = null,
    @SerialName("unit_price")
    val unitPrice: Double? = null,
    val total: Double? = null,
    val status: String? = null
)

@Serializable
data class Product(
    val id: Long? = null,
    val name: String? = null,
    val description: String? = null,
    val price: Double? = null,
    val currency: String? = null,
    val unit: String? = null,
    val status: String? = null,
    @SerialName("is_active")
    val isActive: Boolean? = null,
    @SerialName("category_id")
    val categoryId: Long? = null,
    @SerialName("category_name")
    val categoryName: String? = null,
    @SerialName("image_url")
    val imageUrl: String? = null,
    @SerialName("sort_order")
    val sortOrder: Int? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class ProductCategory(
    val id: Long? = null,
    val name: String? = null,
    val description: String? = null,
    val status: String? = null,
    @SerialName("is_active")
    val isActive: Boolean? = null,
    @SerialName("sort_order")
    val sortOrder: Int? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class Customer(
    val id: Long? = null,
    @SerialName("telegram_user_id")
    val telegramUserId: String? = null,
    val username: String? = null,
    @SerialName("full_name")
    val fullName: String? = null,
    val name: String? = null,
    val language: String? = null,
    @SerialName("preferred_language")
    val preferredLanguage: String? = null,
    @SerialName("is_blocked")
    val isBlocked: Boolean? = null,
    @SerialName("last_seen_at")
    val lastSeenAt: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerMessage(
    val id: Long? = null,
    val direction: String? = null,
    val message: String? = null,
    val text: String? = null,
    val body: String? = null,
    val language: String? = null,
    @SerialName("message_type")
    val messageType: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerRequest(
    val id: Long? = null,
    val status: String? = null,
    @SerialName("request_type")
    val requestType: String? = null,
    @SerialName("item_name")
    val itemName: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerLocation(
    val id: Long? = null,
    val label: String? = null,
    val address: String? = null,
    @SerialName("maps_url")
    val mapsUrl: String? = null,
    @SerialName("google_maps_url")
    val googleMapsUrl: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class OpenRequest(
    val id: Long? = null,
    @SerialName("customer_id")
    val customerId: Long? = null,
    @SerialName("customer_name")
    val customerName: String? = null,
    @SerialName("customer_username")
    val customerUsername: String? = null,
    @SerialName("request_type")
    val requestType: String? = null,
    @SerialName("item_name")
    val itemName: String? = null,
    val status: String? = null,
    val message: String? = null,
    val notes: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

