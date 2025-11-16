import Cocoa

final class StatusIconProvider {
    private let lightIcon: NSImage?
    private let darkIcon: NSImage?

    init() {
        lightIcon = StatusIconProvider.loadImage(named: "status-icon-light")
        darkIcon = StatusIconProvider.loadImage(named: "status-icon-dark")
    }

    private static func loadImage(named resource: String) -> NSImage? {
        guard let url = Bundle.module.url(forResource: resource, withExtension: "png") else {
            NSLog("Unable to locate status icon resource: \(resource)")
            return nil
        }
        return NSImage(contentsOf: url)
    }

    func image(for appearance: NSAppearance?) -> NSImage? {
        let lookedUp = appearance ?? NSApp.effectiveAppearance
        if lookedUp.bestMatch(from: [.darkAqua, .vibrantDark]) != nil {
            // Use the white icon on dark appearances
            return lightIcon
        }
        return darkIcon
    }
}
