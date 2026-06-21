import Foundation

public struct PublicShopsResponse: Codable {
    public let shops: [Shop]
}

public struct PublicPaymentMethodsResponse: Codable {
    public let paymentMethods: [PaymentMethod]

    enum CodingKeys: String, CodingKey {
        case paymentMethods = "payment_methods"
    }
}

public struct PublicCatalogResponse: Codable {
    public let catalog: PublicCatalog
}

public struct PublicCatalog: Codable {
    public let products: [Product]
    public let categories: [ProductCategory]
    public let meetingPoints: [MeetingPoint]
    public let fulfillment: FulfillmentOptions
    public let allowedDeliveryCities: [String]
    public let languages: [String]
    public let app: AppInfo

    enum CodingKeys: String, CodingKey {
        case products
        case categories
        case meetingPoints = "meeting_points"
        case fulfillment
        case allowedDeliveryCities = "allowed_delivery_cities"
        case languages
        case app
    }
}

public struct Shop: Codable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let slug: String
    public let description: String?
    public let address: String?
    public let googleMapsLink: String?
    public let phone: String?
    public let isActive: Bool
    public let paymentMethods: [PaymentMethod]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case description
        case address
        case googleMapsLink = "google_maps_link"
        case phone
        case isActive = "is_active"
        case paymentMethods = "payment_methods"
    }
}

public struct PaymentMethod: Codable, Identifiable, Hashable {
    public var id: String { code }

    public let code: String
    public let name: String
    public let isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case code
        case name
        case isActive = "is_active"
    }
}

public struct Product: Codable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let price: Double
    public let priceFormatted: String
    public let isActive: Bool
    public let categoryId: Int?
    public let categoryName: String
    public let aliases: [String]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case price
        case priceFormatted = "price_formatted"
        case isActive = "is_active"
        case categoryId = "category_id"
        case categoryName = "category_name"
        case aliases
    }
}

public struct ProductCategory: Codable, Identifiable, Hashable {
    public let id: Int
    public let name: String
}


public struct PublicMeetingPointsResponse: Codable {
    public let meetingPoints: [MeetingPoint]

    enum CodingKeys: String, CodingKey {
        case meetingPoints = "meeting_points"
    }
}

public struct MeetingPoint: Codable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let address: String
    public let googleMapsLink: String
    public let isDefault: Bool
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case address
        case googleMapsLink = "google_maps_link"
        case isDefault = "is_default"
        case isActive = "is_active"
    }
}

public struct FulfillmentOptions: Codable, Hashable {
    public let allowPreferredCustomerLocation: Bool
    public let allowNewCustomerLocation: Bool
    public let allowCustomerPickup: Bool

    enum CodingKeys: String, CodingKey {
        case allowPreferredCustomerLocation = "allow_preferred_customer_location"
        case allowNewCustomerLocation = "allow_new_customer_location"
        case allowCustomerPickup = "allow_customer_pickup"
    }
}

public struct AppInfo: Codable, Hashable {
    public let name: String
    public let apiVersion: String

    enum CodingKeys: String, CodingKey {
        case name
        case apiVersion = "api_version"
    }
}
