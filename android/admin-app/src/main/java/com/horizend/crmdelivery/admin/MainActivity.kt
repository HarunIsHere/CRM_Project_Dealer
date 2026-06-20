package com.horizend.crmdelivery.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.horizend.crmdelivery.shared.ApiConfig

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AdminApp()
        }
    }
}

@Composable
private fun AdminApp() {
    MaterialTheme {
        Scaffold { padding ->
            Text(
                text = "CRM Delivery Admin\n${ApiConfig.API_V1}",
                modifier = Modifier.padding(padding)
            )
        }
    }
}
