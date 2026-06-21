import SwiftUI
import Shared

@main
struct CustomerApp: App {
    var body: some Scene {
        WindowGroup {
            CustomerCatalogView()
        }
    }
}

struct CustomerCatalogView: View {
    private let sessionToken = "ios_customer_\(Int(Date().timeIntervalSince1970))"

    @State private var products: [Product] = []
    @State private var cart: CustomerCart?
    @State private var message = "Loading catalog..."
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
            let catalogResponse = try await PublicApiClient.getPublicCatalog()
            products = catalogResponse.catalog.products

            let cartResponse = try await PublicApiClient.getCustomerCart(sessionToken: sessionToken)
            cart = cartResponse.cart
            message = "Catalog loaded"
        } catch {
            message = "Loading failed: \(error.localizedDescription)"
        }
    }

    private func addToCart(_ product: Product) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await PublicApiClient.addCustomerCartItem(
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
            let response = try await PublicApiClient.checkoutCustomerCart(
                sessionToken: sessionToken,
                customerName: "iOS Demo Customer",
                phone: "+49123456789",
                deliveryAddress: "Berlin",
                paymentMethodCode: "cash_delivery",
                notes: "iOS smoke checkout"
            )
            message = "Order created: \(response.order.publicOrderCode)"
            let cartResponse = try await PublicApiClient.getCustomerCart(sessionToken: sessionToken)
            cart = cartResponse.cart
        } catch {
            message = "Checkout failed: \(error.localizedDescription)"
        }
    }
}
