# Local lifecycle receiver

The inbox receives the existing PerformanceDaddy distributed notification
channel and the new Agentbox channel through a read-only Swift helper. It uses
Foundation and supported libproc APIs; it has no network, privileged service,
provider settings, credentials, process-control or reply API. Process identity
is PID plus microsecond start time, checked twice during inspection and again
every five seconds. Session IDs are SHA-256 equality keys, independent of PID.

The inventory enumerates same-user provider executables before any hook arrives.
It exposes only provider, PID and start identity. A detected process without a
hook is shown with unavailable activity, never inferred working or matched to
an arbitrary saved conversation. Exited processes disappear on the next scan.

`npm run build` prepares a release-mode universal macOS helper for the desktop
build. SwiftPM is the only build requirement beyond this repo's existing macOS
toolchain; there are no third-party Swift or new npm production dependencies.
The executable belongs outside asar at `Resources/native/AgentInboxLifecycle`.
Build preparation checks both architecture slices' actual minimum OS version,
so a newer host SDK cannot silently raise the declared macOS 13 requirement.
Development uses the same built helper from `native/bin`. Missing or stopped
receivers clear live evidence and expose unavailable status; source tests and
build preparation do not establish a signed or installed release.

Native tests are run with XcodeBuildMCP's Swift Package Test workflow, package
path `native`. They verify normalization, privacy, process start identity, and
both actual macOS notification channels using disposable local fixture processes.

Existing PerformanceDaddy `--agent-hook` commands keep working while the old
binary exists. New hooks may invoke `AgentInboxLifecycle --agent-hook Claude`
or `AgentInboxLifecycle --agent-hook Codex`, with the executable path quoted.
That mode reads at most 256 KiB from stdin, derives bounded redacted metadata,
and broadcasts it locally. It outputs `{}` for a successful Codex Stop without
making a provider decision. No hook files are installed or changed automatically.
Preserve existing settings and review any configuration transition separately.

Hook formats: [Claude reference](https://code.claude.com/docs/en/hooks),
[Codex reference](https://developers.openai.com/codex/hooks). Observed input
requests are status evidence; only the existing connection verifies delivery or
permission capability. Unlinked rows are explicitly status-only.
