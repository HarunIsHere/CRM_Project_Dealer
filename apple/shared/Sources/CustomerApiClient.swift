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

    public static func getCustomerCart(accessToken: String) async throws -> CustomerCartResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/cart")!, accessToken: accessToken)
    }

    public static func addCustomerCartItem(accessToken: String, productId: Int, quantity: Int) async throws -> CustomerCartResponse {
        let request = AddCartItemRequest(productId: productId, quantity: quantity)
        return try await post(URL(string: "\(customerApiBaseURL)/customer/cart/items")!, body: request, accessToken: accessToken)
    }

    public static func checkoutCustomerCart(accessToken: String, deliveryAddress: String, notes: String) async throws -> CustomerOrderResponse {
        let request = CheckoutRequest(address: deliveryAddress, locationLabel: deliveryAddress, deliveryNote: notes)
        return try await post(URL(string: "\(customerApiBaseURL)/customer/checkout/address")!, body: request, accessToken: accessToken)
    }

    public static func getCustomerOrders(accessToken: String) async throws -> CustomerOrdersResponse {
        try await fetch(URL(string: "\(customerApiBaseURL)/customer/orders")!, accessToken: accessToken)
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
