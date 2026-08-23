package me.ayartuerk.crmadmin.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import retrofit2.http.DELETE
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface AdminApi {
    @POST("admin/auth/recovery/start")
    suspend fun startIdentityRecovery(
        @Body body: AdminIdentityRecoveryStartRequest
    ): AdminIdentityRecoveryStartResponse

    @POST("admin/auth/recovery/verify")
    suspend fun verifyIdentityRecovery(
        @Body body: AdminIdentityRecoveryVerifyRequest
    ): AdminIdentityRecoveryVerifyResponse

    @PUT("admin/auth/recovery/password")
    suspend fun completeIdentityRecovery(
        @Header("X-CSRF-Token") csrfToken: String,
        @Body body: AdminIdentityRecoveryPasswordRequest
    ): AdminIdentityRecoveryPasswordResponse

    @POST("admin/auth/recovery/logout")
    suspend fun logoutIdentityRecovery(
        @Header("X-CSRF-Token") csrfToken: String
    ): BasicResponse

    @POST("admin/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("admin/me")
    suspend fun me(@Header("Authorization") authorization: String): MeResponse

    // ADMIN_SUPERADMIN_ANDROID_API_V1
    @GET("admin/superadmin")
    suspend fun superadminOverview(
        @Header("Authorization") authorization: String
    ): SuperadminOverviewResponse

    @POST("admin/superadmin/admins")
    suspend fun createManagedAdmin(
        @Header("Authorization") authorization: String,
        @Body body: CreateManagedAdminRequest
    ): SuperadminOverviewResponse

    @PATCH("admin/superadmin/admins/{adminId}/toggle")
    suspend fun toggleManagedAdmin(
        @Header("Authorization") authorization: String,
        @Path("adminId") adminId: Long
    ): SuperadminOverviewResponse

    @DELETE("admin/superadmin/admins/{adminId}")
    suspend fun deleteManagedAdmin(
        @Header("Authorization") authorization: String,
        @Path("adminId") adminId: Long
    ): SuperadminOverviewResponse

    @POST("admin/password")
    suspend fun changeAdminPassword(
        @Header("Authorization") authorization: String,
        @Body body: ChangeAdminPasswordRequest
    ): BasicResponse

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

    @POST("admin/products")
    suspend fun createProduct(
        @Header("Authorization") authorization: String,
        @Body body: JsonObject
    ): BasicResponse

    @PATCH("admin/products/{productId}")
    suspend fun updateProduct(
        @Header("Authorization") authorization: String,
        @Path("productId") productId: Long,
        @Body body: JsonObject
    ): BasicResponse

    @DELETE("admin/products/{productId}")
    suspend fun deleteProduct(
        @Header("Authorization") authorization: String,
        @Path("productId") productId: Long
    ): BasicResponse

    @GET("admin/product-categories")
    suspend fun productCategories(@Header("Authorization") authorization: String): ProductCategoriesResponse

    @POST("admin/product-categories")
    suspend fun createProductCategory(
        @Header("Authorization") authorization: String,
        @Body body: JsonObject
    ): BasicResponse

    @PATCH("admin/product-categories/{categoryId}")
    suspend fun updateProductCategory(
        @Header("Authorization") authorization: String,
        @Path("categoryId") categoryId: Long,
        @Body body: JsonObject
    ): BasicResponse

    @DELETE("admin/product-categories/{categoryId}")
    suspend fun deleteProductCategory(
        @Header("Authorization") authorization: String,
        @Path("categoryId") categoryId: Long
    ): BasicResponse

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

    // CUSTOMER_ACTIONS_V1
    @DELETE("admin/customers/{customerId}")
    suspend fun deleteCustomer(
        @Header("Authorization") authorization: String,
        @Path("customerId") customerId: Long
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

    @POST("admin/open-requests/all/done")
    suspend fun markAllOpenRequestsDone(
        @Header("Authorization") authorization: String
    ): OpenRequestAllDoneResponse

    @GET("admin/search-location")
    suspend fun searchMeetingPointLocations(
        @Header("Authorization") authorization: String,
        @Query("query") query: String
    ): MeetingPointLocationSearchResponse

    @GET("admin/meeting-points")
    suspend fun meetingPoints(@Header("Authorization") authorization: String): MeetingPointsResponse

    @POST("admin/meeting-points")
    suspend fun createMeetingPoint(
        @Header("Authorization") authorization: String,
        @Body body: JsonObject
    ): BasicResponse

    @PATCH("admin/meeting-points/{pointId}")
    suspend fun updateMeetingPoint(
        @Header("Authorization") authorization: String,
        @Path("pointId") pointId: Long,
        @Body body: JsonObject
    ): BasicResponse

    @DELETE("admin/meeting-points/{pointId}")
    suspend fun deleteMeetingPoint(
        @Header("Authorization") authorization: String,
        @Path("pointId") pointId: Long
    ): BasicResponse

    @GET("admin/settings")
    suspend fun settings(@Header("Authorization") authorization: String): SettingsResponse

    @PATCH("admin/settings")
    suspend fun updateSettings(
        @Header("Authorization") authorization: String,
        @Body body: JsonObject
    ): SettingsResponse
    @POST("admin/customer-app-orders/{orderId}/on-the-way")
    suspend fun markCustomerAppOrderOnTheWay(
        @Header("Authorization") authorization: String,
        @Path("orderId") orderId: Long
    ): BasicResponse

    @POST("admin/customer-app-orders/{orderId}/ready-to-pickup")
    suspend fun markCustomerAppOrderReadyToPickup(
        @Header("Authorization") authorization: String,
        @Path("orderId") orderId: Long
    ): BasicResponse

    @POST("admin/customer-app-orders/{orderId}/cancel")
    suspend fun cancelCustomerAppOrder(
        @Header("Authorization") authorization: String,
        @Path("orderId") orderId: Long,
        @Body body: CustomerAppOrderCancelRequest
    ): BasicResponse

    @POST("admin/customer-app-orders/{orderId}/delivered")
    suspend fun markCustomerAppOrderDeliveredV2(
        @Header("Authorization") authorization: String,
        @Path("orderId") orderId: Long
    ): BasicResponse

    @POST("admin/customer-app-orders/{orderId}/not-delivered")
    suspend fun markCustomerAppOrderNotDeliveredV2(
        @Header("Authorization") authorization: String,
        @Path("orderId") orderId: Long,
        @Body body: CustomerAppOrderNotDeliveredRequest
    ): BasicResponse

    @GET("admin/ai-info")
    suspend fun aiInfo(
        @Header("Authorization") authorization: String
    ): AiInfoResponse

    @POST("admin/learned-patterns/{patternId}/{action}")
    suspend fun updateLearnedPattern(
        @Header("Authorization") authorization: String,
        @Path("patternId") patternId: Long,
        @Path("action") action: String
    ): BasicResponse

}


@Serializable
data class AiUsageStats(
    @SerialName("last_hour")
    val lastHour: Long = 0,
    @SerialName("last_24_hours")
    val last24Hours: Long = 0,
    @SerialName("last_week")
    val lastWeek: Long = 0,
    @SerialName("last_month")
    val lastMonth: Long = 0,
    val total: Long = 0
)

@Serializable
data class LearnedPattern(
    val id: Long = 0,
    @SerialName("pattern_text")
    val patternText: String = "",
    val intent: String = "",
    @SerialName("product_id")
    val productId: Long? = null,
    @SerialName("product_name")
    val productName: String = "",
    @SerialName("response_text")
    val responseText: String = "",
    val status: String = "pending",
    @SerialName("hit_count")
    val hitCount: Long = 0
)

@Serializable
data class AiInfoResponse(
    val ok: Boolean = false,
    val usage: AiUsageStats? = null,
    @SerialName("learned_patterns")
    val learnedPatterns: List<LearnedPattern> = emptyList(),
    val count: Int = 0,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class AdminIdentityRecoveryStartRequest(
    val username: String
)

@Serializable
data class AdminIdentityRecoveryVerifyRequest(
    val token: String? = null,
    val username: String? = null,
    @SerialName("manual_code")
    val manualCode: String? = null,
    @SerialName("session_transport")
    val sessionTransport: String = "cookie",
    @SerialName("client_platform")
    val clientPlatform: String = "admin_web",
    @SerialName("app_version")
    val appVersion: String? = null
)

@Serializable
data class AdminIdentityRecoveryPasswordRequest(
    @SerialName("new_password")
    val newPassword: String,
    @SerialName("confirm_password")
    val confirmPassword: String? = null
)

@Serializable
data class AdminIdentityRecoveryStartResponse(
    val ok: Boolean = false,
    @SerialName("request_id")
    val requestId: String? = null,
    val accepted: Boolean = false,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class AdminIdentityRecoveryVerifyResponse(
    val ok: Boolean = false,
    @SerialName("request_id")
    val requestId: String? = null,
    val recovery: AdminIdentityRecoveryState? = null,
    val session: AdminIdentityRecoverySession? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class AdminIdentityRecoveryPasswordResponse(
    val ok: Boolean = false,
    @SerialName("request_id")
    val requestId: String? = null,
    @SerialName("password_changed")
    val passwordChanged: Boolean = false,
    @SerialName("login_required")
    val loginRequired: Boolean = false,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class AdminIdentityRecoveryState(
    val stage: String? = null,
    @SerialName("email_verified")
    val emailVerified: Boolean = false,
    @SerialName("password_set")
    val passwordSet: Boolean = false
)

@Serializable
data class AdminIdentityRecoverySession(
    val id: String? = null,
    val scope: String? = null,
    val transport: String? = null,
    @SerialName("expires_at")
    val expiresAt: String? = null,
    @SerialName("csrf_token")
    val csrfToken: String? = null
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
data class SettingsResponse(
    val ok: Boolean = false,
    val settings: JsonObject? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class MeetingPointLocationSearchResponse(
    val ok: Boolean = false,
    val locations: List<MeetingPointLocationSearchResult> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
)

@Serializable
data class MeetingPointLocationSearchResult(
    val name: String = "",
    val address: String = "",
    @SerialName("postal_code")
    val postalCode: String = "",
    val latitude: String = "",
    val longitude: String = "",
    @SerialName("google_maps_link")
    val googleMapsLink: String = ""
)

@Serializable
data class MeetingPointsResponse(
    val ok: Boolean = false,
    @SerialName("meeting_points")
    val meetingPoints: List<MeetingPoint> = emptyList(),
    val count: Int? = null,
    val error: ApiErrorEnvelope? = null
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
data class OpenRequestAllDoneResponse(
    val ok: Boolean = false,
    val updated: Int? = null,
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
    @SerialName("is_superadmin")
    val isSuperadmin: Boolean = false,
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
data class CustomerAppOrderCancelRequest(
    val reason: String = ""
)

@Serializable
data class CustomerAppOrderNotDeliveredRequest(
    @SerialName("admin_status_note")
    val adminStatusNote: String = ""
)

@Serializable
data class CustomerAppOrderCustomer(
    val id: Long? = null,
    @SerialName("full_name")
    val fullName: String? = null,
    val username: String? = null,
    @SerialName("telegram_user_id")
    val telegramUserId: String? = null,
    @SerialName("preferred_language")
    val preferredLanguage: String? = null
)

@Serializable
data class CustomerAppOrder(
    val id: Long,
    @SerialName("public_order_code")
    val publicOrderCode: String? = null,
    val status: String? = null,
    @SerialName("order_status")
    val orderStatus: String? = null,
    @SerialName("order_status_label")
    val orderStatusLabel: String? = null,
    @SerialName("fulfillment_type")
    val fulfillmentType: String? = null,
    @SerialName("delivery_status")
    val deliveryStatus: String? = null,
    @SerialName("delivery_status_label")
    val deliveryStatusLabel: String? = null,
    @SerialName("pickup_status")
    val pickupStatus: String? = null,
    @SerialName("pickup_status_label")
    val pickupStatusLabel: String? = null,
    val customer: CustomerAppOrderCustomer? = null,
    @SerialName("customer_id")
    val customerId: Long? = null,
    @SerialName("customer_name")
    val customerName: String? = null,
    @SerialName("customer_phone")
    val customerPhone: String? = null,
    @SerialName("delivery_location_label")
    val deliveryLocationLabel: String? = null,
    @SerialName("delivery_address")
    val deliveryAddress: String? = null,
    @SerialName("delivery_google_maps_link")
    val deliveryGoogleMapsLink: String? = null,
    @SerialName("delivery_maps_url")
    val deliveryMapsUrl: String? = null,
    @SerialName("total_amount")
    val totalAmount: Double? = null,
    @SerialName("total_formatted")
    val totalFormatted: String? = null,
    val total: Double? = null,
    @SerialName("confirmed_total")
    val confirmedTotal: Double? = null,
    val currency: String? = null,
    val items: List<CustomerAppOrderItem> = emptyList(),
    @SerialName("created_at")
    val createdAt: String? = null,
    @SerialName("updated_at")
    val updatedAt: String? = null
)

@Serializable
data class CustomerAppOrderItem(
    val id: Long,
    @SerialName("product_id")
    val productId: Long? = null,
    @SerialName("product_name")
    val productName: String? = null,
    val quantity: Int? = null,
    @SerialName("unit_price")
    val unitPrice: Double? = null,
    @SerialName("line_total")
    val lineTotal: Double? = null,
    val total: Double? = null,
    @SerialName("item_status")
    val itemStatus: String? = null,
    val status: String? = null
)

@Serializable
data class Product(
    val id: Long? = null,
    val name: String? = null,
    val description: String? = null,
    val price: Double? = null,
    @SerialName("price_formatted")
    val priceFormatted: String? = null,
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
    val aliases: List<String> = emptyList(),
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
    @SerialName("content")
    val content: String? = null,
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
    val description: String? = null,
    @SerialName("request_text")
    val requestText: String? = null,
    val quantity: Double? = null,
    @SerialName("google_maps_link")
    val googleMapsLink: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class CustomerLocation(
    val id: Long? = null,
    val label: String? = null,
    val address: String? = null,
    @SerialName("google_maps_link")
    val googleMapsLink: String? = null,
    @SerialName("maps_url")
    val mapsUrl: String? = null,
    @SerialName("google_maps_url")
    val googleMapsUrl: String? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)

@Serializable
data class OpenRequest(
    @SerialName("customer_id")
    val customerId: Long? = null,
    @SerialName("request_type")
    val requestType: String? = null,
    @SerialName("request_type_label")
    val requestTypeLabel: String? = null,
    @SerialName("item_name")
    val itemName: String? = null,
    val quantity: Double? = null,
    @SerialName("request_count")
    val requestCount: Int? = null,
    val status: String? = null,
    @SerialName("latest_text")
    val latestText: String? = null,
    @SerialName("latest_created_at")
    val latestCreatedAt: String? = null,
    @SerialName("google_maps_link")
    val googleMapsLink: String? = null,
    val customer: Customer? = null
)

@Serializable
data class MeetingPoint(
    val id: Long? = null,
    val name: String? = null,
    val title: String? = null,
    val description: String? = null,
    val address: String? = null,
    @SerialName("maps_url")
    val mapsUrl: String? = null,
    @SerialName("google_maps_link")
    val googleMapsLink: String? = null,
    @SerialName("google_maps_url")
    val googleMapsUrl: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("is_active")
    val isActive: Boolean? = null,
    @SerialName("is_default")
    val isDefault: Boolean? = null,
    @SerialName("sort_order")
    val sortOrder: Int? = null,
    @SerialName("created_at")
    val createdAt: String? = null
)
