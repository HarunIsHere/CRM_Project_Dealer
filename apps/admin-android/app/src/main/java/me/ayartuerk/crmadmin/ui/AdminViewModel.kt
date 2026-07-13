package me.ayartuerk.crmadmin.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import me.ayartuerk.crmadmin.api.ApiClient
import me.ayartuerk.crmadmin.api.Customer
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.CustomerLocation
import me.ayartuerk.crmadmin.api.CustomerMessage
import me.ayartuerk.crmadmin.api.CustomerRequest
import me.ayartuerk.crmadmin.api.DashboardResponse
import me.ayartuerk.crmadmin.api.MeetingPoint
import me.ayartuerk.crmadmin.api.OpenRequest
import me.ayartuerk.crmadmin.api.Product
import me.ayartuerk.crmadmin.api.ProductCategory
import me.ayartuerk.crmadmin.data.AdminRepository
import me.ayartuerk.crmadmin.data.TokenStore
enum class AdminScreen {
    DASHBOARD,
    ORDERS,
    ORDER_DETAIL,
    PRODUCTS,
    CUSTOMERS,
    CUSTOMER_DETAIL,
    OPEN_REQUESTS,
    MEETING_POINTS
}

data class AdminUiState(
    val loading: Boolean = true,
    val loggedIn: Boolean = false,
    val token: String? = null,
    val screen: AdminScreen = AdminScreen.DASHBOARD,
    val dashboard: DashboardResponse? = null,
    val orders: List<CustomerAppOrder> = emptyList(),
    val selectedOrder: CustomerAppOrder? = null,
    val products: List<Product> = emptyList(),
    val categories: List<ProductCategory> = emptyList(),
    val customers: List<Customer> = emptyList(),
    val selectedCustomer: Customer? = null,
    val customerMessages: List<CustomerMessage> = emptyList(),
    val customerRequests: List<CustomerRequest> = emptyList(),
    val customerLocations: List<CustomerLocation> = emptyList(),
    val replyMessage: String = "",
    val lastReplySent: String? = null,
    val openRequests: List<OpenRequest> = emptyList(),
    val lastOpenRequestAction: String? = null,
    val meetingPoints: List<MeetingPoint> = emptyList(),
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

    fun showProducts() {
        _state.value = _state.value.copy(screen = AdminScreen.PRODUCTS, selectedOrder = null)
        loadProducts()
    }

    fun loadProducts() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Products failed")
            }
        }
    }

    fun showCustomers() {
        _state.value = _state.value.copy(screen = AdminScreen.CUSTOMERS, selectedOrder = null, selectedCustomer = null)
        loadCustomers()
    }

    fun loadCustomers() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                repository.customers(token)
            }.onSuccess { customers ->
                _state.value = _state.value.copy(loading = false, customers = customers)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Customers failed")
            }
        }
    }

    fun showCustomerDetail(customerId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                lastReplySent = null,
                screen = AdminScreen.CUSTOMER_DETAIL,
                selectedCustomer = _state.value.customers.firstOrNull { it.id == customerId }
            )

            runCatching {
                repository.customerDetail(token, customerId)
            }.onSuccess { response ->
                _state.value = _state.value.copy(
                    loading = false,
                    selectedCustomer = response.customer,
                    customerMessages = response.messages,
                    customerRequests = response.requests,
                    customerLocations = response.locations
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Customer detail failed")
            }
        }
    }

    fun updateReplyMessage(message: String) {
        _state.value = _state.value.copy(replyMessage = message)
    }

    fun sendCustomerReply() {
        val token = _state.value.token ?: return
        val customerId = _state.value.selectedCustomer?.id ?: return
        val message = _state.value.replyMessage.trim()

        if (message.isBlank()) {
            _state.value = _state.value.copy(error = "Reply message is empty")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastReplySent = null)

            runCatching {
                repository.replyToCustomer(token, customerId, message)
            }.onSuccess {
                _state.value = _state.value.copy(
                    loading = false,
                    replyMessage = "",
                    lastReplySent = "Reply sent"
                )
                showCustomerDetail(customerId)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Reply failed")
            }
        }
    }

    fun showOpenRequests() {
        _state.value = _state.value.copy(
            screen = AdminScreen.OPEN_REQUESTS,
            selectedOrder = null,
            selectedCustomer = null
        )
        loadOpenRequests()
    }

    fun loadOpenRequests() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastOpenRequestAction = null)

            runCatching {
                repository.openRequests(token)
            }.onSuccess { openRequests ->
                _state.value = _state.value.copy(loading = false, openRequests = openRequests)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Open requests failed")
            }
        }
    }

    fun updateOpenRequestStatus(requestId: Long, status: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastOpenRequestAction = null)

            runCatching {
                repository.updateOpenRequestStatus(token, requestId, status)
            }.onSuccess {
                _state.value = _state.value.copy(
                    loading = false,
                    lastOpenRequestAction = "Request #$requestId updated to $status"
                )
                loadOpenRequests()
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Open request update failed")
            }
        }
    }

    fun markOpenRequestGroupDone(requestId: Long) {
        val token = _state.value.token ?: return
        val request = _state.value.openRequests.firstOrNull { it.id == requestId } ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastOpenRequestAction = null)

            runCatching {
                repository.markOpenRequestGroupDone(token, request)
            }.onSuccess { updated ->
                _state.value = _state.value.copy(
                    loading = false,
                    lastOpenRequestAction = "Group done updated $updated request(s)"
                )
                loadOpenRequests()
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Group done failed")
            }
        }
    }

    fun showMeetingPoints() {
        _state.value = _state.value.copy(
            screen = AdminScreen.MEETING_POINTS,
            selectedOrder = null,
            selectedCustomer = null
        )
        loadMeetingPoints()
    }

    fun loadMeetingPoints() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                repository.meetingPoints(token)
            }.onSuccess { meetingPoints ->
                _state.value = _state.value.copy(loading = false, meetingPoints = meetingPoints)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Meeting points failed")
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
