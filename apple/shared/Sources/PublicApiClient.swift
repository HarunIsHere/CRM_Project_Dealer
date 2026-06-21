import Foundation

public enum PublicApiClient {
    public static func getPublicShops() async throws -> [Shop] {
        let response: ShopsResponse = try await fetch(ApiConfig.publicShopsURL)
        return response.shops
    }

    public static func getPublicPaymentMethods() async throws -> [PaymentMethod] {
        let response: PaymentMethodsResponse = try await fetch(ApiConfig.publicPaymentMethodsURL)
        return response.paymentMethods
    }

    private static func fetch<T: Decodable>(_ url: URL) async throws -> T {
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(T.self, from: data)
    }
}
