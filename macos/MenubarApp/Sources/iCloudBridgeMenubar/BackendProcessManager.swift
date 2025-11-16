import Cocoa

final class BackendProcessManager {
    private var process: Process?
    private let queue = DispatchQueue(label: "app.icloudbridge.backend")

    func start() {
        queue.async { [weak self] in
            guard let self else { return }
            if self.process?.isRunning == true {
                return
            }
            guard let executableURL = self.backendExecutableURL() else {
                NSLog("Unable to locate packaged backend binary")
                return
            }

            do {
                var environment = ProcessInfo.processInfo.environment
                if let resources = Bundle.main.resourceURL {
                    let publicDir = resources.appendingPathComponent("public")
                    environment["ICLOUDBRIDGE_FRONTEND_DIST"] = publicDir.path
                    environment["ICLOUDBRIDGE_LOG_ROOT"] = "\(NSHomeDirectory())/Library/Logs/iCloudBridge"
                }
                let proc = Process()
                proc.executableURL = executableURL
                proc.arguments = []
                proc.environment = environment
                proc.standardOutput = nil
                proc.standardError = nil
                proc.terminationHandler = { [weak self] process in
                    guard let self else { return }
                    NSLog("Backend exited with status \(process.terminationStatus); restarting…")
                    self.process = nil
                    self.start()
                }
                try proc.run()
                self.process = proc
            } catch {
                NSLog("Failed to launch backend: \(error.localizedDescription)")
            }
        }
    }

    func stop() {
        queue.sync {
            process?.terminate()
            process = nil
        }
    }

    private func backendExecutableURL() -> URL? {
        guard let bundleURL = Bundle.main.bundleURL as URL? else { return nil }
        let candidate = bundleURL
            .appendingPathComponent("Contents")
            .appendingPathComponent("MacOS")
            .appendingPathComponent("icloudbridge-backend")
        return FileManager.default.isExecutableFile(atPath: candidate.path) ? candidate : nil
    }
}
