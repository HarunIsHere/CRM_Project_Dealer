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
    private let sessionToken = "ios_customer_\(Int(Date().timeIntervalSince1970))"

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
                    Text("Session: \(sessionToken)")
                }

                Section("Cart") {
                    Text("Items: \(cart?.itemCount ?? 0)")
                    Text("Total: \(cart?.totalAmount ?? 0) \(cart?.currency ?? "EUR")")

                    ForEach(cart?.items ?? []) { item in
                        HStack {
                            Text("\(item.quantity) × \(item.productName)")
                            Spacer()
                            Text("\(item.lineTotal) \(cart?.currency ?? "EUR")")
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
                                Text(order.publicOrderCode)
                                    .font(.headline)
                                Text("Status: \(order.status)")

                                if let history = order.statusHistory?.first {
                                    Text("Last update: \(history.newStatus)" + ((history.note?.isEmpty == false) ? " · \(history.note ?? "")" : ""))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Text("Total: \(order.totalAmount) \(order.currency)")
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

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            products = try await CustomerApiClient.getCustomerProducts()
            let cartResponse = try await CustomerApiClient.getCustomerCart(sessionToken: sessionToken)
            cart = cartResponse.cart
            let ordersResponse = try await CustomerApiClient.getCustomerOrders(sessionToken: sessionToken)
            orders = ordersResponse.orders
            message = "Shop loaded"
        } catch {
            message = "Loading failed: \(error.localizedDescription)"
        }
    }

    private func addToCart(_ product: CustomerProduct) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await CustomerApiClient.addCustomerCartItem(
                sessionToken: sessionToken,
                productId: product.id,
                quantity: 1
            )
            cart = response.cart
            message = "Added: \(product.name)"
        } catch {
            message = "Add failed: \(error.localizedDescription)"
        }
    }

    private func checkout() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await CustomerApiClient.checkoutCustomerCart(
                sessionToken: sessionToken,
                customerName: "iOS Demo Customer",
                phone: "+49123456789",
                deliveryAddress: "Berlin",
                paymentMethodCode: "cash_delivery",
                notes: "iOS checkout from catalog"
            )
            message = "Order created: \(response.order.publicOrderCode)"
            let cartResponse = try await CustomerApiClient.getCustomerCart(sessionToken: sessionToken)
            cart = cartResponse.cart
            let ordersResponse = try await CustomerApiClient.getCustomerOrders(sessionToken: sessionToken)
            orders = ordersResponse.orders
        } catch {
            message = "Checkout failed: \(error.localizedDescription)"
        }
    }
}
