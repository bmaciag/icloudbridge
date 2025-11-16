// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "iCloudBridgeMenubar",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .executable(name: "iCloudBridgeMenubar", targets: ["iCloudBridgeMenubar"]),
    ],
    targets: [
        .executableTarget(
            name: "iCloudBridgeMenubar",
            path: "Sources",
            resources: [
                .process("Resources")
            ]
        ),
    ]
)
