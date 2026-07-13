package me.ayartuerk.crmadmin.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import me.ayartuerk.crmadmin.api.ApiClient
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.DashboardResponse
import me.ayartuerk.crmadmin.data.AdminRepository
import me.ayartuerk.crmadmin.data.TokenStore

enum class AdminScreen {
    DASHBOARD,
    ORDERS,
    ORDER_DETAIL
}

data class AdminUiState(
    val loading: Boolean = true,
    val loggedIn: Boolean = false,
    val token: String? = null,
    val screen: AdminScreen = AdminScreen.DASHBOARD,
    val dashboard: DashboardResponse? = null,
    val orders: List<CustomerAppOrder> = emptyList(),
    val selectedOrder: CustomerAppOrder? = null,
    val error: String? = null
)

class AdminViewModel(application: Application) : AndroidViewModel(application) {
    private val tokenStore = TokenStore(application)
    private val repository = AdminRepository(ApiClient.adminApi)

    private val _state = MutableStateFlow(AdminUiState())
    val state: StateFlow<AdminUiState> = _state

    init {
        restoreSession()
    }

    private fun restoreSession() {
        viewModelScope.launch {
            val token = tokenStore.token.first()
            if (token.isNullOrBlank()) {
                _state.value = AdminUiState(loading = false, loggedIn = false)
                return@launch
            }

            runCatching {
                repository.checkSession(token)
            }.onSuccess { valid ->
                if (valid) {
                    _state.value = AdminUiState(loading = false, loggedIn = true, token = token)
                    loadDashboard()
                } else {
                    tokenStore.clearToken()
                    _state.value = AdminUiState(loading = false, loggedIn = false)
                }
            }.onFailure {
                _state.value = AdminUiState(loading = false, loggedIn = false, error = it.message)
            }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                repository.login(username, password)
            }.onSuccess { token ->
                tokenStore.saveToken(token)
                _state.value = AdminUiState(loading = false, loggedIn = true, token = token)
                loadDashboard()
            }.onFailure {
                _state.value = AdminUiState(loading = false, loggedIn = false, error = it.message ?: "Login failed")
            }
        }
    }

    fun showDashboard() {
        _state.value = _state.value.copy(screen = AdminScreen.DASHBOARD, selectedOrder = null)
        loadDashboard()
    }

    fun loadDashboard() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                repository.dashboard(token)
            }.onSuccess { dashboard ->
                _state.value = _state.value.copy(loading = false, dashboard = dashboard)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Dashboard failed")
            }
        }
    }

    fun showOrders() {
        _state.value = _state.value.copy(screen = AdminScreen.ORDERS, selectedOrder = null)
        loadOrders()
    }

    fun loadOrders() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                repository.customerAppOrders(token)
            }.onSuccess { orders ->
                _state.value = _state.value.copy(loading = false, orders = orders)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Orders failed")
            }
        }
    }

    fun showOrderDetail(orderId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                screen = AdminScreen.ORDER_DETAIL,
                selectedOrder = _state.value.orders.firstOrNull { it.id == orderId }
            )

            runCatching {
                repository.customerAppOrderDetail(token, orderId)
            }.onSuccess { order ->
                _state.value = _state.value.copy(loading = false, selectedOrder = order)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Order detail failed")
            }
        }
    }

    fun logout() {
        val token = _state.value.token

        viewModelScope.launch {
            if (!token.isNullOrBlank()) {
                runCatching {
                    repository.logout(token)
                }
            }
            tokenStore.clearToken()
            _state.value = AdminUiState(loading = false, loggedIn = false)
        }
    }
}
