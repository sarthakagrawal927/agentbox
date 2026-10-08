// Shared native metadata contract; raw prompts and executable paths stay local.
import Foundation
import CryptoKit
import CoreFoundation
import NativeProcess

public struct NativeProcess: Equatable {
    public let pid: Int32, parent: Int32
    public let started: UInt64
    public let provider: String?
    public init(pid: Int32, parent: Int32, started: UInt64, provider: String?) {
        self.pid = pid; self.parent = parent; self.started = started; self.provider = provider
    }
}
let names = ["codex": "Codex", "claude": "Claude", "devin": "Devin", "hermes": "Hermes", "aider": "Aider", "gemini": "Gemini CLI", "opencode": "OpenCode", "cursor-agent": "Cursor CLI"]
public let providers = Set(names.values)
public let events: Set<String> = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest", "PostToolUseFailure", "PreCompact", "PostCompact", "PostCompaction", "Elicitation", "ElicitationResult", "Stop", "StopFailure", "RateLimit", "Interrupt", "SessionEnd"]
public let currentChannel = Notification.Name("ac.astral.agentbox.agent-status")
public let legacyChannel = Notification.Name("com.significanthobbies.performancedaddy.agent-status")
public func inspectProcess(_ pid: Int32) -> NativeProcess? {
    var info = AIProcess()
    guard ai_process(pid, &info) == 1 else { return nil }
    let executable = withUnsafeBytes(of: info.path) { String(decoding: $0.prefix(while: { $0 != 0 }), as: UTF8.self) }
    let name = withUnsafeBytes(of: info.name) { String(decoding: $0.prefix(while: { $0 != 0 }), as: UTF8.self) }
    let base = URL(fileURLWithPath: executable).lastPathComponent.lowercased()
    let versions = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/share/claude/versions").path + "/"
    let parts = base.split(separator: ".", omittingEmptySubsequences: false)
    let versionedClaude = executable.hasPrefix(versions) && parts.count == 3 && parts.allSatisfy { !$0.isEmpty && $0.allSatisfy(\.isNumber) }
    return NativeProcess(pid: info.pid, parent: info.parent, started: info.started, provider: names[base] ?? names[name.lowercased()] ?? (versionedClaude ? "Claude" : nil))
}
public func sessionHash(_ id: String) -> String? {
    guard !id.isEmpty, id.utf8.count <= 256 else { return nil }
    return SHA256.hash(data: Data(id.utf8)).map { String(format: "%02x", $0) }.joined()
}
// Enumerate same-user provider executables through supported, read-only APIs.
// Presence establishes no session identity or activity state.
public func runningProviderProcesses() -> [NativeProcess] {
    var pids = [Int32](repeating: 0, count: 65536)
    let count = pids.withUnsafeMutableBufferPointer { ai_list_pids($0.baseAddress, Int32($0.count)) }
    return pids.prefix(Int(count)).compactMap { inspectProcess($0) }
        .filter { $0.provider != nil }.sorted { $0.pid < $1.pid }.prefix(512).map { $0 }
}
public func safeLabel(_ text: String, limit: Int) -> String {
    var result = text
    for (pattern, replacement) in [
        (#"\b[a-z][a-z0-9+.-]*://\S+"#, "[link]"),
        (#"\bBearer\s+\S+"#, "Bearer [private]"),
        (#"\b(api[_ -]?key|token|secret|password|authorization)\s*[:=]\s*\S+"#, "$1=[private]"),
        (#"(?:/Users/|/home/|~/)\S+"#, "[private path]"),
        (#"\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[a-z0-9_-]+"#, "[private]"),
        (#"\b[a-z0-9_-]{28,}\b"#, "[private]"),
        (#"\s+"#, " ")
    ] { result = result.replacingOccurrences(of: pattern, with: replacement, options: [.regularExpression, .caseInsensitive]) }
    return String(result.trimmingCharacters(in: .whitespacesAndNewlines).prefix(limit))
}
public func promptLabel(_ prompt: String) -> String? {
    guard prompt.utf8.count <= 262_144, !prompt.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("<task-notification>") else { return nil }
    guard let line = prompt.split(whereSeparator: \.isNewline).prefix(12).map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }).first(where: { !$0.isEmpty && !$0.hasPrefix("<pasted_content") && !$0.hasPrefix("```") }) else { return nil }
    let safe = safeLabel(line, limit: 88)
    return safe.isEmpty ? nil : safe
}
public func hookEvent(provider: String, input: [String: Any]) -> String? {
    guard providers.contains(provider), let raw = input["hook_event_name"] as? String, raw != "RateLimit" else { return nil }
    if raw == "StopFailure", provider == "Claude", input["error"] as? String == "rate_limit" { return "RateLimit" }
    if raw == "Notification" {
        switch input["notification_type"] as? String {
        case "permission_prompt", "elicitation_dialog", "elicitation_url_dialog", "agent_needs_input": return "PermissionRequest"
        case "idle_prompt", "agent_completed": return "Stop"
        default: return nil
        }
    }
    return events.contains(raw) ? raw : nil
}
public struct LifecycleSignal {
    public let dictionary: [String: Any]
    public init?(_ data: [String: Any], now: Double, process: NativeProcess) {
        func number(_ key: String) -> Double? {
            guard let n = data[key] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite else { return nil }
            return n.doubleValue
        }
        guard let pid = number("pid"), pid == Double(process.pid),
              let started = number("started"), started == Double(process.started), started <= 9_007_199_254_740_991,
              let provider = data["provider"] as? String, providers.contains(provider), provider == process.provider,
              let event = data["event"] as? String, events.contains(event),
              let ts = number("timestamp"), now.isFinite, abs(now - ts) < 120 else { return nil }
        var out: [String: Any] = ["pid": process.pid, "started": process.started, "provider": provider, "event": event, "timestamp": ts]
        for (field, limit) in [("workspace", 64), ("taskLabel", 96)] {
            if let text = data[field] as? String, text.count <= limit { out[field] = safeLabel(text, limit: limit) }
        }
        if let key = data["sessionKey"] as? String, key.count == 64, key.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }) { out["sessionKey"] = key }
        dictionary = out
    }
}
