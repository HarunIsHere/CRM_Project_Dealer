package me.ayartuerk.crmadmin.ui
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.Alignment

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import me.ayartuerk.crmadmin.api.Customer
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.CustomerLocation
import me.ayartuerk.crmadmin.api.CustomerMessage
import me.ayartuerk.crmadmin.api.CustomerRequest
import me.ayartuerk.crmadmin.api.MeetingPoint
import me.ayartuerk.crmadmin.api.OpenRequest
import me.ayartuerk.crmadmin.api.Product
import me.ayartuerk.crmadmin.api.ProductCategory
import me.ayartuerk.crmadmin.ui.design.AdminPanel
import me.ayartuerk.crmadmin.ui.design.AdminDangerButton
import me.ayartuerk.crmadmin.ui.design.AdminPrimaryButton
import me.ayartuerk.crmadmin.ui.design.AdminSecondaryButton
import me.ayartuerk.crmadmin.ui.design.AdminStatusChip
import me.ayartuerk.crmadmin.ui.design.AdminSpacing
import me.ayartuerk.crmadmin.ui.design.AdminColors
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.text.input.VisualTransformation
import kotlinx.coroutines.launch
import androidx.compose.material3.TextButton
import java.util.Locale

private data class AdminLocalizedText(
    val languageCode: String,
    val general: String,
    val orders: String,
    val orderDetail: String,
    val products: String,
    val customers: String,
    val customer: String,
    val openRequests: String,
    val meetingPoints: String,
    val more: String,
    val refresh: String,
    val adminLanguage: String,
    val viewLanguage: String,
    val saveLanguage: String,
    val notificationSettings: String,
    val adminTelegramChatId: String,
    val saveNotificationSettings: String,
    val workingHours: String,
    val enableWorkingHours: String,
    val timezone: String,
    val startTime: String,
    val endTime: String,
    val closedHoursMessageMode: String,
    val auto: String,
    val custom: String,
    val customClosedMessage: String,
    val saveWorkingHours: String,
    val fulfillmentLocationOptions: String,
    val allowPreferredCustomerLocation: String,
    val allowNewCustomerLocation: String,
    val allowCustomerPickup: String,
    val saveFulfillmentOptions: String,
    val deliveryCities: String,
    val commaSeparatedCities: String,
    val saveDeliveryCities: String,
    val botResponseMode: String,
    val ruleBaseOnly: String,
    val aiFallback: String,
    val aiProjectInstructions: String,
    val customInstructions: String,
    val saveAiInstructions: String,
    val logout: String,
    val closedOrders: String,
    val aiInfo: String,
    val superadmin: String,
    val changePassword: String,
    val productList: String,
    val categoryList: String,
    val categories: String,
    val addProduct: String,
    val addCategory: String,
    val createProduct: String,
    val createCategory: String,
    val productName: String,
    val categoryName: String,
    val priceLabel: String,
    val categoryLabel: String,
    val noCategory: String,
    val lists: String,
    val listProducts: String,
    val listCategories: String,
    val back: String,
    val searchFilters: String,
    val searchNameAlias: String,
    val searchCategoryName: String,
    val minimumPrice: String,
    val maximumPrice: String,
    val activeStatus: String,
    val activeOnly: String,
    val inactiveOnly: String,
    val allStatuses: String,
    val allCategories: String,
    val clearFilters: String,
    val unnamedCategory: String,
    val fuzzyMatchThreshold: String,
    val noProductsLoaded: String,
    val noProductsMatch: String,
    val noCategoriesLoaded: String,
    val noCategoriesMatch: String,
    val nameLabel: String,
    val activeLabel: String,
    val idLabel: String,
    val save: String,
    val delete: String,
    val addressLabel: String,
    val googleMapsLinkLabel: String,
    val preferredLabel: String,
    val addMeetingPoint: String,
    val setAsPreferred: String,
    val createMeetingPoint: String,
    val setPreferred: String,
    val meetingPointHelp: String,
    val noMeetingPointsLoaded: String,
    val openMap: String,
    val trueLabel: String,
    val falseLabel: String
)

private fun adminLocalizedText(language: String): AdminLocalizedText {
    val resolved = resolveAdminLanguage(language)
    fun t(key: String): String = AdminSharedTexts.text(resolved, key)

    return AdminLocalizedText(
        languageCode = resolved,
        general = t("general"),
        orders = t("orders"),
        orderDetail = t("order_detail"),
        products = t("products"),
        customers = t("customers"),
        customer = t("customer"),
        openRequests = t("open_requests"),
        meetingPoints = t("meeting_points"),
        more = t("more"),
        refresh = t("refresh"),
        adminLanguage = t("admin_language"),
        viewLanguage = t("view_language"),
        saveLanguage = t("save_language"),
        notificationSettings = t("notification_settings"),
        adminTelegramChatId = t("admin_telegram_chat_id"),
        saveNotificationSettings = t("save_notification_receiver"),
        workingHours = t("working_hours"),
        enableWorkingHours = t("enable_working_hours"),
        timezone = t("timezone"),
        startTime = t("start_time"),
        endTime = t("end_time"),
        closedHoursMessageMode = t("closed_hours_message_mode"),
        auto = t("auto"),
        custom = t("custom"),
        customClosedMessage = t("custom_closed_message"),
        saveWorkingHours = t("save_working_hours"),
        fulfillmentLocationOptions = t("fulfillment_options"),
        allowPreferredCustomerLocation = t("allow_preferred_customer_location"),
        allowNewCustomerLocation = t("allow_new_customer_location"),
        allowCustomerPickup = t("allow_customer_pickup"),
        saveFulfillmentOptions = t("save_fulfillment_options"),
        deliveryCities = t("delivery_cities"),
        commaSeparatedCities = t("comma_separated_cities"),
        saveDeliveryCities = t("save_delivery_cities"),
        botResponseMode = t("bot_response_mode"),
        ruleBaseOnly = t("respond_rule_base"),
        aiFallback = t("respond_ai"),
        aiProjectInstructions = t("ai_project_instructions"),
        customInstructions = t("custom_instructions"),
        saveAiInstructions = t("save_ai_instructions"),
        logout = t("logout"),
        closedOrders = t("closed_orders"),
        aiInfo = t("ai_info"),
        superadmin = t("superadmin"),
        changePassword = t("change_password"),
        productList = t("product_list"),
        categoryList = t("category_list"),
        categories = t("categories"),
        addProduct = t("add_product"),
        addCategory = t("add_category"),
        createProduct = t("create_product"),
        createCategory = t("create_category"),
        productName = t("product_name"),
        categoryName = t("category_name"),
        priceLabel = t("price"),
        categoryLabel = t("category"),
        noCategory = t("no_category"),
        lists = t("lists"),
        listProducts = t("list_products"),
        listCategories = t("list_categories"),
        back = t("back"),
        searchFilters = t("search_filters"),
        searchNameAlias = t("search_product"),
        searchCategoryName = t("search_category"),
        minimumPrice = t("price_min"),
        maximumPrice = t("price_max"),
        activeStatus = t("active_status"),
        activeOnly = t("active_only"),
        inactiveOnly = t("inactive_only"),
        allStatuses = t("all_statuses"),
        allCategories = t("all_categories"),
        clearFilters = t("clear_filters"),
        unnamedCategory = t("uncategorized"),
        fuzzyMatchThreshold = t("fuzzy_cutoff_note"),
        noProductsLoaded = t("no_products_loaded"),
        noProductsMatch = t("no_products_match"),
        noCategoriesLoaded = t("no_categories_loaded"),
        noCategoriesMatch = t("no_categories_match"),
        nameLabel = t("name"),
        activeLabel = t("active"),
        idLabel = t("id"),
        save = t("save"),
        delete = t("delete"),
        addressLabel = t("address"),
        googleMapsLinkLabel = t("google_maps_link"),
        preferredLabel = t("preferred"),
        addMeetingPoint = t("add_meeting_point"),
        setAsPreferred = t("set_as_preferred"),
        createMeetingPoint = t("create_meeting_point"),
        setPreferred = t("set_preferred"),
        meetingPointHelp = t("meeting_point_help"),
        noMeetingPointsLoaded = t("no_meeting_points_loaded"),
        openMap = t("open_map"),
        trueLabel = t("true_value"),
        falseLabel = t("false_value")
    )
}

private fun resolveAdminLanguage(configured: String?): String {
    val explicit = configured?.trim()?.lowercase(Locale.ROOT)
    if (explicit in setOf("en", "de", "tr", "ar", "ru")) return explicit!!

    return when (Locale.getDefault().language.lowercase(Locale.ROOT)) {
        "de" -> "de"
        "tr" -> "tr"
        "ar" -> "ar"
        "ru" -> "ru"
        else -> "en"
    }
}




