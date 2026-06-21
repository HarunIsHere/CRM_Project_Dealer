import SwiftUI
import Shared

@main
struct CustomerApp: App {
    var body: some Scene {
        WindowGroup {
            CustomerHomeView()
        }
    }
}

struct CustomerHomeView: View {
    @State private var result = "Ready."

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("CRM Delivery Customer")
                .font(.title2)
                .bold()

            Text(ApiConfig.apiV1URL.absoluteString)
                .font(.footnote)
                .foregroundStyle(.secondary)

            Button("Load catalog") {
                Task {
                    await loadCatalog()
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

    private func loadCatalog() async {
        result = "Loading catalog..."

        do {
            async let catalog = PublicApiClient.getPublicCatalog()
            async let paymentMethods = PublicApiClient.getPublicPaymentMethods()

            let catalogData = try await catalog
            let paymentData = try await paymentMethods

            let productText = catalogData.products.map { product in
                let category = product.categoryName.isEmpty ? "Uncategorized" : product.categoryName
                return "- \(product.name) · \(product.priceFormatted) · \(category)"
            }.joined(separator: "\n")

            let categoryText = catalogData.categories.map { category in
                "- \(category.name)"
            }.joined(separator: "\n")

            let meetingPointText = catalogData.meetingPoints.map { point in
                "- \(point.name)\n  \(point.googleMapsLink)"
            }.joined(separator: "\n")

            let paymentText = paymentData.map { method in
                "- \(method.name) (\(method.code))"
            }.joined(separator: "\n")

            result = """
            Products:
            \(productText)

            Categories:
            \(categoryText)

            Meeting points:
            \(meetingPointText)

            Payment methods:
            \(paymentText)

            Delivery cities:
            \(catalogData.allowedDeliveryCities.joined(separator: ", "))
            """
        } catch {
            result = error.localizedDescription
        }
    }
}
