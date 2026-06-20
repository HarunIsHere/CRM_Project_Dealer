import SwiftUI
import Shared

@main
struct CRMDeliveryAdminApp: App {
    var body: some Scene {
        WindowGroup {
            AdminHomeView()
        }
    }
}

struct AdminHomeView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("CRM Delivery Admin")
                .font(.title)
                .fontWeight(.semibold)

            Text(ApiConfig.apiV1URL.absoluteString)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
