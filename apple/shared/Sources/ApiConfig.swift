import Foundation

public enum ApiConfig {
    public static let baseURL = URL(string: "https://crm.ayartuerk.me")!
    public static let apiV1URL = URL(string: "https://crm.ayartuerk.me/api/v1")!

    public static let publicShopsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/shops")!
    public static let publicPaymentMethodsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/payment-methods")!
}
