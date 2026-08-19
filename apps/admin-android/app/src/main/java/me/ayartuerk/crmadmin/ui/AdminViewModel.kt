package me.ayartuerk.crmadmin.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import me.ayartuerk.crmadmin.api.ApiClient
import me.ayartuerk.crmadmin.api.AiUsageStats
import me.ayartuerk.crmadmin.api.LearnedPattern
import me.ayartuerk.crmadmin.api.Customer
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.CustomerLocation
import me.ayartuerk.crmadmin.api.CustomerMessage
import me.ayartuerk.crmadmin.api.CustomerRequest
import me.ayartuerk.crmadmin.api.DashboardResponse
import me.ayartuerk.crmadmin.api.MeetingPoint
import me.ayartuerk.crmadmin.api.MeetingPointLocationSearchResult
import me.ayartuerk.crmadmin.api.OpenRequest
import me.ayartuerk.crmadmin.api.Product
import me.ayartuerk.crmadmin.api.ProductCategory
import me.ayartuerk.crmadmin.data.AdminRepository
import me.ayartuerk.crmadmin.data.AdminOrderAction
import me.ayartuerk.crmadmin.data.TokenStore
enum class AdminScreen {
    GENERAL,
    DASHBOARD,
    ORDERS,
    CLOSED_ORDERS,
    ORDER_DETAIL,
    CLOSED_ORDER_DETAIL,
    PRODUCTS,
    PRODUCT_LIST,
    CATEGORY_LIST,
    CUSTOMERS,
    CUSTOMER_DETAIL,
    OPEN_REQUESTS,
    MEETING_POINTS,
    AI_INFO,
    SUPERADMIN,
    CHANGE_PASSWORD,
    SETTINGS,
    MORE
}

data class AdminUiState(
    val loading: Boolean = true,
    val loggedIn: Boolean = false,
    val token: String? = null,
    val screen: AdminScreen = AdminScreen.GENERAL,
    val dashboard: DashboardResponse? = null,
    val orders: List<CustomerAppOrder> = emptyList(),
    val closedOrders: List<CustomerAppOrder> = emptyList(),
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
    val meetingPointSearchResults: List<MeetingPointLocationSearchResult> = emptyList(),
    val meetingPointSearchLoading: Boolean = false,
    val meetingPointSearchAttempted: Boolean = false,
    val lastMeetingPointAction: String? = null,
    val aiUsageStats: AiUsageStats? = null,
    val learnedPatterns: List<LearnedPattern> = emptyList(),
    val currentAdminUsername: String = "",
    val currentAdminRole: String = "admin",
    val isSuperadmin: Boolean = false,
    val managedAdmins: List<me.ayartuerk.crmadmin.api.ManagedAdmin> = emptyList(),
    val adminAuditLogs: List<me.ayartuerk.crmadmin.api.AdminAuditLog> = emptyList(),
    val lastAdminAction: String? = null,
    val passwordChangeNotice: String? = null,
    val lastProductAction: String? = null,
    val settings: Map<String, String> = emptyMap(),
    val lastSettingsAction: String? = null,
    val recoveryNotice: String? = null,
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
                tokenStore.clearToken()
                _state.value = AdminUiState(loading = false, loggedIn = false)
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

    fun sendIdentityRecovery(username: String) {
        val cleaned = username.trim()
        if (cleaned.isBlank()) {
            _state.value = _state.value.copy(recoveryNotice = null, error = "Username is required")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, recoveryNotice = null)

            runCatching {
                repository.startIdentityRecovery(cleaned)
            }.onSuccess {
                _state.value = _state.value.copy(
                    loading = false,
                    recoveryNotice = "If the account exists, a recovery email has been sent."
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Recovery email request failed"
                )
            }
        }
    }

    
    fun showGeneral() {
        _state.value = _state.value.copy(
            screen = AdminScreen.GENERAL,
            selectedOrder = null,
            selectedCustomer = null
        )
        loadSettings()
    }