private val adminTextAliases = mapOf(
    "appTitle" to "title",
    "loadingAdmin" to "loading_admin",
    "username" to "username",
    "password" to "password",
    "forgotPassword" to "forgot_password",
    "login" to "login",
    "loggingIn" to "logging_in",
    "showPassword" to "show_password",
    "hidePassword" to "hide_password",
    "openNavigation" to "open_navigation",
    "dashboard" to "dashboard",
    "summary" to "summary",
    "openOrders" to "open_orders",
    "latestOrders" to "latest_orders",
    "latestRequests" to "latest_requests",
    "order" to "order",
    "request" to "request",
    "customerLabel" to "customer",
    "typeLabel" to "type",
    "statusLabel" to "status",
    "totalLabel" to "total",
    "createdLabel" to "created_at",
    "open" to "open",
    "noOrdersLoaded" to "no_orders_loaded",
    "fulfillment" to "fulfillment",
    "delivery" to "delivery",
    "pickup" to "pickup",
    "openDetail" to "open_detail",
    "orderNotLoaded" to "order_not_loaded",
    "phoneLabel" to "phone",
    "orderStatusLabel" to "order_status",
    "deliveryStatusLabel" to "delivery_status",
    "pickupStatusLabel" to "pickup_status",
    "items" to "items",
    "itemLabel" to "item",
    "aliases" to "aliases",
    "quantity" to "quantity",
    "unit" to "unit_price",
    "noCustomersLoaded" to "no_customers_loaded",
    "usernameLabel" to "username",
    "telegramLabel" to "telegram",
    "languageLabel" to "language",
    "blockedLabel" to "blocked",
    "lastSeenLabel" to "last_seen",
    "customerNotLoaded" to "customer_not_loaded",
    "reply" to "reply",
    "messageLabel" to "message",
    "sendReply" to "send_reply",
    "messages" to "messages",
    "requests" to "requests",
    "locations" to "locations",
    "location" to "location",
    "noOpenRequestsLoaded" to "no_open_requests_loaded",
    "inProgress" to "in_progress_status",
    "done" to "done",
    "groupDone" to "group_done",
    "mapLabel" to "google_maps",
    "replySent" to "reply_sent",
    "adminLanguageUpdated" to "admin_language_updated",
    "notificationSettingsUpdated" to "notification_settings_updated",
    "botResponseModeUpdated" to "bot_response_mode_updated",
    "workingHoursUpdated" to "working_hours_updated",
    "fulfillmentOptionsUpdated" to "fulfillment_options_updated",
    "deliveryCitiesUpdated" to "delivery_cities_updated",
    "aiInstructionsUpdated" to "ai_instructions_updated",
    "new" to "new_status"
)

private fun adminText(ui: AdminLocalizedText, key: String): String {
    val translationKey = adminTextAliases[key] ?: return key
    return AdminSharedTexts.text(ui.languageCode, translationKey)
}

private fun localizeOpenRequestStatus(status: String?, ui: AdminLocalizedText): String {
    return when (status) {
        "new" -> adminText(ui, "new")
        "in_progress" -> adminText(ui, "inProgress")
        "done" -> adminText(ui, "done")
        else -> status ?: "-"
    }
}

private fun localizedAdminFlashMessage(message: String?, ui: AdminLocalizedText): String? {
    if (message.isNullOrBlank()) return null

    fun template(key: String, vararg replacements: Pair<String, String>): String {
        var text = AdminSharedTexts.text(ui.languageCode, key)
        replacements.forEach { (placeholder, value) ->
            text = text.replace("{$placeholder}", value)
        }
        return text
    }

    val requestUpdate = Regex("^Request #(\\d+) updated to (.+)$").matchEntire(message)
    if (requestUpdate != null) {
        val requestId = requestUpdate.groupValues[1]
        val status = localizeOpenRequestStatus(requestUpdate.groupValues[2], ui)
        return template("request_updated_template", "id" to requestId, "status" to status)
    }

    val groupDone = Regex("^Group done updated (\\d+) request\\(s\\)$").matchEntire(message)
    if (groupDone != null) {
        val count = groupDone.groupValues[1]
        return template("group_done_updated_template", "count" to count)
    }

    return when (message) {
        "Reply sent" -> adminText(ui, "replySent")
        "Admin language updated" -> adminText(ui, "adminLanguageUpdated")
        "Notification settings updated" -> adminText(ui, "notificationSettingsUpdated")
        "Bot response mode updated" -> adminText(ui, "botResponseModeUpdated")
        "Working hours updated" -> adminText(ui, "workingHoursUpdated")
        "Fulfillment options updated" -> adminText(ui, "fulfillmentOptionsUpdated")
        "Delivery cities updated" -> adminText(ui, "deliveryCitiesUpdated")
        "AI instructions updated" -> adminText(ui, "aiInstructionsUpdated")
        else -> message
    }
}

@Composable
fun AdminApp(viewModel: AdminViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val ui = adminLocalizedText(resolveAdminLanguage(state.settings["admin_view_language"]))

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            when {
                state.loading && !state.loggedIn -> LoadingScreen(ui)
                state.loggedIn -> AdminShell(
                    state = state,
                    onDashboard = viewModel::showDashboard,
                    onGeneral = viewModel::showGeneral,
                    onOrders = viewModel::showOrders,
                    onProducts = viewModel::showProducts,
                    onCustomers = viewModel::showCustomers,
                    onOpenRequests = viewModel::showOpenRequests,
                    onMeetingPoints = viewModel::showMeetingPoints,
                    onMore = viewModel::showMore,
                    onRefreshDashboard = viewModel::loadDashboard,
                    onRefreshOrders = viewModel::loadOrders,
                    onRefreshProducts = viewModel::loadProducts,
                    onRefreshCustomers = viewModel::loadCustomers,
                    onRefreshOpenRequests = viewModel::loadOpenRequests,
                    onRefreshMeetingPoints = viewModel::loadMeetingPoints,
                    onRefreshSettings = viewModel::loadSettings,
                    onOrderClick = viewModel::showOrderDetail,
                    onCustomerClick = viewModel::showCustomerDetail,
                    onCreateProduct = viewModel::createProduct,
                    onCreateProductCategory = viewModel::createProductCategory,
                    onUpdateProduct = viewModel::updateProduct,
                    onDeleteProduct = viewModel::deleteProduct,
                    onShowProductList = viewModel::showProductList,
                    onShowCategoryList = viewModel::showCategoryList,
                    onUpdateProductCategory = viewModel::updateProductCategory,
                    onDeleteProductCategory = viewModel::deleteProductCategory,
                    onCreateMeetingPoint = viewModel::createMeetingPoint,
                    onUpdateMeetingPoint = viewModel::updateMeetingPoint,
                    onSetPreferredMeetingPoint = viewModel::setPreferredMeetingPoint,
                    onDeleteMeetingPoint = viewModel::deleteMeetingPoint,
                    onReplyChange = viewModel::updateReplyMessage,
                    onSendReply = viewModel::sendCustomerReply,
                    onOpenRequestStatus = viewModel::updateOpenRequestStatus,
                    onOpenRequestGroupDone = viewModel::markOpenRequestGroupDone,
                    onUpdateGeneralSetting = viewModel::updateSettingsValue,
                    onUpdateWorkingHours = viewModel::updateWorkingHours,
                    onUpdateFulfillment = viewModel::updateFulfillmentOptions,
                    onUpdateDeliveryCities = viewModel::updateDeliveryCities,
                    onUpdateAiInstructions = viewModel::updateAiInstructions,
                    onLogout = viewModel::logout,
                    ui = ui
                )
                else -> LoginScreen(
                    loading = state.loading,
                    error = state.error,
                    onLogin = viewModel::login,
                    ui = ui
                )
            }
        }
    }
}

@Composable
private fun LoadingScreen(ui: AdminLocalizedText) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AdminSpacing.L),
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()
        Spacer(modifier = Modifier.height(AdminSpacing.M))
        Text(adminText(ui, "loadingAdmin"))
    }
}

