// A real hook command must emit normalized metadata through the native channel
// and satisfy Codex Stop stdout even when the receiver is not running.
import XCTest
import Foundation
import LifecycleCore
final class HookCommandTests: XCTestCase {
    func testCodexStopUnderNearestProviderReturnsEmptyJSON() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: temp) }
        let alias = temp.appendingPathComponent("codex")
        try FileManager.default.copyItem(at: root.appendingPathComponent(".build/debug/HookFixture"), to: alias)
        let p = Process(), input = Pipe(), output = Pipe()
        p.executableURL = alias; p.arguments = [root.appendingPathComponent(".build/debug/AgentInboxLifecycle").path]
        p.standardInput = input; p.standardOutput = output; p.standardError = FileHandle.nullDevice
        try p.run()
        let data = try JSONSerialization.data(withJSONObject: ["hook_event_name": "Stop", "session_id": "fixture-session"])
        input.fileHandleForWriting.write(data + Data([10])); try input.fileHandleForWriting.close()
        let result = output.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit()
        let object = try XCTUnwrap(try? JSONSerialization.jsonObject(with: result) as? [String: Any])
        XCTAssertEqual(object["hookExit"] as? Int, 0)
        XCTAssertEqual(object["stopOutput"] as? String, "{}")
    }
}
