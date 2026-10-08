// The migrated hook must preserve process/session identity and discard raw
// prompt data before crossing the local notification-to-inbox boundary.
import XCTest
@testable import LifecycleCore
final class LifecycleTests: XCTestCase {
    let now = 1_800_000_000.0
    func signal(_ extra: [String: Any] = [:]) -> [String: Any] {
        ["pid": 42, "started": 100, "provider": "Codex", "event": "Stop", "timestamp": now].merging(extra) { _, b in b }
    }
    func testFreshSignalsRequireExactLiveIdentityAndProvider() {
        let live = NativeProcess(pid: 42, parent: 1, started: 100, provider: "Codex")
        XCTAssertNotNil(LifecycleSignal(signal(), now: now, process: live))
        for extra in [["pid": 43], ["started": 101], ["provider": "Claude"], ["timestamp": now - 120], ["timestamp": now + 120], ["event": "Invented"], ["pid": true]] as [[String: Any]] {
            XCTAssertNil(LifecycleSignal(signal(extra), now: now, process: live))
        }
    }
    func testSignalWhitelistRedactsAndBoundsLabels() {
        let live = NativeProcess(pid: 42, parent: 1, started: 100, provider: "Codex")
        let value = LifecycleSignal(signal(["taskLabel": "Connect postgres://demo:fake-pass@localhost/db", "workspace": "fixture", "sessionKey": String(repeating: "a", count: 64), "prompt": "do not forward", "canReply": true]), now: now, process: live)! // public-check: allow -- fake redaction fixture
        XCTAssertEqual(value.dictionary["taskLabel"] as? String, "Connect [link]")
        XCTAssertNil(value.dictionary["prompt"])
        XCTAssertNil(value.dictionary["canReply"])
        XCTAssertEqual(value.dictionary["workspace"] as? String, "fixture")
        XCTAssertNil(LifecycleSignal(signal(["taskLabel": String(repeating: "x", count: 97)]), now: now, process: live)!.dictionary["taskLabel"])
    }
    func testHookNormalizationAndCodexStopContract() {
        XCTAssertEqual(hookEvent(provider: "Claude", input: ["hook_event_name": "Notification", "notification_type": "permission_prompt"]), "PermissionRequest")
        XCTAssertEqual(hookEvent(provider: "Claude", input: ["hook_event_name": "StopFailure", "error": "rate_limit"]), "RateLimit")
        XCTAssertNil(hookEvent(provider: "Claude", input: ["hook_event_name": "RateLimit"]))
        XCTAssertNil(hookEvent(provider: "Unknown", input: ["hook_event_name": "Stop"]))
        XCTAssertEqual(sessionHash("fixture-session")?.count, 64)
        XCTAssertNil(sessionHash(String(repeating: "é", count: 129)))
        XCTAssertNil(promptLabel("<task-notification>\nCompleted"))
        XCTAssertEqual(promptLabel("\n```\nReview README.md"), "Review README.md")
    }
    func testNativeInspectorReadsOwnStartIdentityWithoutArgumentsOrPaths() {
        let current = inspectProcess(Int32(ProcessInfo.processInfo.processIdentifier))
        XCTAssertNotNil(current)
        XCTAssertGreaterThan(current!.started, 0)
        XCTAssertEqual(current, inspectProcess(current!.pid))
        XCTAssertNil(inspectProcess(-1))
    }
}
