package com.horizend.crmdelivery.shared.api

data class CatalogProduct(
    val id: Long,
    val name: String,
    val price: Long,
    val priceFormatted: String,
    val isActive: Boolean,
    val categoryId: Long?,
    val categoryName: String,
    val aliases: List<String>
)

data class CatalogCategory(
    val id: Long,
    val name: String
)

data class MeetingPoint(
    val id: Long,
    val name: String,
    val address: String,
    val googleMapsLink: String,
    val isDefault: Boolean,
    val isActive: Boolean
)

data class FulfillmentOptions(
    val allowPreferredCustomerLocation: Boolean,
    val allowNewCustomerLocation: Boolean,
    val allowCustomerPickup: Boolean
)

data class PublicCatalog(
    val products: List<CatalogProduct>,
    val categories: List<CatalogCategory>,
    val meetingPoints: List<MeetingPoint>,
    val fulfillment: FulfillmentOptions,
    val allowedDeliveryCities: List<String>,
    val languages: List<String>
)
