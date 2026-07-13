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
import me.ayartuerk.crmadmin.api.CustomerAppOrder

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
                    onRefreshDashboard = viewModel::loadDashboard,
                    onRefreshOrders = viewModel::loadOrders,
                    onOrderClick = viewModel::showOrderDetail,
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
    onRefreshDashboard: () -> Unit,
    onRefreshOrders: () -> Unit,
    onOrderClick: (Long) -> Unit,
    onLogout: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        TopNav(
            selected = state.screen,
            onDashboard = onDashboard,
            onOrders = onOrders,
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
        }
    }
}

@Composable
private fun TopNav(
    selected: AdminScreen,
    onDashboard: () -> Unit,
    onOrders: () -> Unit,
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
