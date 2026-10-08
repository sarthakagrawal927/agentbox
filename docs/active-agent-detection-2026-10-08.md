# Active agent detection — 2026-10-08

The owner could not see active agent status. Desktop inspection found the main
window showing the upstream welcome screen, while the expanded companion held
hook-backed live status. A separate detection defect was reproduced: the native
receiver inventoried only processes that had already sent a hook. Provider
processes without a hook were absent entirely.

The receiver now enumerates same-user recognized provider executables through
supported libproc APIs at startup and every five seconds. PID plus microsecond
start identity remains authoritative. It reads no arguments or environment and
adds no privilege, dependency, provider configuration or reply capability.
Unhooked processes receive status-only rows with their provider and PID, with
activity explicitly unavailable. Process existence never implies working.
Hooked sessions, connected Claude agents and known app-owned workers retain
their existing rows. Exited or reused processes lose their previous identities;
receiver failure clears process evidence alongside lifecycle evidence.

The existing neutral-black companion layout and interactions were preserved;
no frontend, typography, theme or visual-system changes were made.

## Verification

- The actual native transport test first failed because a disposable Codex-named
  process was missing from the first inventory before its hook. It now passes.
- Streaming-parser and row-routing regressions first failed, then verified
  no-hook presence, no invented session join, PID reuse, process exit, receiver
  failure, no false attention and deduplication.
- All six native tests pass through XcodeBuildMCP.
- Changed-source checks and the complete suite pass: 849 files, 10,287 tests;
  one file and 17 tests remain repository skips.
- The complete desktop build passes, including the universal macOS 13 helper.
- The local bundle at `release/local-inbox-2026-10-08T04-23-29-257Z/mac-arm64/Agent Inbox.app`
  was launched with XcodeBuildMCP. It retains the existing dedicated data folder.
- The old local runtime was stopped; the updated runtime was reopened and its
  companion manually expanded through native UI controls. Actual rendered
  evidence showed five Working rows and eight detected Codex process rows with
  unavailable activity. These counts are a snapshot, not persistent claims.
  Screenshot evidence stays in ignored local scratch:
  `scripts/scratch/live-qualification/active-agents-native.png`.

The companion was left open with active statuses visible. The collapsed pill's
number still counts attention requests; detailed working status is inside it.
No process-only row grants reply or permission control. Other release and
migration gates remain as recorded in the earlier qualification; this fix does
not establish physical sleep/wake, external-display behavior or outside-session
reply delivery.
