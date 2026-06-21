import Foundation

public struct CustomerCatalogResponse: Codable {
    public let ok: Bool?
    public let catalog: CustomerCatalog
}

public struct CustomerCatalog: Codable {
    public let products: [CustomerProduct]
}

public struct CustomerProduct: Codable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let price: Int
    public let categoryId: Int?
    public let categoryName: String?
    public let shopId: Int?
    public let shopName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case price
        case categoryId = "category_id"
        case categoryName = "category_name"
        case shopId = "shop_id"
        case shopName = "shop_name"
    }
}
