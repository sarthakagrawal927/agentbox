// swift-tools-version: 6.2
import PackageDescription
let package = Package(name: "AgentInboxAwake", platforms: [.macOS(.v26)], products: [
 .executable(name: "AgentInboxAwake", targets: ["Insomnia"])
], targets: [
 .executableTarget(name: "Insomnia", swiftSettings: [.swiftLanguageMode(.v6)]),
 .target(name: "InsomniaTestHome", path: "Tests/InsomniaTestHome"),
 .testTarget(name: "InsomniaTests", dependencies: ["Insomnia", "InsomniaTestHome"])
])
