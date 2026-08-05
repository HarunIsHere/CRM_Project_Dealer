import Foundation

public enum AdminIdentityApiClient {
    private static let apiBaseURL = "https://crm.ayartuerk.me/api/v1/admin/auth/recovery"

    public static func startRecovery(username: String) async throws -> AdminIdentityRecoveryStartResponse {
        try await post(
            URL(string: "\(apiBaseURL)/start")!,
            body: AdminIdentityRecoveryStartRequest(username: username)
        )
    }

    public static func verifyRecovery(
        token: String? = nil,
        username: String? = nil,
        manualCode: String? = nil,
        sessionTransport: String = "cookie",
        clientPlatform: String = "admin_web",
        appVersion: String? = nil,
        csrfToken: String? = nil
    ) async throws -> AdminIdentityRecoveryVerifyResponse {
        try await post(
            URL(string: "\(apiBaseURL)/verify")!,
            body: AdminIdentityRecoveryVerifyRequest(
                token: token,
                username: username,
                manualCode: manualCode,
                sessionTransport: sessionTransport,
                clientPlatform: clientPlatform,
                appVersion: appVersion
            ),
            csrfToken: csrfToken
        )
    }

    public static func completeRecovery(
        newPassword: String,
        confirmPassword: String? = nil,
        csrfToken: String
    ) async throws -> AdminIdentityRecoveryPasswordResponse {
        try await put(
            URL(string: "\(apiBaseURL)/password")!,
            body: AdminIdentityRecoveryPasswordRequest(
                newPassword: newPassword,
                confirmPassword: confirmPassword
            ),
            csrfToken: csrfToken
        )
    }

    public static func logoutRecovery(csrfToken: String) async throws -> BasicApiResponse {
        try await post(
            URL(string: "\(apiBaseURL)/logout")!,
            body: EmptyRequest(),
            csrfToken: csrfToken
        )
    }

    private static func post<RequestBody: Encodable, ResponseBody: Decodable>(
        _ url: URL,
        body: RequestBody,
        csrfToken: String? = nil
    ) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        if let csrfToken {
            request.setValue(csrfToken, forHTTPHeaderField: "x-csrf-token")
        }
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }

    private static func put<RequestBody: Encodable, ResponseBody: Decodable>(
        _ url: URL,
        body: RequestBody,
        csrfToken: String
    ) async throws -> ResponseBody {
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(csrfToken, forHTTPHeaderField: "x-csrf-token")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(ResponseBody.self, from: data)
    }
}
