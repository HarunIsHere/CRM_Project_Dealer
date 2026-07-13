package me.ayartuerk.crmadmin.ui

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import me.ayartuerk.crmadmin.api.Customer
import me.ayartuerk.crmadmin.api.CustomerAppOrder
import me.ayartuerk.crmadmin.api.CustomerLocation
import me.ayartuerk.crmadmin.api.CustomerMessage
import me.ayartuerk.crmadmin.api.CustomerRequest
import me.ayartuerk.crmadmin.api.Product
import me.ayartuerk.crmadmin.api.ProductCategory
@Composable
fun AdminApp(viewModel: AdminViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            when {
                state.loading && !state.loggedIn -> LoadingScreen()
                state.loggedIn -> AdminShell(
                    state = state,
                    onDashboard = viewModel::showDashboard,
                    onOrders = viewModel::showOrders,
                    onProducts = viewModel::showProducts,
                    onCustomers = viewModel::showCustomers,
                    onRefreshDashboard = viewModel::loadDashboard,
                    onRefreshOrders = viewModel::loadOrders,
                    onRefreshProducts = viewModel::loadProducts,
                    onRefreshCustomers = viewModel::loadCustomers,
                    onOrderClick = viewModel::showOrderDetail,
                    onCustomerClick = viewModel::showCustomerDetail,
                    onReplyChange = viewModel::updateReplyMessage,
                    onSendReply = viewModel::sendCustomerReply,
                    onLogout = viewModel::logout
                )
                else -> LoginScreen(
                    loading = state.loading,
                    error = state.error,
                    onLogin = viewModel::login
                )
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dpCompat),
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()
        Spacer(modifier = Modifier.height(16.dpCompat))
        Text("Loading CRM Admin...")
    }
}

@Composable
private fun LoginScreen(
    loading: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit
) {
    var username by remember { mutableStateOf("admin") }
    var password by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dpCompat),
        verticalArrangement = Arrangement.Center
    ) {
        Text("CRM Admin", style = MaterialTheme.typography.headlineMedium)

        Spacer(modifier = Modifier.height(24.dpCompat))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            singleLine = true
        )

        Spacer(modifier = Modifier.height(12.dpCompat))

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true
        )

        Spacer(modifier = Modifier.height(16.dpCompat))

        Button(
            enabled = !loading,
            onClick = { onLogin(username.trim(), password) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (loading) "Logging in..." else "Login")
        }

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
    onOrders: () -> Unit,
    onProducts: () -> Unit,
    onCustomers: () -> Unit,
    onRefreshDashboard: () -> Unit,
    onRefreshOrders: () -> Unit,
    onRefreshProducts: () -> Unit,
    onRefreshCustomers: () -> Unit,
    onOrderClick: (Long) -> Unit,
    onCustomerClick: (Long) -> Unit,
    onReplyChange: (String) -> Unit,
    onSendReply: () -> Unit,
    onLogout: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        TopNav(
            selected = state.screen,
            onDashboard = onDashboard,
            onOrders = onOrders,
            onProducts = onProducts,
            onCustomers = onCustomers,
            onLogout = onLogout
        )

        when (state.screen) {
            AdminScreen.DASHBOARD -> DashboardScreen(
                state = state,
                onRefresh = onRefreshDashboard,
                onOrderClick = onOrderClick
            )

            AdminScreen.ORDERS -> OrdersScreen(
                state = state,
                onRefresh = onRefreshOrders,
                onOrderClick = onOrderClick
            )

            AdminScreen.ORDER_DETAIL -> OrderDetailScreen(
                state = state,
                onBack = onOrders,
                onRefresh = {
                    state.selectedOrder?.id?.let(onOrderClick)
                }
            )

            AdminScreen.PRODUCTS -> ProductsScreen(
                state = state,
                onRefresh = onRefreshProducts
            )

            AdminScreen.CUSTOMERS -> CustomersScreen(
                state = state,
                onRefresh = onRefreshCustomers,
                onCustomerClick = onCustomerClick
            )

            AdminScreen.CUSTOMER_DETAIL -> CustomerDetailScreen(
                state = state,
                onBack = onCustomers,
                onRefresh = {
                    state.selectedCustomer?.id?.let(onCustomerClick)
                },
                onReplyChange = onReplyChange,
                onSendReply = onSendReply
            )
        }
    }
}

