import Foundation

public enum ApiConfig {
    public static let baseURL = URL(string: "https://crm.ayartuerk.me")!
    public static let apiV1URL = URL(string: "https://crm.ayartuerk.me/api/v1")!

    public static let publicShopsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/shops")!
    public static let publicCatalogURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/catalog")!
    public static let publicMeetingPointsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/meeting-points")!
    public static let publicPaymentMethodsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/payment-methods")!
}
