import AppKit
import Foundation

if let output = ResumeFrozenCommand.run(Array(CommandLine.arguments.dropFirst()), endAfter: ResumeFrozenCommand.endProcess) {
    for line in output.lines { print(line) }
    exit(output.status)
}
guard CommandLine.arguments.dropFirst().elementsEqual(["--serve"]) else {
    fputs("AgentInboxAwake is controlled by Agent Inbox.\n", stderr)
    exit(64)
}
let application = NSApplication.shared
application.setActivationPolicy(.prohibited)
let paths = Paths.fromEnvironment()
try paths.createDirectories()
// Only one live manager may own the session, even after the Electron parent
// dies while an earlier helper is still restoring the machine.
let owner = open(paths.appSupport.appendingPathComponent(".controller.lock").path, O_CREAT | O_RDWR | O_NOFOLLOW, 0o600)
guard owner >= 0, flock(owner, LOCK_EX | LOCK_NB) == 0 else { exit(75) }
let manager = SessionManager.live(paths: paths)
AwakeProtocol.configure(manager)
var parentGone = false
let retryExit = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
    Task { @MainActor in
        if parentGone && !manager.isActive && !manager.state.isDirty && manager.pendingEnd == nil { exit(0) }
    }
}
Task { @MainActor in
    await manager.reconcile()
    do {
        for try await line in FileHandle.standardInput.bytes.lines {
            do {
                let command = try AwakeCommand.parse(line)
                if await AwakeProtocol.respond(command, manager: manager) { exit(0) }
            } catch {
                AwakeProtocol.emit(["id": -1, "ok": false, "error": "Invalid keep-awake command.", "state": AwakeProtocol.snapshot(manager)])
            }
        }
    } catch { Log.error("Inbox connection ended: \(error.localizedDescription)") }
    parentGone = true
    _ = await manager.end(reason: .quit)
}
application.run()
