package me.ayartuerk.crmadmin.data

import me.ayartuerk.crmadmin.api.ChangeAdminPasswordRequest
import me.ayartuerk.crmadmin.api.CreateManagedAdminRequest
import me.ayartuerk.crmadmin.api.SuperadminOverviewResponse

import kotlinx.serialization.json.put

import kotlinx.serialization.json.jsonPrimitive

import kotlinx.serialization.json.buildJsonObject

import kotlinx.serialization.json.JsonPrimitive

import kotlinx.serialization.json.JsonObject

import kotlinx.serialization.json.JsonArray

import me.ayartuerk.crmadmin.api.AdminApi
import me.ayartuerk.crmadmin.api.AiUsageStats
import me.ayartuerk.crmadmin.api.LearnedPattern
import me.ayartuerk.crmadmin.api.AdminIdentityRecoveryStartRequest
import me.ayartuerk.crmadmin.api.Customer
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.CustomerDetailResponse
import me.ayartuerk.crmadmin.api.CustomerReplyRequest
import me.ayartuerk.crmadmin.api.DashboardResponse
import me.ayartuerk.crmadmin.api.LoginRequest
import me.ayartuerk.crmadmin.api.MeetingPoint
import me.ayartuerk.crmadmin.api.MeetingPointLocationSearchResult
import me.ayartuerk.crmadmin.api.OpenRequestStatusRequest
import me.ayartuerk.crmadmin.api.OpenRequestGroupDoneRequest
import me.ayartuerk.crmadmin.api.OpenRequest
import me.ayartuerk.crmadmin.api.Product
import me.ayartuerk.crmadmin.api.ProductCategory
import me.ayartuerk.crmadmin.api.bearer
enum class AdminOrderAction {
    DELIVERY_ON_THE_WAY,
    DELIVERY_DELIVERED,
    DELIVERY_NOT_DELIVERED,
    RETURN_NOT_DELIVERED,
    PICKUP_READY,
    PICKUP_PICKED_UP,
    CANCEL
}

