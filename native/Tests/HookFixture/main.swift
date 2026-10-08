// Disposable ancestry fixture for native integration tests, never packaged.
import Foundation
guard CommandLine.arguments.count == 2 else { exit(1) }
let executable = URL(fileURLWithPath: CommandLine.arguments[1])
while let line = readLine() {
    guard let data = line.data(using: .utf8), data.count <= 262_144 else { continue }
    let process = Process(), input = Pipe(), output = Pipe()
    process.executableURL = executable; process.arguments = ["--agent-hook", "Codex"]
    process.standardInput = input; process.standardOutput = output; process.standardError = FileHandle.nullDevice
    do {
        try process.run(); input.fileHandleForWriting.write(data); try input.fileHandleForWriting.close()
        let result = output.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
        let obj: [String: Any] = ["hookExit": process.terminationStatus, "stopOutput": String(decoding: result, as: UTF8.self)]
        FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: obj) + Data([10]))
    } catch { exit(1) }
}