@Composable
private fun LoginScreen(
    loading: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit,
    ui: AdminLocalizedText
) {
    var username by remember { mutableStateOf("admin") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AdminSpacing.L),
        verticalArrangement = Arrangement.Center
    ) {
        Text(adminText(ui, "appTitle"), style = MaterialTheme.typography.headlineMedium)

        Spacer(modifier = Modifier.height(AdminSpacing.L))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = username,
            onValueChange = { username = it },
            label = { Text(adminText(ui, "username")) },
            singleLine = true
        )

        Spacer(modifier = Modifier.height(AdminSpacing.S))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = password,
            onValueChange = { password = it },
            label = { Text(adminText(ui, "password")) },
            singleLine = true,
            visualTransformation = if (passwordVisible) {
                VisualTransformation.None
            } else {
                PasswordVisualTransformation()
            },
            trailingIcon = {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) {
                            Icons.Filled.VisibilityOff
                        } else {
                            Icons.Filled.Visibility
                        },
                        contentDescription = if (passwordVisible) {
                            adminText(ui, "hidePassword")
                        } else {
                            adminText(ui, "showPassword")
                        }
                    )
                }
            }
        )

        TextButton(
            onClick = {
                // TODO: wire existing Web Admin forgot/reset-password API flow.
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(adminText(ui, "forgotPassword"))
        }

        Spacer(modifier = Modifier.height(AdminSpacing.M))

        AdminPrimaryButton(
            text = if (loading) adminText(ui, "loggingIn") else adminText(ui, "login"),
            enabled = !loading,
            onClick = { onLogin(username.trim(), password) },
            modifier = Modifier.fillMaxWidth()
        )

        if (!error.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(16.dpCompat))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun AdminShell(
    state: AdminUiState,
    onDashboard: () -> Unit,
    onGeneral: () -> Unit,
    onOrders: () -> Unit,
    onProducts: () -> Unit,
    onCustomers: () -> Unit,
    onOpenRequests: () -> Unit,
    onMeetingPoints: () -> Unit,
    onMore: () -> Unit,
    onRefreshDashboard: () -> Unit,
    onRefreshOrders: () -> Unit,
    onRefreshProducts: () -> Unit,
    onRefreshCustomers: () -> Unit,
    onRefreshOpenRequests: () -> Unit,
    onRefreshMeetingPoints: () -> Unit,
    onRefreshSettings: () -> Unit,
    onOrderClick: (Long) -> Unit,
    onCustomerClick: (Long) -> Unit,
    onCreateProduct: (String, Double, Long?) -> Unit,
    onCreateProductCategory: (String) -> Unit,
    onUpdateProduct: (Long, String, Double, Long?, String, Boolean) -> Unit,
    onDeleteProduct: (Long) -> Unit,
    onShowProductList: () -> Unit,
    onShowCategoryList: () -> Unit,
    onUpdateProductCategory: (Long, String, Boolean) -> Unit,
    onDeleteProductCategory: (Long) -> Unit,
    onCreateMeetingPoint: (String, String, String, Boolean) -> Unit,
    onUpdateMeetingPoint: (Long, String, String, String, Boolean) -> Unit,
    onSetPreferredMeetingPoint: (Long) -> Unit,
    onDeleteMeetingPoint: (Long) -> Unit,
    onReplyChange: (String) -> Unit,
    onSendReply: () -> Unit,
    onOpenRequestStatus: (Long, String) -> Unit,
    onOpenRequestGroupDone: (Long) -> Unit,
    onUpdateGeneralSetting: (String, String) -> Unit,
    onUpdateWorkingHours: (Boolean, String, String, String, String, String) -> Unit,
    onUpdateFulfillment: (Boolean, Boolean, Boolean) -> Unit,
    onUpdateDeliveryCities: (String) -> Unit,
    onUpdateAiInstructions: (String) -> Unit,
    onLogout: () -> Unit,
    ui: AdminLocalizedText
) {
    val drawerState = rememberDrawerState(
        initialValue = DrawerValue.Closed
    )
    val drawerScope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AdminNavigationDrawerContent(
                onGeneral = {
                    drawerScope.launch { drawerState.close() }
                    onGeneral()
                },
                onOpenRequests = {
                    drawerScope.launch { drawerState.close() }
                    onOpenRequests()
                },
                onOrders = {
                    drawerScope.launch { drawerState.close() }
                    onOrders()
                },
                onProducts = {
                    drawerScope.launch { drawerState.close() }
                    onProducts()
                },
                onMeetingPoints = {
                    drawerScope.launch { drawerState.close() }
                    onMeetingPoints()
                },
                onCustomers = {
                    drawerScope.launch { drawerState.close() }
                    onCustomers()
                },
                onLogout = {
                    drawerScope.launch { drawerState.close() }
                    onLogout()
                },
                ui = ui
            )
        }
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .weight(1f)
                .statusBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        horizontal = 12.dpCompat,
                        vertical = 6.dpCompat
                    ),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = {
                        drawerScope.launch {
                            drawerState.open()
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Filled.Menu,
                        contentDescription = adminText(ui, "openNavigation")
                    )
                }

                Text(
                    text = when (state.screen) {
                        AdminScreen.GENERAL -> ui.general
                        AdminScreen.DASHBOARD -> adminText(ui, "dashboard")
                        AdminScreen.ORDERS -> ui.orders
                        AdminScreen.ORDER_DETAIL -> ui.orderDetail
                        AdminScreen.PRODUCTS -> ui.products
                        AdminScreen.PRODUCT_LIST -> ui.productList
                        AdminScreen.CATEGORY_LIST -> ui.categoryList
                        AdminScreen.CUSTOMERS -> ui.customers
                        AdminScreen.CUSTOMER_DETAIL -> ui.customer
                        AdminScreen.OPEN_REQUESTS -> ui.openRequests
                        AdminScreen.MEETING_POINTS -> ui.meetingPoints
                        AdminScreen.SETTINGS -> ui.general
                        AdminScreen.MORE -> ui.general
                    },
                    style = MaterialTheme.typography.titleLarge
                )
            }
            when (state.screen) {
                AdminScreen.GENERAL -> GeneralScreen(
                    state = state,
                    onRefresh = onRefreshSettings,
                    onUpdateGeneralSetting = onUpdateGeneralSetting,
                    onUpdateWorkingHours = onUpdateWorkingHours,
                    onUpdateFulfillment = onUpdateFulfillment,
                    onUpdateDeliveryCities = onUpdateDeliveryCities,
                    onUpdateAiInstructions = onUpdateAiInstructions,
                    ui = ui
                )

                AdminScreen.DASHBOARD -> DashboardScreen(
                    state = state,
                    onRefresh = onRefreshDashboard,
                    onOrderClick = onOrderClick,
                    ui = ui
                )

                AdminScreen.ORDERS -> OrdersScreen(
                    state = state,
                    onRefresh = onRefreshOrders,
                    onOrderClick = onOrderClick,
                    ui = ui
                )

                AdminScreen.ORDER_DETAIL -> OrderDetailScreen(
                    state = state,
                    onBack = onOrders,
                    onRefresh = {
                        state.selectedOrder?.id?.let(onOrderClick)
                    },
                    ui = ui
                )

                AdminScreen.PRODUCTS -> ProductsScreen(
                    state = state,
                    onRefresh = onRefreshProducts,
                    onCreateProduct = onCreateProduct,
                    onCreateCategory = onCreateProductCategory,
                    onShowProductList = onShowProductList,
                    onShowCategoryList = onShowCategoryList,
                    ui = ui
                )

                AdminScreen.PRODUCT_LIST -> ProductListScreen(
                    state = state,
                    onRefresh = onRefreshProducts,
                    onBack = onProducts,
                    onUpdateProduct = onUpdateProduct,
                    onDeleteProduct = onDeleteProduct,
                    ui = ui
                )

                AdminScreen.CATEGORY_LIST -> CategoryListScreen(
                    state = state,
                    onRefresh = onRefreshProducts,
                    onBack = onProducts,
                    onUpdateCategory = onUpdateProductCategory,
                    onDeleteCategory = onDeleteProductCategory,
                    ui = ui
                )

                AdminScreen.CUSTOMERS -> CustomersScreen(
                    state = state,
                    onRefresh = onRefreshCustomers,
                    onCustomerClick = onCustomerClick,
                    ui = ui
                )

                AdminScreen.CUSTOMER_DETAIL -> CustomerDetailScreen(
                    state = state,
                    onBack = onCustomers,
                    onRefresh = {
                        state.selectedCustomer?.id?.let(onCustomerClick)
                    },
                    onReplyChange = onReplyChange,
                    onSendReply = onSendReply,
                    ui = ui
                )

                AdminScreen.OPEN_REQUESTS -> OpenRequestsScreen(
                    state = state,
                    onRefresh = onRefreshOpenRequests,
                    onStatus = onOpenRequestStatus,
                    onGroupDone = onOpenRequestGroupDone,
                    ui = ui
                )

                AdminScreen.MEETING_POINTS -> MeetingPointsScreen(
                    state = state,
                    onRefresh = onRefreshMeetingPoints,
                    onCreateMeetingPoint = onCreateMeetingPoint,
                    onUpdateMeetingPoint = onUpdateMeetingPoint,
                    onSetPreferredMeetingPoint = onSetPreferredMeetingPoint,
                    onDeleteMeetingPoint = onDeleteMeetingPoint,
                    ui = ui
                )

                AdminScreen.SETTINGS -> SettingsScreen(
                    state = state,
                    onRefresh = onRefreshSettings,
                    onUpdateGeneralSetting = onUpdateGeneralSetting,
                    onUpdateWorkingHours = onUpdateWorkingHours,
                    onUpdateFulfillment = onUpdateFulfillment,
                    onUpdateDeliveryCities = onUpdateDeliveryCities,
                    onUpdateAiInstructions = onUpdateAiInstructions
                )

                AdminScreen.MORE -> GeneralScreen(
                    state = state,
                    onRefresh = onRefreshSettings,
                    onUpdateGeneralSetting = onUpdateGeneralSetting,
                    onUpdateWorkingHours = onUpdateWorkingHours,
                    onUpdateFulfillment = onUpdateFulfillment,
                    onUpdateDeliveryCities = onUpdateDeliveryCities,
                    onUpdateAiInstructions = onUpdateAiInstructions,
                    ui = ui
                )
            }
        }

    }
}
}

@Composable
private fun AdminNavigationDrawerContent(
    onGeneral: () -> Unit,
    onOpenRequests: () -> Unit,
    onOrders: () -> Unit,
    onProducts: () -> Unit,
    onMeetingPoints: () -> Unit,
    onCustomers: () -> Unit,
    onLogout: () -> Unit,
    ui: AdminLocalizedText
) {
    ModalDrawerSheet {
        Text(
            adminText(ui, "appTitle"),
            modifier = Modifier.padding(16.dpCompat),
            style = MaterialTheme.typography.titleLarge
        )

        NavigationDrawerItem(
            label = { Text(ui.general) },
            selected = false,
            onClick = onGeneral
        )

        NavigationDrawerItem(
            label = { Text(ui.openRequests) },
            selected = false,
            onClick = onOpenRequests
        )

        NavigationDrawerItem(
            label = { Text(ui.orders) },
            selected = false,
            onClick = onOrders
        )

        NavigationDrawerItem(
            label = { Text(ui.closedOrders) },
            selected = false,
            onClick = { }
        )

        NavigationDrawerItem(
            label = { Text(ui.products) },
            selected = false,
            onClick = onProducts
        )

        NavigationDrawerItem(
            label = { Text(ui.meetingPoints) },
            selected = false,
            onClick = onMeetingPoints
        )

        NavigationDrawerItem(
            label = { Text(ui.aiInfo) },
            selected = false,
            onClick = { }
        )

        NavigationDrawerItem(
            label = { Text(ui.customers) },
            selected = false,
            onClick = onCustomers
        )

        NavigationDrawerItem(
            label = { Text(ui.superadmin) },
            selected = false,
            onClick = { }
        )

        NavigationDrawerItem(
            label = { Text(ui.changePassword) },
            selected = false,
            onClick = { }
        )

        NavigationDrawerItem(
            label = { Text(ui.logout) },
            selected = false,
            onClick = onLogout
        )
    }
}


