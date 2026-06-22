package com.horizend.crmdelivery.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.horizend.crmdelivery.shared.api.CustomerApiClient
import com.horizend.crmdelivery.shared.api.CustomerCart
import com.horizend.crmdelivery.shared.api.CustomerOrderSummary
import com.horizend.crmdelivery.shared.api.CustomerProduct
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                CustomerShopScreen()
            }
        }
    }
}

@Composable
private fun CustomerShopScreen() {
    val scope = rememberCoroutineScope()
    val sessionToken = remember { "android_customer_${System.currentTimeMillis()}" }

    var products by remember { mutableStateOf<List<CustomerProduct>>(emptyList()) }
    var orders by remember { mutableStateOf<List<CustomerOrderSummary>>(emptyList()) }
    var cart by remember { mutableStateOf<CustomerCart?>(null) }
    var message by remember { mutableStateOf("Loading shop...") }
    var loading by remember { mutableStateOf(false) }

    fun refreshCart() {
        scope.launch {
            runCatching {
                CustomerApiClient.getCustomerCart(sessionToken).cart
            }.onSuccess {
                cart = it
            }.onFailure {
                message = "Cart error: ${it.message}"
            }
        }
    }

    fun refreshOrders() {
        scope.launch {
            runCatching {
                CustomerApiClient.getCustomerOrders(sessionToken).orders
            }.onSuccess {
                orders = it
            }.onFailure {
                message = "Orders error: ${it.message}"
            }
        }
    }

    LaunchedEffect(Unit) {
        loading = true
        runCatching {
            products = CustomerApiClient.getCustomerProducts()
            cart = CustomerApiClient.getCustomerCart(sessionToken).cart
            orders = CustomerApiClient.getCustomerOrders(sessionToken).orders
        }.onSuccess {
            message = "Shop loaded"
        }.onFailure {
            message = "Loading failed: ${it.message}"
        }
        loading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Customer Shop", style = MaterialTheme.typography.headlineMedium)
        Text(message)
        Text("Session: $sessionToken")

        if (loading) {
            CircularProgressIndicator()
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Cart", style = MaterialTheme.typography.titleLarge)
                Text("Items: ${cart?.itemCount ?: 0}")
                Text("Total: ${cart?.totalAmount ?: 0} ${cart?.currency ?: "EUR"}")

                cart?.items.orEmpty().forEach { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("${item.quantity} × ${item.productName}")
                        Text("${item.lineTotal} ${cart?.currency ?: "EUR"}")
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    enabled = !loading && cart?.items?.isNotEmpty() == true,
                    onClick = {
                        scope.launch {
                            loading = true
                            runCatching {
                                CustomerApiClient.checkoutCustomerCart(
                                    sessionToken = sessionToken,
                                    customerName = "Android Demo Customer",
                                    phone = "+49123456789",
                                    deliveryAddress = "Berlin",
                                    paymentMethodCode = "cash_delivery",
                                    notes = "Android checkout from catalog"
                                )
                            }.onSuccess {
                                message = "Order created: ${it.order.publicOrderCode}"
                                refreshCart()
                                refreshOrders()
                            }.onFailure {
                                message = "Checkout failed: ${it.message}"
                            }
                            loading = false
                        }
                    }
                ) {
                    Text("Checkout")
                }
            }
        }

        Text("Orders", style = MaterialTheme.typography.titleLarge)

        if (orders.isEmpty()) {
            Text("No orders yet")
        } else {
            orders.forEach { order ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(order.publicOrderCode, style = MaterialTheme.typography.titleMedium)
                        Text("Status: ${order.status}")
                        Text("Total: ${order.totalAmount} ${order.currency}")
                    }
                }
            }
        }

        Text("Products", style = MaterialTheme.typography.titleLarge)

        products.forEach { product ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(product.name, style = MaterialTheme.typography.titleMedium)
                    Text("${product.price} EUR")
                    product.categoryName?.takeIf { it.isNotBlank() }?.let { categoryName ->
                        Text(categoryName)
                    }
                    product.shopName?.takeIf { it.isNotBlank() }?.let { shopName ->
                        Text("Shop: $shopName")
                    }

                    OutlinedButton(
                        enabled = !loading,
                        onClick = {
                            scope.launch {
                                loading = true
                                runCatching {
                                    CustomerApiClient.addCustomerCartItem(
                                        sessionToken = sessionToken,
                                        productId = product.id,
                                        quantity = 1
                                    )
                                }.onSuccess {
                                    cart = it.cart
                                    message = "Added: ${product.name}"
                                }.onFailure {
                                    message = "Add failed: ${it.message}"
                                }
                                loading = false
                            }
                        }
                    ) {
                        Text("Add to cart")
                    }
                }
            }
        }
    }
}
