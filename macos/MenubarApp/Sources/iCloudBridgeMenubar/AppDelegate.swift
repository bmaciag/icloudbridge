import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let backendManager = BackendProcessManager()
    private let launchAgentManager = LaunchAgentManager()
    private var preflightCoordinator: PreflightCoordinator?
    private var menuController: MenuController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        menuController = MenuController(
            backendManager: backendManager,
            launchAgentManager: launchAgentManager
        )

        let coordinator = PreflightCoordinator(backendManager: backendManager)
        preflightCoordinator = coordinator
        coordinator.start()
    }

    func applicationWillTerminate(_ notification: Notification) {
        backendManager.stop()
    }
}