@Composable
private fun GeneralScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onUpdateGeneralSetting: (String, String) -> Unit,
    onUpdateWorkingHours: (Boolean, String, String, String, String, String) -> Unit,
    onUpdateFulfillment: (Boolean, Boolean, Boolean) -> Unit,
    onUpdateDeliveryCities: (String) -> Unit,
    onUpdateAiInstructions: (String) -> Unit,
    ui: AdminLocalizedText
) {
    val s = state.settings

    val languages = listOf(
        "en" to "English",
        "de" to "Deutsch",
        "tr" to "Türkçe",
        "ar" to "العربية",
        "ru" to "Русский"
    )

    var language by remember(s) { mutableStateOf(s["admin_view_language"] ?: "en") }
    var languageExpanded by remember { mutableStateOf(false) }
    var chatId by remember(s) { mutableStateOf(s["admin_telegram_chat_id"] ?: "") }
    var whEnabled by remember(s) { mutableStateOf(s["working_hours_enabled"] == "on") }
    var whTimezone by remember(s) { mutableStateOf(s["working_hours_timezone"] ?: "Europe/Berlin") }
    var whStart by remember(s) { mutableStateOf(s["working_hours_start"] ?: "10:00") }
    var whEnd by remember(s) { mutableStateOf(s["working_hours_end"] ?: "22:00") }
    var whMessageMode by remember(s) { mutableStateOf(s["working_hours_message_mode"] ?: "custom") }
    var whClosedMessage by remember(s) { mutableStateOf(s["working_hours_closed_message"] ?: "") }
    var allowPreferred by remember(s) { mutableStateOf(s["allow_preferred_customer_location"] == "on") }
    var allowNew by remember(s) { mutableStateOf(s["allow_new_customer_location"] == "on") }
    var allowPickup by remember(s) { mutableStateOf(s["allow_customer_pickup"] == "on") }
    var deliveryCities by remember(s) { mutableStateOf(s["allowed_delivery_cities"] ?: "") }
    var aiInstructions by remember(s) { mutableStateOf(s["ai_custom_instructions"] ?: "") }

    val timezones = listOf(
        "Europe/Berlin", "Europe/London", "Europe/Paris", "Europe/Rome",
        "Europe/Madrid", "Europe/Amsterdam", "Europe/Vienna", "Europe/Zurich",
        "Europe/Istanbul", "Europe/Moscow", "America/New_York", "America/Chicago",
        "America/Denver", "America/Los_Angeles", "Asia/Dubai", "Asia/Tokyo"
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dpCompat,
            end = 16.dpCompat,
            top = 12.dpCompat,
            bottom = 24.dpCompat
        ),
        verticalArrangement = Arrangement.spacedBy(16.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(ui.general, style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (!state.lastSettingsAction.isNullOrBlank()) {
            item { Text(localizedAdminFlashMessage(state.lastSettingsAction, ui) ?: "") }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dpCompat),
                    verticalArrangement = Arrangement.spacedBy(12.dpCompat)
                ) {
                    Text(ui.adminLanguage, style = MaterialTheme.typography.titleMedium)
                    Text(ui.viewLanguage, color = AdminColors.TextSecondary)

                    Box {
                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { languageExpanded = true }
                        ) {
                            Text(
                                text = languages.firstOrNull { it.first == language }?.second ?: language,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        DropdownMenu(
                            expanded = languageExpanded,
                            onDismissRequest = { languageExpanded = false }
                        ) {
                            languages.forEach { (code, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    onClick = {
                                        language = code
                                        languageExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    AdminPrimaryButton(
                        text = ui.saveLanguage,
                        enabled = !state.loading && language != (s["admin_view_language"] ?: "en"),
                        onClick = { onUpdateGeneralSetting("admin_view_language", language) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dpCompat),
                    verticalArrangement = Arrangement.spacedBy(12.dpCompat)
                ) {
                    Text(ui.notificationSettings, style = MaterialTheme.typography.titleMedium)

                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = chatId,
                        onValueChange = { chatId = it },
                        label = { Text(ui.adminTelegramChatId) },
                        singleLine = true
                    )

                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                        onClick = { onUpdateGeneralSetting("admin_telegram_chat_id", chatId) }
                    ) { Text(ui.saveNotificationSettings) }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dpCompat),
                    verticalArrangement = Arrangement.spacedBy(12.dpCompat)
                ) {
                    Text(ui.workingHours, style = MaterialTheme.typography.titleMedium)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(ui.enableWorkingHours)
                        androidx.compose.material3.Switch(
                            checked = whEnabled,
                            onCheckedChange = { whEnabled = it }
                        )
                    }

                    Text(ui.timezone)
                    var expandedTz by remember { mutableStateOf(false) }
                    Box {
                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { expandedTz = true }
                        ) { Text(whTimezone, modifier = Modifier.fillMaxWidth()) }
                        androidx.compose.material3.DropdownMenu(
                            expanded = expandedTz,
                            onDismissRequest = { expandedTz = false }
                        ) {
                            timezones.forEach { tz ->
                                androidx.compose.material3.DropdownMenuItem(
                                    text = { Text(tz) },
                                    onClick = {
                                        whTimezone = tz
                                        expandedTz = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = whStart,
                        onValueChange = { whStart = it },
                        label = { Text(ui.startTime) },
                        singleLine = true
                    )

                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = whEnd,
                        onValueChange = { whEnd = it },
                        label = { Text(ui.endTime) },
                        singleLine = true
                    )

                    Text(ui.closedHoursMessageMode)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dpCompat)) {
                        val autoSelected = whMessageMode != "custom"
                        val customSelected = whMessageMode == "custom"
                        if (autoSelected) {
                            Button(onClick = { whMessageMode = "auto" }) { Text(ui.auto) }
                        } else {
                            OutlinedButton(onClick = { whMessageMode = "auto" }) { Text(ui.auto) }
                        }
                        if (customSelected) {
                            Button(onClick = { whMessageMode = "custom" }) { Text(ui.custom) }
                        } else {
                            OutlinedButton(onClick = { whMessageMode = "custom" }) { Text(ui.custom) }
                        }
                    }

                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = whClosedMessage,
                        onValueChange = { whClosedMessage = it },
                        label = { Text(ui.customClosedMessage) },
                        minLines = 2
                    )

                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                        onClick = {
                            onUpdateWorkingHours(
                                whEnabled, whTimezone, whStart, whEnd,
                                whMessageMode, whClosedMessage
                            )
                        }
                    ) { Text(ui.saveWorkingHours) }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dpCompat),
                    verticalArrangement = Arrangement.spacedBy(12.dpCompat)
                ) {
                    Text(ui.fulfillmentLocationOptions, style = MaterialTheme.typography.titleMedium)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(ui.allowPreferredCustomerLocation)
                        androidx.compose.material3.Switch(
                            checked = allowPreferred,
                            onCheckedChange = { allowPreferred = it }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(ui.allowNewCustomerLocation)
                        androidx.compose.material3.Switch(
                            checked = allowNew,
                            onCheckedChange = { allowNew = it }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(ui.allowCustomerPickup)
                        androidx.compose.material3.Switch(
                            checked = allowPickup,
                            onCheckedChange = { allowPickup = it }
                        )
                    }

                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                        onClick = { onUpdateFulfillment(allowPreferred, allowNew, allowPickup) }
                    ) { Text(ui.saveFulfillmentOptions) }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dpCompat),
                    verticalArrangement = Arrangement.spacedBy(12.dpCompat)
                ) {
                    Text(ui.deliveryCities, style = MaterialTheme.typography.titleMedium)
                    Text(ui.commaSeparatedCities, style = MaterialTheme.typography.bodySmall)

                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = deliveryCities,
                        onValueChange = { deliveryCities = it },
                        label = { Text(ui.deliveryCities) },
                        singleLine = true
                    )

                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                        onClick = { onUpdateDeliveryCities(deliveryCities) }
                    ) { Text(ui.saveDeliveryCities) }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dpCompat),
                    verticalArrangement = Arrangement.spacedBy(12.dpCompat)
                ) {
                    Text(ui.botResponseMode, style = MaterialTheme.typography.titleMedium)

                    val currentMode = s["ai_response_mode"] ?: "rule_base"

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dpCompat)) {
                        if (currentMode == "rule_base") {
                            Button(
                                onClick = { onUpdateGeneralSetting("ai_response_mode", "rule_base") }
                            ) { Text(ui.ruleBaseOnly) }
                        } else {
                            OutlinedButton(
                                onClick = { onUpdateGeneralSetting("ai_response_mode", "rule_base") }
                            ) { Text(ui.ruleBaseOnly) }
                        }

                        if (currentMode == "ai_fallback") {
                            Button(
                                onClick = { onUpdateGeneralSetting("ai_response_mode", "ai_fallback") }
                            ) { Text(ui.aiFallback) }
                        } else {
                            OutlinedButton(
                                onClick = { onUpdateGeneralSetting("ai_response_mode", "ai_fallback") }
                            ) { Text(ui.aiFallback) }
                        }
                    }

                    Text(ui.aiProjectInstructions, style = MaterialTheme.typography.titleMedium)

                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = aiInstructions,
                        onValueChange = { aiInstructions = it },
                        label = { Text(ui.customInstructions) },
                        minLines = 3
                    )

                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                        onClick = { onUpdateAiInstructions(aiInstructions) }
                    ) { Text(ui.saveAiInstructions) }
                }
            }
        }
    }
}


