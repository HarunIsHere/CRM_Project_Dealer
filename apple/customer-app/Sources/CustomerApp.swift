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
            async let shops = fetchText(ApiConfig.publicShopsURL)
            async let payments = fetchText(ApiConfig.publicPaymentMethodsURL)
            result = "Shops:\n\(try await shops)\n\nPayment methods:\n\(try await payments)"
        } catch {
            result = error.localizedDescription
        }
    }

    private func fetchText(_ url: URL) async throws -> String {
        let (data, _) = try await URLSession.shared.data(from: url)
        return String(data: data, encoding: .utf8) ?? ""
    }
}
