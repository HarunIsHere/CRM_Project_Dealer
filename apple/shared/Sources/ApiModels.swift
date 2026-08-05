import Foundation

public struct BasicApiResponse: Codable, Sendable {
    public let ok: Bool
    public let error: ApiErrorEnvelope?
}

public struct ApiErrorEnvelope: Codable, Sendable {
    public let code: String?
    public let message: String?
}

public struct AdminIdentityRecoveryStartRequest: Codable, Sendable {
    public let username: String
}

public struct AdminIdentityRecoveryVerifyRequest: Codable, Sendable {
    public let token: String?
    public let username: String?
    public let manualCode: String?
    public let sessionTransport: String
    public let clientPlatform: String
    public let appVersion: String?

    public init(
        token: String? = nil,
        username: String? = nil,
        manualCode: String? = nil,
        sessionTransport: String = "cookie",
        clientPlatform: String = "admin_web",
        appVersion: String? = nil
    ) {
        self.token = token
        self.username = username
        self.manualCode = manualCode
        self.sessionTransport = sessionTransport
        self.clientPlatform = clientPlatform
        self.appVersion = appVersion
    }

    enum CodingKeys: String, CodingKey {
        case token
        case username
        case manualCode = "manual_code"
        case sessionTransport = "session_transport"
        case clientPlatform = "client_platform"
        case appVersion = "app_version"
    }
}

public struct AdminIdentityRecoveryPasswordRequest: Codable, Sendable {
    public let newPassword: String
    public let confirmPassword: String?

    public init(newPassword: String, confirmPassword: String? = nil) {
        self.newPassword = newPassword
        self.confirmPassword = confirmPassword
    }

    enum CodingKeys: String, CodingKey {
        case newPassword = "new_password"
        case confirmPassword = "confirm_password"
    }
}

public struct AdminIdentityRecoveryStartResponse: Codable, Sendable {
    public let ok: Bool
    public let requestId: String?
    public let accepted: Bool?
    public let error: ApiErrorEnvelope?

    enum CodingKeys: String, CodingKey {
        case ok
        case requestId = "request_id"
        case accepted
        case error
    }
}

public struct AdminIdentityRecoveryVerifyResponse: Codable, Sendable {
    public let ok: Bool
    public let requestId: String?
    public let recovery: AdminIdentityRecoveryState?
    public let session: AdminIdentityRecoverySession?
    public let error: ApiErrorEnvelope?

    enum CodingKeys: String, CodingKey {
        case ok
        case requestId = "request_id"
        case recovery
        case session
        case error
    }
}

public struct AdminIdentityRecoveryPasswordResponse: Codable, Sendable {
    public let ok: Bool
    public let requestId: String?
    public let passwordChanged: Bool?
    public let loginRequired: Bool?
    public let error: ApiErrorEnvelope?

    enum CodingKeys: String, CodingKey {
        case ok
        case requestId = "request_id"
        case passwordChanged = "password_changed"
        case loginRequired = "login_required"
        case error
    }
}

public struct AdminIdentityRecoveryState: Codable, Sendable {
    public let stage: String?
    public let emailVerified: Bool?
    public let passwordSet: Bool?

    enum CodingKeys: String, CodingKey {
        case stage
        case emailVerified = "email_verified"
        case passwordSet = "password_set"
    }
}

public struct AdminIdentityRecoverySession: Codable, Sendable {
    public let id: String?
    public let scope: String?
    public let transport: String?
    public let expiresAt: String?
    public let csrfToken: String?

    enum CodingKeys: String, CodingKey {
        case id
        case scope
        case transport
        case expiresAt = "expires_at"
        case csrfToken = "csrf_token"
    }
}

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

public struct Shop: Codable, Identifiable, Hashable, Sendable {
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

public struct PaymentMethod: Codable, Identifiable, Hashable, Sendable {
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

public struct Product: Codable, Identifiable, Hashable, Sendable {
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

public struct ProductCategory: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let name: String
}


public struct PublicMeetingPointsResponse: Codable {
    public let meetingPoints: [MeetingPoint]