@Composable
private fun DashboardScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onOrderClick: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    val dashboard = state.dashboard

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(adminText(ui, "dashboard"), style = MaterialTheme.typography.headlineSmall)

                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        item {
            AdminPanel {
                Text(adminText(ui, "summary"), style = MaterialTheme.typography.titleMedium)
                Text("${adminText(ui, "openOrders")}: ${dashboard?.summary?.openOrders ?: "-"}")
                Text("${ui.closedOrders}: ${dashboard?.summary?.closedOrders ?: "-"}")
                Text("${ui.openRequests}: ${dashboard?.summary?.openRequests ?: "-"}")
                Text("${ui.customers}: ${dashboard?.summary?.customers ?: "-"}")
            }
        }

        item {
            Text(adminText(ui, "latestOrders"), style = MaterialTheme.typography.titleMedium)
        }

        items(dashboard?.latestOrders ?: emptyList()) { order ->
            AdminPanel {
                Text("${adminText(ui, "order")} #${order.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
                Text("${adminText(ui, "customerLabel")}: ${order.customerName ?: "-"}")
                Text("${adminText(ui, "statusLabel")}: ${order.orderStatus ?: order.status ?: "-"}")
                Text("${adminText(ui, "totalLabel")}: ${order.total ?: "-"}")
                Text("${adminText(ui, "createdLabel")}: ${order.createdAt ?: "-"}", color = AdminColors.TextSecondary)
                if (order.id != null) {
                    AdminPrimaryButton(text = adminText(ui, "open"), onClick = { onOrderClick(order.id) })
                }
            }
        }

        item {
            Text(adminText(ui, "latestRequests"), style = MaterialTheme.typography.titleMedium)
        }

        items(dashboard?.latestRequests ?: emptyList()) { request ->
            AdminPanel {
                Text("${adminText(ui, "request")} #${request.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
                Text("${adminText(ui, "customerLabel")}: ${request.customerName ?: "-"}")
                Text("${adminText(ui, "typeLabel")}: ${request.requestType ?: "-"}")
                Text("${adminText(ui, "statusLabel")}: ${localizeOpenRequestStatus(request.status, ui)}")
                Text("${adminText(ui, "createdLabel")}: ${request.createdAt ?: "-"}", color = AdminColors.TextSecondary)
            }
        }
    }
}

@Composable
private fun OrdersScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onOrderClick: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(ui.orders, style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (state.orders.isEmpty() && !state.loading) {
            item {
                Text(adminText(ui, "noOrdersLoaded"))
            }
        }

        items(state.orders) { order ->
            OrderCard(order = order, onOrderClick = onOrderClick, ui = ui)
        }
    }
}

@Composable
private fun OrderCard(
    order: CustomerAppOrder,
    onOrderClick: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    AdminPanel {
        Text("${adminText(ui, "order")} #${order.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
        Text("${adminText(ui, "customerLabel")}: ${order.customerName ?: "-"}")
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
            Text("${adminText(ui, "fulfillment")}:")
            AdminStatusChip(text = order.fulfillmentType ?: "-")
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
            Text("${adminText(ui, "statusLabel")}:")
            AdminStatusChip(text = order.orderStatus ?: order.status ?: "-")
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
            Text("${adminText(ui, "delivery")}:")
            AdminStatusChip(text = order.deliveryStatus ?: "-")
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
            Text("${adminText(ui, "pickup")}:")
            AdminStatusChip(text = order.pickupStatus ?: "-")
        }
        Text("${adminText(ui, "totalLabel")}: ${order.confirmedTotal ?: order.total ?: "-"}")
        Text("${adminText(ui, "createdLabel")}: ${order.createdAt ?: "-"}", color = AdminColors.TextSecondary)

        if (order.id != null) {
            AdminPrimaryButton(text = adminText(ui, "openDetail"), onClick = { onOrderClick(order.id) })
        }
    }
}

@Composable
private fun OrderDetailScreen(
    state: AdminUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    ui: AdminLocalizedText
) {
    val order = state.selectedOrder

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dpCompat)
            ) {
                AdminSecondaryButton(text = ui.back, onClick = onBack)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (order == null && !state.loading) {
            item {
                Text(adminText(ui, "orderNotLoaded"))
            }
        }

        if (order != null) {
            item {
                AdminPanel {
                    Text("${adminText(ui, "order")} #${order.id ?: "-"}", style = MaterialTheme.typography.headlineSmall)
                    Text("${adminText(ui, "customerLabel")}: ${order.customerName ?: "-"}")
                    Text("${adminText(ui, "phoneLabel")}: ${order.customerPhone ?: "-"}")
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
                        Text("${adminText(ui, "fulfillment")}:")
                        AdminStatusChip(text = order.fulfillmentType ?: "-")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
                        Text("${adminText(ui, "orderStatusLabel")}:")
                        AdminStatusChip(text = order.orderStatus ?: order.status ?: "-")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
                        Text("${adminText(ui, "deliveryStatusLabel")}:")
                        AdminStatusChip(text = order.deliveryStatus ?: "-")
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
                        Text("${adminText(ui, "pickupStatusLabel")}:")
                        AdminStatusChip(text = order.pickupStatus ?: "-")
                    }
                    Text("${adminText(ui, "totalLabel")}: ${order.confirmedTotal ?: order.total ?: "-"}")
                    Text("${adminText(ui, "createdLabel")}: ${order.createdAt ?: "-"}", color = AdminColors.TextSecondary)
                }
            }

            item {
                AdminPanel {
                    Text(adminText(ui, "delivery"), style = MaterialTheme.typography.titleMedium)
                    Text("${ui.addressLabel}: ${order.deliveryAddress ?: "-"}")
                    Text("${adminText(ui, "mapLabel")}: ${order.deliveryMapsUrl ?: "-"}", color = AdminColors.TextSecondary)
                }
            }

            item {
                Text(adminText(ui, "items"), style = MaterialTheme.typography.titleMedium)
            }

            items(order.items) { orderItem ->
                AdminPanel {
                    Text(orderItem.productName ?: adminText(ui, "itemLabel"), style = MaterialTheme.typography.titleSmall)
                    Text("${adminText(ui, "quantity")}: ${orderItem.quantity ?: "-"}")
                    Text("${adminText(ui, "unit")}: ${orderItem.unitPrice ?: "-"}")
                    Text("${adminText(ui, "totalLabel")}: ${orderItem.total ?: "-"}")
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
                        Text("${adminText(ui, "statusLabel")}:")
                        AdminStatusChip(text = orderItem.status ?: "-")
                    }
                }
            }
        }
    }
}


