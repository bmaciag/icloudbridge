import Cocoa
import ServiceManagement

enum LaunchAgentError: LocalizedError {
    case bundlePathMissing
    case backendMissing
    case loginHelperMissing
    case processFailed(message: String)

    var errorDescription: String? {
        switch self {
        case .bundlePathMissing:
            return "Could not locate the menubar bundle path."
        case .backendMissing:
            return "Backend resources are missing from the app bundle."
        case .loginHelperMissing:
            return "Login helper is missing from the app bundle."
        case .processFailed(let message):
            return message
        }
    }
}

final class LaunchAgentManager {
    private let label = "com.icloudbridge.server"
    private let fm = FileManager.default
    private let loginHelperIdentifier = "app.icloudbridge.loginhelper"
    private let launchAgentPlist = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/LaunchAgents/com.icloudbridge.server.plist")

    private var currentUserIdentifier: String {
        let uid = getuid()
        return "gui/\(uid)"
    }

    func isInstalled() -> Bool {
        guard #available(macOS 13.0, *) else { return false }
        let service = SMAppService.loginItem(identifier: loginHelperIdentifier)
        return service.status == .enabled
    }

    func install() throws {
        guard #available(macOS 13.0, *) else {
            throw LaunchAgentError.processFailed(message: "Start at Login requires macOS 13 or later.")
        }
        do {
            try installWithSMAppService()
        } catch LaunchAgentError.loginHelperMissing {
            // Fallback for dev/bare builds: install a LaunchAgent for the menubar app itself.
            try installLaunchAgentFallback()
        }
    }

    func remove() throws {
        guard #available(macOS 13.0, *) else { return }
        try removeWithSMAppService()
        try? removeLaunchAgentFallback()
    }

    @discardableResult
    private func runLaunchctl(arguments: [String]) throws -> Int32 {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        task.arguments = arguments

        let pipe = Pipe()
        task.standardError = pipe
        task.standardOutput = pipe

        try task.run()
        task.waitUntilExit()

        if task.terminationStatus != 0 {
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw LaunchAgentError.processFailed(message: output.trimmingCharacters(in: .whitespacesAndNewlines))
        }

        return task.terminationStatus
    }

    private func backendAssetsPresent() -> Bool {
        guard let resources = Bundle.main.resourceURL else {
            return false
        }

        // Prefer the packaged backend binary (matches older builds)
        let primary = resources.appendingPathComponent("icloudbridge-backend")
        if FileManager.default.isExecutableFile(atPath: primary.path) {
            return true
        }

        // Fallback to legacy backend/ path
        let legacy = resources.appendingPathComponent("backend/icloudbridge-backend")
        if FileManager.default.isExecutableFile(atPath: legacy.path) {
            return true
        }

        // For current builds we ship backend_src + venv installer instead of a binary
        let backendSrc = resources.appendingPathComponent("backend_src", isDirectory: true)
        return FileManager.default.fileExists(atPath: backendSrc.path)
    }

    @available(macOS 13.0, *)
    private func installWithSMAppService() throws {
        guard backendAssetsPresent() else {
            throw LaunchAgentError.backendMissing
        }

        // SMAppService requires the helper to be embedded at Contents/Library/LoginItems inside the running bundle.
        guard let appBundle = Bundle.main.bundleURL as URL?, appBundle.pathExtension == "app" else {
            throw LaunchAgentError.bundlePathMissing
        }
        let helperBundle = appBundle
            .appendingPathComponent("Contents")
            .appendingPathComponent("Library")
            .appendingPathComponent("LoginItems")
            .appendingPathComponent("iCloudBridgeLoginHelper.app")
        guard fm.fileExists(atPath: helperBundle.path) else {
            throw LaunchAgentError.loginHelperMissing
        }

        let service = SMAppService.loginItem(identifier: loginHelperIdentifier)
        try service.register()
    }

    // Fallback: use a LaunchAgent pointing to the menubar app executable when the login helper is not bundled.
    private func installLaunchAgentFallback() throws {
        guard let appBundle = Bundle.main.bundleURL as URL? else {
            throw LaunchAgentError.bundlePathMissing
        }
        let executable = appBundle
            .appendingPathComponent("Contents")
            .appendingPathComponent("MacOS")
            .appendingPathComponent(appBundle.deletingPathExtension().lastPathComponent)

        guard fm.isExecutableFile(atPath: executable.path) else {
            throw LaunchAgentError.backendMissing
        }

        let plist: [String: Any] = [
            "Label": label,
            "ProgramArguments": [executable.path],
            "RunAtLoad": true,
            "KeepAlive": false,
        ]

        let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try data.write(to: launchAgentPlist, options: .atomic)

        try runLaunchctl(arguments: ["bootstrap", currentUserIdentifier, launchAgentPlist.path])
        try runLaunchctl(arguments: ["enable", "\(currentUserIdentifier)/\(label)"])
    }

    private func removeLaunchAgentFallback() throws {
        if fm.fileExists(atPath: launchAgentPlist.path) {
            _ = try? runLaunchctl(arguments: ["bootout", currentUserIdentifier, launchAgentPlist.path])
            try? fm.removeItem(at: launchAgentPlist)
        }
    }

    @available(macOS 13.0, *)
    private func removeWithSMAppService() throws {
        guard let appBundle = Bundle.main.bundleURL as URL?, appBundle.pathExtension == "app" else {
            return
        }
        let helperBundle = appBundle
            .appendingPathComponent("Contents")
            .appendingPathComponent("Library")
            .appendingPathComponent("LoginItems")
            .appendingPathComponent("iCloudBridgeLoginHelper.app")
        let service = SMAppService.loginItem(identifier: loginHelperIdentifier)

        // Attempt SM removal, then force bootout of the helper label
        try? service.unregister()
        _ = try? runLaunchctl(arguments: ["bootout", "gui/\(getuid())/\(loginHelperIdentifier)"])

        if fm.fileExists(atPath: helperBundle.path) {
            // Best-effort cleanup of helper bundle remnants
            try? fm.removeItem(at: helperBundle)
        }
    }
}
