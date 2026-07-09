import Foundation

public enum CustomerApiClient {
    private static let customerApiBaseURL = "https://crm.ayartuerk.me/api/v1"

    public static func getCustomerProducts() async throws -> [CustomerProduct] {
        let response: CustomerCatalogResponse = try await fetch(URL(string: "\(customerApiBaseURL)/public/catalog")!)
        return response.catalog.products
    }

    public static func startCustomerSession(
        deviceId: String,
        platform: String,
        appVersion: String,
        fullName: String,
        username: String = "",
        language: String = "en"
    ) async throws -> CustomerSessionStartResponse {
        let request = CustomerSessionStartRequest(
            deviceId: deviceId,
            platform: platform,
            appVersion: appVersion,
            fullName: fullName,
            username: username,
            language: language
        )
        return try await post(URL(string: "\(customerApiBaseURL)/customer/session/start")!, body: request)
    }


    public static func verifyCustomerSession(accessToken: String) async throws -> CustomerSessionVerifyResponse {
        try await post(URL(string: "\(customerApiBaseURL)/customer/session/verify")!, body: EmptyRequest(), accessToken: accessToken)
    }

    public static func logoutCustomerSession(accessToken: String) async throws -> CustomerLogoutResponse {
        try await post(URL(string: "\(customerApiBaseURL)/customer/session/logout")!, body: EmptyRequest(), accessToken: accessToken)
    }

    public static func getCustomerProfile(accessToken: String) async throws -> CustomerProfileResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/me")!, accessToken: accessToken)
    }

    public static func updateCustomerProfile(
        accessToken: String,
        fullName: String,
        username: String = "",
        preferredLanguage: String = "en"
    ) async throws -> CustomerProfileResponse {
        let request = CustomerProfileUpdateRequest(
            fullName: fullName,
            username: username,
            preferredLanguage: preferredLanguage
        )
        return try await patch(URL(string: "\(customerApiBaseURL)/customer/me")!, body: request, accessToken: accessToken)
    }

    public static func getCustomerLocations(accessToken: String) async throws -> CustomerLocationsResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/locations")!, accessToken: accessToken)
    }

    public static func createCustomerLocation(
        accessToken: String,
        label: String = "",
        address: String = "",
        googleMapsLink: String = "",
        latitude: String = "",
        longitude: String = "",
        saveAsPreferred: Bool = false
    ) async throws -> CustomerLocationResponse {
        let request = CreateCustomerLocationRequest(
            label: label,
            address: address,
            googleMapsLink: googleMapsLink,
            latitude: latitude,
            longitude: longitude,
            saveAsPreferred: saveAsPreferred
        )

        return try await post(URL(string: "\(customerApiBaseURL)/customer/locations")!, body: request, accessToken: accessToken)
    }

    public static func getCustomerCart(accessToken: String) async throws -> CustomerCartResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/cart")!, accessToken: accessToken)
    }

    public static func addCustomerCartItem(accessToken: String, productId: Int, quantity: Int) async throws -> CustomerCartResponse {
        let request = AddCartItemRequest(productId: productId, quantity: quantity)
        return try await post(URL(string: "\(customerApiBaseURL)/customer/cart/items")!, body: request, accessToken: accessToken)
    }

    public static func updateCustomerCartItem(accessToken: String, itemId: Int, quantity: Int) async throws -> CustomerCartResponse {
        let request = UpdateCartItemRequest(quantity: quantity)
        return try await patch(URL(string: "\(customerApiBaseURL)/customer/cart/items/\(itemId)")!, body: request, accessToken: accessToken)
    }

    public static func removeCustomerCartItem(accessToken: String, itemId: Int) async throws -> CustomerCartResponse {
        try await delete(URL(string: "\(customerApiBaseURL)/customer/cart/items/\(itemId)")!, accessToken: accessToken)
    }

    public static func checkoutCustomerCart(
        accessToken: String,
        deliveryAddress: String = "",
        notes: String,
        savedLocationId: Int? = nil,
        usePreferredLocation: Bool = false,
        locationLabel: String? = nil,
        googleMapsLink: String = "",
        latitude: String = "",
        longitude: String = "",
        saveAsPreferred: Bool = false
    ) async throws -> CustomerOrderResponse {
        let request = CheckoutRequest(
            savedLocationId: savedLocationId,
            usePreferredLocation: usePreferredLocation,
            address: deliveryAddress,
            locationLabel: locationLabel ?? deliveryAddress,
            googleMapsLink: googleMapsLink,
            latitude: latitude,
            longitude: longitude,
            deliveryNote: notes,
            saveAsPreferred: saveAsPreferred
        )
        return try await post(URL(string: "\(customerApiBaseURL)/customer/checkout/address")!, body: request, accessToken: accessToken)
    }

    public static func checkoutCustomerPickup(
        accessToken: String,
        notes: String = "",
        paymentMethodCode: String = ""
    ) async throws -> CustomerOrderResponse {
        let request = CheckoutPickupRequest(notes: notes, paymentMethodCode: paymentMethodCode)
        return try await post(URL(string: "\(customerApiBaseURL)/customer/checkout/pickup")!, body: request, accessToken: accessToken)
    }

    public static func getCustomerOrders(accessToken: String) async throws -> CustomerOrdersResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/orders")!, accessToken: accessToken)
    }

    public static func getCustomerOrderDetail(accessToken: String, orderId: Int) async throws -> CustomerOrderResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/orders/\(orderId)")!, accessToken: accessToken)
    }

    private static func fetch<ResponseBody: Decodable>(_ url: URL, accessToken: String? = nil) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }

    private static func patch<RequestBody: Encodable, ResponseBody: Decodable>(_ url: URL, body: RequestBody, accessToken: String? = nil) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }

    private static func delete<ResponseBody: Decodable>(_ url: URL, accessToken: String? = nil) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }

    private static func post<RequestBody: Encodable, ResponseBody: Decodable>(_ url: URL, body: RequestBody, accessToken: String? = nil) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }
}
