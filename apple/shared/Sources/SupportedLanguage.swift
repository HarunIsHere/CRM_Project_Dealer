import Foundation

public enum SupportedLanguage: String, CaseIterable, Identifiable {
    case english = "en"
    case german = "de"
    case turkish = "tr"
    case arabic = "ar"
    case russian = "ru"

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .english: return "English"
        case .german: return "Deutsch"
        case .turkish: return "Türkçe"
        case .arabic: return "العربية"
        case .russian: return "Русский"
        }
    }

    public var isRightToLeft: Bool {
        self == .arabic
    }
}