    enum CodingKeys: String, CodingKey {
        case meetingPoints = "meeting_points"
    }
}

public struct MeetingPoint: Codable, Identifiable, Hashable, Sendable {
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



public struct CustomerSession: Codable, Sendable {
    public let accessToken: String
    public let tokenType: String?
    public let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case expiresAt = "expires_at"
    }
}

public struct CustomerProfile: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let fullName: String?
    public let username: String?
    public let language: String?
    public let preferredLanguage: String?
    public let conversationState: String?
    public let createdAt: String?
    public let lastSeenAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName = "full_name"
        case username
        case language
        case preferredLanguage = "preferred_language"
        case conversationState = "conversation_state"
        case createdAt = "created_at"
        case lastSeenAt = "last_seen_at"
    }
}

public struct CustomerSessionVerifyResponse: Codable, Sendable {
    public let ok: Bool
    public let valid: Bool
    public let expiresAt: String?
    public let customer: CustomerProfile?

    enum CodingKeys: String, CodingKey {
        case ok
        case valid
        case expiresAt = "expires_at"
        case customer
    }
}

public struct CustomerLogoutResponse: Codable, Sendable {
    public let ok: Bool
    public let loggedOut: Bool?
    public let revokedCount: Int?

    enum CodingKeys: String, CodingKey {
        case ok
        case loggedOut = "logged_out"
        case revokedCount = "revoked_count"
    }
}

public struct CustomerProfileResponse: Codable, Sendable {
    public let ok: Bool
    public let customer: CustomerProfile
}

public struct CustomerProfileUpdateRequest: Codable, Sendable {
    public let fullName: String
    public let username: String
    public let preferredLanguage: String

    public init(fullName: String, username: String = "", preferredLanguage: String = "en") {
        self.fullName = fullName
        self.username = username
        self.preferredLanguage = preferredLanguage
    }

    enum CodingKeys: String, CodingKey {
        case fullName = "full_name"
        case username
        case preferredLanguage = "preferred_language"
    }
}

public struct EmptyRequest: Codable, Sendable {
    public init() {}
}


public struct CustomerSessionStartResponse: Codable, Sendable {
    public let ok: Bool
    public let session: CustomerSession
    public let customer: CustomerProfile?
}

public struct CustomerSession: Codable, Sendable {
    public let accessToken: String
    public let expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case expiresAt = "expires_at"
    }
}

public struct CustomerLocation: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let customerId: Int?
    public let sessionToken: String?
    public let requestType: String?
    public let label: String
    public let address: String?
    public let description: String?
    public let latitude: Double?
    public let longitude: Double?
    public let googleMapsLink: String?
    public let source: String?
    public let isPreferred: Bool?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case customerId = "customer_id"
        case sessionToken = "session_token"
        case requestType = "request_type"
        case label
        case address
        case description
        case latitude
        case longitude
        case googleMapsLink = "google_maps_link"
        case source
        case isPreferred = "is_preferred"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

public struct CustomerLocationsResponse: Codable, Sendable {
    public let ok: Bool
    public let locations: [CustomerLocation]
    public let count: Int?
}

public struct CustomerLocationResponse: Codable, Sendable {
    public let ok: Bool
    public let location: CustomerLocation
    public let locations: [CustomerLocation]?
    public let count: Int?
}

public struct CreateCustomerLocationRequest: Codable, Sendable {
    public let label: String
    public let address: String
    public let googleMapsLink: String
    public let latitude: String
    public let longitude: String
    public let saveAsPreferred: Bool

    public init(
        label: String = "",
        address: String = "",
        googleMapsLink: String = "",
        latitude: String = "",
        longitude: String = "",
        saveAsPreferred: Bool = false
    ) {
        self.label = label
        self.address = address
        self.googleMapsLink = googleMapsLink
        self.latitude = latitude
        self.longitude = longitude
        self.saveAsPreferred = saveAsPreferred
    }

    enum CodingKeys: String, CodingKey {
        case label
        case address
        case googleMapsLink = "google_maps_link"
        case latitude
        case longitude
        case saveAsPreferred = "save_as_preferred"
    }
}

public struct CustomerCartResponse: Codable, Sendable {
    public let ok: Bool
    public let cart: CustomerCart
}

