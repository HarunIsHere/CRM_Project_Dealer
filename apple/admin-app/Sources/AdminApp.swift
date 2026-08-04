import SwiftUI
import Shared
import Foundation

@main
struct AdminApp: App {
    var body: some Scene {
        WindowGroup {
            AdminHomeView()
        }
    }
}

struct AdminHomeView: View {
    @State private var selectedLanguage = defaultSupportedLanguage()
    @State private var result = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(t("title"))
                .font(.title2)
                .bold()

            Picker(t("view_language"), selection: $selectedLanguage) {
                ForEach(SupportedLanguage.allCases) { language in
                    Text(language.label).tag(language)
                }
            }
            .pickerStyle(.menu)

            Text(ApiConfig.apiV1URL.absoluteString)
                .font(.footnote)
                .foregroundStyle(.secondary)

            Button(t("load_shops_and_payment_methods")) {
                Task {
                    await loadFoundationData()
                }
            }
            .buttonStyle(.borderedProminent)

            ScrollView {
                Text(result.isEmpty ? t("ready") : result)
                    .font(.system(.footnote, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(24)
        .environment(\.layoutDirection, selectedLanguage.isRightToLeft ? .rightToLeft : .leftToRight)
        .onChange(of: selectedLanguage) { _, _ in
            result = ""
        }
    }

    private func t(_ key: String) -> String {
        AdminSharedTexts.text(selectedLanguage.rawValue, key)
    }

    private func template(_ key: String, _ replacements: [String: String]) -> String {
        replacements.reduce(t(key)) { partial, pair in
            partial.replacingOccurrences(of: "{\(pair.key)}", with: pair.value)
        }
    }

    private func loadFoundationData() async {
        result = t("loading")

        do {
            async let shops = PublicApiClient.getPublicShops()
            async let paymentMethods = PublicApiClient.getPublicPaymentMethods()

            let shopText = try await shops.map { shop in
                "- \(shop.name) (\(shop.slug))\n  Payments: \(shop.paymentMethods.map { $0.name }.joined(separator: ", "))"
            }.joined(separator: "\n")

            let paymentText = try await paymentMethods.map { method in
                "- \(method.name) (\(method.code))"
            }.joined(separator: "\n")

            result = "\(t("shops_heading")):\n\(shopText)\n\n\(t("payment_methods_heading")):\n\(paymentText)"
        } catch {
            result = template("loading_failed_template", ["error": error.localizedDescription])
        }
    }
}

private func defaultSupportedLanguage() -> SupportedLanguage {
    let preferredCode = Locale.preferredLanguages
        .compactMap { Locale(identifier: $0).language.languageCode?.identifier }
        .first

    return SupportedLanguage(rawValue: preferredCode ?? "en") ?? .english
}
