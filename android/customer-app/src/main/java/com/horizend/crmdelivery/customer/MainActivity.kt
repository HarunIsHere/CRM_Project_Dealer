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
import com.horizend.crmdelivery.shared.api.CustomerCart
import com.horizend.crmdelivery.shared.api.Product
import com.horizend.crmdelivery.shared.api.PublicApiClient
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                CustomerCatalogScreen()
            }
        }
    }
}

@Composable
private fun CustomerCatalogScreen() {
    val scope = rememberCoroutineScope()
    val sessionToken = remember { "android_customer_${System.currentTimeMillis()}" }

    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var cart by remember { mutableStateOf<CustomerCart?>(null) }
    var message by remember { mutableStateOf("Loading catalog...") }
    var loading by remember { mutableStateOf(true) }

    fun refreshCart() {
        scope.launch {
            runCatching {
                PublicApiClient.getCustomerCart(sessionToken).cart
            }.onSuccess {
                cart = it
            }.onFailure {
                message = "Cart error: ${it.message}"
            }
        }
    }

    LaunchedEffect(Unit) {
        runCatching {
            val catalog = PublicApiClient.getPublicCatalog().catalog
            products = catalog.products
            PublicApiClient.getCustomerCart(sessionToken).cart
        }.onSuccess {
            cart = it
            message = "Catalog loaded"
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

        if (loading) {
            CircularProgressIndicator()
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text("Cart", style = MaterialTheme.typography.titleLarge)
                Text("Session: $sessionToken")
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
                    enabled = (cart?.items?.isNotEmpty() == true),
                    onClick = {
                        scope.launch {
                            loading = true
                            runCatching {
                                PublicApiClient.checkoutCustomerCart(
                                    sessionToken = sessionToken,
                                    customerName = "Android Demo Customer",
                                    phone = "+49123456789",
                                    deliveryAddress = "Berlin",
                                    paymentMethodCode = "cash_delivery",
                                    notes = "Android smoke checkout"
                                )
                            }.onSuccess {
                                message = "Order created: ${it.order.publicOrderCode}"
                                refreshCart()
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

        Text("Products", style = MaterialTheme.typography.titleLarge)

        products.forEach { product ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(product.name, style = MaterialTheme.typography.titleMedium)
                    Text("${product.price} EUR")
                    Text(product.categoryName ?: "")

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                loading = true
                                runCatching {
                                    PublicApiClient.addCustomerCartItem(
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
