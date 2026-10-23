// Inbox's new wire protocol must reject invalid timers before any power call.
// Decode both edges and verify the adapter never enables unrelated automation.
import XCTest
@testable import Insomnia

final class AwakeProtocolTests: XCTestCase {
    @MainActor
    func testInboxAdapterDisablesUnrelatedAutomationAndKeepsPowerGuards() {
        let h = Harness()
        defer { h.home.destroy() }
        let manager = h.makeManager()
        manager.config.freezeAllApps = true
        manager.config.dockerRule = true
        manager.config.hotspotSSID = "test-hotspot"
        manager.config.tmuxTargets = ["test:0.0"]
        manager.config.disableAppNapForAgents = true
        manager.config.thermalRules = false
        manager.config.endFloor = 0
        AwakeProtocol.configure(manager)
        XCTAssertTrue(manager.config.freezeList.isEmpty)
        XCTAssertFalse(manager.config.freezeAllApps)
        XCTAssertFalse(manager.config.dockerRule)
        XCTAssertTrue(manager.config.hotspotSSID.isEmpty)
        XCTAssertTrue(manager.config.tmuxTargets.isEmpty)
        XCTAssertFalse(manager.config.disableAppNapForAgents)
        XCTAssertTrue(manager.config.thermalRules)
        XCTAssertEqual(manager.config.endFloor, 10)
        XCTAssertEqual(manager.config.lowPowerFloor, 40)
    }

    @MainActor
    func testSnapshotUsesTheActualSessionDeadlineAndShowsFailedRestoration() async throws {
        let h = Harness()
        defer { h.home.destroy() }
        let manager = h.makeManager()
        AwakeProtocol.configure(manager)
        XCTAssertEqual(AwakeProtocol.snapshot(manager)["phase"] as? String, "idle")
        await manager.start(duration: 60)
        XCTAssertEqual(AwakeProtocol.snapshot(manager)["phase"] as? String, "active")
        XCTAssertEqual(AwakeProtocol.snapshot(manager)["endsAt"] as? Double, h.clock.now.addingTimeInterval(60).timeIntervalSince1970 * 1000)
        h.guardFake.throwOn = ["disablesleep 0"]
        _ = await manager.end(reason: .user)
        let snapshot = AwakeProtocol.snapshot(manager)
        XCTAssertEqual(snapshot["phase"] as? String, "recovery")
        XCTAssertFalse((snapshot["warnings"] as? [String] ?? []).isEmpty)
    }
    func testDurationEdgesAndNonDurationCommands() throws {
        for minutes in [1, 30, 43200] {
            XCTAssertEqual(try AwakeCommand.parse("{\"id\":1,\"action\":\"start\",\"minutes\":\(minutes)}").minutes, minutes)
        }
        for minutes in [0, -1, 43201] {
            XCTAssertThrowsError(try AwakeCommand.parse("{\"id\":1,\"action\":\"extend\",\"minutes\":\(minutes)}"))
        }
        for line in ["{}", "{\"id\":1,\"action\":\"start\"}", "{\"id\":1,\"action\":\"start\",\"minutes\":1.5}", "{\"id\":1,\"action\":\"shell\"}"] {
            XCTAssertThrowsError(try AwakeCommand.parse(line))
        }
        XCTAssertEqual(try AwakeCommand.parse("{\"id\":2,\"action\":\"end\"}").action, .end)
        XCTAssertThrowsError(try AwakeCommand.parse(String(repeating: " ", count: 4097)))
    }
    func testRecoveryNamespaceDoesNotTouchStandaloneInsomnia() {
        XCTAssertEqual(Paths.backstopLabel, "com.agentinbox.awake.backstop")
        XCTAssertEqual(Paths.bundleIdentifier, "com.agentinbox.awake")
        XCTAssertTrue(Paths.standard.appSupport.path.hasSuffix("Application Support/AgentInboxAwake"))
        XCTAssertTrue(Paths.standard.appBundle.path.hasSuffix("Applications/AgentInboxAwake.app"))
    }
}
