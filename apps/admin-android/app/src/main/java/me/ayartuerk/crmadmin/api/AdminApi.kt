package me.ayartuerk.crmadmin.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface AdminApi {
    @POST("admin/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("admin/me")
    suspend fun me(@Header("Authorization") authorization: String): MeResponse

    @GET("admin/dashboard")
    suspend fun dashboard(@Header("Authorization") authorization: String): DashboardResponse

    @POST("admin/logout")
    suspend fun logout(@Header("Authorization") authorization: String): BasicResponse
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
    @SerialName("customers")
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
