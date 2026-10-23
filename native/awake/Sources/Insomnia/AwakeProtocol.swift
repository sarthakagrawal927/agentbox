import Foundation

struct AwakeCommand: Decodable {
    enum Action: String, Decodable { case status, start, extend, end, quit }
    let id: Int
    let action: Action
    let minutes: Int?

    static func parse(_ line: String) throws -> AwakeCommand {
        guard line.utf8.count <= 4096 else { throw ProtocolError.invalid }
        let command = try JSONDecoder().decode(Self.self, from: Data(line.utf8))
        if command.action == .start || command.action == .extend {
            guard let minutes = command.minutes, (1...43200).contains(minutes) else { throw ProtocolError.invalid }
        }
        return command
    }
    enum ProtocolError: Error { case invalid }
}

@MainActor
enum AwakeProtocol {
    static func configure(_ manager: SessionManager) {
        // Inbox owns only a user-started power session. Never stop apps, type
        // into agents, change their preferences, or reconfigure networking.
        manager.config.freezeList = []
        manager.config.freezeAllApps = false
        manager.config.dockerRule = false
        manager.config.disableAppNapForAgents = false
        manager.config.muteOnLidClose = true
        manager.config.darkenDisplayOnLidClose = true
        manager.config.lowPowerOnLidClose = true
        manager.config.hotspotSSID = ""
        manager.config.tmuxTargets = []
        manager.config.thermalRules = true
        manager.config.endFloor = 10
        manager.config.lowPowerFloor = 40
    }

    static func snapshot(_ manager: SessionManager) -> [String: Any] {
        let warnings = [manager.lastError, manager.foreignSleepWarning, manager.commandWarning,
                        manager.keptDisplayReadDoubt] .compactMap { $0 }
            + manager.darkenRefusals
            + manager.outputsWaitingForRestore.map { "Reconnect audio output \($0.name ?? "unknown output") to restore its saved volume." }
        let recovering = manager.pendingEnd != nil || (!manager.isActive && manager.state.isDirty)
        return ["phase": recovering ? "recovery" : manager.isActive ? "active" : "idle",
                "endsAt": manager.session.map { $0.endsAt.timeIntervalSince1970 * 1000 } as Any? ?? NSNull(),
                "warnings": warnings]
    }

    static func respond(_ command: AwakeCommand, manager: SessionManager) async -> Bool {
        var quit = false
        switch command.action {
        case .status: break
        case .start: await manager.start(duration: Double(command.minutes!) * 60)
        case .extend: await manager.extend(by: Double(command.minutes!) * 60)
        case .end: _ = await manager.end(reason: .user)
        case .quit:
            let outcome = await manager.end(reason: .quit)
            quit = outcome == .restored && !manager.state.isDirty
        }
        let state = snapshot(manager)
        let succeeded: Bool
        switch command.action {
        case .start, .extend: succeeded = manager.isActive && manager.lastError == nil
        case .end, .quit: succeeded = !manager.isActive && !manager.state.isDirty
        case .status: succeeded = true
        }
        var result: [String: Any] = ["id": command.id, "ok": succeeded, "state": state]
        if !succeeded { result["error"] = manager.lastError ?? "Restoration is unfinished. Keep Agent Inbox open; recovery will retry." }
        emit(result)
        return quit
    }

    static func emit(_ value: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { return }
        try? FileHandle.standardOutput.write(contentsOf: data + Data([10]))
    }
}