@Composable
private fun TopNav(
    selected: AdminScreen,
    onDashboard: () -> Unit,
    onOrders: () -> Unit,
    onProducts: () -> Unit,
    onCustomers: () -> Unit,
    onLogout: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dpCompat),
        horizontalArrangement = Arrangement.spacedBy(8.dpCompat)
    ) {
        Button(
            enabled = selected != AdminScreen.DASHBOARD,
            onClick = onDashboard
        ) {
            Text("Dashboard")
        }

        Button(
            enabled = selected != AdminScreen.ORDERS,
            onClick = onOrders
        ) {
            Text("Orders")
        }

        Button(
            enabled = selected != AdminScreen.PRODUCTS,
            onClick = onProducts
        ) {
            Text("Products")
        }

        Button(
            enabled = selected != AdminScreen.CUSTOMERS,
            onClick = onCustomers
        ) {
            Text("Customers")
        }

        OutlinedButton(onClick = onLogout) {
            Text("Logout")
        }
    }
}

@Composable
private fun DashboardScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onOrderClick: (Long) -> Unit
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
                Text("Dashboard", style = MaterialTheme.typography.headlineSmall)

                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }

        commonStateItems(state)

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dpCompat)) {
                    Text("Summary", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dpCompat))
                    Text("Open orders: ${dashboard?.summary?.openOrders ?: "-"}")
                    Text("Closed orders: ${dashboard?.summary?.closedOrders ?: "-"}")
                    Text("Open requests: ${dashboard?.summary?.openRequests ?: "-"}")
                    Text("Customers: ${dashboard?.summary?.customers ?: "-"}")
                }
            }
        }

        item {
            Text("Latest orders", style = MaterialTheme.typography.titleMedium)
        }

        items(dashboard?.latestOrders ?: emptyList()) { order ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dpCompat)) {
                    Text("Order #${order.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
                    Text("Customer: ${order.customerName ?: "-"}")
                    Text("Status: ${order.orderStatus ?: order.status ?: "-"}")
                    Text("Total: ${order.total ?: "-"}")
                    Text("Created: ${order.createdAt ?: "-"}")
                    if (order.id != null) {
                        Spacer(modifier = Modifier.height(8.dpCompat))
                        Button(onClick = { onOrderClick(order.id) }) {
                            Text("Open")
                        }
                    }
                }
            }
        }

        item {
            Text("Latest requests", style = MaterialTheme.typography.titleMedium)
        }

        items(dashboard?.latestRequests ?: emptyList()) { request ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dpCompat)) {
                    Text("Request #${request.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
                    Text("Customer: ${request.customerName ?: "-"}")
                    Text("Type: ${request.requestType ?: "-"}")
                    Text("Status: ${request.status ?: "-"}")
                    Text("Created: ${request.createdAt ?: "-"}")
                }
            }
        }
    }
}

@Composable
private fun OrdersScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onOrderClick: (Long) -> Unit
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
                Text("V2 Orders", style = MaterialTheme.typography.headlineSmall)
                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }

        commonStateItems(state)

        if (state.orders.isEmpty() && !state.loading) {
            item {
                Text("No orders loaded.")
            }
        }

        items(state.orders) { order ->
            OrderCard(order = order, onOrderClick = onOrderClick)
        }
    }
}

@Composable
private fun OrderCard(
    order: CustomerAppOrder,
    onOrderClick: (Long) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text("Order #${order.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
            Text("Customer: ${order.customerName ?: "-"}")
            Text("Fulfillment: ${order.fulfillmentType ?: "-"}")
            Text("Status: ${order.orderStatus ?: order.status ?: "-"}")
            Text("Delivery: ${order.deliveryStatus ?: "-"}")
            Text("Pickup: ${order.pickupStatus ?: "-"}")
            Text("Total: ${order.confirmedTotal ?: order.total ?: "-"}")
            Text("Created: ${order.createdAt ?: "-"}")

            if (order.id != null) {
                Spacer(modifier = Modifier.height(8.dpCompat))
                Button(onClick = { onOrderClick(order.id) }) {
                    Text("Open detail")
                }
            }
        }
    }
}