public struct CustomerCart: Codable, Hashable, Sendable {
    public let id: Int?
    public let status: String?
    public let orderStatus: String?
    public let deliveryLocationLabel: String?
    public let deliveryGoogleMapsLink: String?
    public let deliveryNote: String?
    public let adminStatusNote: String?
    public let sessionToken: String?
    public let items: [CustomerCartItem]
    public let totalAmount: Int
    public let totalFormatted: String?
    public let currency: String?
    public let itemCount: Int
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case orderStatus = "order_status"
        case deliveryLocationLabel = "delivery_location_label"
        case deliveryGoogleMapsLink = "delivery_google_maps_link"
        case deliveryNote = "delivery_note"
        case adminStatusNote = "admin_status_note"
        case sessionToken = "session_token"
        case items
        case totalAmount = "total_amount"
        case totalFormatted = "total_formatted"
        case currency
        case itemCount = "item_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

public struct CustomerCartItem: Codable, Identifiable, Hashable, Sendable {
    public var id: Int { itemId ?? productId ?? 0 }
    public let itemId: Int?
    public let productId: Int?
    public let itemType: String?
    public let quantity: Int
    public let productName: String?
    public let name: String?
    public let unitPrice: Int?
    public let priceSnapshot: Int?
    public let shopId: Int?
    public let shopName: String?
    public let lineTotal: Int?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case itemId = "id"
        case productId = "product_id"
        case itemType = "item_type"
        case quantity
        case productName = "product_name"
        case name
        case unitPrice = "unit_price"
        case priceSnapshot = "price_snapshot"
        case shopId = "shop_id"
        case shopName = "shop_name"
        case lineTotal = "line_total"
        case createdAt = "created_at"
    }
}

public struct AddCartItemRequest: Codable {
    public let productId: Int
    public let quantity: Int

    public init(productId: Int, quantity: Int) {
        self.productId = productId
        self.quantity = quantity
    }

    enum CodingKeys: String, CodingKey {
        case productId = "product_id"
        case quantity
    }
}

public struct UpdateCartItemRequest: Codable, Sendable {
    public let quantity: Int

    public init(quantity: Int) {
        self.quantity = quantity
    }
}


public struct CheckoutRequest: Codable, Sendable {
    public let savedLocationId: Int?
    public let usePreferredLocation: Bool
    public let address: String
    public let locationLabel: String
    public let googleMapsLink: String
    public let latitude: String
    public let longitude: String
    public let deliveryNote: String
    public let saveAsPreferred: Bool

    public init(
        savedLocationId: Int? = nil,
        usePreferredLocation: Bool = false,
        address: String = "",
        locationLabel: String = "",
        googleMapsLink: String = "",
        latitude: String = "",
        longitude: String = "",
        deliveryNote: String,
        saveAsPreferred: Bool = false
    ) {
        self.savedLocationId = savedLocationId
        self.usePreferredLocation = usePreferredLocation
        self.address = address
        self.locationLabel = locationLabel
        self.googleMapsLink = googleMapsLink
        self.latitude = latitude
        self.longitude = longitude
        self.deliveryNote = deliveryNote
        self.saveAsPreferred = saveAsPreferred
    }

    enum CodingKeys: String, CodingKey {
        case savedLocationId = "saved_location_id"
        case usePreferredLocation = "use_preferred_location"
        case address
        case locationLabel = "location_label"
        case googleMapsLink = "google_maps_link"
        case latitude
        case longitude
        case deliveryNote = "delivery_note"
        case saveAsPreferred = "save_as_preferred"
    }
}

public struct CustomerOrderResponse: Codable, Sendable {
    public let ok: Bool
    public let order: CustomerOrder?
    public let cart: CustomerCart?
}

public struct CustomerOrdersResponse: Codable, Sendable {
    public let ok: Bool
    public let orders: [CustomerOrderSummary]
}

public struct CustomerOrderStatusHistory: Codable, Identifiable, Hashable, Sendable {
    public let id: Int?
    public let orderId: Int?
    public let previousStatus: String?
    public let newStatus: String
    public let changedByAdminUsername: String?
    public let note: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case orderId = "order_id"
        case previousStatus = "previous_status"
        case newStatus = "new_status"
        case changedByAdminUsername = "changed_by_admin_username"
        case note
        case createdAt = "created_at"
    }
}

