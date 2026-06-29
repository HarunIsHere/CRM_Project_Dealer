import SwiftUI
import Shared

@main
struct CustomerApp: App {
    var body: some Scene {
        WindowGroup {
            CustomerShopView()
        }
    }
}

struct CustomerShopView: View {
    private let deviceId = "ios_customer_\(Int(Date().timeIntervalSince1970))"

    @State private var accessToken: String?
    @State private var products: [CustomerProduct] = []
    @State private var orders: [CustomerOrderSummary] = []
    @State private var cart: CustomerCart?
    @State private var message = "Loading shop..."
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            List {
                Section("Status") {
                    Text(message)
                    Text("Device: \(deviceId)")
                }

                Section("Cart") {
                    Text("Status: \(cart?.orderStatus ?? "in_progress")")
                    Text("Items: \(cart?.itemCount ?? 0)")
                    Text("Total: \(cart?.totalFormatted ?? "\(cart?.totalAmount ?? 0) \(cart?.currency ?? "EUR")")")

                    ForEach(cart?.items ?? []) { item in
                        HStack {
                            Text("\(item.quantity) × \(item.productName ?? item.name ?? "Product")")
                            Spacer()
                            Text("\(item.lineTotal ?? ((item.unitPrice ?? item.priceSnapshot ?? 0) * item.quantity)) \(cart?.currency ?? "EUR")")
                        }
                    }

                    Button("Checkout") {
                        Task {
                            await checkout()
                        }
                    }
                    .disabled((cart?.items.isEmpty ?? true) || isLoading)
                }

                Section("Orders") {
                    if orders.isEmpty {
                        Text("No orders yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(orders) { order in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(order.publicOrderCode?.isEmpty == false ? order.publicOrderCode! : "Order #\(order.id)")
                                    .font(.headline)

                                Text("Status: \(order.orderStatusLabel ?? order.orderStatus ?? order.status ?? "active")")

                                if let location = order.deliveryLocationLabel, !location.isEmpty {
                                    Text("Location: \(location)")
                                }

                                if let history = order.statusHistory?.first {
                                    Text("Last update: \(history.newStatus)" + ((history.note?.isEmpty == false) ? " · \(history.note ?? "")" : ""))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Text("Total: \(order.totalFormatted ?? "\(order.totalAmount) \(order.currency ?? "EUR")")")
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                Section("Products") {
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
                                Text("Shop: \(shopName)")
                                    .foregroundStyle(.secondary)
                            }

                            Button("Add to cart") {
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
            .navigationTitle("Customer Shop")
            .task {
                await load()
            }
            .overlay {
                if isLoading {
                    ProgressView()
                }
            }
        }
    }

    private func ensureSession() async throws -> String {
        if let accessToken, !accessToken.isEmpty {
            return accessToken
        }

        let response = try await CustomerApiClient.startCustomerSession(
            deviceId: deviceId,
            platform: "ios-customer-app",
            appVersion: "0.1.0",
            fullName: "iOS Demo Customer",
            username: "ios_customer",
            language: "en"
        )

        accessToken = response.session.accessToken
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
            message = "Shop loaded"
        } catch {
            message = "Loading failed: \(error.localizedDescription)"
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
            message = "Added: \(product.name)"
        } catch {
            message = "Add failed: \(error.localizedDescription)"
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
            message = "Checkout submitted: \(response.order?.publicOrderCode?.isEmpty == false ? response.order!.publicOrderCode! : response.order.map { "Order #\($0.id)" } ?? "active order")"
            try await refreshOrdersAndCart()
        } catch {
            message = "Checkout failed: \(error.localizedDescription)"
        }
    }
}
