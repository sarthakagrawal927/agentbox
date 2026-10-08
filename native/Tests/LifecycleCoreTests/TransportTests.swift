// Exercise the actual macOS legacy/current notification channels against a
// disposable process with a real libproc identity. No provider configuration.
import XCTest
import Foundation
import LifecycleCore
final class TransportTests: XCTestCase {
    func testLegacyAndCurrentChannelsReachOnlyVerifiedNativeProcesses() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let binary = root.appendingPathComponent(".build/debug/AgentInboxLifecycle")
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: temp, withIntermediateDirectories: true)
        let alias = temp.appendingPathComponent("codex")
        try FileManager.default.copyItem(at: binary, to: alias)
        let process = Process(), pipe = Pipe()
        process.executableURL = alias; process.arguments = ["--listen"]; process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        defer { pipe.fileHandleForReading.readabilityHandler = nil; if process.isRunning { process.terminate(); process.waitUntilExit() }; try? FileManager.default.removeItem(at: temp) }
        let ready = expectation(description: "native receiver ready"), received = expectation(description: "both channels delivered")
        received.expectedFulfillmentCount = 2
        let lock = NSLock(); var buffer = Data(), count = 0, initialPids: [Int32] = []
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let chunk = handle.availableData
            lock.lock(); defer { lock.unlock() }
            buffer.append(chunk)
            while let end = buffer.firstIndex(of: 10) {
                let line = buffer.prefix(upTo: end); buffer.removeSubrange(...end)
                guard let obj = try? JSONSerialization.jsonObject(with: line) as? [String: Any] else { continue }
                if obj["type"] as? String == "inventory", count == 0 {
                    initialPids = (obj["processes"] as? [[String: Any]] ?? []).compactMap { ($0["pid"] as? NSNumber)?.int32Value }
                    count = 1; ready.fulfill()
                }
                if obj["type"] as? String == "event" {
                    let payload = obj["payload"] as? [String: Any]
                    XCTAssertEqual(payload?["taskLabel"] as? String, "Review transport")
                    XCTAssertNil(payload?["prompt"]); received.fulfill()
                }
            }
        }
        try process.run(); wait(for: [ready], timeout: 5)
        lock.lock(); let detectedBeforeHook = initialPids.contains(process.processIdentifier); lock.unlock()
        XCTAssertTrue(detectedBeforeHook, "A running provider must appear before any hook is sent")
        let live = try XCTUnwrap(inspectProcess(process.processIdentifier))
        XCTAssertEqual(live.provider, "Codex")
        let payload: [String: Any] = ["pid": live.pid, "started": live.started, "provider": "Codex", "event": "PermissionRequest", "timestamp": Date().timeIntervalSince1970, "sessionKey": sessionHash("transport-fixture")!, "taskLabel": "Review transport", "prompt": "excluded"]
        for channel in [legacyChannel, currentChannel] {
            DistributedNotificationCenter.default().postNotificationName(channel, object: nil, userInfo: payload, deliverImmediately: true)
        }
        wait(for: [received], timeout: 5)
    }
}