@Composable
private fun OrderDetailScreen(
    state: AdminUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit
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
                OutlinedButton(onClick = onBack) {
                    Text("Back")
                }
                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }

        commonStateItems(state)

        if (order == null && !state.loading) {
            item {
                Text("Order not loaded.")
            }
        }

        if (order != null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dpCompat)) {
                        Text("Order #${order.id ?: "-"}", style = MaterialTheme.typography.headlineSmall)
                        Text("Customer: ${order.customerName ?: "-"}")
                        Text("Phone: ${order.customerPhone ?: "-"}")
                        Text("Fulfillment: ${order.fulfillmentType ?: "-"}")
                        Text("Order status: ${order.orderStatus ?: order.status ?: "-"}")
                        Text("Delivery status: ${order.deliveryStatus ?: "-"}")
                        Text("Pickup status: ${order.pickupStatus ?: "-"}")
                        Text("Total: ${order.confirmedTotal ?: order.total ?: "-"}")
                        Text("Created: ${order.createdAt ?: "-"}")
                    }
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dpCompat)) {
                        Text("Delivery", style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(8.dpCompat))
                        Text("Address: ${order.deliveryAddress ?: "-"}")
                        Text("Map: ${order.deliveryMapsUrl ?: "-"}")
                    }
                }
            }

            item {
                Text("Items", style = MaterialTheme.typography.titleMedium)
            }

            items(order.items) { item ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dpCompat)) {
                        Text(item.productName ?: "Item", style = MaterialTheme.typography.titleSmall)
                        Text("Quantity: ${item.quantity ?: "-"}")
                        Text("Unit: ${item.unitPrice ?: "-"}")
                        Text("Total: ${item.total ?: "-"}")
                        Text("Status: ${item.status ?: "-"}")
                    }
                }
            }
        }
    }
}


@Composable
private fun ProductsScreen(
    state: AdminUiState,
    onRefresh: () -> Unit
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
                Text("Products", style = MaterialTheme.typography.headlineSmall)
                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }

        commonStateItems(state)

        item {
            Text("Categories (${state.categories.size})", style = MaterialTheme.typography.titleMedium)
        }

        if (state.categories.isEmpty() && !state.loading) {
            item {
                Text("No categories loaded.")
            }
        }

        items(state.categories) { category ->
            CategoryCard(category = category)
        }

        item {
            Text("Products (${state.products.size})", style = MaterialTheme.typography.titleMedium)
        }

        if (state.products.isEmpty() && !state.loading) {
            item {
                Text("No products loaded.")
            }
        }

        items(state.products) { product ->
            ProductCard(product = product)
        }
    }
}

@Composable
private fun CategoryCard(category: ProductCategory) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text(category.name ?: "Category", style = MaterialTheme.typography.titleSmall)
            Text("ID: ${category.id ?: "-"}")
            Text("Description: ${category.description ?: "-"}")
            Text("Status: ${category.status ?: "-"}")
            Text("Active: ${category.isActive ?: "-"}")
            Text("Sort: ${category.sortOrder ?: "-"}")
            Text("Created: ${category.createdAt ?: "-"}")
        }
    }
}

@Composable
private fun ProductCard(product: Product) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text(product.name ?: "Product", style = MaterialTheme.typography.titleSmall)
            Text("ID: ${product.id ?: "-"}")
            Text("Category: ${product.categoryName ?: product.categoryId ?: "-"}")
            Text("Price: ${product.price ?: "-"} ${product.currency ?: ""}")
            Text("Unit: ${product.unit ?: "-"}")
            Text("Status: ${product.status ?: "-"}")
            Text("Active: ${product.isActive ?: "-"}")
            Text("Description: ${product.description ?: "-"}")
            Text("Created: ${product.createdAt ?: "-"}")
        }
    }
}


@Composable
private fun CustomersScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onCustomerClick: (Long) -> Unit
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
                Text("Customers (${state.customers.size})", style = MaterialTheme.typography.headlineSmall)
                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }

        commonStateItems(state)

        if (state.customers.isEmpty() && !state.loading) {
            item {
                Text("No customers loaded.")
            }
        }

        items(state.customers) { customer ->
            CustomerCard(customer = customer, onCustomerClick = onCustomerClick)
        }
    }
}

