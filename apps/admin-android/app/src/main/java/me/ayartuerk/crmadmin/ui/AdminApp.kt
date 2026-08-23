package me.ayartuerk.crmadmin.ui
import me.ayartuerk.crmadmin.data.AdminOrderAction
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.LaunchedEffect
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
    val searchLocation: String,
    val search: String,
    val noLocationsFound: String,
    val setAsPreferred: String,
    val createMeetingPoint: String,
    val setPreferred: String,
    val unsetPreferred: String,
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
        searchLocation = t("search_location"),
        search = t("search"),
        noLocationsFound = t("no_locations_found"),
        setAsPreferred = t("set_as_preferred"),
        createMeetingPoint = t("create_meeting_point"),
        setPreferred = t("set_preferred"),
        unsetPreferred = t("unset_preferred"),
        meetingPointHelp = t("meeting_point_help"),
        noMeetingPointsLoaded = t("no_meeting_points_loaded"),
        openMap = t("open_map"),
        trueLabel = t("true_value"),
        falseLabel = t("false_value")
    )
}

internal fun resolveAdminLanguage(configured: String?): String {
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
    "aiCounter" to "ai_counter",
    "lastHour" to "last_hour",
    "last24Hours" to "last_24_hours",
    "lastWeek" to "last_week",
    "lastMonth" to "last_month",
    "aiTotal" to "total",
    "aiPatterns" to "ai_patterns",
    "patternLabel" to "pattern",
    "intentLabel" to "intent",
    "aiProduct" to "product",
    "responseLabel" to "response",
    "aiStatus" to "status",
    "hitsLabel" to "hits",
    "approve" to "approve",
    "reject" to "reject",
    "pendingStatus" to "pending_status",
    "approvedStatus" to "approved_status",
    "rejectedStatus" to "rejected_status",
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
    "allDone" to "all_done",
    "allDoneConfirm" to "all_done_confirm",
    "openCustomer" to "open_customer",
    "answer" to "answer",
    "quantity" to "quantity",
    "requestCount" to "request_count",
    "latestText" to "latest_text",
    "latestCreatedAt" to "latest_created_at",
    "cancel" to "cancel",
    "actions" to "actions",
    "noAvailableAction" to "no_available_action",
    "onTheWay" to "on_the_way",
    "delivered" to "delivered",
    "notDelivered" to "not_delivered",
    "returnNotDelivered" to "return_not_delivered",
    "readyToPickUp" to "ready_to_pick_up",
    "pickedUpDelivered" to "picked_up_delivered",
    "updated" to "updated_at",
    "requestTypeProductSpecific" to "request_type_product_specific",
    "requestTypeProductList" to "request_type_product_list",
    "requestTypeDeliveryLocation" to "request_type_delivery_location",
    "requestTypeLocation" to "request_type_location",
    "requestTypeAddress" to "request_type_address",
    "requestTypeContactAdmin" to "request_type_contact_admin",
    "requestTypeUnresolved" to "request_type_unresolved",
    "mapLabel" to "google_maps",
    "replySent" to "reply_sent",
    "messageCustomer" to "message_customer",
    "structuredRequests" to "structured_requests",
    "customerLocations" to "customer_locations",
    "conversationHistory" to "conversation_history",
    "message" to "message",
    "send" to "send",
    "adminLanguageUpdated" to "admin_language_updated",
    "notificationSettingsUpdated" to "notification_settings_updated",
    "botResponseModeUpdated" to "bot_response_mode_updated",
    "workingHoursUpdated" to "working_hours_updated",
    "fulfillmentOptionsUpdated" to "fulfillment_options_updated",
    "deliveryCitiesUpdated" to "delivery_cities_updated",
    "aiInstructionsUpdated" to "ai_instructions_updated",
    "new" to "new_status",
    "save" to "save"
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

internal fun localizedAdminMessage(
    message: AdminUiMessage?,
    languageCode: String
): String? {
    if (message == null) return null

    var text = AdminSharedTexts.text(languageCode, message.key)
    message.arguments.forEach { (placeholder, value) ->
        val resolvedValue = when {
            placeholder in message.localizedArguments ->
                AdminSharedTexts.text(languageCode, value)
            message.key == "request_updated_template" && placeholder == "status" ->
                localizeOpenRequestStatus(value, adminLocalizedText(languageCode))
            else -> value
        }
        text = text.replace("{$placeholder}", resolvedValue)
    }
    return text
}

private fun localizedAdminMessage(
    message: AdminUiMessage?,
    ui: AdminLocalizedText
): String? = localizedAdminMessage(message, ui.languageCode)

@Composable
fun AdminApp(viewModel: AdminViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val ui = adminLocalizedText(resolveAdminLanguage(state.settings["admin_view_language"]))

    LaunchedEffect(state.loggedIn, state.token) {
        if (state.loggedIn) {
            viewModel.loadCurrentAdmin()
        }
    }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            when {
                state.loading && !state.loggedIn -> LoadingScreen(ui)
                state.loggedIn -> AdminShell(
                    state = state,
                    onDashboard = viewModel::showDashboard,
                    onGeneral = viewModel::showGeneral,
                    onOrders = viewModel::showOrders,
                    onClosedOrders = viewModel::showClosedOrders,
                    onProducts = viewModel::showProducts,
                    onCustomers = viewModel::showCustomers,
                    onOpenRequests = viewModel::showOpenRequests,
                    onMeetingPoints = viewModel::showMeetingPoints,
                    onAiInfo = viewModel::showAiInfo,
                    onSuperadmin = viewModel::showSuperadmin,
                    onChangePassword = viewModel::showChangePassword,
                    onRefreshSuperadmin = viewModel::loadSuperadmin,
                    onCreateManagedAdmin = viewModel::createManagedAdmin,
                    onToggleManagedAdmin = viewModel::toggleManagedAdmin,
                    onDeleteManagedAdmin = viewModel::deleteManagedAdmin,
                    onSubmitPasswordChange = viewModel::submitPasswordChange,
                    onMore = viewModel::showMore,
                    onRefreshDashboard = viewModel::loadDashboard,
                    onRefreshOrders = viewModel::loadOrders,
                    onRefreshProducts = viewModel::loadProducts,
                    onRefreshCustomers = viewModel::loadCustomers,
                    onRefreshOpenRequests = viewModel::loadOpenRequests,
                    onRefreshMeetingPoints = viewModel::loadMeetingPoints,
                    onRefreshAiInfo = viewModel::loadAiInfo,
                    onSearchMeetingPointLocations = viewModel::searchMeetingPointLocations,
                    onRefreshSettings = viewModel::loadSettings,
                    onOrderClick = viewModel::showOrderDetail,
                    onClosedOrderClick = viewModel::showClosedOrderDetail,
                    onOrderAction = viewModel::performSelectedOrderAction,
                    onApproveOrderGroup = viewModel::approveSelectedOrderGroup,
                    onRejectOrderGroup = viewModel::rejectSelectedOrderGroup,
                    onCustomerClick = viewModel::showCustomerDetail,
                    onCustomerMessage = viewModel::sendCustomerMessage,
                    onDeleteCustomer = viewModel::deleteCustomer,
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
                    onLearnedPatternAction = viewModel::updateLearnedPattern,
                    onReplyChange = viewModel::updateReplyMessage,
                    onSendReply = viewModel::sendCustomerReply,
                    onOpenRequestGroupDone = viewModel::markOpenRequestGroupDone,
                    onOpenRequestAllDone = viewModel::markAllOpenRequestsDone,
                    onOpenRequestCustomer = viewModel::showCustomerDetail,
                    onUpdateOpenRequestStatus = viewModel::updateOpenRequestStatus,
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
                    recoveryNotice = state.recoveryNotice,
                    onLogin = viewModel::login,
                    onForgotPassword = viewModel::sendIdentityRecovery,
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
    error: AdminUiMessage?,
    recoveryNotice: AdminUiMessage?,
    onLogin: (String, String) -> Unit,
    onForgotPassword: (String) -> Unit,
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
            onClick = { onForgotPassword(username) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(adminText(ui, "forgotPassword"))
        }

        Spacer(modifier = Modifier.height(AdminSpacing.S))

        if (recoveryNotice != null) {
            Text(
                localizedAdminMessage(recoveryNotice, ui).orEmpty(),
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(AdminSpacing.S))
        }

        Spacer(modifier = Modifier.height(AdminSpacing.M))

        AdminPrimaryButton(
            text = if (loading) adminText(ui, "loggingIn") else adminText(ui, "login"),
            enabled = !loading,
            onClick = { onLogin(username.trim(), password) },
            modifier = Modifier.fillMaxWidth()
        )

        if (error != null) {
            Spacer(modifier = Modifier.height(16.dpCompat))
            Text(
                localizedAdminMessage(error, ui).orEmpty(),
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}

@Composable
private fun AdminShell(
    state: AdminUiState,
    onDashboard: () -> Unit,
    onGeneral: () -> Unit,
    onOrders: () -> Unit,
    onClosedOrders: () -> Unit,
    onProducts: () -> Unit,
    onCustomers: () -> Unit,
    onOpenRequests: () -> Unit,
    onMeetingPoints: () -> Unit,
    onAiInfo: () -> Unit,
    onSuperadmin: () -> Unit,
    onChangePassword: () -> Unit,
    onRefreshSuperadmin: () -> Unit,
    onCreateManagedAdmin: (String, String, String, String) -> Unit,
    onToggleManagedAdmin: (Long) -> Unit,
    onDeleteManagedAdmin: (Long) -> Unit,
    onSubmitPasswordChange: (String, String, String) -> Unit,
    onMore: () -> Unit,
    onRefreshDashboard: () -> Unit,
    onRefreshOrders: () -> Unit,
    onRefreshProducts: () -> Unit,
    onRefreshCustomers: (String, String, String) -> Unit,
    onRefreshOpenRequests: () -> Unit,
    onRefreshMeetingPoints: () -> Unit,
    onRefreshAiInfo: () -> Unit,
    onSearchMeetingPointLocations: (String) -> Unit,
    onRefreshSettings: () -> Unit,
    onOrderClick: (Long) -> Unit,
    onClosedOrderClick: (Long) -> Unit,
    onOrderAction: (AdminOrderAction, String) -> Unit,
    onApproveOrderGroup: (Long) -> Unit,
    onRejectOrderGroup: (Long, String) -> Unit,
    onCustomerClick: (Long) -> Unit,
    onCustomerMessage: (Long, String) -> Unit,
    onDeleteCustomer: (Long) -> Unit,
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
    onSetPreferredMeetingPoint: (Long, Boolean) -> Unit,
    onDeleteMeetingPoint: (Long) -> Unit,
    onLearnedPatternAction: (Long, String) -> Unit,
    onReplyChange: (String) -> Unit,
    onSendReply: () -> Unit,
    onOpenRequestGroupDone: (OpenRequest) -> Unit,
    onOpenRequestAllDone: () -> Unit,
    onOpenRequestCustomer: (Long) -> Unit,
    onUpdateOpenRequestStatus: (Long, String) -> Unit,
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
                onClosedOrders = {
                    drawerScope.launch { drawerState.close() }
                    onClosedOrders()
                },
                onProducts = {
                    drawerScope.launch { drawerState.close() }
                    onProducts()
                },
                onMeetingPoints = {
                    drawerScope.launch { drawerState.close() }
                    onMeetingPoints()
                },
                onAiInfo = {
                    drawerScope.launch { drawerState.close() }
                    onAiInfo()
                },
                isSuperadmin = state.isSuperadmin,
                onSuperadmin = {
                    drawerScope.launch { drawerState.close() }
                    onSuperadmin()
                },
                onChangePassword = {
                    drawerScope.launch { drawerState.close() }
                    onChangePassword()
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
                        AdminScreen.CLOSED_ORDERS -> ui.closedOrders
                        AdminScreen.ORDER_DETAIL -> ui.orderDetail
                        AdminScreen.CLOSED_ORDER_DETAIL -> ui.orderDetail
                        AdminScreen.PRODUCTS -> ui.products
                        AdminScreen.PRODUCT_LIST -> ui.productList
                        AdminScreen.CATEGORY_LIST -> ui.categoryList
                        AdminScreen.CUSTOMERS -> ui.customers
                        AdminScreen.CUSTOMER_DETAIL -> ui.customer
                        AdminScreen.OPEN_REQUESTS -> ui.openRequests
                        AdminScreen.MEETING_POINTS -> ui.meetingPoints
                    AdminScreen.AI_INFO -> ui.aiInfo
                        AdminScreen.SUPERADMIN -> ui.superadmin
                        AdminScreen.CHANGE_PASSWORD -> ui.changePassword
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

                AdminScreen.CLOSED_ORDERS -> OrdersScreen(
                    state = state,
                    onRefresh = onRefreshOrders,
                    onOrderClick = onClosedOrderClick,
                    ui = ui,
                    closed = true
                )

                AdminScreen.ORDER_DETAIL -> OrderDetailScreen(
                    state = state,
                    onBack = onOrders,
                    onRefresh = {
                        state.selectedOrder?.id?.let(onOrderClick)
                    },
                    ui = ui,
                    onAction = onOrderAction,
                    onApproveGroup = onApproveOrderGroup,
                    onRejectGroup = onRejectOrderGroup
                )

                AdminScreen.CLOSED_ORDER_DETAIL -> OrderDetailScreen(
                    state = state,
                    onBack = onClosedOrders,
                    onRefresh = {
                        state.selectedOrder?.id?.let(onClosedOrderClick)
                    },
                    ui = ui,
                    onAction = onOrderAction,
                    onApproveGroup = onApproveOrderGroup,
                    onRejectGroup = onRejectOrderGroup,
                    closedMode = true
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
                    onMessageCustomer = onCustomerMessage,
                    onDeleteCustomer = onDeleteCustomer,
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
                    onUpdateRequestStatus = onUpdateOpenRequestStatus,
                    ui = ui
                )

                AdminScreen.OPEN_REQUESTS -> OpenRequestsScreen(
                    state = state,
                    onRefresh = onRefreshOpenRequests,
                    onGroupDone = onOpenRequestGroupDone,
                    onAllDone = onOpenRequestAllDone,
                    onOpenCustomer = onOpenRequestCustomer,
                    ui = ui
                )

                AdminScreen.MEETING_POINTS -> MeetingPointsScreen(
                    state = state,
                    onRefresh = onRefreshMeetingPoints,
                    onSearchLocation = onSearchMeetingPointLocations,
                    onCreateMeetingPoint = onCreateMeetingPoint,
                    onUpdateMeetingPoint = onUpdateMeetingPoint,
                    onSetPreferredMeetingPoint = onSetPreferredMeetingPoint,
                    onDeleteMeetingPoint = onDeleteMeetingPoint,
                    ui = ui
                )

                AdminScreen.AI_INFO -> AiInfoScreen(
                    state = state,
                    onRefresh = onRefreshAiInfo,
                    onPatternAction = onLearnedPatternAction,
                    ui = ui
                )

                AdminScreen.SUPERADMIN -> SuperadminManagementScreen(
                    state = state,
                    onRefresh = onRefreshSuperadmin,
                    onCreate = onCreateManagedAdmin,
                    onToggle = onToggleManagedAdmin,
                    onDelete = onDeleteManagedAdmin
                )

                AdminScreen.CHANGE_PASSWORD -> AdminChangePasswordScreen(
                    state = state,
                    onSubmit = onSubmitPasswordChange
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
    onClosedOrders: () -> Unit,
    onProducts: () -> Unit,
    onMeetingPoints: () -> Unit,
    onAiInfo: () -> Unit,
    isSuperadmin: Boolean,
    onSuperadmin: () -> Unit,
    onChangePassword: () -> Unit,
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
            onClick = onClosedOrders
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
            onClick = onAiInfo
        )

        NavigationDrawerItem(
            label = { Text(ui.customers) },
            selected = false,
            onClick = onCustomers
        )

        if (isSuperadmin) {
            NavigationDrawerItem(
                label = { Text(ui.superadmin) },
                selected = false,
                onClick = onSuperadmin
            )
        }

        NavigationDrawerItem(
            label = { Text(ui.changePassword) },
            selected = false,
            onClick = onChangePassword
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

        commonStateItems(state, ui)

        if (state.lastSettingsAction != null) {
            item { Text(localizedAdminMessage(state.lastSettingsAction, ui) ?: "") }
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

        commonStateItems(state, ui)

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
    ui: AdminLocalizedText,
    closed: Boolean = false
) {
    val visibleOrders =
        if (closed) state.closedOrders else state.orders
    val screenTitle =
        if (closed) ui.closedOrders else ui.orders

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
                Text(screenTitle, style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        commonStateItems(state, ui)

        if (visibleOrders.isEmpty() && !state.loading) {
            item {
                Text(adminText(ui, "noOrdersLoaded"))
            }
        }

        items(visibleOrders) { order ->
            OrderCard(order = order, onOrderClick = onOrderClick, ui = ui)
        }
    }
}

private fun CustomerAppOrder.displayCustomer(): String =
    listOf(
        customerName,
        customer?.fullName,
        customer?.username
    ).firstOrNull { !it.isNullOrBlank() } ?: "-"

private fun CustomerAppOrder.displayTotal(): String =
    totalFormatted?.takeIf { it.isNotBlank() }
        ?: totalAmount?.toString()
        ?: confirmedTotal?.toString()
        ?: total?.toString()
        ?: "-"

private fun displayOrderTimestamp(value: String?): String {
    val cleaned = value?.trim()?.replace('T', ' ').orEmpty()
    if (cleaned.isBlank()) return "-"

    return cleaned
        .substringBefore(".")
        .removeSuffix("Z")
}

private fun displayOrderValue(
    ui: AdminLocalizedText,
    backendLabel: String? = null,
    raw: String?,
    fulfillment: Boolean = false
): String {
    val normalized = raw?.trim()?.lowercase()

    val alias = when {
        fulfillment && normalized == "delivery" -> "delivery"
        fulfillment && normalized == "pickup" -> "pickup"
        normalized == "delivery" -> "delivery"
        normalized == "pickup" -> "pickup"
        normalized == "on_the_way" -> "onTheWay"
        normalized == "delivered" -> "delivered"
        normalized == "not_delivered" -> "notDelivered"
        normalized == "ready_to_pickup" -> "readyToPickUp"
        normalized == "picked_up" -> "pickedUpDelivered"
        else -> null
    }

    if (alias != null) {
        val translated = adminText(ui, alias)
        val translationKey = adminTextAliases[alias]

        if (
            translated.isNotBlank() &&
            translated != alias &&
            translated != translationKey
        ) {
            return translated
        }
    }

    val value = raw
        ?.takeIf { it.isNotBlank() }
        ?: backendLabel?.takeIf { it.isNotBlank() }
        ?: return "-"

    val words = value
        .replace('_', ' ')
        .replace('-', ' ')

    return words.replaceFirstChar {
        if (it.isLowerCase()) it.titlecase() else it.toString()
    }
}

private fun CustomerAppOrder.itemsSummary(): String =
    items.joinToString(" · ") { item ->
        val name =
            item.productName ?: "Item #${item.productId ?: item.id}"
        "$name ×${item.quantity ?: 0}"
    }

@Composable
private fun OrderCard(
    order: CustomerAppOrder,
    onOrderClick: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    val fulfillment = order.fulfillmentType
        ?.trim()
        ?.lowercase()
        .orEmpty()

    AdminPanel {
        Text(
            text = "${adminText(ui, "order")} #${order.id}",
            style = MaterialTheme.typography.titleSmall
        )

        order.publicOrderCode
            ?.takeIf { it.isNotBlank() }
            ?.let {
                Text(
                    text = it,
                    color = AdminColors.TextSecondary
                )
            }

        Text(
            "${adminText(ui, "customerLabel")}: ${
                order.displayCustomer()
            }"
        )

        order.customer?.telegramUserId
            ?.takeIf { it.isNotBlank() }
            ?.let {
                Text(
                    "${AdminSharedTexts.text(ui.languageCode, "telegram")}: $it"
                )
            }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement =
                Arrangement.spacedBy(AdminSpacing.XS)
        ) {
            Text("${adminText(ui, "fulfillment")}:")
            AdminStatusChip(
                text = displayOrderValue(
                    raw = order.fulfillmentType,
                    ui = ui,
                    fulfillment = true
                )
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement =
                Arrangement.spacedBy(AdminSpacing.XS)
        ) {
            Text("${adminText(ui, "statusLabel")}:")
            AdminStatusChip(
                text = displayOrderValue(
                    raw = order.orderStatus ?: order.status,
                    backendLabel = order.orderStatusLabel,
                    ui = ui
                )
            )
        }

        if (fulfillment == "delivery") {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement =
                    Arrangement.spacedBy(AdminSpacing.XS)
            ) {
                Text("${adminText(ui, "delivery")}:")
                AdminStatusChip(
                    text = displayOrderValue(
                        raw = order.deliveryStatus,
                        backendLabel = order.deliveryStatusLabel,
                        ui = ui
                    )
                )
            }
        }

        if (fulfillment == "pickup") {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement =
                    Arrangement.spacedBy(AdminSpacing.XS)
            ) {
                Text("${adminText(ui, "pickup")}:")
                AdminStatusChip(
                    text = displayOrderValue(
                        raw = order.pickupStatus,
                        backendLabel = order.pickupStatusLabel,
                        ui = ui
                    )
                )
            }
        }

        Text(
            "${adminText(ui, "totalLabel")}: ${
                order.displayTotal()
            }"
        )

        if (order.items.isNotEmpty()) {
            Text(
                "${adminText(ui, "items")}: ${
                    order.itemsSummary()
                }"
            )
        }

        if (fulfillment == "delivery") {
            val location =
                order.deliveryLocationLabel ?: order.deliveryAddress

            location
                ?.takeIf { it.isNotBlank() }
                ?.let {
                    Text(
                        "${adminText(ui, "location")}: $it"
                    )
                }
        }

        Text(
            text = "${adminText(ui, "createdLabel")}: ${
                displayOrderTimestamp(order.createdAt)
            }",
            color = AdminColors.TextSecondary
        )

        AdminPrimaryButton(
            text = adminText(ui, "openDetail"),
            onClick = { onOrderClick(order.id) },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun OrderDetailScreen(
    state: AdminUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onAction: (AdminOrderAction, String) -> Unit,
    onApproveGroup: (Long) -> Unit,
    onRejectGroup: (Long, String) -> Unit,
    ui: AdminLocalizedText,
    closedMode: Boolean = false
) {
    val order = state.selectedOrder

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement =
            Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement =
                    Arrangement.spacedBy(8.dpCompat)
            ) {
                AdminSecondaryButton(
                    text = ui.back,
                    onClick = onBack,
                    modifier = Modifier.weight(1f)
                )
                AdminSecondaryButton(
                    text = ui.refresh,
                    onClick = onRefresh,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        commonStateItems(state, ui)

        if (order == null && !state.loading) {
            item {
                Text(adminText(ui, "orderNotLoaded"))
            }
        }

        if (order != null) {
            val fulfillment = order.fulfillmentType
                ?.trim()
                ?.lowercase()
                .orEmpty()

            val orderStatus = (order.orderStatus ?: order.status)
                ?.trim()
                ?.lowercase()
                .orEmpty()

            val deliveryStatus = order.deliveryStatus
                ?.trim()
                ?.lowercase()
                .orEmpty()

            val pickupStatus = order.pickupStatus
                ?.trim()
                ?.lowercase()
                .orEmpty()

            val terminal = orderStatus in setOf(
                "delivered",
                "cancelled",
                "not_delivered",
                "closed"
            )

            item {
                AdminPanel {
                    Text(
                        text = "${adminText(ui, "order")} #${order.id}",
                        style =
                            MaterialTheme.typography.headlineSmall
                    )

                    order.publicOrderCode
                        ?.takeIf { it.isNotBlank() }
                        ?.let { Text(it) }

                    Text(
                        "${adminText(ui, "customerLabel")}: ${
                            order.displayCustomer()
                        }"
                    )

                    order.customerPhone
                        ?.takeIf { it.isNotBlank() }
                        ?.let {
                            Text(
                                "${adminText(ui, "phoneLabel")}: $it"
                            )
                        }

                    order.customer?.telegramUserId
                        ?.takeIf { it.isNotBlank() }
                        ?.let {
                            Text(
                                "${AdminSharedTexts.text(ui.languageCode, "telegram")}: $it"
                            )
                        }

                    Row(
                        verticalAlignment =
                            Alignment.CenterVertically,
                        horizontalArrangement =
                            Arrangement.spacedBy(AdminSpacing.XS)
                    ) {
                        Text("${adminText(ui, "fulfillment")}:")
                        AdminStatusChip(
                            text = displayOrderValue(
                                raw = order.fulfillmentType,
                                ui = ui,
                                fulfillment = true
                            )
                        )
                    }

                    Row(
                        verticalAlignment =
                            Alignment.CenterVertically,
                        horizontalArrangement =
                            Arrangement.spacedBy(AdminSpacing.XS)
                    ) {
                        Text(
                            "${adminText(ui, "orderStatusLabel")}:"
                        )
                        AdminStatusChip(
                            text = displayOrderValue(
                                raw =
                                    order.orderStatus ?: order.status,
                                backendLabel =
                                    order.orderStatusLabel,
                                ui = ui
                            )
                        )
                    }

                    if (fulfillment == "delivery") {
                        Row(
                            verticalAlignment =
                                Alignment.CenterVertically,
                            horizontalArrangement =
                                Arrangement.spacedBy(
                                    AdminSpacing.XS
                                )
                        ) {
                            Text(
                                "${
                                    adminText(
                                        ui,
                                        "deliveryStatusLabel"
                                    )
                                }:"
                            )
                            AdminStatusChip(
                                text = displayOrderValue(
                                    raw = order.deliveryStatus,
                                    backendLabel =
                                        order.deliveryStatusLabel,
                                    ui = ui
                                )
                            )
                        }
                    }

                    if (fulfillment == "pickup") {
                        Row(
                            verticalAlignment =
                                Alignment.CenterVertically,
                            horizontalArrangement =
                                Arrangement.spacedBy(
                                    AdminSpacing.XS
                                )
                        ) {
                            Text(
                                "${
                                    adminText(
                                        ui,
                                        "pickupStatusLabel"
                                    )
                                }:"
                            )
                            AdminStatusChip(
                                text = displayOrderValue(
                                    raw = order.pickupStatus,
                                    backendLabel =
                                        order.pickupStatusLabel,
                                    ui = ui
                                )
                            )
                        }
                    }

                    Text(
                        "${adminText(ui, "totalLabel")}: ${
                            order.displayTotal()
                        }"
                    )

                    Text(
                        "${adminText(ui, "createdLabel")}: ${
                            displayOrderTimestamp(
                                order.createdAt
                            )
                        }",
                        color = AdminColors.TextSecondary
                    )

                    Text(
                        "${adminText(ui, "updated")}: ${
                            displayOrderTimestamp(
                                order.updatedAt
                            )
                        }",
                        color = AdminColors.TextSecondary
                    )
                }
            }

            item {
                AdminPanel {
                    Text(
                        text = adminText(ui, "actions"),
                        style =
                            MaterialTheme.typography.titleMedium
                    )

                    when {
                        state.loading -> {
                            CircularProgressIndicator()
                        }

                        closedMode &&
                            orderStatus == "cancelled" -> {
                            Text(
                                adminText(
                                    ui,
                                    "noAvailableAction"
                                )
                            )
                        }

                        closedMode &&
                            orderStatus in setOf(
                                "delivered",
                                "closed"
                            ) -> {
                            AdminSecondaryButton(
                                text = adminText(
                                    ui,
                                    "returnNotDelivered"
                                ),
                                onClick = {
                                    onAction(
                                        AdminOrderAction
                                            .RETURN_NOT_DELIVERED,
                                        ""
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        closedMode -> {
                            Text(
                                adminText(
                                    ui,
                                    "noAvailableAction"
                                )
                            )
                        }

                        terminal -> {
                            Text(
                                adminText(
                                    ui,
                                    "noAvailableAction"
                                )
                            )
                        }

                        fulfillment == "delivery" -> {
                            if (deliveryStatus != "on_the_way") {
                                AdminSecondaryButton(
                                    text =
                                        adminText(ui, "onTheWay"),
                                    onClick = {
                                        onAction(
                                            AdminOrderAction
                                                .DELIVERY_ON_THE_WAY,
                                            ""
                                        )
                                    },
                                    modifier =
                                        Modifier.fillMaxWidth()
                                )
                            }

                            AdminPrimaryButton(
                                text =
                                    adminText(ui, "delivered"),
                                onClick = {
                                    onAction(
                                        AdminOrderAction
                                            .DELIVERY_DELIVERED,
                                        ""
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            )

                            AdminSecondaryButton(
                                text =
                                    adminText(ui, "notDelivered"),
                                onClick = {
                                    onAction(
                                        AdminOrderAction
                                            .DELIVERY_NOT_DELIVERED,
                                        ""
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            )

                            AdminSecondaryButton(
                                text = adminText(ui, "cancel"),
                                onClick = {
                                    onAction(
                                        AdminOrderAction.CANCEL,
                                        ""
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        fulfillment == "pickup" -> {
                            if (
                                pickupStatus !in setOf(
                                    "ready_to_pickup",
                                    "picked_up"
                                )
                            ) {
                                AdminSecondaryButton(
                                    text = adminText(
                                        ui,
                                        "readyToPickUp"
                                    ),
                                    onClick = {
                                        onAction(
                                            AdminOrderAction
                                                .PICKUP_READY,
                                            ""
                                        )
                                    },
                                    modifier =
                                        Modifier.fillMaxWidth()
                                )
                            }

                            if (pickupStatus != "picked_up") {
                                AdminPrimaryButton(
                                    text = adminText(
                                        ui,
                                        "pickedUpDelivered"
                                    ),
                                    onClick = {
                                        onAction(
                                            AdminOrderAction
                                                .PICKUP_PICKED_UP,
                                            ""
                                        )
                                    },
                                    modifier =
                                        Modifier.fillMaxWidth()
                                )
                            }

                            AdminSecondaryButton(
                                text = adminText(ui, "cancel"),
                                onClick = {
                                    onAction(
                                        AdminOrderAction.CANCEL,
                                        ""
                                    )
                                },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        else -> {
                            Text(
                                adminText(
                                    ui,
                                    "noAvailableAction"
                                )
                            )
                        }
                    }
                }
            }

            if (fulfillment == "delivery") {
                item {
                    val location =
                        order.deliveryLocationLabel
                            ?: order.deliveryAddress

                    val map =
                        order.deliveryGoogleMapsLink
                            ?: order.deliveryMapsUrl

                    AdminPanel {
                        Text(
                            text = adminText(ui, "delivery"),
                            style =
                                MaterialTheme.typography.titleMedium
                        )

                        location
                            ?.takeIf { it.isNotBlank() }
                            ?.let {
                                Text("${ui.addressLabel}: $it")
                            }

                        map
                            ?.takeIf { it.isNotBlank() }
                            ?.let {
                                Text(
                                    text = it,
                                    color =
                                        AdminColors.TextSecondary
                                )
                            }
                    }
                }
            }

            if (order.groups.isNotEmpty()) {
                item {
                    Text(
                        text = AdminSharedTexts.text(
                            ui.languageCode,
                            "groups_and_items"
                        ),
                        style = MaterialTheme.typography.titleMedium
                    )
                }

                items(
                    items = order.groups,
                    key = { group -> group.id }
                ) { group ->
                    OrderGroupCard(
                        group = group,
                        loading = state.loading,
                        actionable = !closedMode &&
                            !terminal &&
                            fulfillment == "delivery" &&
                            group.groupStatus == "pending_admin_approval",
                        onApprove = onApproveGroup,
                        onReject = onRejectGroup,
                        ui = ui
                    )
                }
            }

            item {
                Text(
                    text = adminText(ui, "items"),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            items(order.items) { orderItem ->
                AdminPanel {
                    val name =
                        orderItem.productName
                            ?: "Item #${
                                orderItem.productId
                                    ?: orderItem.id
                            }"

                    val lineTotal =
                        orderItem.lineTotal ?: orderItem.total

                    Text(
                        text = name,
                        style =
                            MaterialTheme.typography.titleSmall
                    )

                    Text(
                        "${adminText(ui, "quantity")}: ${
                            orderItem.quantity ?: "-"
                        }"
                    )

                    Text(
                        "${adminText(ui, "unit")}: ${
                            orderItem.unitPrice ?: "-"
                        }"
                    )

                    Text(
                        "${adminText(ui, "totalLabel")}: ${
                            lineTotal ?: "-"
                        }"
                    )

                    Row(
                        verticalAlignment =
                            Alignment.CenterVertically,
                        horizontalArrangement =
                            Arrangement.spacedBy(AdminSpacing.XS)
                    ) {
                        Text(
                            "${adminText(ui, "statusLabel")}:"
                        )
                        AdminStatusChip(
                            text = displayOrderValue(
                                raw =
                                    orderItem.itemStatus
                                        ?: orderItem.status,
                                ui = ui
                            )
                        )
                    }
                }
            }
        }
    }
}


@Composable
private fun OrderGroupCard(
    group: me.ayartuerk.crmadmin.api.CustomerAppOrderGroup,
    loading: Boolean,
    actionable: Boolean,
    onApprove: (Long) -> Unit,
    onReject: (Long, String) -> Unit,
    ui: AdminLocalizedText
) {
    var showRejectDialog by remember(group.id) {
        mutableStateOf(false)
    }
    var rejectNote by remember(group.id) {
        mutableStateOf("")
    }

    val groupTypeKey = when (group.groupType) {
        "initial_checkout" -> "group_type_initial_checkout"
        "customer_addition" -> "group_type_customer_addition"
        "admin_addition" -> "group_type_admin_addition"
        else -> null
    }
    val groupType = groupTypeKey
        ?.let { AdminSharedTexts.text(ui.languageCode, it) }
        ?: group.groupType
        ?: "-"

    AdminPanel {
        Text(
            text = "${AdminSharedTexts.text(ui.languageCode, "group")} #${group.id}",
            style = MaterialTheme.typography.titleSmall
        )
        Text(groupType)

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement =
                Arrangement.spacedBy(AdminSpacing.XS)
        ) {
            Text("${adminText(ui, "statusLabel")}:")
            AdminStatusChip(
                text = displayOrderValue(
                    raw = group.groupStatus,
                    ui = ui
                )
            )
        }

        Text(
            "${adminText(ui, "items")}: ${
                group.itemCount ?: group.items.size
            }"
        )
        Text(
            "${adminText(ui, "totalLabel")}: ${
                group.totalFormatted ?: group.totalAmount ?: "-"
            }"
        )

        group.adminDecisionNote
            ?.takeIf { it.isNotBlank() }
            ?.let {
                Text(
                    "${AdminSharedTexts.text(ui.languageCode, "note")}: $it",
                    color = AdminColors.TextSecondary
                )
            }

        if (actionable) {
            AdminPrimaryButton(
                text = AdminSharedTexts.text(
                    ui.languageCode,
                    "approve_group"
                ),
                enabled = !loading,
                onClick = { onApprove(group.id) },
                modifier = Modifier.fillMaxWidth()
            )

            AdminSecondaryButton(
                text = AdminSharedTexts.text(
                    ui.languageCode,
                    "reject_group"
                ),
                enabled = !loading,
                onClick = { showRejectDialog = true },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }

    if (showRejectDialog) {
        AlertDialog(
            onDismissRequest = { showRejectDialog = false },
            title = {
                Text(
                    AdminSharedTexts.text(
                        ui.languageCode,
                        "reject_group"
                    )
                )
            },
            text = {
                OutlinedTextField(
                    value = rejectNote,
                    onValueChange = { rejectNote = it },
                    label = {
                        Text(
                            AdminSharedTexts.text(
                                ui.languageCode,
                                "reject_note"
                            )
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(
                    enabled = !loading,
                    onClick = {
                        showRejectDialog = false
                        onReject(group.id, rejectNote)
                    }
                ) {
                    Text(
                        AdminSharedTexts.text(
                            ui.languageCode,
                            "reject"
                        )
                    )
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showRejectDialog = false }
                ) {
                    Text(adminText(ui, "cancel"))
                }
            }
        )
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

        commonStateItems(state, ui)

        if (state.lastProductAction != null) {
            item {
                Text(localizedAdminMessage(state.lastProductAction, ui).orEmpty())
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

        commonStateItems(state, ui)

        if (state.lastProductAction != null) {
            item {
                Text(localizedAdminMessage(state.lastProductAction, ui).orEmpty())
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

        commonStateItems(state, ui)

        if (state.lastProductAction != null) {
            item {
                Text(localizedAdminMessage(state.lastProductAction, ui).orEmpty())
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


// CUSTOMER_LIST_UI_V1
@Composable
private fun CustomersScreen(
    state: AdminUiState,
    onRefresh: (String, String, String) -> Unit,
    onCustomerClick: (Long) -> Unit,
    onMessageCustomer: (Long, String) -> Unit,
    onDeleteCustomer: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var idFilter by remember { mutableStateOf("") }
    var searchFilter by remember(state.customerSearchFilter) {
        mutableStateOf(state.customerSearchFilter)
    }
    var languageFilter by remember(state.customerLanguageFilter) {
        mutableStateOf(state.customerLanguageFilter)
    }
    var activeFilter by remember(state.customerActiveFilter) {
        mutableStateOf(state.customerActiveFilter)
    }
    var activeFilterExpanded by remember { mutableStateOf(false) }
    var lastSeenFrom by remember { mutableStateOf("") }
    var lastSeenTo by remember { mutableStateOf("") }

    val visibleCustomers = state.customers.filter { customer ->
        val idMatches = idFilter.isBlank() ||
            customer.id?.toString()?.contains(idFilter.trim()) == true
        val searchMatches = searchFilter.isBlank() || listOf(
            customer.fullName,
            customer.name,
            customer.username,
            customer.telegramUserId
        ).any { it?.contains(searchFilter.trim(), ignoreCase = true) == true }
        val languageMatches = languageFilter.isBlank() || listOf(
            customer.language,
            customer.preferredLanguage
        ).any { it?.equals(languageFilter.trim(), ignoreCase = true) == true }
        val activeMatches = when (activeFilter) {
            "active" -> customer.isBlocked != true
            "blocked" -> customer.isBlocked == true
            else -> true
        }
        val seenDate = customer.lastSeenAt?.take(10).orEmpty()
        val fromMatches = lastSeenFrom.isBlank() ||
            (seenDate.isNotBlank() && seenDate >= lastSeenFrom.trim())
        val toMatches = lastSeenTo.isBlank() ||
            (seenDate.isNotBlank() && seenDate <= lastSeenTo.trim())

        idMatches &&
            searchMatches &&
            languageMatches &&
            activeMatches &&
            fromMatches &&
            toMatches
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
                Text("${ui.customers} (${visibleCustomers.size})", style = MaterialTheme.typography.headlineSmall)
                AdminSecondaryButton(
                    text = ui.refresh,
                    onClick = {
                        onRefresh(
                            searchFilter,
                            languageFilter,
                            activeFilter
                        )
                    }
                )
            }
        }

        commonStateItems(state, ui)

        if (state.lastReplySent != null) {
            item {
                Text(
                    localizedAdminMessage(state.lastReplySent, ui).orEmpty(),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        item {
            AdminPanel {
                Text(
                    AdminSharedTexts.text(ui.languageCode, "search_filters"),
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                OutlinedTextField(
                    value = idFilter,
                    onValueChange = { idFilter = it },
                    label = { Text(ui.idLabel) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                OutlinedTextField(
                    value = searchFilter,
                    onValueChange = { searchFilter = it },
                    label = { Text("${ui.search} ${ui.customer}") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                OutlinedTextField(
                    value = languageFilter,
                    onValueChange = { languageFilter = it },
                    label = { Text("${adminText(ui, "languageLabel")} (en, de, tr, ar, ru)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                Text(
                    AdminSharedTexts.text(
                        ui.languageCode,
                        "active_status"
                    )
                )
                OutlinedButton(
                    onClick = { activeFilterExpanded = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    val labelKey = when (activeFilter) {
                        "active" -> "active"
                        "blocked" -> "blocked"
                        else -> "all_customers"
                    }
                    Text(AdminSharedTexts.text(ui.languageCode, labelKey))
                }
                DropdownMenu(
                    expanded = activeFilterExpanded,
                    onDismissRequest = { activeFilterExpanded = false }
                ) {
                    listOf(
                        "" to "all_customers",
                        "active" to "active",
                        "blocked" to "blocked"
                    ).forEach { (value, labelKey) ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    AdminSharedTexts.text(
                                        ui.languageCode,
                                        labelKey
                                    )
                                )
                            },
                            onClick = {
                                activeFilter = value
                                activeFilterExpanded = false
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                OutlinedTextField(
                    value = lastSeenFrom,
                    onValueChange = { lastSeenFrom = it },
                    label = { Text("${adminText(ui, "lastSeenLabel")} ≥ YYYY-MM-DD") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                OutlinedTextField(
                    value = lastSeenTo,
                    onValueChange = { lastSeenTo = it },
                    label = { Text("${adminText(ui, "lastSeenLabel")} ≤ YYYY-MM-DD") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                AdminPrimaryButton(
                    text = AdminSharedTexts.text(
                        ui.languageCode,
                        "apply_filters"
                    ),
                    onClick = {
                        onRefresh(
                            searchFilter,
                            languageFilter,
                            activeFilter
                        )
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(AdminSpacing.S))

                AdminSecondaryButton(
                    text = ui.clearFilters,
                    onClick = {
                        idFilter = ""
                        searchFilter = ""
                        languageFilter = ""
                        activeFilter = ""
                        lastSeenFrom = ""
                        lastSeenTo = ""
                        onRefresh("", "", "")
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        if (visibleCustomers.isEmpty() && !state.loading) {
            item { Text(adminText(ui, "noCustomersLoaded")) }
        }

        items(visibleCustomers) { customer ->
            CustomerCard(
                customer = customer,
                loading = state.loading,
                onCustomerClick = onCustomerClick,
                onMessageCustomer = onMessageCustomer,
                onDeleteCustomer = onDeleteCustomer,
                ui = ui
            )
        }
    }
}

@Composable
private fun CustomerCard(
    customer: Customer,
    loading: Boolean,
    onCustomerClick: (Long) -> Unit,
    onMessageCustomer: (Long, String) -> Unit,
    onDeleteCustomer: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    val id = customer.id
    val name = customer.fullName ?: customer.name ?: customer.username ?: customer.telegramUserId ?: ui.customer
    var showMessageDialog by remember(id) { mutableStateOf(false) }
    var showDeleteDialog by remember(id) { mutableStateOf(false) }
    var message by remember(id) { mutableStateOf("") }

    AdminPanel {
        Text(name, style = MaterialTheme.typography.titleSmall)
        Text("${ui.idLabel}: ${id ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "usernameLabel")}: ${customer.username ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "telegramLabel")}: ${customer.telegramUserId ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "languageLabel")}: ${customer.preferredLanguage ?: customer.language ?: "-"}")
        Text("${adminText(ui, "blockedLabel")}: ${if (customer.isBlocked == true) ui.trueLabel else ui.falseLabel}")
        Text(
            "${adminText(ui, "lastSeenLabel")}: ${displayOrderTimestamp(customer.lastSeenAt)}",
            color = AdminColors.TextSecondary
        )

        Spacer(modifier = Modifier.height(AdminSpacing.S))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)
        ) {
            AdminPrimaryButton(
                text = adminText(ui, "openCustomer"),
                onClick = { id?.let(onCustomerClick) },
                enabled = id != null && !loading,
                modifier = Modifier.weight(0.85f)
            )
            androidx.compose.material3.OutlinedButton(
                onClick = { showMessageDialog = true },
                enabled = id != null && !loading,
                modifier = Modifier.weight(1.15f),
                contentPadding = PaddingValues(
                    horizontal = 8.dpCompat,
                    vertical = AdminSpacing.S
                )
            ) {
                Text(
                    text = adminText(ui, "messageCustomer"),
                    maxLines = 1,
                    softWrap = false,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                )
            }
        }

        AdminDangerButton(
            text = ui.delete,
            onClick = { showDeleteDialog = true },
            enabled = id != null && !loading,
            modifier = Modifier.fillMaxWidth()
        )
    }

    if (showMessageDialog) {
        AlertDialog(
            onDismissRequest = { showMessageDialog = false },
            title = { Text("${adminText(ui, "messageCustomer")} – $name") },
            text = {
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = it },
                    label = { Text(adminText(ui, "message")) },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 4
                )
            },
            confirmButton = {
                TextButton(
                    enabled = id != null && message.isNotBlank() && !loading,
                    onClick = {
                        id?.let { onMessageCustomer(it, message.trim()) }
                        message = ""
                        showMessageDialog = false
                    }
                ) {
                    Text(adminText(ui, "send"))
                }
            },
            dismissButton = {
                TextButton(onClick = { showMessageDialog = false }) {
                    Text(adminText(ui, "cancel"))
                }
            }
        )
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text(ui.delete) },
            text = { Text("$name?") },
            confirmButton = {
                TextButton(
                    enabled = id != null && !loading,
                    onClick = {
                        id?.let(onDeleteCustomer)
                        showDeleteDialog = false
                    }
                ) {
                    Text(ui.delete)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text(adminText(ui, "cancel"))
                }
            }
        )
    }
}

// CUSTOMER_DETAIL_UI_V1
@Composable
private fun CustomerDetailScreen(
    state: AdminUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onReplyChange: (String) -> Unit,
    onSendReply: () -> Unit,
    onUpdateRequestStatus: (Long, String) -> Unit,
    ui: AdminLocalizedText
) {
    val customer = state.selectedCustomer
    val name = customer?.fullName ?: customer?.name ?: customer?.username ?: customer?.telegramUserId ?: "-"
    var visibleSection by remember(customer?.id) { mutableStateOf("requests") }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dpCompat)) {
                AdminSecondaryButton(text = ui.back, onClick = onBack)
                AdminSecondaryButton(text = ui.refresh, onClick = onRefresh)
            }
        }

        if (customer == null) {
            item { Text("-") }
        } else {
            item {
                AdminPanel {
                    Text(name, style = MaterialTheme.typography.headlineSmall)
                    Spacer(modifier = Modifier.height(AdminSpacing.S))
                    Text("${ui.idLabel}: ${customer.id ?: "-"}")
                    Text("${adminText(ui, "telegramLabel")}: ${customer.telegramUserId ?: "-"}")
                    Text("${adminText(ui, "usernameLabel")}: ${customer.username ?: "-"}")
                    Text("${adminText(ui, "fullNameLabel")}: ${customer.fullName ?: customer.name ?: "-"}")
                    Text("${adminText(ui, "languageLabel")}: ${customer.language ?: "-"}")
                    Text("${adminText(ui, "preferredLanguageLabel")}: ${customer.preferredLanguage ?: "-"}")
                    Text("${adminText(ui, "blockedLabel")}: ${if (customer.isBlocked == true) ui.trueLabel else ui.falseLabel}")
                    Text(
                        "${adminText(ui, "lastSeenLabel")}: ${displayOrderTimestamp(customer.lastSeenAt)}",
                        color = AdminColors.TextSecondary
                    )
                }
            }

            item {
                AdminPanel {
                    Text(
                        "${adminText(ui, "messageCustomer")} – $name",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(AdminSpacing.S))
                    OutlinedTextField(
                        value = state.replyMessage,
                        onValueChange = onReplyChange,
                        label = { Text(adminText(ui, "message")) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 4
                    )
                    Spacer(modifier = Modifier.height(AdminSpacing.S))
                    AdminPrimaryButton(
                        text = adminText(ui, "send"),
                        enabled = state.replyMessage.isNotBlank() && !state.loading,
                        onClick = onSendReply
                    )
                    state.lastReplySent?.let { message ->
                        Spacer(modifier = Modifier.height(AdminSpacing.S))
                        Text(
                            localizedAdminMessage(message, ui).orEmpty(),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(AdminSpacing.S)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)
                    ) {
                        CustomerDetailSectionButton(
                            text = adminText(ui, "structuredRequests"),
                            selected = visibleSection == "requests",
                            onClick = { visibleSection = "requests" },
                            modifier = Modifier.weight(1f)
                        )
                        CustomerDetailSectionButton(
                            text = adminText(ui, "customerLocations"),
                            selected = visibleSection == "locations",
                            onClick = { visibleSection = "locations" },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    CustomerDetailSectionButton(
                        text = adminText(ui, "conversationHistory"),
                        selected = visibleSection == "messages",
                        onClick = { visibleSection = "messages" },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            when (visibleSection) {
                "requests" -> {
                    item {
                        Text(
                            "${adminText(ui, "structuredRequests")} (${state.customerRequests.size})",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                    if (state.customerRequests.isEmpty()) {
                        item { Text("-") }
                    } else {
                        items(state.customerRequests) { request ->
                            CustomerRequestCard(
                                request = request,
                                loading = state.loading,
                                onUpdateStatus = onUpdateRequestStatus,
                                ui = ui
                            )
                        }
                    }
                }

                "locations" -> {
                    item {
                        Text(
                            "${adminText(ui, "customerLocations")} (${state.customerLocations.size})",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                    if (state.customerLocations.isEmpty()) {
                        item { Text("-") }
                    } else {
                        items(state.customerLocations) { location ->
                            CustomerLocationCard(location = location, ui = ui)
                        }
                    }
                }

                "messages" -> {
                    item {
                        Text(
                            "${adminText(ui, "conversationHistory")} (${state.customerMessages.size})",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                    if (state.customerMessages.isEmpty()) {
                        item { Text("-") }
                    } else {
                        items(state.customerMessages) { message ->
                            CustomerMessageCard(message = message, ui = ui)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomerDetailSectionButton(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (selected) {
        AdminPrimaryButton(
            text = text,
            onClick = onClick,
            modifier = modifier
        )
    } else {
        AdminSecondaryButton(
            text = text,
            onClick = onClick,
            modifier = modifier
        )
    }
}

@Composable
private fun CustomerMessageCard(message: CustomerMessage, ui: AdminLocalizedText) {
    AdminPanel {
        Text("${message.direction ?: "-"} / ${message.messageType ?: "-"}", style = MaterialTheme.typography.titleSmall)
        Text(message.content ?: "-")
        Text("${adminText(ui, "languageLabel")}: ${message.language ?: "-"}", color = AdminColors.TextSecondary)
        Text("${adminText(ui, "createdLabel")}: ${displayOrderTimestamp(message.createdAt)}", color = AdminColors.TextSecondary)
    }
}

@Composable
private fun CustomerRequestCard(
    request: CustomerRequest,
    loading: Boolean,
    onUpdateStatus: (Long, String) -> Unit,
    ui: AdminLocalizedText
) {
    val context = LocalContext.current
    val mapUrl = request.googleMapsLink?.takeIf { it.isNotBlank() }
    val statusOptions = listOf("new", "in_progress", "done")
    var selectedStatus by remember(request.id, request.status) {
        mutableStateOf(request.status?.takeIf { it in statusOptions } ?: "new")
    }
    var statusMenuExpanded by remember(request.id) { mutableStateOf(false) }

    AdminPanel {
        Text("${adminText(ui, "request")} #${request.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
        Text("${adminText(ui, "typeLabel")}: ${localizeRequestType(request.requestType, ui)}")
        Text("${adminText(ui, "itemLabel")}: ${request.itemName ?: "-"}", color = AdminColors.TextSecondary)

        request.quantity?.let {
            Text("${adminText(ui, "quantity")}: $it")
        }

        Text(request.description ?: request.requestText ?: "-")
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)
        ) {
            Text("${adminText(ui, "statusLabel")}:")
            AdminStatusChip(text = localizeOpenRequestStatus(request.status, ui))
        }

        Text(
            "${adminText(ui, "createdLabel")}: ${displayOrderTimestamp(request.createdAt)}",
            color = AdminColors.TextSecondary
        )

        if (mapUrl != null) {
            TextButton(onClick = { openCustomerLocationInMaps(context, mapUrl) }) {
                Text(ui.openMap)
            }
        }

        Spacer(modifier = Modifier.height(AdminSpacing.S))

        androidx.compose.foundation.layout.Box(modifier = Modifier.fillMaxWidth()) {
            androidx.compose.material3.OutlinedButton(
                onClick = { statusMenuExpanded = true },
                enabled = !loading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)
                ) {
                    Text(
                        localizeOpenRequestStatus(selectedStatus, ui),
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                    Text("▾", color = AdminColors.TextSecondary)
                }
            }

            androidx.compose.material3.DropdownMenu(
                expanded = statusMenuExpanded,
                onDismissRequest = { statusMenuExpanded = false },
                modifier = Modifier.fillMaxWidth()
            ) {
                statusOptions.forEach { status ->
                    androidx.compose.material3.DropdownMenuItem(
                        text = { Text(localizeOpenRequestStatus(status, ui)) },
                        onClick = {
                            selectedStatus = status
                            statusMenuExpanded = false
                        }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(AdminSpacing.XS))

        AdminPrimaryButton(
            text = adminText(ui, "save"),
            enabled = !loading && request.id != null,
            onClick = { request.id?.let { onUpdateStatus(it, selectedStatus) } },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun CustomerLocationCard(location: CustomerLocation, ui: AdminLocalizedText) {
    val context = LocalContext.current
    val mapUrl = location.googleMapsLink ?: location.mapsUrl ?: location.googleMapsUrl

    AdminPanel {
        Text(location.label ?: adminText(ui, "location"), style = MaterialTheme.typography.titleSmall)
        Text("${ui.addressLabel}: ${location.address ?: "-"}")
        Text("${adminText(ui, "createdLabel")}: ${displayOrderTimestamp(location.createdAt)}", color = AdminColors.TextSecondary)

        if (!mapUrl.isNullOrBlank()) {
            TextButton(onClick = { openCustomerLocationInMaps(context, mapUrl) }) {
                Text(ui.openMap)
            }
        }
    }
}

private fun openCustomerLocationInMaps(context: android.content.Context, url: String) {
    runCatching {
        context.startActivity(
            android.content.Intent(
                android.content.Intent.ACTION_VIEW,
                android.net.Uri.parse(url)
            )
        )
    }
}


@Composable
private fun OpenRequestsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onGroupDone: (OpenRequest) -> Unit,
    onAllDone: () -> Unit,
    onOpenCustomer: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var showAllDoneConfirm by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dpCompat),
        verticalArrangement = Arrangement.spacedBy(12.dpCompat)
    ) {
        item {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(AdminSpacing.S)
            ) {
                Text(
                    "${ui.openRequests} (${state.openRequests.size})",
                    style = MaterialTheme.typography.headlineSmall
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)
                ) {
                    AdminPrimaryButton(
                        text = adminText(ui, "allDone"),
                        enabled = state.openRequests.isNotEmpty() && !state.loading,
                        onClick = { showAllDoneConfirm = true },
                        modifier = Modifier.weight(1f)
                    )
                    AdminSecondaryButton(
                        text = ui.refresh,
                        onClick = onRefresh,
                        modifier = Modifier.weight(0.72f)
                    )
                }
            }
        }

        commonStateItems(state, ui)

        if (state.lastOpenRequestAction != null) {
            item {
                Text(localizedAdminMessage(state.lastOpenRequestAction, ui) ?: "")
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
                onGroupDone = onGroupDone,
                onOpenCustomer = onOpenCustomer,
                ui = ui
            )
        }
    }

    if (showAllDoneConfirm) {
        AlertDialog(
            onDismissRequest = { showAllDoneConfirm = false },
            title = { Text(adminText(ui, "allDone")) },
            text = { Text(adminText(ui, "allDoneConfirm")) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showAllDoneConfirm = false
                        onAllDone()
                    }
                ) {
                    Text(adminText(ui, "allDone"))
                }
            },
            dismissButton = {
                TextButton(onClick = { showAllDoneConfirm = false }) {
                    Text(adminText(ui, "cancel"))
                }
            }
        )
    }
}

@Composable
private fun OpenRequestCard(
    request: OpenRequest,
    onGroupDone: (OpenRequest) -> Unit,
    onOpenCustomer: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    val customer = request.customer
    val customerLabel = customer?.fullName?.takeIf { it.isNotBlank() }
        ?: customer?.username?.takeIf { it.isNotBlank() }
        ?: customer?.telegramUserId?.takeIf { it.isNotBlank() }
        ?: request.customerId?.toString()
        ?: "-"
    val typeLabel = localizeRequestType(request.requestType, ui)
    val quantity = request.quantity
    val requestCount = request.requestCount

    AdminPanel {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(AdminSpacing.XS)
        ) {
            RequestRow(label = adminText(ui, "customerLabel"), value = customerLabel, ui = ui)
            RequestRow(label = adminText(ui, "typeLabel"), value = typeLabel, ui = ui)
            RequestRow(label = adminText(ui, "itemLabel"), value = request.itemName ?: "-", ui = ui)
            RequestRow(label = adminText(ui, "quantity"), value = quantity?.toString() ?: "-", ui = ui)
            RequestRow(label = adminText(ui, "requestCount"), value = requestCount?.toString() ?: "-", ui = ui)
            RequestRow(label = adminText(ui, "statusLabel"), value = localizeOpenRequestStatus(request.status, ui), ui = ui)
            RequestRow(label = adminText(ui, "latestText"), value = request.latestText ?: "-", ui = ui)
            RequestRow(label = adminText(ui, "latestCreatedAt"), value = request.latestCreatedAt ?: "-", ui = ui)
        }

        Spacer(modifier = Modifier.height(AdminSpacing.S))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(AdminSpacing.XS)
        ) {
            AdminSecondaryButton(
                text = adminText(ui, "openCustomer"),
                enabled = request.customerId != null,
                onClick = { request.customerId?.let(onOpenCustomer) },
                modifier = Modifier.weight(1.45f)
            )

            AdminSecondaryButton(
                text = adminText(ui, "answer"),
                enabled = request.customerId != null,
                onClick = { request.customerId?.let(onOpenCustomer) },
                modifier = Modifier.weight(0.95f)
            )

            AdminPrimaryButton(
                text = adminText(ui, "done"),
                enabled = request.customerId != null && !request.requestType.isNullOrBlank(),
                onClick = { onGroupDone(request) },
                modifier = Modifier.weight(0.85f)
            )
        }
    }
}

@Composable
private fun RequestRow(label: String, value: String, ui: AdminLocalizedText) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)
    ) {
        Text(
            label,
            modifier = Modifier.weight(0.34f),
            style = MaterialTheme.typography.labelSmall,
            color = AdminColors.TextSecondary
        )
        Text(
            value,
            modifier = Modifier.weight(0.66f),
            style = MaterialTheme.typography.bodyMedium,
            softWrap = true
        )
    }
}

private fun localizeRequestType(type: String?, ui: AdminLocalizedText): String {
    val label = when (type) {
        "product_specific" -> adminText(ui, "requestTypeProductSpecific")
        "product_list" -> adminText(ui, "requestTypeProductList")
        "delivery_location" -> adminText(ui, "requestTypeDeliveryLocation")
        "location" -> adminText(ui, "requestTypeLocation")
        "address" -> adminText(ui, "requestTypeAddress")
        "contact_admin" -> adminText(ui, "requestTypeContactAdmin")
        "unresolved" -> adminText(ui, "requestTypeUnresolved")
        else -> null
    }
    return label ?: type ?: "-"
}


@Composable
private fun MeetingPointsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onSearchLocation: (String) -> Unit,
    onCreateMeetingPoint: (String, String, String, Boolean) -> Unit,
    onUpdateMeetingPoint: (Long, String, String, String, Boolean) -> Unit,
    onSetPreferredMeetingPoint: (Long, Boolean) -> Unit,
    onDeleteMeetingPoint: (Long) -> Unit,
    ui: AdminLocalizedText
) {
    var locationSearchQuery by remember(state.screen) { mutableStateOf("") }
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

        commonStateItems(state, ui)

        item {
            AdminPanel {
                Text(ui.addMeetingPoint, style = MaterialTheme.typography.titleMedium)

                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = locationSearchQuery,
                    onValueChange = { locationSearchQuery = it },
                    label = { Text(ui.searchLocation) },
                    singleLine = true
                )

                AdminPrimaryButton(
                    text = ui.search,
                    enabled = !state.meetingPointSearchLoading && locationSearchQuery.isNotBlank(),
                    onClick = {
                        onSearchLocation(locationSearchQuery)
                    },
                    modifier = Modifier.fillMaxWidth()
                )

                if (state.meetingPointSearchLoading) {
                    CircularProgressIndicator()
                }

                if (
                    state.meetingPointSearchAttempted &&
                    !state.meetingPointSearchLoading &&
                    state.meetingPointSearchResults.isEmpty()
                ) {
                    Text(
                        text = ui.noLocationsFound,
                        color = AdminColors.TextSecondary
                    )
                }

                state.meetingPointSearchResults.forEach { result ->
                    AdminSecondaryButton(
                        text = result.address.ifBlank { result.name },
                        onClick = {
                            locationSearchQuery = result.address
                            name = result.name.ifBlank { result.address }
                            address = result.address
                            googleMapsLink = result.googleMapsLink
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

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
    onSetPreferredMeetingPoint: (Long, Boolean) -> Unit,
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
    val canTogglePreferred = !loading && point.id != null

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
                text = if (point.isDefault == true) ui.unsetPreferred else ui.setPreferred,
                enabled = canTogglePreferred,
                onClick = {
                    val pointId = point.id ?: return@AdminSecondaryButton
                    onSetPreferredMeetingPoint(pointId, point.isDefault != true)
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


private fun localizedAiPatternStatus(
    status: String,
    ui: AdminLocalizedText
): String {
    return when (status.trim().lowercase(Locale.ROOT)) {
        "pending" -> adminText(ui, "pendingStatus")
        "approved" -> adminText(ui, "approvedStatus")
        "rejected" -> adminText(ui, "rejectedStatus")
        else -> status
            .replace('_', ' ')
            .replaceFirstChar {
                if (it.isLowerCase()) it.titlecase() else it.toString()
            }
    }
}

@Composable
private fun AiMetricCell(
    label: String,
    value: Long,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(AdminSpacing.S)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value.toString(),
            style = MaterialTheme.typography.headlineSmall
        )
    }
}

@Composable
private fun AiInfoScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onPatternAction: (Long, String) -> Unit,
    ui: AdminLocalizedText
) {
    val usage = state.aiUsageStats

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = AdminSpacing.L),
        verticalArrangement = Arrangement.spacedBy(AdminSpacing.M)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = ui.aiInfo,
                    style = MaterialTheme.typography.headlineMedium,
                    modifier = Modifier.weight(1f)
                )

                AdminSecondaryButton(
                    text = ui.refresh,
                    enabled = !state.loading,
                    onClick = onRefresh
                )
            }
        }

        commonStateItems(state, ui)

        item {
            Text(
                text = adminText(ui, "aiCounter"),
                style = MaterialTheme.typography.titleLarge
            )
        }

        item {
            AdminPanel {
                Row(modifier = Modifier.fillMaxWidth()) {
                    AiMetricCell(
                        label = adminText(ui, "lastHour"),
                        value = usage?.lastHour ?: 0,
                        modifier = Modifier.weight(1f)
                    )
                    AiMetricCell(
                        label = adminText(ui, "last24Hours"),
                        value = usage?.last24Hours ?: 0,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(modifier = Modifier.fillMaxWidth()) {
                    AiMetricCell(
                        label = adminText(ui, "lastWeek"),
                        value = usage?.lastWeek ?: 0,
                        modifier = Modifier.weight(1f)
                    )
                    AiMetricCell(
                        label = adminText(ui, "lastMonth"),
                        value = usage?.lastMonth ?: 0,
                        modifier = Modifier.weight(1f)
                    )
                }

                AiMetricCell(
                    label = adminText(ui, "aiTotal"),
                    value = usage?.total ?: 0,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            Text(
                text = "${adminText(ui, "aiPatterns")} (${state.learnedPatterns.size})",
                style = MaterialTheme.typography.titleLarge
            )
        }

        if (state.learnedPatterns.isEmpty() && !state.loading) {
            item {
                Text("-")
            }
        }

        items(state.learnedPatterns) { pattern ->
            AdminPanel {
                Text(
                    text = "#${pattern.id}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = "${adminText(ui, "patternLabel")}: ${pattern.patternText.ifBlank { "-" }}",
                    style = MaterialTheme.typography.titleMedium
                )

                Text(
                    text = "${adminText(ui, "intentLabel")}: ${pattern.intent.ifBlank { "-" }}",
                    style = MaterialTheme.typography.bodyMedium
                )

                Text(
                    text = "${adminText(ui, "aiProduct")}: ${pattern.productName.ifBlank { "-" }}",
                    style = MaterialTheme.typography.bodyMedium
                )

                Text(
                    text = "${adminText(ui, "responseLabel")}:",
                    style = MaterialTheme.typography.labelLarge
                )

                Text(
                    text = pattern.responseText.ifBlank { "-" },
                    style = MaterialTheme.typography.bodyMedium
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${adminText(ui, "aiStatus")}: ${
                            localizedAiPatternStatus(pattern.status, ui)
                        }",
                        color = MaterialTheme.colorScheme.primary
                    )

                    Text(
                        text = "${adminText(ui, "hitsLabel")}: ${pattern.hitCount}"
                    )
                }

                if (pattern.status.equals("pending", ignoreCase = true)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(AdminSpacing.S)
                    ) {
                        AdminPrimaryButton(
                            text = adminText(ui, "approve"),
                            enabled = !state.loading && pattern.id > 0,
                            onClick = {
                                onPatternAction(pattern.id, "approve")
                            },
                            modifier = Modifier.weight(1f)
                        )

                        AdminSecondaryButton(
                            text = adminText(ui, "reject"),
                            enabled = !state.loading && pattern.id > 0,
                            onClick = {
                                onPatternAction(pattern.id, "reject")
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                AdminDangerButton(
                    text = ui.delete,
                    enabled = !state.loading && pattern.id > 0,
                    onClick = {
                        onPatternAction(pattern.id, "delete")
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            Spacer(modifier = Modifier.height(AdminSpacing.L))
        }
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

private fun androidx.compose.foundation.lazy.LazyListScope.commonStateItems(
    state: AdminUiState,
    ui: AdminLocalizedText
) {
    if (state.loading) {
        item {
            CircularProgressIndicator()
        }
    }

    if (state.error != null) {
        item {
            Text(
                localizedAdminMessage(state.error, ui).orEmpty(),
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