fun showDashboard() {
        _state.value = _state.value.copy(screen = AdminScreen.GENERAL, selectedOrder = null)
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

    fun showClosedOrders() {
        _state.value = _state.value.copy(
            screen = AdminScreen.CLOSED_ORDERS,
            selectedOrder = null
        )
        loadOrders()
    }

    fun loadOrders() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null
            )

            runCatching {
                repository.customerAppOrders(token)
            }.onSuccess { orders ->
                val activeOrders = orders.filterNot { order ->
                    val orderStatus =
                        (order.orderStatus ?: order.status)
                            ?.trim()
                            ?.lowercase()

                    val deliveryStatus =
                        order.deliveryStatus
                            ?.trim()
                            ?.lowercase()

                    val pickupStatus =
                        order.pickupStatus
                            ?.trim()
                            ?.lowercase()

                    orderStatus in setOf(
                        "delivered",
                        "closed",
                        "cancelled",
                        "canceled"
                    ) ||
                        deliveryStatus == "delivered" ||
                        pickupStatus == "picked_up"
                }

                _state.value = _state.value.copy(
                    loading = false,
                    orders = activeOrders,
                    closedOrders = orders.filterNot { candidate ->
                        activeOrders.any { active ->
                            active.id == candidate.id
                        }
                    }
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Failed to load orders"
                )
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

    fun showClosedOrderDetail(orderId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                screen = AdminScreen.CLOSED_ORDER_DETAIL,
                selectedOrder = _state.value.closedOrders
                    .firstOrNull { it.id == orderId }
            )

            runCatching {
                repository.customerAppOrderDetail(token, orderId)
            }.onSuccess { order ->
                _state.value = _state.value.copy(
                    loading = false,
                    selectedOrder = order
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Order detail failed"
                )
            }
        }
    }

    fun showProducts() {
        _state.value = _state.value.copy(
            screen = AdminScreen.PRODUCTS,
            selectedOrder = null,
            lastProductAction = null
        )
        loadProducts()
    }

    fun showProductList() {
        _state.value = _state.value.copy(
            screen = AdminScreen.PRODUCT_LIST,
            selectedOrder = null,
            lastProductAction = null
        )
        loadProducts()
    }

    fun showCategoryList() {
        _state.value = _state.value.copy(
            screen = AdminScreen.CATEGORY_LIST,
            selectedOrder = null,
            lastProductAction = null
        )
        loadProducts()
    }

    fun loadProducts() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

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

    fun createProduct(name: String, price: Double, categoryId: Long?) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

            runCatching {
                repository.createProduct(token, name, price, categoryId)
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second,
                    lastProductAction = "Product created"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Product create failed")
            }
        }
    }

    fun updateProduct(
        productId: Long,
        name: String,
        price: Double,
        categoryId: Long?,
        aliases: String,
        isActive: Boolean
    ) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

            runCatching {
                repository.updateProduct(token, productId, name, price, categoryId, aliases, isActive)
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second,
                    lastProductAction = "Product updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Product update failed")
            }
        }
    }

    fun deleteProduct(productId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

            runCatching {
                repository.deleteProduct(token, productId)
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second,
                    lastProductAction = "Product deleted"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Product delete failed")
            }
        }
    }

    fun createProductCategory(name: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

            runCatching {
                repository.createProductCategory(token, name)
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second,
                    lastProductAction = "Category created"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Category create failed")
            }
        }
    }

    fun updateProductCategory(categoryId: Long, name: String, isActive: Boolean) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

            runCatching {
                repository.updateProductCategory(token, categoryId, name, isActive)
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second,
                    lastProductAction = "Category updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Category update failed")
            }
        }
    }

    fun deleteProductCategory(categoryId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastProductAction = null)

            runCatching {
                repository.deleteProductCategory(token, categoryId)
                val categories = repository.productCategories(token)
                val products = repository.products(token)
                categories to products
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    categories = result.first,
                    products = result.second,
                    lastProductAction = "Category deleted"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Category delete failed")
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

    // CUSTOMER_ACTIONS_V1
    fun sendCustomerMessage(customerId: Long, message: String) {
        val token = _state.value.token ?: return
        val cleaned = message.trim()

        if (cleaned.isBlank()) {
            _state.value = _state.value.copy(error = "Message is required")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastReplySent = null)

            runCatching {
                repository.replyToCustomer(token, customerId, cleaned)
            }.onSuccess {
                _state.value = _state.value.copy(
                    loading = false,
                    lastReplySent = "Reply sent"
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Message could not be sent"
                )
            }
        }
    }

    fun deleteCustomer(customerId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastReplySent = null)

            runCatching {
                repository.deleteCustomer(token, customerId)
                repository.customers(token)
            }.onSuccess { customers ->
                _state.value = _state.value.copy(
                    loading = false,
                    customers = customers,
                    selectedCustomer = null,
                    customerMessages = emptyList(),
                    customerRequests = emptyList(),
                    customerLocations = emptyList(),
                    replyMessage = "",
                    screen = AdminScreen.CUSTOMERS
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Customer deletion failed"
                )
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
                val selectedCustomerId = _state.value.selectedCustomer?.id
                _state.value = _state.value.copy(
                    loading = false,
                    lastOpenRequestAction = "Request #$requestId updated to $status"
                )
                loadOpenRequests()
                selectedCustomerId?.let(::showCustomerDetail)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Open request update failed")
            }
        }
    }

    fun markOpenRequestGroupDone(request: OpenRequest) {
        val token = _state.value.token ?: return

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

    fun markAllOpenRequestsDone() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastOpenRequestAction = null)

            runCatching {
                repository.markAllOpenRequestsDone(token)
            }.onSuccess { updated ->
                _state.value = _state.value.copy(
                    loading = false,
                    lastOpenRequestAction = "All done updated $updated request(s)"
                )
                loadOpenRequests()
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "All done failed")
            }
        }
    }

    fun showMeetingPoints() {
        _state.value = _state.value.copy(
            screen = AdminScreen.MEETING_POINTS,
            selectedOrder = null,
            selectedCustomer = null,
            meetingPointSearchResults = emptyList(),
            meetingPointSearchLoading = false,
            meetingPointSearchAttempted = false,
            lastMeetingPointAction = null
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

    fun searchMeetingPointLocations(query: String) {
        val token = _state.value.token ?: return
        val cleaned = query.trim()

        if (cleaned.isBlank()) {
            _state.value = _state.value.copy(
                meetingPointSearchResults = emptyList(),
                meetingPointSearchLoading = false,
                meetingPointSearchAttempted = false
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(
                meetingPointSearchLoading = true,
                meetingPointSearchAttempted = false,
                error = null
            )

            runCatching {
                repository.searchMeetingPointLocations(token, cleaned)
            }.onSuccess { locations ->
                _state.value = _state.value.copy(
                    meetingPointSearchResults = locations,
                    meetingPointSearchLoading = false,
                    meetingPointSearchAttempted = true
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    meetingPointSearchResults = emptyList(),
                    meetingPointSearchLoading = false,
                    meetingPointSearchAttempted = true,
                    error = it.message ?: "Location search failed"
                )
            }
        }
    }

    fun createMeetingPoint(name: String, address: String, googleMapsLink: String, isPreferred: Boolean) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastMeetingPointAction = null)

            runCatching {
                repository.createMeetingPoint(token, name, address, googleMapsLink, isPreferred)
                repository.meetingPoints(token)
            }.onSuccess { meetingPoints ->
                _state.value = _state.value.copy(
                    loading = false,
                    meetingPoints = meetingPoints,
                    lastMeetingPointAction = "Meeting point created"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Meeting point create failed")
            }
        }
    }

    fun updateMeetingPoint(
        pointId: Long,
        name: String,
        address: String,
        googleMapsLink: String,
        isActive: Boolean
    ) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastMeetingPointAction = null)

            runCatching {
                repository.updateMeetingPoint(token, pointId, name, address, googleMapsLink, isActive)
                repository.meetingPoints(token)
            }.onSuccess { meetingPoints ->
                _state.value = _state.value.copy(
                    loading = false,
                    meetingPoints = meetingPoints,
                    lastMeetingPointAction = "Meeting point updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Meeting point update failed")
            }
        }
    }

    fun setPreferredMeetingPoint(pointId: Long, isPreferred: Boolean) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastMeetingPointAction = null)

            runCatching {
                repository.setPreferredMeetingPoint(token, pointId, isPreferred)
                repository.meetingPoints(token)
            }.onSuccess { meetingPoints ->
                _state.value = _state.value.copy(
                    loading = false,
                    meetingPoints = meetingPoints,
                    lastMeetingPointAction = "Preferred meeting point updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Set preferred meeting point failed")
            }
        }
    }

    fun deleteMeetingPoint(pointId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastMeetingPointAction = null)

            runCatching {
                repository.deleteMeetingPoint(token, pointId)
                repository.meetingPoints(token)
            }.onSuccess { meetingPoints ->
                _state.value = _state.value.copy(
                    loading = false,
                    meetingPoints = meetingPoints,
                    lastMeetingPointAction = "Meeting point deleted"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Meeting point delete failed")
            }
        }
    }

    fun showAiInfo() {
        _state.value = _state.value.copy(
            screen = AdminScreen.AI_INFO,
            selectedOrder = null,
            selectedCustomer = null
        )
        loadAiInfo()
    }

    fun loadAiInfo() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null
            )

            runCatching {
                repository.aiInfo(token)
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    aiUsageStats = result.first,
                    learnedPatterns = result.second
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "AI information load failed"
                )
            }
        }
    }

    fun updateLearnedPattern(patternId: Long, action: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null
            )

            runCatching {
                repository.updateLearnedPattern(
                    token,
                    patternId,
                    action
                )
                repository.aiInfo(token)
            }.onSuccess { result ->
                _state.value = _state.value.copy(
                    loading = false,
                    aiUsageStats = result.first,
                    learnedPatterns = result.second
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Learned-pattern action failed"
                )
            }
        }
    }

    // ADMIN_SUPERADMIN_VIEWMODEL_V1
    fun loadCurrentAdmin() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            runCatching {
                repository.currentAdmin(token)
            }.onSuccess { admin ->
                if (admin != null) {
                    _state.value = _state.value.copy(
                        currentAdminUsername = admin.username.orEmpty(),
                        currentAdminRole = admin.role ?: "admin",
                        isSuperadmin = admin.isSuperadmin
                    )
                }
            }
        }
    }

    fun showSuperadmin() {
        _state.value = _state.value.copy(
            screen = AdminScreen.SUPERADMIN,
            error = null,
            lastAdminAction = null
        )
        loadSuperadmin()
    }

    fun showChangePassword() {
        _state.value = _state.value.copy(
            screen = AdminScreen.CHANGE_PASSWORD,
            error = null,
            passwordChangeNotice = null
        )
    }

    fun loadSuperadmin() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null
            )

            runCatching {
                repository.superadminOverview(token)
            }.onSuccess(::applySuperadminOverview)
             .onFailure {
                 _state.value = _state.value.copy(
                     loading = false,
                     error = it.message ?: "Superadmin data request failed"
                 )
             }
        }
    }

    private fun applySuperadminOverview(
        response: me.ayartuerk.crmadmin.api.SuperadminOverviewResponse
    ) {
        val current = response.currentAdmin
        _state.value = _state.value.copy(
            loading = false,
            currentAdminUsername =
                current?.username ?: _state.value.currentAdminUsername,
            currentAdminRole =
                current?.role ?: _state.value.currentAdminRole,
            isSuperadmin =
                current?.isSuperadmin ?: _state.value.isSuperadmin,
            managedAdmins = response.admins,
            adminAuditLogs = response.auditLogs,
            error = null
        )
    }

    fun createManagedAdmin(
        username: String,
        email: String,
        password: String,
        role: String
    ) {
        val token = _state.value.token ?: return
        val cleanedUsername = username.trim()
        val cleanedEmail = email.trim()

        if (cleanedUsername.isBlank() ||
            cleanedEmail.isBlank() ||
            password.isBlank()
        ) {
            _state.value = _state.value.copy(
                error = "Username, email address and password are required."
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                lastAdminAction = null
            )

            runCatching {
                repository.createManagedAdmin(
                    token,
                    cleanedUsername,
                    cleanedEmail,
                    password,
                    role
                )
            }.onSuccess {
                applySuperadminOverview(it)
                _state.value = _state.value.copy(
                    lastAdminAction = "Administrator created."
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Administrator creation failed"
                )
            }
        }
    }

    fun toggleManagedAdmin(adminId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                lastAdminAction = null
            )

            runCatching {
                repository.toggleManagedAdmin(token, adminId)
            }.onSuccess {
                applySuperadminOverview(it)
                _state.value = _state.value.copy(
                    lastAdminAction = "Administrator access updated."
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Administrator access update failed"
                )
            }
        }
    }

    fun deleteManagedAdmin(adminId: Long) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                lastAdminAction = null
            )

            runCatching {
                repository.deleteManagedAdmin(token, adminId)
            }.onSuccess {
                applySuperadminOverview(it)
                _state.value = _state.value.copy(
                    lastAdminAction = "Administrator credential deleted."
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Administrator deletion failed"
                )
            }
        }
    }

    fun submitPasswordChange(
        currentPassword: String,
        newPassword: String,
        confirmPassword: String
    ) {
        val token = _state.value.token ?: return

        if (currentPassword.isBlank() ||
            newPassword.isBlank() ||
            confirmPassword.isBlank()
        ) {
            _state.value = _state.value.copy(
                error = "All password fields are required."
            )
            return
        }

        if (newPassword != confirmPassword) {
            _state.value = _state.value.copy(
                error = "The new passwords do not match."
            )
            return
        }

        if (newPassword.length < 8) {
            _state.value = _state.value.copy(
                error = "The new password must contain at least 8 characters."
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(
                loading = true,
                error = null,
                passwordChangeNotice = null
            )

            runCatching {
                repository.changeAdminPassword(
                    token,
                    currentPassword,
                    newPassword,
                    confirmPassword
                )
            }.onSuccess {
                tokenStore.clearToken()
                _state.value = AdminUiState(
                    loggedIn = false,
                    loading = false,
                    recoveryNotice =
                        "Password changed. Sign in with your new password."
                )
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Password change failed"
                )
            }
        }
    }

    fun showMore() {
        _state.value = _state.value.copy(
            screen = AdminScreen.MORE,
            selectedOrder = null,
            selectedCustomer = null
        )
    }

    fun showSettings() {
        showGeneral()
    }

    fun loadSettings() {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastSettingsAction = null)

            runCatching {
                repository.settings(token)
            }.onSuccess { settings ->
                _state.value = _state.value.copy(loading = false, settings = settings)
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Settings failed")
            }
        }
    }

    fun updateSettingsValue(key: String, value: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastSettingsAction = null)

            runCatching {
                val body = buildJsonObject { put(key, value) }
                repository.updateSettings(token, body)
            }.onSuccess { settings ->
                val action = when (key) {
                    "admin_view_language" -> "Admin language updated"
                    "admin_telegram_chat_id" -> "Notification settings updated"
                    "ai_response_mode" -> "Bot response mode updated"
                    else -> "$key updated"
                }
                _state.value = _state.value.copy(
                    loading = false,
                    settings = settings,
                    lastSettingsAction = action
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Settings update failed")
            }
        }
    }

    fun updateAdminLanguage(language: String) {
        updateSettingsValue("admin_view_language", language)
    }

    fun updateNotificationChatId(chatId: String) {
        updateSettingsValue("admin_telegram_chat_id", chatId)
    }

    fun updateWorkingHours(enabled: Boolean, timezone: String, start: String, end: String, messageMode: String, closedMessage: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastSettingsAction = null)

            runCatching {
                val body = buildJsonObject {
                    put("working_hours_enabled", if (enabled) "on" else "off")
                    put("working_hours_timezone", timezone)
                    put("working_hours_start", start)
                    put("working_hours_end", end)
                    put("working_hours_message_mode", messageMode)
                    put("working_hours_closed_message", closedMessage)
                }
                repository.updateSettings(token, body)
            }.onSuccess { settings ->
                _state.value = _state.value.copy(
                    loading = false,
                    settings = settings,
                    lastSettingsAction = "Working hours updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Working hours update failed")
            }
        }
    }

    fun updateFulfillmentOptions(allowPreferred: Boolean, allowNew: Boolean, allowPickup: Boolean) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastSettingsAction = null)

            runCatching {
                val body = buildJsonObject {
                    put("allow_preferred_customer_location", if (allowPreferred) "on" else "off")
                    put("allow_new_customer_location", if (allowNew) "on" else "off")
                    put("allow_customer_pickup", if (allowPickup) "on" else "off")
                }
                repository.updateSettings(token, body)
            }.onSuccess { settings ->
                _state.value = _state.value.copy(
                    loading = false,
                    settings = settings,
                    lastSettingsAction = "Fulfillment options updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Fulfillment options update failed")
            }
        }
    }

    fun updateDeliveryCities(cities: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastSettingsAction = null)

            runCatching {
                val body = buildJsonObject { put("allowed_delivery_cities", cities) }
                repository.updateSettings(token, body)
            }.onSuccess { settings ->
                _state.value = _state.value.copy(
                    loading = false,
                    settings = settings,
                    lastSettingsAction = "Delivery cities updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Delivery cities update failed")
            }
        }
    }

    fun updateAiResponseMode(mode: String) {
        updateSettingsValue("ai_response_mode", mode)
    }

    fun updateAiInstructions(instructions: String) {
        val token = _state.value.token ?: return

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null, lastSettingsAction = null)

            runCatching {
                val body = buildJsonObject { put("ai_custom_instructions", instructions) }
                repository.updateSettings(token, body)
            }.onSuccess { settings ->
                _state.value = _state.value.copy(
                    loading = false,
                    settings = settings,
                    lastSettingsAction = "AI instructions updated"
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "AI instructions update failed")
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
    fun performSelectedOrderAction(
        action: AdminOrderAction,
        note: String = ""
    ) {
        val token = _state.value.token
        val selectedOrder = _state.value.selectedOrder

        if (token.isNullOrBlank() || selectedOrder == null) {
            _state.value = _state.value.copy(error = "No order is selected")
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            runCatching {
                repository.performOrderAction(
                    token = token,
                    orderId = selectedOrder.id,
                    action = action,
                    note = note
                )
            }.onSuccess { updated ->
                _state.value = _state.value.copy(
                    loading = false,
                    selectedOrder = updated,
                    orders = _state.value.orders.map { order ->
                        if (order.id == updated.id) updated else order
                    }
                )
                loadOrders()
            }.onFailure {
                _state.value = _state.value.copy(
                    loading = false,
                    error = it.message ?: "Order update failed"
                )
            }
        }
    }

}