class AdminRepository(
    private val api: AdminApi
) {
    suspend fun login(username: String, password: String): String {
        val response = api.login(LoginRequest(username = username, password = password))
        if (!response.ok || response.accessToken.isNullOrBlank()) {
            val message = response.error?.message ?: "Login failed"
            throw IllegalStateException(message)
        }
        return response.accessToken
    }

    suspend fun startIdentityRecovery(username: String) {
        val response = api.startIdentityRecovery(
            AdminIdentityRecoveryStartRequest(username = username)
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Recovery email request failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun checkSession(token: String): Boolean {
        val response = api.me(bearer(token))
        return response.ok
    }

    suspend fun dashboard(token: String): DashboardResponse {
        val response = api.dashboard(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Dashboard load failed"
            throw IllegalStateException(message)
        }
        return response
    }

    suspend fun customerAppOrders(token: String): List<CustomerAppOrder> {
        val response = api.customerAppOrders(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Orders load failed"
            throw IllegalStateException(message)
        }
        return response.orders
    }

    suspend fun customerAppOrderDetail(token: String, orderId: Long): CustomerAppOrder {
        val response = api.customerAppOrderDetail(bearer(token), orderId)
        if (!response.ok || response.order == null) {
            val message = response.error?.message ?: "Order detail load failed"
            throw IllegalStateException(message)
        }
        return response.order
    }

    suspend fun products(token: String): List<Product> {
        val response = api.products(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Products load failed"
            throw IllegalStateException(message)
        }
        return response.products
    }

    suspend fun createProduct(token: String, name: String, price: Double, categoryId: Long?) {
        val response = api.createProduct(
            bearer(token),
            buildJsonObject {
                put("name", name)
                put("price", price)
                if (categoryId != null) {
                    put("category_id", categoryId)
                }
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Product create failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun updateProduct(
        token: String,
        productId: Long,
        name: String,
        price: Double,
        categoryId: Long?,
        aliases: String,
        isActive: Boolean
    ) {
        val response = api.updateProduct(
            bearer(token),
            productId,
            buildJsonObject {
                put("name", name)
                put("price", price)
                put("category_id", categoryId?.toString() ?: "")
                put("aliases", aliases)
                put("is_active", isActive)
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Product update failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun deleteProduct(token: String, productId: Long) {
        val response = api.deleteProduct(bearer(token), productId)
        if (!response.ok) {
            val message = response.error?.message ?: "Product delete failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun productCategories(token: String): List<ProductCategory> {
        val response = api.productCategories(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Categories load failed"
            throw IllegalStateException(message)
        }
        return response.categories
    }

    suspend fun createProductCategory(token: String, name: String) {
        val response = api.createProductCategory(
            bearer(token),
            buildJsonObject {
                put("name", name)
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Category create failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun updateProductCategory(token: String, categoryId: Long, name: String, isActive: Boolean) {
        val response = api.updateProductCategory(
            bearer(token),
            categoryId,
            buildJsonObject {
                put("name", name)
                put("is_active", isActive)
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Category update failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun deleteProductCategory(token: String, categoryId: Long) {
        val response = api.deleteProductCategory(bearer(token), categoryId)
        if (!response.ok) {
            val message = response.error?.message ?: "Category delete failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun customers(
        token: String,
        search: String? = null,
        language: String? = null,
        active: String? = null,
        limit: Int = 250
    ): List<Customer> {
        val normalizedActive = active
            ?.trim()
            ?.takeIf { it == "active" || it == "blocked" }

        val response = api.customers(
            authorization = bearer(token),
            search = search?.trim()?.takeIf { it.isNotEmpty() },
            language = language?.trim()?.takeIf { it.isNotEmpty() },
            active = normalizedActive,
            limit = limit.coerceIn(1, 250)
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Customers load failed"
            throw IllegalStateException(message)
        }
        return response.customers
    }

    suspend fun customerDetail(token: String, customerId: Long): CustomerDetailResponse {
        val response = api.customerDetail(bearer(token), customerId)
        if (!response.ok || response.customer == null) {
            val message = response.error?.message ?: "Customer detail load failed"
            throw IllegalStateException(message)
        }
        return response
    }

    suspend fun replyToCustomer(token: String, customerId: Long, message: String) {
        val response = api.replyToCustomer(bearer(token), customerId, CustomerReplyRequest(message = message))
        if (!response.ok) {
            val errorMessage = response.error?.message ?: "Reply failed"
            throw IllegalStateException(errorMessage)
        }
    }

    // CUSTOMER_ACTIONS_V1
    suspend fun deleteCustomer(token: String, customerId: Long) {
        val response = api.deleteCustomer(bearer(token), customerId)
        if (!response.ok) {
            throw IllegalStateException(response.error?.message ?: "Customer deletion failed")
        }
    }

    suspend fun openRequests(token: String): List<OpenRequest> {
        val response = api.openRequests(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Open requests load failed"
            throw IllegalStateException(message)
        }
        return response.openRequests
    }

    suspend fun updateOpenRequestStatus(token: String, requestId: Long, status: String): OpenRequest {
        val response = api.updateOpenRequestStatus(
            bearer(token),
            requestId,
            OpenRequestStatusRequest(status = status)
        )
        if (!response.ok || response.request == null) {
            val message = response.error?.message ?: "Open request status update failed"
            throw IllegalStateException(message)
        }
        return response.request
    }

    suspend fun markOpenRequestGroupDone(token: String, request: OpenRequest): Int {
        val customerId = request.customerId ?: throw IllegalStateException("Missing customer_id")
        val requestType = request.requestType ?: throw IllegalStateException("Missing request_type")

        val response = api.markOpenRequestGroupDone(
            bearer(token),
            OpenRequestGroupDoneRequest(
                customerId = customerId,
                requestType = requestType,
                itemName = request.itemName
            )
        )

        if (!response.ok) {
            val message = response.error?.message ?: "Group done failed"
            throw IllegalStateException(message)
        }

        return response.updated ?: 0
    }

    suspend fun markAllOpenRequestsDone(token: String): Int {
        val response = api.markAllOpenRequestsDone(bearer(token))

        if (!response.ok) {
            val message = response.error?.message ?: "All done failed"
            throw IllegalStateException(message)
        }

        return response.updated ?: 0
    }

    suspend fun searchMeetingPointLocations(
        token: String,
        query: String
    ): List<MeetingPointLocationSearchResult> {
        val response = api.searchMeetingPointLocations(
            bearer(token),
            query.trim()
        )

        if (!response.ok) {
            val message = response.error?.message ?: "Location search failed"
            throw IllegalStateException(message)
        }

        return response.locations
    }

    suspend fun meetingPoints(token: String): List<MeetingPoint> {
        val response = api.meetingPoints(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Meeting points load failed"
            throw IllegalStateException(message)
        }
        return response.meetingPoints
    }

    suspend fun createMeetingPoint(
        token: String,
        name: String,
        address: String,
        googleMapsLink: String,
        isPreferred: Boolean
    ) {
        val response = api.createMeetingPoint(
            bearer(token),
            buildJsonObject {
                put("name", name)
                put("address", address)
                put("google_maps_link", googleMapsLink)
                put("is_default", isPreferred)
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Meeting point create failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun updateMeetingPoint(
        token: String,
        pointId: Long,
        name: String,
        address: String,
        googleMapsLink: String,
        isActive: Boolean
    ) {
        val response = api.updateMeetingPoint(
            bearer(token),
            pointId,
            buildJsonObject {
                put("name", name)
                put("address", address)
                put("google_maps_link", googleMapsLink)
                put("is_active", isActive)
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Meeting point update failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun setPreferredMeetingPoint(token: String, pointId: Long, isPreferred: Boolean) {
        val response = api.updateMeetingPoint(
            bearer(token),
            pointId,
            buildJsonObject {
                put("is_default", isPreferred)
            }
        )
        if (!response.ok) {
            val message = response.error?.message ?: "Set preferred meeting point failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun deleteMeetingPoint(token: String, pointId: Long) {
        val response = api.deleteMeetingPoint(bearer(token), pointId)
        if (!response.ok) {
            val message = response.error?.message ?: "Meeting point delete failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun aiInfo(
        token: String
    ): Pair<AiUsageStats, List<LearnedPattern>> {
        val response = api.aiInfo(bearer(token))

        if (!response.ok) {
            val message = response.error?.message ?: "AI information load failed"
            throw IllegalStateException(message)
        }

        return Pair(
            response.usage ?: AiUsageStats(),
            response.learnedPatterns
        )
    }

    suspend fun updateLearnedPattern(
        token: String,
        patternId: Long,
        action: String
    ) {
        require(action in setOf("approve", "reject", "delete")) {
            "Unsupported learned-pattern action"
        }

        val response = api.updateLearnedPattern(
            bearer(token),
            patternId,
            action
        )

        if (!response.ok) {
            val message = response.error?.message ?: "Learned-pattern action failed"
            throw IllegalStateException(message)
        }
    }

    suspend fun settings(token: String): Map<String, String> {
        val response = api.settings(bearer(token))
        if (!response.ok || response.settings == null) {
            val message = response.error?.message ?: "Settings load failed"
            throw IllegalStateException(message)
        }
        return response.settings.toDisplayMap()
    }

    suspend fun updateSettings(token: String, body: JsonObject): Map<String, String> {
        val response = api.updateSettings(bearer(token), body)
        if (!response.ok || response.settings == null) {
            val message = response.error?.message ?: "Settings update failed"
            throw IllegalStateException(message)
        }
        return response.settings.toDisplayMap()
    }

    private fun JsonObject.toDisplayMap(): Map<String, String> {
        return entries.associate { entry ->
            val value = when (val element = entry.value) {
                is JsonPrimitive -> element.content
                is JsonArray -> element.joinToString(", ") { item ->
                    runCatching { item.jsonPrimitive.content }.getOrDefault(item.toString())
                }
                else -> element.toString()
            }
            entry.key to value
        }
    }

    // ADMIN_SUPERADMIN_REPOSITORY_V1
    suspend fun currentAdmin(token: String) =
        api.me("Bearer $token").admin

    suspend fun superadminOverview(
        token: String
    ): SuperadminOverviewResponse {
        val response = api.superadminOverview("Bearer $token")
        if (!response.ok) {
            throw IllegalStateException(
                response.error?.message ?: "Superadmin data request failed"
            )
        }
        return response
    }

    suspend fun createManagedAdmin(
        token: String,
        username: String,
        email: String,
        password: String,
        role: String
    ): SuperadminOverviewResponse {
        val response = api.createManagedAdmin(
            "Bearer $token",
            CreateManagedAdminRequest(
                username = username,
                email = email,
                password = password,
                role = role
            )
        )
        if (!response.ok) {
            throw IllegalStateException(
                response.error?.message ?: "Administrator creation failed"
            )
        }
        return response
    }

    suspend fun toggleManagedAdmin(
        token: String,
        adminId: Long
    ): SuperadminOverviewResponse {
        val response = api.toggleManagedAdmin(
            "Bearer $token",
            adminId
        )
        if (!response.ok) {
            throw IllegalStateException(
                response.error?.message ?: "Administrator access update failed"
            )
        }
        return response
    }

    suspend fun deleteManagedAdmin(
        token: String,
        adminId: Long
    ): SuperadminOverviewResponse {
        val response = api.deleteManagedAdmin(
            "Bearer $token",
            adminId
        )
        if (!response.ok) {
            throw IllegalStateException(
                response.error?.message ?: "Administrator deletion failed"
            )
        }
        return response
    }

    suspend fun changeAdminPassword(
        token: String,
        currentPassword: String,
        newPassword: String,
        confirmPassword: String
    ) {
        val response = api.changeAdminPassword(
            "Bearer $token",
            ChangeAdminPasswordRequest(
                currentPassword = currentPassword,
                newPassword = newPassword,
                confirmPassword = confirmPassword
            )
        )
        if (!response.ok) {
            throw IllegalStateException(
                response.error?.message ?: "Password change failed"
            )
        }
    }

    suspend fun logout(token: String) {
        api.logout(bearer(token))
    }
    suspend fun performOrderAction(
        token: String,
        orderId: Long,
        action: AdminOrderAction,
        note: String = ""
    ): me.ayartuerk.crmadmin.api.CustomerAppOrder {
        val authorization = "Bearer $token"

        val response = when (action) {
            AdminOrderAction.DELIVERY_ON_THE_WAY ->
                api.markCustomerAppOrderOnTheWay(authorization, orderId)

            AdminOrderAction.DELIVERY_DELIVERED,
            AdminOrderAction.PICKUP_PICKED_UP ->
                api.markCustomerAppOrderDeliveredV2(authorization, orderId)

            AdminOrderAction.DELIVERY_NOT_DELIVERED ->
                api.markCustomerAppOrderNotDeliveredV2(
                    authorization,
                    orderId,
                    me.ayartuerk.crmadmin.api.CustomerAppOrderNotDeliveredRequest(
                        adminStatusNote = note
                    )
                )

            AdminOrderAction.RETURN_NOT_DELIVERED ->
                api.markCustomerAppOrderNotDeliveredV2(
                    authorization,
                    orderId,
                    me.ayartuerk.crmadmin.api.CustomerAppOrderNotDeliveredRequest(
                        adminStatusNote = "Returned from closed orders"
                    )
                )

            AdminOrderAction.PICKUP_READY ->
                api.markCustomerAppOrderReadyToPickup(authorization, orderId)

            AdminOrderAction.CANCEL ->
                api.cancelCustomerAppOrder(
                    authorization,
                    orderId,
                    me.ayartuerk.crmadmin.api.CustomerAppOrderCancelRequest(
                        reason = note
                    )
                )
        }

        if (!response.ok) {
            throw IllegalStateException("Order update failed")
        }

        return customerAppOrderDetail(token, orderId)
    }

}