@Composable
private fun ProductsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onCreateProduct: (String, Double, Long?) -> Unit,
    onCreateCategory: (String) -> Unit,
    onShowProductList: () -> Unit,
    onShowCategoryList: () -> Unit,
    ui: AdminLocalizedText
) {
    var newProductName by remember { mutableStateOf("") }
    var newProductPrice by remember { mutableStateOf("") }
    var newProductCategoryId by remember { mutableStateOf<Long?>(null) }
    var newProductCategoryExpanded by remember { mutableStateOf(false) }
    var newCategoryName by remember { mutableStateOf("") }

    val activeCategoryOptions = state.categories.filter { it.isActive != false }
    val newPrice = newProductPrice.toDoubleOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(ui.products, style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (!state.lastProductAction.isNullOrBlank()) {
            item {
                Text(state.lastProductAction)
            }
        }

        item {
            AdminPanel {
                Text(ui.addProduct, style = MaterialTheme.typography.titleMedium)

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = newProductName,
                    onValueChange = { newProductName = it },
                    label = { Text(ui.productName) },
                    singleLine = true
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = newProductPrice,
                    onValueChange = { newProductPrice = it },
                    label = { Text(ui.priceLabel) },
                    singleLine = true
                )

                Text(ui.categoryLabel)
                Box {
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { newProductCategoryExpanded = true }
                    ) {
                        Text(
                            text = newProductCategoryId?.let { categoryId ->
                                activeCategoryOptions.firstOrNull { it.id == categoryId }?.name
                            } ?: ui.noCategory,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    DropdownMenu(
                        expanded = newProductCategoryExpanded,
                        onDismissRequest = { newProductCategoryExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text(ui.noCategory) },
                            onClick = {
                                newProductCategoryId = null
                                newProductCategoryExpanded = false
                            }
                        )
                        activeCategoryOptions.forEach { category ->
                            DropdownMenuItem(
                                text = { Text(category.name ?: ui.unnamedCategory) },
                                onClick = {
                                    newProductCategoryId = category.id
                                    newProductCategoryExpanded = false
                                }
                            )
                        }
                    }
                }

                AdminPrimaryButton(
                    text = ui.createProduct,
                    enabled = !state.loading && newProductName.isNotBlank() && newPrice != null && newPrice > 0.0,
                    onClick = {
                        onCreateProduct(newProductName.trim(), newPrice ?: 0.0, newProductCategoryId)
                        newProductName = ""
                        newProductPrice = ""
                        newProductCategoryId = null
                    }
                )
            }
        }

        item {
            AdminPanel {
                Text(ui.addCategory, style = MaterialTheme.typography.titleMedium)

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = newCategoryName,
                    onValueChange = { newCategoryName = it },
                    label = { Text(ui.categoryName) },
                    singleLine = true
                )

                AdminPrimaryButton(
                    text = ui.createCategory,
                    enabled = !state.loading && newCategoryName.isNotBlank(),
                    onClick = {
                        onCreateCategory(newCategoryName.trim())
                        newCategoryName = ""
                    }
                )
            }
        }

        item {
            AdminPanel {
                Text(ui.lists, style = MaterialTheme.typography.titleMedium)

                AdminSecondaryButton(
                    text = ui.listProducts,
                    onClick = onShowProductList,
                    modifier = Modifier.fillMaxWidth()
                )

                AdminSecondaryButton(
                    text = ui.listCategories,
                    onClick = onShowCategoryList,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun ProductListScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
    onUpdateProduct: (Long, String, Double, Long?, String, Boolean) -> Unit,
    onDeleteProduct: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var filterId by remember { mutableStateOf("") }
    var filterQuery by remember { mutableStateOf("") }
    var filterMinPrice by remember { mutableStateOf("") }
    var filterMaxPrice by remember { mutableStateOf("") }
    var filterActive by remember { mutableStateOf("all") }
    var filterCategoryId by remember { mutableStateOf<Long?>(null) }
    var filterActiveExpanded by remember { mutableStateOf(false) }
    var filterCategoryExpanded by remember { mutableStateOf(false) }

    val activeCategoryOptions = state.categories.filter { it.isActive != false }
    val filteredProducts = state.products.filter { product ->
        val idMatches = filterId.isBlank() || (product.id?.toString() ?: "").contains(filterId.trim())
        val query = filterQuery.trim().lowercase()
        val searchable = listOf(
            product.name.orEmpty(),
            product.aliases.joinToString(", ")
        ).joinToString(" ").lowercase()
        val queryMatches = query.isBlank() || searchable.contains(query)
        val minPrice = filterMinPrice.toDoubleOrNull()
        val maxPrice = filterMaxPrice.toDoubleOrNull()
        val priceValue = product.price ?: 0.0
        val minMatches = minPrice == null || priceValue >= minPrice
        val maxMatches = maxPrice == null || priceValue <= maxPrice
        val activeMatches = when (filterActive) {
            "active" -> product.isActive == true
            "inactive" -> product.isActive == false
            else -> true
        }
        val categoryMatches = filterCategoryId == null || product.categoryId == filterCategoryId

        idMatches && queryMatches && minMatches && maxMatches && activeMatches && categoryMatches
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(ui.productList, style = MaterialTheme.typography.headlineSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)) {
                    AdminSecondaryButton(text = ui.back, onClick = onBack)
                    AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
                }
            }
        }

        commonStateItems(state)

        if (!state.lastProductAction.isNullOrBlank()) {
            item {
                Text(state.lastProductAction)
            }
        }

        item {
            AdminPanel {
                Text(ui.searchFilters, style = MaterialTheme.typography.titleMedium)

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = filterId,
                    onValueChange = { filterId = it },
                    label = { Text(ui.idLabel) },
                    singleLine = true
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = filterQuery,
                    onValueChange = { filterQuery = it },
                    label = { Text(ui.searchNameAlias) },
                    singleLine = true
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = filterMinPrice,
                    onValueChange = { filterMinPrice = it },
                    label = { Text(ui.minimumPrice) },
                    singleLine = true
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = filterMaxPrice,
                    onValueChange = { filterMaxPrice = it },
                    label = { Text(ui.maximumPrice) },
                    singleLine = true
                )

                Text(ui.activeStatus)
                Box {
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { filterActiveExpanded = true }
                    ) {
                        Text(
                            text = when (filterActive) {
                                "active" -> ui.activeOnly
                                "inactive" -> ui.inactiveOnly
                                else -> ui.allStatuses
                            },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    DropdownMenu(
                        expanded = filterActiveExpanded,
                        onDismissRequest = { filterActiveExpanded = false }
                    ) {
                        listOf(
                            "all" to ui.allStatuses,
                            "active" to ui.activeOnly,
                            "inactive" to ui.inactiveOnly
                        ).forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    filterActive = value
                                    filterActiveExpanded = false
                                }
                            )
                        }
                    }
                }

                Text(ui.categoryLabel)
                Box {
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { filterCategoryExpanded = true }
                    ) {
                        Text(
                            text = filterCategoryId?.let { categoryId ->
                                activeCategoryOptions.firstOrNull { it.id == categoryId }?.name
                            } ?: ui.allCategories,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    DropdownMenu(
                        expanded = filterCategoryExpanded,
                        onDismissRequest = { filterCategoryExpanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text(ui.allCategories) },
                            onClick = {
                                filterCategoryId = null
                                filterCategoryExpanded = false
                            }
                        )
                        activeCategoryOptions.forEach { category ->
                            DropdownMenuItem(
                                text = { Text(category.name ?: ui.unnamedCategory) },
                                onClick = {
                                    filterCategoryId = category.id
                                    filterCategoryExpanded = false
                                }
                            )
                        }
                    }
                }

                Text(ui.fuzzyMatchThreshold, color = AdminColors.TextSecondary)

                AdminSecondaryButton(
                    text = ui.clearFilters,
                    onClick = {
                        filterId = ""
                        filterQuery = ""
                        filterMinPrice = ""
                        filterMaxPrice = ""
                        filterActive = "all"
                        filterCategoryId = null
                    }
                )
            }
        }

        item {
            Text("${ui.products} (${filteredProducts.size}/${state.products.size})", style = MaterialTheme.typography.titleMedium)
        }

        if (filteredProducts.isEmpty() && !state.loading) {
            item {
                Text(if (state.products.isEmpty()) ui.noProductsLoaded else ui.noProductsMatch)
            }
        }

        items(filteredProducts, key = { it.id ?: 0L }) { product ->
            ProductCard(
                product = product,
                categories = activeCategoryOptions,
                loading = state.loading,
                onUpdateProduct = onUpdateProduct,
                onDeleteProduct = onDeleteProduct,
                ui = ui
            )
        }
    }
}

@Composable
private fun CategoryListScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
    onUpdateCategory: (Long, String, Boolean) -> Unit,
    onDeleteCategory: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var filterId by remember { mutableStateOf("") }
    var filterQuery by remember { mutableStateOf("") }
    var filterActive by remember { mutableStateOf("all") }
    var filterActiveExpanded by remember { mutableStateOf(false) }

    val filteredCategories = state.categories.filter { category ->
        val idMatches = filterId.isBlank() || (category.id?.toString() ?: "").contains(filterId.trim())
        val query = filterQuery.trim().lowercase()
        val nameMatches = query.isBlank() || (category.name ?: "").lowercase().contains(query)
        val activeMatches = when (filterActive) {
            "active" -> category.isActive == true
            "inactive" -> category.isActive == false
            else -> true
        }

        idMatches && nameMatches && activeMatches
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(ui.categoryList, style = MaterialTheme.typography.headlineSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)) {
                    AdminSecondaryButton(text = ui.back, onClick = onBack)
                    AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
                }
            }
        }

        commonStateItems(state)

        if (!state.lastProductAction.isNullOrBlank()) {
            item {
                Text(state.lastProductAction)
            }
        }

        item {
            AdminPanel {
                Text(ui.searchFilters, style = MaterialTheme.typography.titleMedium)

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = filterId,
                    onValueChange = { filterId = it },
                    label = { Text(ui.idLabel) },
                    singleLine = true
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = filterQuery,
                    onValueChange = { filterQuery = it },
                    label = { Text(ui.searchCategoryName) },
                    singleLine = true
                )

                Text(ui.activeStatus)
                Box {
                    OutlinedButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { filterActiveExpanded = true }
                    ) {
                        Text(
                            text = when (filterActive) {
                                "active" -> ui.activeOnly
                                "inactive" -> ui.inactiveOnly
                                else -> ui.allStatuses
                            },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    DropdownMenu(
                        expanded = filterActiveExpanded,
                        onDismissRequest = { filterActiveExpanded = false }
                    ) {
                        listOf(
                            "all" to ui.allStatuses,
                            "active" to ui.activeOnly,
                            "inactive" to ui.inactiveOnly
                        ).forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    filterActive = value
                                    filterActiveExpanded = false
                                }
                            )
                        }
                    }
                }

                AdminSecondaryButton(
                    text = ui.clearFilters,
                    onClick = {
                        filterId = ""
                        filterQuery = ""
                        filterActive = "all"
                    }
                )
            }
        }

        item {
            Text("${ui.categories} (${filteredCategories.size}/${state.categories.size})", style = MaterialTheme.typography.titleMedium)
        }

        if (filteredCategories.isEmpty() && !state.loading) {
            item {
                Text(if (state.categories.isEmpty()) ui.noCategoriesLoaded else ui.noCategoriesMatch)
            }
        }

        items(filteredCategories, key = { it.id ?: 0L }) { category ->
            CategoryCard(
                category = category,
                loading = state.loading,
                onUpdateCategory = onUpdateCategory,
                onDeleteCategory = onDeleteCategory,
                ui = ui
            )
        }
    }
}

