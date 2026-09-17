import SwiftUI
import Shared
import Foundation
import Security

@main
struct CustomerApp: App {
    var body: some Scene {
        WindowGroup {
            CustomerShopView()
        }
    }
}

struct CustomerShopView: View {
    private let sessionStore: CustomerSessionStore
    private let deviceId: String

    @State private var selectedLanguage = defaultSupportedLanguage()
    @State private var accessToken: String?
    @State private var verifiedAccessToken: String?
    @State private var products: [CustomerProduct] = []
    @State private var orders: [CustomerOrderSummary] = []
    @State private var cart: CustomerCart?
    @State private var message = ""
    @State private var isLoading = false

    init() {
        let store = CustomerSessionStore()
        sessionStore = store
        deviceId = store.installationId()
        _accessToken = State(initialValue: store.readAccessToken())
        _verifiedAccessToken = State(initialValue: nil)
    }

    var body: some View {
        NavigationStack {
            List {
                Section(t("language_section")) {
                    Picker(t("language"), selection: $selectedLanguage) {
                        ForEach(SupportedLanguage.allCases) { language in
                            Text(language.label).tag(language)
                        }
                    }
                    .pickerStyle(.menu)
                }

                Section(t("status_section")) {
                    Text(message.isEmpty ? t("loading_shop") : message)
                    Text("\(t("device")): \(deviceId)")
                }

                Section(t("cart_section")) {
                    Text("\(t("status")): \(cart?.orderStatus ?? t("in_progress_status"))")
                    Text("\(t("items")): \(cart?.itemCount ?? 0)")
                    Text("\(t("total")): \(cart?.totalFormatted ?? "\(cart?.totalAmount ?? 0) \(cart?.currency ?? "EUR")")")

                    ForEach(cart?.items ?? []) { item in
                        HStack {
                            Text("\(item.quantity) × \(item.productName ?? item.name ?? t("product_fallback"))")
                            Spacer()
                            Text("\(item.lineTotal ?? ((item.unitPrice ?? item.priceSnapshot ?? 0) * item.quantity)) \(cart?.currency ?? "EUR")")
                        }
                    }

                    Button(t("checkout")) {
                        Task {
                            await checkout()
                        }
                    }
                    .disabled((cart?.items.isEmpty ?? true) || isLoading)
                }

                Section(t("orders_section")) {
                    if orders.isEmpty {
                        Text(t("no_orders_yet"))
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(orders) { order in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(orderTitle(order))
                                    .font(.headline)

                                Text("\(t("status")): \(order.orderStatusLabel ?? order.orderStatus ?? order.status ?? t("active_status"))")

                                if let location = order.deliveryLocationLabel, !location.isEmpty {
                                    Text("\(t("location")): \(location)")
                                }

                                if let history = order.statusHistory?.first {
                                    Text("\(t("last_update")): \(history.newStatus)" + ((history.note?.isEmpty == false) ? " · \(history.note ?? "")" : ""))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Text("\(t("total")): \(order.totalFormatted ?? "\(order.totalAmount) \(order.currency ?? "EUR")")")
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section(t("products_section")) {
                    ForEach(products) { product in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(product.name)
                                .font(.headline)
                            Text("\(product.price) EUR")

                            if let categoryName = product.categoryName, !categoryName.isEmpty {
                                Text(categoryName)
                                    .foregroundStyle(.secondary)
                            }

                            if let shopName = product.shopName, !shopName.isEmpty {
                                Text("\(t("shop")): \(shopName)")
                                    .foregroundStyle(.secondary)
                            }

                            Button(t("add_to_cart")) {
                                Task {
                                    await addToCart(product)
                                }
                            }
                            .disabled(isLoading)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle(t("customer_shop_title"))
            .task(id: selectedLanguage) {
                await load()
            }
            .overlay {
                if isLoading {
                    ProgressView()
                }
            }
        }
        .environment(\.layoutDirection, selectedLanguage.isRightToLeft ? .rightToLeft : .leftToRight)
    }

    private func t(_ key: String) -> String {
        CustomerSharedTexts.text(selectedLanguage.rawValue, key)
    }

    private func template(_ key: String, _ replacements: [String: String]) -> String {
        replacements.reduce(t(key)) { partial, pair in
            partial.replacingOccurrences(of: "{\(pair.key)}", with: pair.value)
        }
    }

    private func orderTitle(_ order: CustomerOrderSummary) -> String {
        order.publicOrderCode?.takeIfNotBlank ?? template("order_number_template", ["id": String(order.id)])
    }

    private func ensureSession() async throws -> String {
        if let accessToken, !accessToken.isEmpty {
            if verifiedAccessToken == accessToken {
                return accessToken
            }

            if let response = try? await CustomerApiClient
                .verifyCustomerSession(accessToken: accessToken),
               response.valid {
                verifiedAccessToken = accessToken
                return accessToken
            }

            sessionStore.clearAccessToken()
            self.accessToken = nil
            verifiedAccessToken = nil
        }

        let response = try await CustomerApiClient.startCustomerSession(
            deviceId: deviceId,
            platform: "ios-customer-app",
            appVersion: "0.1.0",
            fullName: "iOS Demo Customer",
            username: "ios_customer",
            language: selectedLanguage.rawValue
        )

        accessToken = response.session.accessToken
        verifiedAccessToken = response.session.accessToken
        try sessionStore.writeAccessToken(response.session.accessToken)
        return response.session.accessToken
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let token = try await ensureSession()
            products = try await CustomerApiClient.getCustomerProducts()
            let cartResponse = try await CustomerApiClient.getCustomerCart(accessToken: token)
            cart = cartResponse.cart
            let ordersResponse = try await CustomerApiClient.getCustomerOrders(accessToken: token)
            orders = ordersResponse.orders
            message = t("shop_loaded")
        } catch {
            message = template("loading_failed_template", ["error": error.localizedDescription])
        }
    }

    private func refreshOrdersAndCart() async throws {
        let token = try await ensureSession()
        let cartResponse = try await CustomerApiClient.getCustomerCart(accessToken: token)
        cart = cartResponse.cart
        let ordersResponse = try await CustomerApiClient.getCustomerOrders(accessToken: token)
        orders = ordersResponse.orders
    }

    private func addToCart(_ product: CustomerProduct) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let token = try await ensureSession()
            let response = try await CustomerApiClient.addCustomerCartItem(
                accessToken: token,
                productId: product.id,
                quantity: 1
            )
            cart = response.cart
            try await refreshOrdersAndCart()
            message = template("added_template", ["name": product.name])
        } catch {
            message = template("add_failed_template", ["error": error.localizedDescription])
        }
    }

    private func checkout() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let token = try await ensureSession()
            let response = try await CustomerApiClient.checkoutCustomerCart(
                accessToken: token,
                deliveryAddress: "Berlin",
                notes: "iOS checkout from catalog"
            )
            let orderLabel = response.order?.publicOrderCode?.takeIfNotBlank
                ?? response.order.map { template("order_number_template", ["id": String($0.id)]) }
                ?? t("active_order_fallback")
            message = template("checkout_submitted_template", ["order": orderLabel])
            try await refreshOrdersAndCart()
        } catch {
            message = template("checkout_failed_template", ["error": error.localizedDescription])
        }
    }
}

private func defaultSupportedLanguage() -> SupportedLanguage {
    let preferredCode = Locale.preferredLanguages
        .compactMap { Locale(identifier: $0).language.languageCode?.identifier }
        .first

    return SupportedLanguage(rawValue: preferredCode ?? "en") ?? .english
}

private extension String {
    var takeIfNotBlank: String? {
        isEmpty ? nil : self
    }
}

private struct CustomerSessionStore {
    private let service = "com.horizend.crmdelivery.customer.session"
    private let account = "customer_access_token"
    private let installationIdKey = "customer_installation_id"

    func installationId() -> String {
        if let existing = UserDefaults.standard.string(
            forKey: installationIdKey
        ), !existing.isEmpty {
            return existing
        }

        let value = "ios_customer_\(UUID().uuidString.lowercased())"
        UserDefaults.standard.set(value, forKey: installationIdKey)
        return value
    }

    func readAccessToken() -> String? {
        var result: CFTypeRef?
        let status = SecItemCopyMatching(
            baseQuery([
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]) as CFDictionary,
            &result
        )

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty else {
            return nil
        }

        return value
    }

    func writeAccessToken(_ accessToken: String) throws {
        guard !accessToken.isEmpty,
              let data = accessToken.data(using: .utf8) else {
            throw SessionStoreError.invalidToken
        }

        clearAccessToken()

        let status = SecItemAdd(
            baseQuery([
                kSecValueData as String: data,
                kSecAttrAccessible as String:
                    kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            ]) as CFDictionary,
            nil
        )

        guard status == errSecSuccess else {
            throw SessionStoreError.keychain(status)
        }
    }

    func clearAccessToken() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private func baseQuery(
        _ additions: [String: Any] = [:]
    ) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        additions.forEach { query[$0.key] = $0.value }
        return query
    }
}

private enum SessionStoreError: Error {
    case invalidToken
    case keychain(OSStatus)
}
