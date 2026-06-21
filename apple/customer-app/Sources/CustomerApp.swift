import SwiftUI
import Shared

@main
struct CustomerApp: App {
    var body: some Scene {
        WindowGroup {
            CustomerCartView()
        }
    }
}

struct CustomerCartView: View {
    private let sessionToken = "ios_customer_\(Int(Date().timeIntervalSince1970))"

    @State private var cart: CustomerCart?
    @State private var message = "Loading cart..."
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

                    Button("Add demo product") {
                        Task {
                            await addDemoProduct()
                        }
                    }
                    .disabled(isLoading)

                    Button("Checkout") {
                        Task {
                            await checkout()
                        }
                    }
                    .disabled((cart?.items.isEmpty ?? true) || isLoading)
                }
            }
            .navigationTitle("Customer Shop")
            .task {
                await loadCart()
            }
            .overlay {
                if isLoading {
                    ProgressView()
                }
            }
        }
    }

    private func loadCart() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await CustomerApiClient.getCustomerCart(sessionToken: sessionToken)
            cart = response.cart
            message = "Cart loaded"
        } catch {
            message = "Cart failed: \(error.localizedDescription)"
        }
    }

    private func addDemoProduct() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await CustomerApiClient.addCustomerCartItem(
                sessionToken: sessionToken,
                productId: 3,
                quantity: 1
            )
            cart = response.cart
            message = "Added demo product"
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
                notes: "iOS smoke checkout"
            )
            message = "Order created: \(response.order.publicOrderCode)"
            let cartResponse = try await CustomerApiClient.getCustomerCart(sessionToken: sessionToken)
            cart = cartResponse.cart
        } catch {
            message = "Checkout failed: \(error.localizedDescription)"
        }
    }
}