@Composable
private fun CategoryCard(
    category: ProductCategory,
    loading: Boolean,
    onUpdateCategory: (Long, String, Boolean) -> Unit,
    onDeleteCategory: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var name by remember(category.id, category.name) { mutableStateOf(category.name ?: "") }
    var isActive by remember(category.id, category.isActive) { mutableStateOf(category.isActive == true) }
    val canSave = !loading && category.id != null && name.isNotBlank()

    AdminPanel {
        Text("${ui.idLabel}: ${category.id ?: "-"}", color = AdminColors.TextSecondary)

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = name,
            onValueChange = { name = it },
            label = { Text(ui.nameLabel) },
            singleLine = true
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(ui.activeLabel)
            Switch(
                checked = isActive,
                onCheckedChange = { isActive = it }
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)) {
            AdminPrimaryButton(
                text = ui.save,
                enabled = canSave,
                onClick = {
                    val categoryId = category.id ?: return@AdminPrimaryButton
                    onUpdateCategory(categoryId, name.trim(), isActive)
                },
                modifier = Modifier.weight(1f)
            )

            AdminDangerButton(
                text = ui.delete,
                enabled = !loading && category.id != null,
                onClick = {
                    val categoryId = category.id ?: return@AdminDangerButton
                    onDeleteCategory(categoryId)
                },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun ProductCard(
    product: Product,
    categories: List<ProductCategory>,
    loading: Boolean,
    onUpdateProduct: (Long, String, Double, Long?, String, Boolean) -> Unit,
    onDeleteProduct: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var name by remember(product.id, product.name) { mutableStateOf(product.name ?: "") }
    var price by remember(product.id, product.price) { mutableStateOf(product.price?.toString() ?: "") }
    var categoryId by remember(product.id, product.categoryId) { mutableStateOf(product.categoryId) }
    var aliases by remember(product.id, product.aliases) { mutableStateOf(product.aliases.joinToString(", ")) }
    var isActive by remember(product.id, product.isActive) { mutableStateOf(product.isActive == true) }
    var categoryExpanded by remember(product.id) { mutableStateOf(false) }

    val parsedPrice = price.toDoubleOrNull()
    val canSave = !loading && product.id != null && name.isNotBlank() && parsedPrice != null && parsedPrice > 0.0

    AdminPanel {
        Text("${ui.idLabel}: ${product.id ?: "-"}", color = AdminColors.TextSecondary)

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = name,
            onValueChange = { name = it },
            label = { Text(ui.nameLabel) },
            singleLine = true
        )

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = price,
            onValueChange = { price = it },
            label = { Text(ui.priceLabel) },
            singleLine = true
        )

        Text(ui.categoryLabel)
        Box {
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { categoryExpanded = true }
            ) {
                Text(
                    text = categoryId?.let { selectedId ->
                        categories.firstOrNull { it.id == selectedId }?.name
                            ?: product.categoryName
                            ?: selectedId.toString()
                    } ?: ui.noCategory,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            DropdownMenu(
                expanded = categoryExpanded,
                onDismissRequest = { categoryExpanded = false }
            ) {
                DropdownMenuItem(
                    text = { Text(ui.noCategory) },
                    onClick = {
                        categoryId = null
                        categoryExpanded = false
                    }
                )
                categories.forEach { category ->
                    DropdownMenuItem(
                        text = { Text(category.name ?: ui.unnamedCategory) },
                        onClick = {
                            categoryId = category.id
                            categoryExpanded = false
                        }
                    )
                }
            }
        }

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = aliases,
            onValueChange = { aliases = it },
            label = { Text(adminText(ui, "aliases")) },
            minLines = 2
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(ui.activeLabel)
            Switch(
                checked = isActive,
                onCheckedChange = { isActive = it }
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)) {
            AdminPrimaryButton(
                text = ui.save,
                enabled = canSave,
                onClick = {
                    val productId = product.id ?: return@AdminPrimaryButton
                    val safePrice = parsedPrice ?: return@AdminPrimaryButton
                    onUpdateProduct(productId, name.trim(), safePrice, categoryId, aliases, isActive)
                },
                modifier = Modifier.weight(1f)
            )

            AdminDangerButton(
                text = ui.delete,
                enabled = !loading && product.id != null,
                onClick = {
                    val productId = product.id ?: return@AdminDangerButton
                    onDeleteProduct(productId)
                },
                modifier = Modifier.weight(1f)
            )
        }
    }
}


@Composable
private fun CustomersScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onCustomerClick: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("${ui.customers} (${state.customers.size})", style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (state.customers.isEmpty() && !state.loading) {
            item {
                Text(adminText(ui, "noCustomersLoaded"))
            }
        }

        items(state.customers) { customer ->
            CustomerCard(customer = customer, onCustomerClick = onCustomerClick, ui = ui)
        }
    }
}

@Composable
private fun CustomerCard(
    customer: Customer,
    onCustomerClick: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    AdminPanel {
        Text(customer.fullName ?: customer.name ?: ui.customer, style = MaterialTheme.typography.titleSmall)
        Text("${ui.idLabel}: ${customer.id ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "usernameLabel")}: ${customer.username ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "telegramLabel")}: ${customer.telegramUserId ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "languageLabel")}: ${customer.preferredLanguage ?: customer.language ?: "-"}")
        Text("${adminText(ui, "blockedLabel")}: ${customer.isBlocked ?: "-"}")
        Text("${adminText(ui, "lastSeenLabel")}: ${customer.lastSeenAt ?: "-"}", color = AdminColors.TextSecondary)

        if (customer.id != null) {
            AdminPrimaryButton(text = adminText(ui, "openDetail"), onClick = { onCustomerClick(customer.id) })
        }
    }
}

@Composable
private fun CustomerDetailScreen(
    state: AdminUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onReplyChange: (String) -> Unit,
    onSendReply: () -> Unit,
    ui: AdminLocalizedText
) {
    val customer = state.selectedCustomer

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dpCompat)
            ) {
                AdminSecondaryButton(text = ui.back, onClick = onBack)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (!state.lastReplySent.isNullOrBlank()) {
            item {
                Text(localizedAdminFlashMessage(state.lastReplySent, ui) ?: "")
            }
        }

        if (customer == null && !state.loading) {
            item {
                Text(adminText(ui, "customerNotLoaded"))
            }
        }

        if (customer != null) {
            item {
                AdminPanel {
                    Text(customer.fullName ?: customer.name ?: ui.customer, style = MaterialTheme.typography.headlineSmall)
                    Text("${ui.idLabel}: ${customer.id ?: "-"}", color = AdminColors.TextSecondary)
                    Text("${adminText(ui, "usernameLabel")}: ${customer.username ?: "-"}", color = AdminColors.TextSecondary)
                    Text("${adminText(ui, "telegramLabel")}: ${customer.telegramUserId ?: "-"}", color = AdminColors.TextSecondary)
                    Text("${adminText(ui, "languageLabel")}: ${customer.preferredLanguage ?: customer.language ?: "-"}")
                    Text("${adminText(ui, "blockedLabel")}: ${customer.isBlocked ?: "-"}")
                    Text("${adminText(ui, "lastSeenLabel")}: ${customer.lastSeenAt ?: "-"}", color = AdminColors.TextSecondary)
                    Text("${adminText(ui, "createdLabel")}: ${customer.createdAt ?: "-"}", color = AdminColors.TextSecondary)
                }
            }

            item {
                AdminPanel {
                    Text(adminText(ui, "reply"), style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = state.replyMessage,
                        onValueChange = onReplyChange,
                        label = { Text(adminText(ui, "messageLabel")) },
                        minLines = 3
                    )
                    AdminPrimaryButton(
                        text = adminText(ui, "sendReply"),
                        enabled = !state.loading && state.replyMessage.isNotBlank(),
                        onClick = onSendReply
                    )
                }
            }

            item {
                Text("${adminText(ui, "messages")} (${state.customerMessages.size})", style = MaterialTheme.typography.titleMedium)
            }

            items(state.customerMessages) { message ->
                CustomerMessageCard(message = message, ui = ui)
            }

            item {
                Text("${adminText(ui, "requests")} (${state.customerRequests.size})", style = MaterialTheme.typography.titleMedium)
            }

            items(state.customerRequests) { request ->
                CustomerRequestCard(request = request, ui = ui)
            }

            item {
                Text("${adminText(ui, "locations")} (${state.customerLocations.size})", style = MaterialTheme.typography.titleMedium)
            }

            items(state.customerLocations) { location ->
                CustomerLocationCard(location = location, ui = ui)
            }
        }
    }
}

@Composable
private fun CustomerMessageCard(message: CustomerMessage, ui: AdminLocalizedText) {
    AdminPanel {
        Text("${message.direction ?: "-"} / ${message.messageType ?: "-"}", style = MaterialTheme.typography.titleSmall)
        Text(message.message ?: message.text ?: message.body ?: "-")
        Text("${adminText(ui, "languageLabel")}: ${message.language ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "createdLabel")}: ${message.createdAt ?: "-"}", color = AdminColors.TextSecondary)
    }
}

@Composable
private fun CustomerRequestCard(request: CustomerRequest, ui: AdminLocalizedText) {
    AdminPanel {
        Text("${adminText(ui, "request")} #${request.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
        Text("${adminText(ui, "typeLabel")}: ${request.requestType ?: "-"}")
        Text("${adminText(ui, "itemLabel")}: ${request.itemName ?: "-"}", color = AdminColors.TextSecondary)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
            Text("${adminText(ui, "statusLabel")}:")
            AdminStatusChip(text = localizeOpenRequestStatus(request.status, ui))
        }
        Text("${adminText(ui, "createdLabel")}: ${request.createdAt ?: "-"}", color = AdminColors.TextSecondary)
    }
}

@Composable
private fun CustomerLocationCard(location: CustomerLocation, ui: AdminLocalizedText) {
    AdminPanel {
        Text(location.label ?: adminText(ui, "location"), style = MaterialTheme.typography.titleSmall)
        Text("${ui.addressLabel}: ${location.address ?: "-"}")
        Text("${adminText(ui, "mapLabel")}: ${location.mapsUrl ?: location.googleMapsUrl ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "createdLabel")}: ${location.createdAt ?: "-"}", color = AdminColors.TextSecondary)
    }
}


