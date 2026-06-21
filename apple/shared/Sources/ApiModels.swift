import Foundation

public struct PaymentMethod: Codable, Identifiable, Hashable {
    public var id: String { code }

    public let code: String
    public let name: String
    public let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case code
        case name
        case isActive = "is_active"
    }
}

public struct Shop: Codable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let slug: String
    public let description: String
    public let address: String
    public let googleMapsLink: String
    public let phone: String
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

public struct ShopsResponse: Codable {
    public let shops: [Shop]
}

public struct PaymentMethodsResponse: Codable {
    public let paymentMethods: [PaymentMethod]

    enum CodingKeys: String, CodingKey {
        case paymentMethods = "payment_methods"
    }
}
