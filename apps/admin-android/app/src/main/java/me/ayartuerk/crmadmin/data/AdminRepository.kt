package me.ayartuerk.crmadmin.data

import me.ayartuerk.crmadmin.api.AdminApi
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.DashboardResponse
import me.ayartuerk.crmadmin.api.LoginRequest
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

    suspend fun logout(token: String) {
        api.logout(bearer(token))
    }
}
