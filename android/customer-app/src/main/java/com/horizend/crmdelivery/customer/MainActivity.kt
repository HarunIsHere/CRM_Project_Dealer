package com.horizend.crmdelivery.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.runtime.CompositionLocalProvider
import com.horizend.crmdelivery.shared.api.CustomerApiClient
import com.horizend.crmdelivery.shared.api.CustomerCart
import com.horizend.crmdelivery.shared.api.CustomerOrderSummary
import com.horizend.crmdelivery.shared.api.CustomerProduct
import com.horizend.crmdelivery.shared.i18n.CustomerSharedTexts
import com.horizend.crmdelivery.shared.i18n.SupportedLanguages
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
    val deviceId = remember { "android_customer_${System.currentTimeMillis()}" }

    var selectedLanguage by remember { mutableStateOf(SupportedLanguages.resolve(null)) }
    var accessToken by remember(selectedLanguage) { mutableStateOf<String?>(null) }
    var products by remember { mutableStateOf<List<CustomerProduct>>(emptyList()) }
    var orders by remember { mutableStateOf<List<CustomerOrderSummary>>(emptyList()) }
    var cart by remember { mutableStateOf<CustomerCart?>(null) }
    var message by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }

    fun t(key: String): String = CustomerSharedTexts.text(selectedLanguage, key)

    fun template(key: String, vararg replacements: Pair<String, String>): String {
        var text = t(key)
        replacements.forEach { (placeholder, value) ->
            text = text.replace("{$placeholder}", value)
        }
        return text
    }

    suspend fun ensureSession(): String {
        accessToken?.takeIf { it.isNotBlank() }?.let { return it }

        val response = CustomerApiClient.startCustomerSession(
            deviceId = deviceId,
            platform = "android-customer-app",
            appVersion = "0.1.0",
            fullName = "Android Demo Customer",
            username = "android_customer",
            language = selectedLanguage
        )

        accessToken = response.session.accessToken
        return response.session.accessToken
    }

    fun orderTitle(order: CustomerOrderSummary): String =
        order.publicOrderCode.takeIf { it.isNotBlank() }
            ?: template("order_number_template", "id" to order.id.toString())

    fun orderStatus(order: CustomerOrderSummary): String =
        order.orderStatusLabel?.takeIf { it.isNotBlank() }
            ?: order.orderStatus?.takeIf { it.isNotBlank() }
            ?: order.status.takeIf { it.isNotBlank() }
            ?: t("active_status")

    fun itemName(itemName: String?, fallback: String?): String =
        itemName?.takeIf { it.isNotBlank() }
            ?: fallback?.takeIf { it.isNotBlank() }
            ?: t("product_fallback")

    fun itemLineTotal(lineTotal: Int?, unitPrice: Int?, quantity: Int): Int =
        lineTotal ?: ((unitPrice ?: 0) * quantity)

    fun refreshCart() {
        scope.launch {
            runCatching {
                val token = ensureSession()
                CustomerApiClient.getCustomerCart(token).cart
            }.onSuccess {
                cart = it
            }.onFailure {
                message = template("cart_error_template", "error" to (it.message ?: it.localizedMessage ?: "unknown"))
            }
        }
    }

    fun refreshOrders() {
        scope.launch {
            runCatching {
                val token = ensureSession()
                CustomerApiClient.getCustomerOrders(token).orders
            }.onSuccess {
                orders = it
            }.onFailure {
                message = template("orders_error_template", "error" to (it.message ?: it.localizedMessage ?: "unknown"))
            }
        }
    }

    LaunchedEffect(selectedLanguage) {
        loading = true
        accessToken = null
        runCatching {
            val token = ensureSession()
            products = CustomerApiClient.getCustomerProducts()
            cart = CustomerApiClient.getCustomerCart(token).cart
            orders = CustomerApiClient.getCustomerOrders(token).orders
        }.onSuccess {
            message = t("shop_loaded")
        }.onFailure {
            message = template("loading_failed_template", "error" to (it.message ?: it.localizedMessage ?: "unknown"))
        }
        loading = false
    }

    CompositionLocalProvider(
        LocalLayoutDirection provides if (SupportedLanguages.isRightToLeft(selectedLanguage)) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(t("customer_shop_title"), style = MaterialTheme.typography.headlineMedium)
            LanguagePicker(
                selectedLanguage = selectedLanguage,
                label = t("language"),
                onLanguageSelected = { selectedLanguage = it }
            )
            Text(if (message.isBlank()) t("loading_shop") else message)
            Text("${t("device")}: $deviceId")

            if (loading) {
                CircularProgressIndicator()
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(t("cart_section"), style = MaterialTheme.typography.titleLarge)
                    Text("${t("status")}: ${cart?.orderStatus ?: t("in_progress_status")}")
                    Text("${t("items")}: ${cart?.itemCount ?: 0}")
                    Text("${t("total")}: ${cart?.totalFormatted ?: "${cart?.totalAmount ?: 0} ${cart?.currency ?: "EUR"}"}")

                    cart?.items.orEmpty().forEach { item ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("${item.quantity} × ${itemName(item.productName, item.name)}")
                            Text("${itemLineTotal(item.lineTotal, item.unitPrice ?: item.priceSnapshot, item.quantity)} ${cart?.currency ?: "EUR"}")
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        enabled = !loading && cart?.items?.isNotEmpty() == true,
                        onClick = {
                            scope.launch {
                                loading = true
                                runCatching {
                                    val token = ensureSession()
                                    CustomerApiClient.checkoutCustomerCart(
                                        accessToken = token,
                                        deliveryAddress = "Berlin",
                                        notes = "Android checkout from catalog"
                                    )
                                }.onSuccess {
                                    val orderLabel = it.order?.let { order ->
                                        order.publicOrderCode.takeIf { code -> code.isNotBlank() }
                                            ?: template("order_number_template", "id" to order.id.toString())
                                    } ?: t("active_order_fallback")
                                    message = template("checkout_submitted_template", "order" to orderLabel)
                                    refreshCart()
                                    refreshOrders()
                                }.onFailure {
                                    message = template("checkout_failed_template", "error" to (it.message ?: it.localizedMessage ?: "unknown"))
                                }
                                loading = false
                            }
                        }
                    ) {
                        Text(t("checkout"))
                    }
                }
            }

            Text(t("orders_section"), style = MaterialTheme.typography.titleLarge)

            if (orders.isEmpty()) {
                Text(t("no_orders_yet"))
            } else {
                orders.forEach { order ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(orderTitle(order), style = MaterialTheme.typography.titleMedium)
                            Text("${t("status")}: ${orderStatus(order)}")
                            order.deliveryLocationLabel?.takeIf { it.isNotBlank() }?.let { location ->
                                Text("${t("location")}: $location")
                            }
                            order.statusHistory.firstOrNull()?.let { history ->
                                val noteText = history.note?.takeIf { it.isNotBlank() }?.let { note -> " · $note" } ?: ""
                                Text("${t("last_update")}: ${history.newStatus}$noteText")
                            }
                            order.updatedAt?.takeIf { it.isNotBlank() }?.let { updatedAt ->
                                Text("${t("updated")}: $updatedAt")
                            }
                            Text("${t("total")}: ${order.totalFormatted ?: "${order.totalAmount} ${order.currency}"}")
                        }
                    }
                }
            }

            Text(t("products_section"), style = MaterialTheme.typography.titleLarge)

            products.forEach { product ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(product.name, style = MaterialTheme.typography.titleMedium)
                        Text("${product.price} EUR")
                        product.categoryName?.takeIf { it.isNotBlank() }?.let { categoryName ->
                            Text(categoryName)
                        }
                        product.shopName?.takeIf { it.isNotBlank() }?.let { shopName ->
                            Text("${t("shop")}: $shopName")
                        }

                        OutlinedButton(
                            enabled = !loading,
                            onClick = {
                                scope.launch {
                                    loading = true
                                    runCatching {
                                        val token = ensureSession()
                                        CustomerApiClient.addCustomerCartItem(
                                            accessToken = token,
                                            productId = product.id,
                                            quantity = 1
                                        )
                                    }.onSuccess {
                                        cart = it.cart
                                        message = template("added_template", "name" to product.name)
                                        refreshOrders()
                                    }.onFailure {
                                        message = template("add_failed_template", "error" to (it.message ?: it.localizedMessage ?: "unknown"))
                                    }
                                    loading = false
                                }
                            }
                        ) {
                            Text(t("add_to_cart"))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LanguagePicker(
    selectedLanguage: String,
    label: String,
    onLanguageSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, style = MaterialTheme.typography.titleMedium)
        Box {
            OutlinedButton(onClick = { expanded = true }) {
                Text(SupportedLanguages.label(selectedLanguage))
            }
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                SupportedLanguages.all.forEach { language ->
                    DropdownMenuItem(
                        text = { Text(language.nativeLabel) },
                        onClick = {
                            onLanguageSelected(language.code)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