@Composable
private fun CustomerCard(
    customer: Customer,
    onCustomerClick: (Long) -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text(customer.fullName ?: customer.name ?: "Customer", style = MaterialTheme.typography.titleSmall)
            Text("ID: ${customer.id ?: "-"}")
            Text("Username: ${customer.username ?: "-"}")
            Text("Telegram: ${customer.telegramUserId ?: "-"}")
            Text("Language: ${customer.preferredLanguage ?: customer.language ?: "-"}")
            Text("Blocked: ${customer.isBlocked ?: "-"}")
            Text("Last seen: ${customer.lastSeenAt ?: "-"}")

            if (customer.id != null) {
                Spacer(modifier = Modifier.height(8.dpCompat))
                Button(onClick = { onCustomerClick(customer.id) }) {
                    Text("Open detail")
                }
            }
        }
    }
}

@Composable
private fun CustomerDetailScreen(
    state: AdminUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onReplyChange: (String) -> Unit,
    onSendReply: () -> Unit
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
                OutlinedButton(onClick = onBack) {
                    Text("Back")
                }
                OutlinedButton(onClick = onRefresh) {
                    Text("Refresh")
                }
            }
        }

        commonStateItems(state)

        if (!state.lastReplySent.isNullOrBlank()) {
            item {
                Text(state.lastReplySent)
            }
        }

        if (customer == null && !state.loading) {
            item {
                Text("Customer not loaded.")
            }
        }

        if (customer != null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dpCompat)) {
                        Text(customer.fullName ?: customer.name ?: "Customer", style = MaterialTheme.typography.headlineSmall)
                        Text("ID: ${customer.id ?: "-"}")
                        Text("Username: ${customer.username ?: "-"}")
                        Text("Telegram: ${customer.telegramUserId ?: "-"}")
                        Text("Language: ${customer.preferredLanguage ?: customer.language ?: "-"}")
                        Text("Blocked: ${customer.isBlocked ?: "-"}")
                        Text("Last seen: ${customer.lastSeenAt ?: "-"}")
                        Text("Created: ${customer.createdAt ?: "-"}")
                    }
                }
            }

            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dpCompat)) {
                        Text("Reply", style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(8.dpCompat))
                        OutlinedTextField(
                            modifier = Modifier.fillMaxWidth(),
                            value = state.replyMessage,
                            onValueChange = onReplyChange,
                            label = { Text("Message") },
                            minLines = 3
                        )
                        Spacer(modifier = Modifier.height(8.dpCompat))
                        Button(
                            enabled = !state.loading && state.replyMessage.isNotBlank(),
                            onClick = onSendReply
                        ) {
                            Text("Send reply")
                        }
                    }
                }
            }

            item {
                Text("Messages (${state.customerMessages.size})", style = MaterialTheme.typography.titleMedium)
            }

            items(state.customerMessages) { message ->
                CustomerMessageCard(message = message)
            }

            item {
                Text("Requests (${state.customerRequests.size})", style = MaterialTheme.typography.titleMedium)
            }

            items(state.customerRequests) { request ->
                CustomerRequestCard(request = request)
            }

            item {
                Text("Locations (${state.customerLocations.size})", style = MaterialTheme.typography.titleMedium)
            }

            items(state.customerLocations) { location ->
                CustomerLocationCard(location = location)
            }
        }
    }
}

@Composable
private fun CustomerMessageCard(message: CustomerMessage) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text("${message.direction ?: "-"} / ${message.messageType ?: "-"}", style = MaterialTheme.typography.titleSmall)
            Text(message.message ?: message.text ?: message.body ?: "-")
            Text("Language: ${message.language ?: "-"}")
            Text("Created: ${message.createdAt ?: "-"}")
        }
    }
}

@Composable
private fun CustomerRequestCard(request: CustomerRequest) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text("Request #${request.id ?: "-"}", style = MaterialTheme.typography.titleSmall)
            Text("Type: ${request.requestType ?: "-"}")
            Text("Item: ${request.itemName ?: "-"}")
            Text("Status: ${request.status ?: "-"}")
            Text("Created: ${request.createdAt ?: "-"}")
        }
    }
}

@Composable
private fun CustomerLocationCard(location: CustomerLocation) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dpCompat)) {
            Text(location.label ?: "Location", style = MaterialTheme.typography.titleSmall)
            Text("Address: ${location.address ?: "-"}")
            Text("Map: ${location.mapsUrl ?: location.googleMapsUrl ?: "-"}")
            Text("Created: ${location.createdAt ?: "-"}")
        }
    }
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