@Composable
private fun OpenRequestsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onStatus: (Long, String) -> Unit,
    onGroupDone: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("${ui.openRequests} (${state.openRequests.size})", style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        if (!state.lastOpenRequestAction.isNullOrBlank()) {
            item {
                Text(localizedAdminFlashMessage(state.lastOpenRequestAction, ui) ?: "")
            }
        }

        if (state.openRequests.isEmpty() && !state.loading) {
            item {
                Text(adminText(ui, "noOpenRequestsLoaded"))
            }
        }

        items(state.openRequests) { request ->
            OpenRequestCard(
                request = request,
                onStatus = onStatus,
                onGroupDone = onGroupDone,
                ui = ui
            )
        }
    }
}

@Composable
private fun OpenRequestCard(
    request: OpenRequest,
    onStatus: (Long, String) -> Unit,
    onGroupDone: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    AdminPanel {
        Text("${adminText(ui, "request")} #${request.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
        Text("${adminText(ui, "customerLabel")}: ${request.customerName ?: request.customerUsername ?: request.customerId ?: "-"}")
        Text("${adminText(ui, "typeLabel")}: ${request.requestType ?: "-"}")
        Text("${adminText(ui, "itemLabel")}: ${request.itemName ?: "-"}", color = AdminColors.TextSecondary)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
            Text("${adminText(ui, "statusLabel")}:")
            AdminStatusChip(text = localizeOpenRequestStatus(request.status, ui))
        }
        Text("${adminText(ui, "messageLabel")}: ${request.message ?: request.notes ?: "-"}")
        Text("${adminText(ui, "createdLabel")}: ${request.createdAt ?: "-"}", color = AdminColors.TextSecondary)

        if (request.id != null) {
            Spacer(modifier = Modifier.height(AdminSpacing.XS))
            Row(horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)) {
                AdminSecondaryButton(
                    text = adminText(ui, "inProgress"),
                    enabled = request.status != "in_progress",
                    onClick = { onStatus(request.id, "in_progress") }
                )

                AdminPrimaryButton(
                    text = adminText(ui, "done"),
                    enabled = request.status != "done",
                    onClick = { onStatus(request.id, "done") }
                )
            }

            Spacer(modifier = Modifier.height(AdminSpacing.XS))

            AdminSecondaryButton(
                text = adminText(ui, "groupDone"),
                enabled = request.customerId != null && !request.requestType.isNullOrBlank(),
                onClick = { onGroupDone(request.id) }
            )
        }
    }
}


@Composable
private fun MeetingPointsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onCreateMeetingPoint: (String, String, String, Boolean) -> Unit,
    onUpdateMeetingPoint: (Long, String, String, String, Boolean) -> Unit,
    onSetPreferredMeetingPoint: (Long) -> Unit,
    onDeleteMeetingPoint: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var name by remember(state.screen) { mutableStateOf("") }
    var address by remember(state.screen) { mutableStateOf("") }
    var googleMapsLink by remember(state.screen) { mutableStateOf("") }
    var isPreferred by remember(state.screen) { mutableStateOf(false) }
    val canCreate = !state.loading && name.isNotBlank() && address.isNotBlank() && googleMapsLink.isNotBlank()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(ui.meetingPoints, style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state)

        item {
            AdminPanel {
                Text(ui.addMeetingPoint, style = MaterialTheme.typography.titleMedium)

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(ui.nameLabel) },
                    singleLine = true
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = address,
                    onValueChange = { address = it },
                    label = { Text(ui.addressLabel) },
                    minLines = 2
                )

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = googleMapsLink,
                    onValueChange = { googleMapsLink = it },
                    label = { Text(ui.googleMapsLinkLabel) },
                    minLines = 2
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)
                ) {
                    Checkbox(
                        checked = isPreferred,
                        onCheckedChange = { isPreferred = it }
                    )
                    Text(ui.setAsPreferred)
                }

                AdminPrimaryButton(
                    text = ui.createMeetingPoint,
                    enabled = canCreate,
                    onClick = {
                        onCreateMeetingPoint(
                            name.trim(),
                            address.trim(),
                            googleMapsLink.trim(),
                            isPreferred
                        )
                        name = ""
                        address = ""
                        googleMapsLink = ""
                        isPreferred = false
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = ui.meetingPointHelp,
                    modifier = Modifier.padding(16.dpCompat),
                    color = AdminColors.Primary
                )
            }
        }

        item {
            Text(
                "${ui.meetingPoints} (${state.meetingPoints.size})",
                style = MaterialTheme.typography.titleLarge
            )
        }

        if (state.meetingPoints.isEmpty() && !state.loading) {
            item {
                Text(ui.noMeetingPointsLoaded)
            }
        }

        items(state.meetingPoints, key = { it.id ?: 0L }) { point ->
            MeetingPointCard(
                point = point,
                loading = state.loading,
                onUpdateMeetingPoint = onUpdateMeetingPoint,
                onSetPreferredMeetingPoint = onSetPreferredMeetingPoint,
                onDeleteMeetingPoint = onDeleteMeetingPoint,
                ui = ui
            )
        }
    }
}

@Composable
private fun MeetingPointCard(
    point: MeetingPoint,
    loading: Boolean,
    onUpdateMeetingPoint: (Long, String, String, String, Boolean) -> Unit,
    onSetPreferredMeetingPoint: (Long) -> Unit,
    onDeleteMeetingPoint: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    val context = LocalContext.current
    var name by remember(point.id, point.name, point.title) { mutableStateOf(point.name ?: point.title ?: "") }
    var address by remember(point.id, point.address) { mutableStateOf(point.address ?: "") }
    var googleMapsLink by remember(point.id, point.googleMapsLink, point.googleMapsUrl, point.mapsUrl) {
        mutableStateOf(point.googleMapsLink ?: point.googleMapsUrl ?: point.mapsUrl ?: "")
    }
    var isActive by remember(point.id, point.isActive) { mutableStateOf(point.isActive == true) }
    val canSave = !loading && point.id != null && name.isNotBlank() && address.isNotBlank() && googleMapsLink.isNotBlank()
    val canSetPreferred = !loading && point.id != null && point.isDefault != true

    AdminPanel {
        Text("${ui.idLabel}: ${point.id ?: "-"}", color = AdminColors.TextSecondary)

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = name,
            onValueChange = { name = it },
            label = { Text(ui.nameLabel) },
            singleLine = true
        )

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = address,
            onValueChange = { address = it },
            label = { Text(ui.addressLabel) },
            minLines = 2
        )

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = googleMapsLink,
            onValueChange = { googleMapsLink = it },
            label = { Text(ui.googleMapsLinkLabel) },
            minLines = 2
        )

        if (googleMapsLink.isNotBlank()) {
            TextButton(
                onClick = {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse(googleMapsLink))
                    )
                }
            ) {
                Text(ui.openMap)
            }
        }

        Text(
            "${ui.preferredLabel}: ${if (point.isDefault == true) ui.trueLabel else ui.falseLabel}",
            color = AdminColors.TextSecondary
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(ui.activeLabel)
            Switch(
                checked = isActive,
                onCheckedChange = { isActive = it }
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)
        ) {
            AdminPrimaryButton(
                text = ui.save,
                enabled = canSave,
                onClick = {
                    val pointId = point.id ?: return@AdminPrimaryButton
                    onUpdateMeetingPoint(
                        pointId,
                        name.trim(),
                        address.trim(),
                        googleMapsLink.trim(),
                        isActive
                    )
                },
                modifier = Modifier.weight(1f)
            )

            AdminSecondaryButton(
                text = ui.setPreferred,
                enabled = canSetPreferred,
                onClick = {
                    val pointId = point.id ?: return@AdminSecondaryButton
                    onSetPreferredMeetingPoint(pointId)
                },
                modifier = Modifier.weight(1f)
            )
        }

        AdminDangerButton(
            text = ui.delete,
            enabled = !loading && point.id != null,
            onClick = {
                val pointId = point.id ?: return@AdminDangerButton
                onDeleteMeetingPoint(pointId)
            },
            modifier = Modifier.fillMaxWidth()
        )
    }
}


@Composable
private fun SettingsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onUpdateGeneralSetting: (String, String) -> Unit,
    onUpdateWorkingHours: (Boolean, String, String, String, String, String) -> Unit,
    onUpdateFulfillment: (Boolean, Boolean, Boolean) -> Unit,
    onUpdateDeliveryCities: (String) -> Unit,
    onUpdateAiInstructions: (String) -> Unit
) {
    GeneralScreen(
        state = state,
        onRefresh = onRefresh,
        onUpdateGeneralSetting = onUpdateGeneralSetting,
        onUpdateWorkingHours = onUpdateWorkingHours,
        onUpdateFulfillment = onUpdateFulfillment,
        onUpdateDeliveryCities = onUpdateDeliveryCities,
        onUpdateAiInstructions = onUpdateAiInstructions,
        ui = adminLocalizedText(resolveAdminLanguage(state.settings["admin_view_language"]))
    )
}

private fun androidx.compose.foundation.lazy.LazyListScope.commonStateItems(state: AdminUiState) {
    if (state.loading) {
        item {
            CircularProgressIndicator()
        }
    }

    if (!state.error.isNullOrBlank()) {
        item {
            Text(state.error, color = MaterialTheme.colorScheme.error)
        }
    }
}
