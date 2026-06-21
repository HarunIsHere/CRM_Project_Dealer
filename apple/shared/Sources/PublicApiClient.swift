import Foundation

public enum PublicApiClient {
    public static func getPublicShops() async throws -> [Shop] {
        let response: PublicShopsResponse = try await fetch(ApiConfig.publicShopsURL)
        return response.shops
    }

    public static func getPublicPaymentMethods() async throws -> [PaymentMethod] {
        let response: PublicPaymentMethodsResponse = try await fetch(ApiConfig.publicPaymentMethodsURL)
        return response.paymentMethods
    }

    public static func getPublicCatalog() async throws -> PublicCatalog {
        let response: PublicCatalogResponse = try await fetch(ApiConfig.publicCatalogURL)
        return response.catalog
    }

    public static func getPublicMeetingPoints() async throws -> [MeetingPoint] {
        let response: PublicMeetingPointsResponse = try await fetch(ApiConfig.publicMeetingPointsURL)
        return response.meetingPoints
    }

    private static func fetch<T: Decodable>(_ url: URL) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: url)

        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }


    public static func getCustomerCart(sessionToken: String) async throws -> CustomerCartResponse {
        var components = URLComponents(url: ApiConfig.customerCartURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "session_token", value: sessionToken)]
        return try await fetch(components.url!)
    }

    public static func addCustomerCartItem(sessionToken: String, productId: Int, quantity: Int) async throws -> CustomerCartResponse {
        let request = AddCartItemRequest(sessionToken: sessionToken, productId: productId, quantity: quantity)
        return try await post(ApiConfig.customerCartItemsURL, body: request)
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
        return try await post(ApiConfig.customerCheckoutURL, body: request)
    }

    public static func getCustomerOrders(sessionToken: String) async throws -> CustomerOrdersResponse {
        var components = URLComponents(url: ApiConfig.customerOrdersURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "session_token", value: sessionToken)]
        return try await fetch(components.url!)
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
