package com.horizend.crmdelivery.shared.api

data class Shop(
    val id: Long,
    val name: String,
    val slug: String,
    val description: String,
    val address: String,
    val googleMapsLink: String,
    val phone: String,
    val isActive: Boolean,
    val paymentMethods: List<PaymentMethod>
)
