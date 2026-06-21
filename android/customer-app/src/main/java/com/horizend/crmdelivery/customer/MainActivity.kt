package com.horizend.crmdelivery.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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

            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(modifier = Modifier.padding(24.dp)) {
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
                                result = "Loading..."
                                Thread {
                                    val output = runCatching {
                                        val shops = PublicApiClient.getPublicShops()
                                        val paymentMethods = PublicApiClient.getPublicPaymentMethods()

                                        buildString {
                                            appendLine("Shops:")
                                            shops.forEach { shop ->
                                                appendLine("- ${shop.name} (${shop.slug})")
                                                appendLine("  Payments: ${shop.paymentMethods.joinToString { it.name }}")
                                            }

                                            appendLine()
                                            appendLine("Payment methods:")
                                            paymentMethods.forEach { method ->
                                                appendLine("- ${method.name} (${method.code})")
                                            }
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
                            Text("Load shops and payment methods")
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(text = result)
                    }
                }
            }
        }
    }
}