public struct CustomerOrderSummary: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let publicOrderCode: String?
    public let status: String?
    public let orderStatus: String?
    public let orderStatusLabel: String?
    public let deliveryLocationLabel: String?
    public let deliveryGoogleMapsLink: String?
    public let deliveryNote: String?
    public let adminStatusNote: String?
    public let totalAmount: Int
    public let totalFormatted: String?
    public let currency: String?
    public let itemCount: Int?
    public let customerName: String?
    public let phone: String?
    public let deliveryAddress: String?
    public let paymentMethodCode: String?
    public let notes: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let statusHistory: [CustomerOrderStatusHistory]?

    enum CodingKeys: String, CodingKey {
        case id
        case publicOrderCode = "public_order_code"
        case status
        case orderStatus = "order_status"
        case orderStatusLabel = "order_status_label"
        case deliveryLocationLabel = "delivery_location_label"
        case deliveryGoogleMapsLink = "delivery_google_maps_link"
        case deliveryNote = "delivery_note"
        case adminStatusNote = "admin_status_note"
        case totalAmount = "total_amount"
        case totalFormatted = "total_formatted"
        case currency
        case itemCount = "item_count"
        case customerName = "customer_name"
        case phone
        case deliveryAddress = "delivery_address"
        case paymentMethodCode = "payment_method_code"
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case statusHistory = "status_history"
    }
}

public struct CustomerOrder: Codable, Identifiable, Hashable, Sendable {
    public let id: Int
    public let publicOrderCode: String?
    public let sessionToken: String?
    public let status: String?
    public let orderStatus: String?
    public let orderStatusLabel: String?
    public let deliveryLocationLabel: String?
    public let deliveryGoogleMapsLink: String?
    public let deliveryNote: String?
    public let adminStatusNote: String?
    public let totalAmount: Int
    public let totalFormatted: String?
    public let currency: String?
    public let itemCount: Int?
    public let customerName: String?
    public let phone: String?
    public let deliveryAddress: String?
    public let paymentMethodCode: String?
    public let notes: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let statusHistory: [CustomerOrderStatusHistory]?
    public let items: [CustomerOrderItem]

    enum CodingKeys: String, CodingKey {
        case id
        case publicOrderCode = "public_order_code"
        case sessionToken = "session_token"
        case status
        case orderStatus = "order_status"
        case orderStatusLabel = "order_status_label"
        case deliveryLocationLabel = "delivery_location_label"
        case deliveryGoogleMapsLink = "delivery_google_maps_link"
        case deliveryNote = "delivery_note"
        case adminStatusNote = "admin_status_note"
        case totalAmount = "total_amount"
        case totalFormatted = "total_formatted"
        case currency
        case itemCount = "item_count"
        case customerName = "customer_name"
        case phone
        case deliveryAddress = "delivery_address"
        case paymentMethodCode = "payment_method_code"
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case statusHistory = "status_history"
        case items
    }
}

public struct CustomerOrderItem: Codable, Identifiable, Hashable, Sendable {
    public var id: Int { itemId ?? productId ?? 0 }
    public let itemId: Int?
    public let customerOrderId: Int?
    public let productId: Int?
    public let productName: String?
    public let name: String?
    public let shopId: Int?
    public let quantity: Int
    public let unitPrice: Int?
    public let priceSnapshot: Int?
    public let lineTotal: Int?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case itemId = "id"
        case customerOrderId = "customer_order_id"
        case productId = "product_id"
        case productName = "product_name"
        case name
        case shopId = "shop_id"
        case quantity
        case unitPrice = "unit_price"
        case priceSnapshot = "price_snapshot"
        case lineTotal = "line_total"
        case createdAt = "created_at"
    }
}


public struct CheckoutPickupRequest: Codable, Sendable {
    public let notes: String
    public let paymentMethodCode: String

    public init(notes: String = "", paymentMethodCode: String = "") {
        self.notes = notes
        self.paymentMethodCode = paymentMethodCode
    }

    enum CodingKeys: String, CodingKey {
        case notes
        case paymentMethodCode = "payment_method_code"
    }
}
