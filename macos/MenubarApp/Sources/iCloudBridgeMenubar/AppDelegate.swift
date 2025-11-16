import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let backendManager = BackendProcessManager()
    private let launchAgentManager = LaunchAgentManager()
    private var menuController: MenuController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        backendManager.start()
        menuController = MenuController(
            backendManager: backendManager,
            launchAgentManager: launchAgentManager
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        backendManager.stop()
    }
}
