import Foundation

public enum ApiConfig {
    public static let baseURL = URL(string: "https://crm.ayartuerk.me")!
    public static let apiV1URL = URL(string: "https://crm.ayartuerk.me/api/v1")!

    public static let publicShopsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/shops")!
    public static let publicCatalogURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/catalog")!
    public static let publicMeetingPointsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/meeting-points")!
    public static let publicPaymentMethodsURL = URL(string: "https://crm.ayartuerk.me/api/v1/public/payment-methods")!

    public static let customerCartURL = URL(string: "https://crm.ayartuerk.me/api/v1/customer/cart")!
    public static let customerCartItemsURL = URL(string: "https://crm.ayartuerk.me/api/v1/customer/cart/items")!
    public static let customerCheckoutURL = URL(string: "https://crm.ayartuerk.me/api/v1/customer/checkout")!
    public static let customerOrdersURL = URL(string: "https://crm.ayartuerk.me/api/v1/customer/orders")!
}
