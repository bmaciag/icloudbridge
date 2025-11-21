import Cocoa
import SwiftUI

struct PreflightSnapshot {
    let statuses: [RequirementStatus]
    let suppressNext: Bool
    let allSatisfied: Bool
}

private final class PreflightModel: ObservableObject {
    @Published var snapshot: PreflightSnapshot

    init(snapshot: PreflightSnapshot) {
        self.snapshot = snapshot
    }
}

final class PreflightWindowController: NSWindowController {
    private let model = PreflightModel(snapshot: PreflightSnapshot(statuses: [], suppressNext: true, allSatisfied: false))
    private let hostingController: NSHostingController<PreflightView>

    var onInstallHomebrew: (() -> Void)? {
        didSet { setCallbacks() }
    }
    var onInstallPython: (() -> Void)? {
        didSet { setCallbacks() }
    }
    var onInstallRuby: (() -> Void)? {
        didSet { setCallbacks() }
    }
    var onOpenFullDiskAccess: (() -> Void)? {
        didSet { setCallbacks() }
    }
    var onRefresh: (() -> Void)? {
        didSet { setCallbacks() }
    }
    var onCloseRequested: (() -> Void)? {
        didSet { setCallbacks() }
    }
    var onToggleSuppress: ((Bool) -> Void)? {
        didSet { setCallbacks() }
    }

    init() {
        hostingController = NSHostingController(rootView: PreflightView(model: model))
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 420),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "iCloudBridge Setup"
        window.contentViewController = hostingController
        window.isReleasedWhenClosed = false
        super.init(window: window)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func apply(snapshot: PreflightSnapshot) {
        model.snapshot = snapshot
    }

    private func setCallbacks() {
        hostingController.rootView.onInstallHomebrew = onInstallHomebrew
        hostingController.rootView.onInstallPython = onInstallPython
        hostingController.rootView.onInstallRuby = onInstallRuby
        hostingController.rootView.onOpenFullDiskAccess = onOpenFullDiskAccess
        hostingController.rootView.onRefresh = onRefresh
        hostingController.rootView.onCloseRequested = onCloseRequested
        hostingController.rootView.onToggleSuppress = onToggleSuppress
    }
}

struct PreflightView: View {
    @ObservedObject var model: PreflightModel

    var onInstallHomebrew: (() -> Void)?
    var onInstallPython: (() -> Void)?
    var onInstallRuby: (() -> Void)?
    var onOpenFullDiskAccess: (() -> Void)?
    var onRefresh: (() -> Void)?
    var onCloseRequested: (() -> Void)?
    var onToggleSuppress: ((Bool) -> Void)?

    private var snapshot: PreflightSnapshot { model.snapshot }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Confirm the prerequisites below before starting the sync engine.")
                .font(.system(size: 14, weight: .semibold))

            VStack(spacing: 12) {
                RequirementRow(
                    title: "Homebrew",
                    status: status(for: .homebrew),
                    actionTitle: buttonTitle(for: .homebrew, defaultTitle: "Install Homebrew"),
                    actionEnabled: isActionEnabled(for: .homebrew),
                    action: { onInstallHomebrew?() }
                )
                RequirementRow(
                    title: "Python 3.12",
                    status: status(for: .python),
                    actionTitle: buttonTitle(for: .python, defaultTitle: "Install python@3.12"),
                    actionEnabled: isActionEnabled(for: .python),
                    action: { onInstallPython?() }
                )
                RequirementRow(
                    title: "Ruby",
                    status: status(for: .ruby),
                    actionTitle: buttonTitle(for: .ruby, defaultTitle: "Install Ruby"),
                    actionEnabled: isActionEnabled(for: .ruby),
                    action: { onInstallRuby?() }
                )
                RequirementRow(
                    title: "Full Disk Access",
                    status: status(for: .fullDiskAccess),
                    actionTitle: "Open System Settings",
                    actionEnabled: true,
                    action: { onOpenFullDiskAccess?() }
                )
            }
            .padding(12)
            .background(.quaternary.opacity(0.6))
            .cornerRadius(10)

            Text(summaryText)
                .font(.system(size: 13))
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Toggle("Don't show this next time", isOn: Binding(
                get: { snapshot.suppressNext },
                set: { onToggleSuppress?($0) }
            ))
            .toggleStyle(.switch)

            HStack {
                Button("Refresh") { onRefresh?() }
                Spacer()
                Button("Close") { onCloseRequested?() }
            }
        }
        .padding(20)
    }

    private var summaryText: String {
        snapshot.allSatisfied ? "All prerequisites met. The backend will start automatically." : "Resolve the items above, then click Refresh."
    }

    private func status(for requirement: Requirement) -> RequirementState {
        snapshot.statuses.first(where: { $0.requirement == requirement })?.state ?? .pending
    }

    private func isActionEnabled(for requirement: Requirement) -> Bool {
        let state = status(for: requirement)
        switch state {
        case .pending, .checking, .installing, .satisfied:
            return false
        case .actionRequired, .failed:
            return true
        }
    }

    private func buttonTitle(for requirement: Requirement, defaultTitle: String) -> String {
        let state = status(for: requirement)
        switch state {
        case .installing:
            return "Installing…"
        case .checking:
            return "Checking…"
        case .satisfied:
            return "Installed"
        default:
            return defaultTitle
        }
    }
}

private struct RequirementRow: View {
    let title: String
    let status: RequirementState
    let actionTitle: String
    let actionEnabled: Bool
    let action: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .frame(width: 140, alignment: .leading)

            Circle()
                .fill(color(for: status))
                .frame(width: 10, height: 10)

            Text(status.message)
                .font(.system(size: 13))
                .lineLimit(2)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(actionTitle, action: action)
                .disabled(!actionEnabled)
        }
    }

    private func color(for state: RequirementState) -> Color {
        switch state {
        case .satisfied:
            return .green
        case .installing, .checking:
            return .orange
        case .actionRequired, .failed:
            return .red
        case .pending:
            return .gray
        }
    }
}
