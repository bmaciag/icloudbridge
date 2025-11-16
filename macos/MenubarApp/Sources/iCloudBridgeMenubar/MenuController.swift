import Cocoa

final class MenuController {
    private let backendManager: BackendProcessManager
    private let launchAgentManager: LaunchAgentManager
    private let iconProvider = StatusIconProvider()

    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let openWebItem = NSMenuItem(title: "Open Web UI", action: #selector(openWebUI), keyEquivalent: "")
    private let toggleLoginItem = NSMenuItem(title: "Install Login Item", action: #selector(toggleLoginItemAction), keyEquivalent: "")
    private let quitItem = NSMenuItem(title: "Quit iCloudBridge", action: #selector(quitApp), keyEquivalent: "q")

    init(backendManager: BackendProcessManager, launchAgentManager: LaunchAgentManager) {
        self.backendManager = backendManager
        self.launchAgentManager = launchAgentManager
        configureStatusItem()
        rebuildMenu()
        DistributedNotificationCenter.default().addObserver(
            self,
            selector: #selector(handleInterfaceStyleChange),
            name: NSNotification.Name("AppleInterfaceThemeChangedNotification"),
            object: nil
        )
    }

    deinit {
        DistributedNotificationCenter.default().removeObserver(self)
    }

    private func configureStatusItem() {
        updateStatusIcon()
    }

    private func rebuildMenu() {
        openWebItem.target = self
        toggleLoginItem.target = self
        quitItem.target = self

        let menu = NSMenu()
        menu.addItem(openWebItem)
        menu.addItem(toggleLoginItem)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(quitItem)
        statusItem.menu = menu

        refreshLoginItemState()
    }

    @objc private func handleInterfaceStyleChange() {
        updateStatusIcon()
    }

    private func updateStatusIcon() {
        guard let button = statusItem.button else {
            return
        }

        if let icon = iconProvider.image(for: button.effectiveAppearance) {
            icon.size = NSSize(width: 18, height: 18)
            button.image = icon
            button.image?.isTemplate = false
            button.title = ""
        } else {
            button.title = "☁︎"
        }
    }

    private func refreshLoginItemState() {
        if launchAgentManager.isInstalled() {
            toggleLoginItem.title = "Remove Login Item"
        } else {
            toggleLoginItem.title = "Install Login Item"
        }
    }

    @objc private func openWebUI() {
        guard let url = URL(string: "http://127.0.0.1:27731/") else { return }
        NSWorkspace.shared.open(url)
    }

    @objc private func toggleLoginItemAction() {
        do {
            if launchAgentManager.isInstalled() {
                try launchAgentManager.remove()
            } else {
                try launchAgentManager.install()
            }
            refreshLoginItemState()
        } catch {
            presentErrorAlert(message: error.localizedDescription)
        }
    }

    @objc private func quitApp() {
        backendManager.stop()
        NSApp.terminate(nil)
    }

    private func presentErrorAlert(message: String) {
        let alert = NSAlert()
        alert.messageText = "iCloudBridge"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.runModal()
    }
}
