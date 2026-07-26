import AppIntents
import Foundation

// "Hey Siri, add to my TallyCrew calendar that [job description]" — runs in
// the background (openAppWhenRun = false), calling the same voice-parsing
// endpoint as the in-app Voice button, and saves the result as an unverified
// draft job for the admin to review later in Calendar.
struct AddJobIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Job to TallyCrew"
    static var description = IntentDescription(
        "Adds a job to your TallyCrew calendar as a draft, parsed the same way as the Voice button on the calendar page."
    )
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Job details", requestValueDialog: "What's the job?")
    var jobDetails: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let token = SiriKeychain.read() else {
            throw AddJobIntentError.notSignedIn
        }

        var request = URLRequest(url: URL(string: "https://www.tallycrew.ca/api/siri/add-job")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["text": jobDetails])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AddJobIntentError.requestFailed
        }
        if httpResponse.statusCode == 401 {
            throw AddJobIntentError.notSignedIn
        }
        guard httpResponse.statusCode == 200 else {
            let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw AddJobIntentError.serverError((body?["error"] as? String) ?? "Something went wrong")
        }

        return .result(dialog: "Added to your TallyCrew calendar as a draft.")
    }
}

enum AddJobIntentError: LocalizedError {
    case notSignedIn
    case requestFailed
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "Siri Shortcuts isn't enabled. Open TallyCrew → Settings → Siri Shortcuts to turn it on."
        case .requestFailed:
            return "Couldn't reach TallyCrew. Check your connection and try again."
        case .serverError(let message):
            return message
        }
    }
}

struct TallyCrewShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        // jobDetails is free-text, not an AppEntity/AppEnum, so it can't be captured
        // inline in the phrase — Siri asks for it separately via requestValueDialog.
        AppShortcut(
            intent: AddJobIntent(),
            phrases: [
                "Add to my \(.applicationName) calendar",
                "In \(.applicationName), add to my calendar",
                "Add a job to \(.applicationName)"
            ],
            shortTitle: "Add Job",
            systemImageName: "calendar.badge.plus"
        )
    }
}
