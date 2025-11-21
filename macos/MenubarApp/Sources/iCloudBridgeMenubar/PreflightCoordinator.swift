import Cocoa

final class PreflightCoordinator {
    private let preflightManager = PreflightManager()
    private weak var backendManager: BackendProcessManager?
    private var windowController: PreflightWindowController?
    private var backendStarted = false
    private var latestStatuses: [RequirementStatus] = []

    private let defaults = UserDefaults.standard
    private let shownKey = "preflight.hasShownOnce"
    private let suppressKey = "preflight.suppressWhenHealthy"

    init(backendManager: BackendProcessManager) {
        self.backendManager = backendManager
        if defaults.object(forKey: suppressKey) == nil {
            defaults.set(true, forKey: suppressKey)
        }
        preflightManager.onEvent = { [weak self] event in
            self?.handle(event: event)
        }
    }

    func start() {
        preflightManager.runFullCheck()
    }

    private func handle(event: PreflightEvent) {
        switch event {
        case .statusesUpdated(let statuses):
            latestStatuses = statuses
            let snapshot = PreflightSnapshot(
                statuses: statuses,
                suppressNext: shouldSuppressWhenHealthy,
                allSatisfied: statuses.allSatisfy { $0.state.isSatisfied }
            )
            if shouldShowWindow(for: statuses) {
                showWindow()
            }
            windowController?.apply(snapshot: snapshot)

        case .allSatisfied:
            startBackendIfNeeded()
            if shouldAutoCloseOnSuccess() {
                windowController?.close()
            }
        }
    }

    private func showWindow() {
        if windowController == nil {
            let controller = PreflightWindowController()
            controller.onInstallHomebrew = { [weak self] in self?.preflightManager.installHomebrew() }
            controller.onInstallPython = { [weak self] in self?.preflightManager.installPython() }
            controller.onInstallRuby = { [weak self] in self?.preflightManager.installRuby() }
            controller.onOpenFullDiskAccess = { [weak self] in self?.preflightManager.openFullDiskAccessPreferences() }
            controller.onRefresh = { [weak self] in self?.preflightManager.runFullCheck() }
            controller.onCloseRequested = { [weak self] in self?.handleCloseRequested() }
            controller.onToggleSuppress = { [weak self] suppress in
                self?.defaults.set(suppress, forKey: self?.suppressKey ?? "")
            }

            windowController = controller
            controller.showWindow(nil)
            controller.window?.makeKeyAndOrderFront(nil)
            defaults.set(true, forKey: shownKey)

            let snapshot = PreflightSnapshot(
                statuses: preflightManager.currentStatuses(),
                suppressNext: shouldSuppressWhenHealthy,
                allSatisfied: false
            )
            controller.apply(snapshot: snapshot)
        } else {
            windowController?.showWindow(nil)
            windowController?.window?.makeKeyAndOrderFront(nil)
        }
    }

    private func shouldShowWindow(for statuses: [RequirementStatus]) -> Bool {
        if !hasShownOnce { return true }
        if statuses.contains(where: { !$0.state.isSatisfied }) { return true }
        return !shouldSuppressWhenHealthy
    }

    private func shouldAutoCloseOnSuccess() -> Bool {
        // Only relevant if a window is already open; on first run we want the user to see the window even when healthy.
        return windowController == nil && shouldSuppressWhenHealthy
    }

    private var hasShownOnce: Bool {
        defaults.bool(forKey: shownKey)
    }

    private var shouldSuppressWhenHealthy: Bool {
        defaults.bool(forKey: suppressKey)
    }

    private func startBackendIfNeeded() {
        guard !backendStarted else { return }
        backendStarted = true
        backendManager?.start()
    }

    private func handleCloseRequested() {
        let allSatisfied = latestStatuses.allSatisfy { $0.state.isSatisfied }
        if !allSatisfied {
            backendManager?.stop()
            NSApp.terminate(nil)
            return
        }
        windowController?.close()
    }
}
