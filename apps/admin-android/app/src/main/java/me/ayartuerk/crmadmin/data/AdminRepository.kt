package me.ayartuerk.crmadmin.data

import kotlinx.serialization.json.put

import kotlinx.serialization.json.jsonPrimitive

import kotlinx.serialization.json.buildJsonObject

import kotlinx.serialization.json.JsonPrimitive

import kotlinx.serialization.json.JsonObject

import kotlinx.serialization.json.JsonArray

import me.ayartuerk.crmadmin.api.AdminApi
import me.ayartuerk.crmadmin.api.Customer
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.CustomerDetailResponse
import me.ayartuerk.crmadmin.api.CustomerReplyRequest
import me.ayartuerk.crmadmin.api.DashboardResponse
import me.ayartuerk.crmadmin.api.LoginRequest
import me.ayartuerk.crmadmin.api.MeetingPoint
import me.ayartuerk.crmadmin.api.OpenRequestStatusRequest
import me.ayartuerk.crmadmin.api.OpenRequestGroupDoneRequest
import me.ayartuerk.crmadmin.api.OpenRequest
import me.ayartuerk.crmadmin.api.Product
import me.ayartuerk.crmadmin.api.ProductCategory
import me.ayartuerk.crmadmin.api.bearer
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

    suspend fun productCategories(token: String): List<ProductCategory> {
        val response = api.productCategories(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Categories load failed"
            throw IllegalStateException(message)
        }
        return response.categories
    }

    suspend fun customers(token: String): List<Customer> {
        val response = api.customers(bearer(token))
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

    suspend fun meetingPoints(token: String): List<MeetingPoint> {
        val response = api.meetingPoints(bearer(token))
        if (!response.ok) {
            val message = response.error?.message ?: "Meeting points load failed"
            throw IllegalStateException(message)
        }
        return response.meetingPoints
    }

    suspend fun settings(token: String): Map<String, String> {
        val response = api.settings(bearer(token))
        if (!response.ok || response.settings == null) {
            val message = response.error?.message ?: "Settings load failed"
            throw IllegalStateException(message)
        }
        return response.settings.toDisplayMap()
    }

    suspend fun updateAiResponseMode(token: String, mode: String): Map<String, String> {
        val body = buildJsonObject {
            put("ai_response_mode", mode)
        }

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

    suspend fun logout(token: String) {
        api.logout(bearer(token))
    }
}
