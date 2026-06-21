package com.horizend.crmdelivery.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.horizend.crmdelivery.shared.ApiConfig
import com.horizend.crmdelivery.shared.api.PublicApiClient

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var result by remember { mutableStateOf("Ready.") }
            val scrollState = rememberScrollState()

            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .padding(24.dp)
                            .verticalScroll(scrollState)
                    ) {
                        Text(
                            text = "CRM Delivery Customer",
                            style = MaterialTheme.typography.headlineSmall
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(text = ApiConfig.API_V1)

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                result = "Loading catalog..."
                                Thread {
                                    val output = runCatching {
                                        val catalog = PublicApiClient.getPublicCatalog()
                                        val paymentMethods = PublicApiClient.getPublicPaymentMethods()

                                        buildString {
                                            appendLine("Products:")
                                            catalog.products.forEach { product ->
                                                val category = product.categoryName.ifBlank { "Uncategorized" }
                                                appendLine("- ${product.name} · ${product.priceFormatted} · $category")
                                            }

                                            appendLine()
                                            appendLine("Categories:")
                                            catalog.categories.forEach { category ->
                                                appendLine("- ${category.name}")
                                            }

                                            appendLine()
                                            appendLine("Meeting points:")
                                            catalog.meetingPoints.forEach { point ->
                                                appendLine("- ${point.name}")
                                                appendLine("  ${point.googleMapsLink}")
                                            }

                                            appendLine()
                                            appendLine("Payment methods:")
                                            paymentMethods.forEach { method ->
                                                appendLine("- ${method.name} (${method.code})")
                                            }

                                            appendLine()
                                            appendLine("Delivery cities:")
                                            appendLine(catalog.allowedDeliveryCities.joinToString(", "))
                                        }
                                    }.getOrElse { error ->
                                        error.message ?: "Unknown error"
                                    }

                                    runOnUiThread {
                                        result = output
                                    }
                                }.start()
                            }
                        ) {
                            Text("Load catalog")
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(text = result)
                    }
                }
            }
        }
    }
}
