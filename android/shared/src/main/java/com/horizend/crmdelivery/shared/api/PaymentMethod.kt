package com.horizend.crmdelivery.shared.api

data class PaymentMethod(
    val code: String,
    val name: String,
    val isActive: Boolean = true
)
