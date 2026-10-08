import LifecycleCore
import Foundation
import Darwin

func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return }
    FileHandle.standardOutput.write(data + Data([10]))
}
if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--agent-hook" {
    let provider = CommandLine.arguments[2]
    let input = FileHandle.standardInput.readData(ofLength: 262_145)
    guard input.count <= 262_144, let object = try? JSONSerialization.jsonObject(with: input) as? [String: Any] else { exit(0) }
    defer { if provider == "Codex", object["hook_event_name"] as? String == "Stop" { FileHandle.standardOutput.write(Data("{}".utf8)) } }
    if let event = hookEvent(provider: provider, input: object) {
        var pid = getppid(), seen = Set<Int32>(), owner: NativeProcess?
        for _ in 0..<32 {
            guard pid > 1, seen.insert(pid).inserted, let process = inspectProcess(pid) else { break }
            if process.provider == provider { owner = process; break }
            pid = process.parent
        }
        if let owner {
            var payload: [String: Any] = ["pid": owner.pid, "started": owner.started, "provider": provider, "event": event, "timestamp": Date().timeIntervalSince1970]
            if let id = object["session_id"] as? String, let key = sessionHash(id) { payload["sessionKey"] = key }
            if let cwd = object["cwd"] as? String { payload["workspace"] = safeLabel(URL(fileURLWithPath: cwd).lastPathComponent, limit: 64) }
            if object["hook_event_name"] as? String == "UserPromptSubmit", let prompt = object["prompt"] as? String, let label = promptLabel(prompt) { payload["taskLabel"] = label }
            DistributedNotificationCenter.default().postNotificationName(currentChannel, object: nil, userInfo: payload, deliverImmediately: true)
        }
    }
} else if CommandLine.arguments.count == 2, CommandLine.arguments[1] == "--listen" {
    var known: [Int32: NativeProcess] = [:]
    func inventory() {
        known = Dictionary(uniqueKeysWithValues: runningProviderProcesses().map { ($0.pid, $0) })
        emit(["type": "inventory", "processes": known.values.map { ["pid": $0.pid, "started": $0.started, "provider": $0.provider ?? ""] as [String: Any] }])
    }
    let observers = [currentChannel, legacyChannel].map { channel in
        DistributedNotificationCenter.default().addObserver(forName: channel, object: nil, queue: .main) { note in
            guard let data = note.userInfo as? [String: Any], let pid = data["pid"] as? NSNumber,
                  let process = inspectProcess(pid.int32Value),
                  let signal = LifecycleSignal(data, now: Date().timeIntervalSince1970, process: process) else { return }
            if known.count >= 512, known[process.pid] == nil { return }
            known[process.pid] = process
            emit(["type": "event", "payload": signal.dictionary]); inventory()
        }
    }
    inventory()
    let timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in inventory() }
    withExtendedLifetime((observers, timer)) { RunLoop.main.run() }
}
