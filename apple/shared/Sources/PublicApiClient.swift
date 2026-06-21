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
}
