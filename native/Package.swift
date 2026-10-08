// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "AgentInboxLifecycle", platforms: [.macOS(.v13)], products: [
    .executable(name: "AgentInboxLifecycle", targets: ["AgentInboxLifecycle"])
], targets: [
    .target(name: "NativeProcess"),
    .target(name: "LifecycleCore", dependencies: ["NativeProcess"]),
    .executableTarget(name: "AgentInboxLifecycle", dependencies: ["LifecycleCore"]),
    .executableTarget(name: "HookFixture", path: "Tests/HookFixture"),
    .testTarget(name: "LifecycleCoreTests", dependencies: ["LifecycleCore"])
])
