import SwiftUI
import Shared

@main
struct CRMDeliveryCustomerApp: App {
    var body: some Scene {
        WindowGroup {
            CustomerHomeView()
        }
    }
}

struct CustomerHomeView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("CRM Delivery Customer")
                .font(.title)
                .fontWeight(.semibold)

            Text(ApiConfig.apiV1URL.absoluteString)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
