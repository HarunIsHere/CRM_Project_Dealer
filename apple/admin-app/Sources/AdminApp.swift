import SwiftUI
import Shared

@main
struct AdminApp: App {
    var body: some Scene {
        WindowGroup {
            AdminHomeView()
        }
    }
}

struct AdminHomeView: View {
    @State private var result = "Ready."

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("CRM Delivery Admin")
                .font(.title2)
                .bold()

            Text(ApiConfig.apiV1URL.absoluteString)
                .font(.footnote)
                .foregroundStyle(.secondary)

            Button("Load shops and payment methods") {
                Task {
                    await loadFoundationData()
                }
            }
            .buttonStyle(.borderedProminent)

            ScrollView {
                Text(result)
                    .font(.system(.footnote, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(24)
    }

    private func loadFoundationData() async {
        result = "Loading..."

        do {
            async let shops = PublicApiClient.getPublicShops()
            async let paymentMethods = PublicApiClient.getPublicPaymentMethods()

            let shopText = try await shops.map { shop in
                "- \(shop.name) (\(shop.slug))\n  Payments: \(shop.paymentMethods.map { $0.name }.joined(separator: ", "))"
            }.joined(separator: "\n")

            let paymentText = try await paymentMethods.map { method in
                "- \(method.name) (\(method.code))"
            }.joined(separator: "\n")

            result = "Shops:\n\(shopText)\n\nPayment methods:\n\(paymentText)"
        } catch {
            result = error.localizedDescription
        }
    }
}
