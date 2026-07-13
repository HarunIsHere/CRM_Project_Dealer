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

@Composable
fun AdminApp(viewModel: AdminViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            when {
                state.loading && !state.loggedIn -> LoadingScreen()
                state.loggedIn -> DashboardScreen(
                    state = state,
                    onRefresh = viewModel::loadDashboard,
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
private fun DashboardScreen(
    state: AdminUiState,
    onRefresh: () -> Unit,
    onLogout: () -> Unit
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

                Row(horizontalArrangement = Arrangement.spacedBy(8.dpCompat)) {
                    OutlinedButton(onClick = onRefresh) {
                        Text("Refresh")
                    }
                    OutlinedButton(onClick = onLogout) {
                        Text("Logout")
                    }
                }
            }
        }

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
