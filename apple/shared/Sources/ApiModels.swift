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


public struct CustomerCartResponse: Codable {
    public let ok: Bool
    public let cart: CustomerCart
}

public struct CustomerCart: Codable, Hashable {
    public let sessionToken: String
    public let items: [CustomerCartItem]
    public let totalAmount: Int
    public let currency: String
    public let itemCount: Int

    enum CodingKeys: String, CodingKey {
        case sessionToken = "session_token"
        case items
        case totalAmount = "total_amount"
        case currency
        case itemCount = "item_count"
    }
}

public struct CustomerCartItem: Codable, Identifiable, Hashable {
    public var id: Int { productId }
    public let productId: Int
    public let quantity: Int
    public let productName: String
    public let unitPrice: Int
    public let shopId: Int?
    public let shopName: String?
    public let lineTotal: Int

    enum CodingKeys: String, CodingKey {
        case productId = "product_id"
        case quantity
        case productName = "product_name"
        case unitPrice = "unit_price"
        case shopId = "shop_id"
        case shopName = "shop_name"
        case lineTotal = "line_total"
    }
}

public struct AddCartItemRequest: Codable {
    public let sessionToken: String
    public let productId: Int
    public let quantity: Int

    public init(sessionToken: String, productId: Int, quantity: Int) {
        self.sessionToken = sessionToken
        self.productId = productId
        self.quantity = quantity
    }

    enum CodingKeys: String, CodingKey {
        case sessionToken = "session_token"
        case productId = "product_id"
        case quantity
    }
}

public struct CheckoutRequest: Codable {
    public let sessionToken: String
    public let customerName: String
    public let phone: String
    public let deliveryAddress: String
    public let paymentMethodCode: String
    public let notes: String

    public init(sessionToken: String, customerName: String, phone: String, deliveryAddress: String, paymentMethodCode: String, notes: String) {
        self.sessionToken = sessionToken
        self.customerName = customerName
        self.phone = phone
        self.deliveryAddress = deliveryAddress
        self.paymentMethodCode = paymentMethodCode
        self.notes = notes
    }

    enum CodingKeys: String, CodingKey {
        case sessionToken = "session_token"
        case customerName = "customer_name"
        case phone
        case deliveryAddress = "delivery_address"
        case paymentMethodCode = "payment_method_code"
        case notes
    }
}

public struct CustomerOrderResponse: Codable {
    public let ok: Bool
    public let order: CustomerOrder
}

public struct CustomerOrdersResponse: Codable {
    public let ok: Bool
    public let orders: [CustomerOrderSummary]
}

public struct CustomerOrderSummary: Codable, Identifiable, Hashable {
    public let id: Int
    public let publicOrderCode: String
    public let status: String
    public let totalAmount: Int
    public let currency: String

    enum CodingKeys: String, CodingKey {
        case id
        case publicOrderCode = "public_order_code"
        case status
        case totalAmount = "total_amount"
        case currency
    }
}

public struct CustomerOrder: Codable, Identifiable, Hashable {
    public let id: Int
    public let publicOrderCode: String
    public let sessionToken: String
    public let status: String
    public let totalAmount: Int
    public let currency: String
    public let items: [CustomerOrderItem]

    enum CodingKeys: String, CodingKey {
        case id
        case publicOrderCode = "public_order_code"
        case sessionToken = "session_token"
        case status
        case totalAmount = "total_amount"
        case currency
        case items
    }
}

public struct CustomerOrderItem: Codable, Identifiable, Hashable {
    public let id: Int
    public let customerOrderId: Int
    public let productId: Int
    public let productName: String
    public let shopId: Int?
    public let quantity: Int
    public let unitPrice: Int
    public let lineTotal: Int

    enum CodingKeys: String, CodingKey {
        case id
        case customerOrderId = "customer_order_id"
        case productId = "product_id"
        case productName = "product_name"
        case shopId = "shop_id"
        case quantity
        case unitPrice = "unit_price"
        case lineTotal = "line_total"
    }
}

