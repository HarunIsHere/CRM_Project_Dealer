import Foundation

public enum CustomerApiClient {
    private static let customerApiBaseURL = "https://crm.ayartuerk.me/api/v1"


    public static func getCustomerProducts() async throws -> [CustomerProduct] {
        let response: CustomerCatalogResponse = try await fetch(URL(string: "\(customerApiBaseURL)/public/catalog")!)
        return response.catalog.products
    }

    public static func getCustomerCart(sessionToken: String) async throws -> CustomerCartResponse {
        var components = URLComponents(string: "\(customerApiBaseURL)/customer/cart")!
        components.queryItems = [URLQueryItem(name: "session_token", value: sessionToken)]
        return try await fetch(components.url!)
    }

    public static func addCustomerCartItem(sessionToken: String, productId: Int, quantity: Int) async throws -> CustomerCartResponse {
        let request = AddCartItemRequest(sessionToken: sessionToken, productId: productId, quantity: quantity)
        return try await post(URL(string: "\(customerApiBaseURL)/customer/cart/items")!, body: request)
    }

    public static func checkoutCustomerCart(
        sessionToken: String,
        customerName: String,
        phone: String,
        deliveryAddress: String,
        paymentMethodCode: String,
        notes: String
    ) async throws -> CustomerOrderResponse {
        let request = CheckoutRequest(
            sessionToken: sessionToken,
            customerName: customerName,
            phone: phone,
            deliveryAddress: deliveryAddress,
            paymentMethodCode: paymentMethodCode,
            notes: notes
        )
        return try await post(URL(string: "\(customerApiBaseURL)/customer/checkout")!, body: request)
    }

    public static func getCustomerOrders(sessionToken: String) async throws -> CustomerOrdersResponse {
        var components = URLComponents(string: "\(customerApiBaseURL)/customer/orders")!
        components.queryItems = [URLQueryItem(name: "session_token", value: sessionToken)]
        return try await fetch(components.url!)
    }

    private static func fetch<ResponseBody: Decodable>(_ url: URL) async throws -> ResponseBody {
        let (data, response) = try await URLSession.shared.data(from: url)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }

    private static func post<RequestBody: Encodable, ResponseBody: Decodable>(_ url: URL, body: RequestBody) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }
}
