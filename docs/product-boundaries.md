# Ownership across PerformanceDaddy, ContextDaddy and Agent Inbox

| Product | Owns | Does not own |
| --- | --- | --- |
| PerformanceDaddy | Measured CPU/memory/pressure/thermal/device-power diagnosis, agent process attribution, ports, captures and comparable follow-ups | Agent replies, workflow attention, skill/context governance, token/allowance dashboards |
| ContextDaddy | Skills/plugins/MCP structural health, instructions/memory/scope, persistent skill invocation/access policy, token history, provider allowance and run telemetry | Agent conversations, reply delivery, live inbox status, individual permission approval, Mac optimization |
| Agent Inbox | Observed live agents/threads, segmented status battery, floating/pinnable pill, attention, exact linking/handoff, replies and individual permission requests | Provider allowance polling, token dashboards, global skill/MCP policy, machine optimization, cleanup or autonomous project driving |

An Inbox run's explicit execution mode and worker concurrency belong to Inbox.
Shared skill visibility/invocation and global context governance belong to
ContextDaddy. Provider rate-limit errors may hold a worker without making
Inbox a provider-allowance dashboard. App-owned worker prompts and conversation
history are execution inputs; Inbox does not manage global provider instructions.
Runtime relevance attached to an agent's CPU/RSS/process tree belongs to
PerformanceDaddy. Lifecycle cleanup remains StorageDaddy's separate responsibility.

## Required agent battery

Retain the recognizable outline and segmented status approach. Its destination
is the existing Inbox pill, with no new menu-bar item. Individual marks represent
up to twelve observed agents; larger groups use proportional state strips.
Green is working, amber attention, red blocked and neutral unavailable/at prompt.
Saved history and queued work do not fill it. Empty means no live agents observed,
with possible coverage gaps. It is not a charge or remaining-token percentage.
Device battery and power belong to PerformanceDaddy; allowances to ContextDaddy.

## Source enforcement and verification, 2026-10-08

- Local Inbox startup applies an effective configuration that disables inherited
  telemetry, automatic machine pacing, memory gating, orphan process cleanup and
  autonomous project driving. It preserves saved configuration on disk.
- Inbox settings reject those writes before mutation and omit their controls.
  Manual concurrency, connection settings and explicit execution modes remain.
- Local snapshots return no allowance readings and evaluate neither provider
  reader. The upstream entry point retains its previous allowance behavior.
- ContextDaddy's telemetry destination is named Run telemetry. Historical naming
  records remain intact; unrelated usage changes in its checkout were preserved.
- Each repository's product and agent instructions now state the ownership split.
- New boundary/battery/settings tests were first observed failing. The final
  Inbox suite passes 10,300 tests with 17 skipped; typecheck and build pass.
  ContextDaddy's focused model checks and full 142-test native suite pass.
  PerformanceDaddy changes are documentation only; its battery source is retained.

Outside hook evidence remains in the battery even when the exact imported
conversation is already queued. Its observed process state is separate from the
conversation's request/action state. The companion forwards only bounded,
recognized observed states; this creates no reply or approval capability.

The new pill battery is source/build-qualified, not freshly render-qualified.
Computer-use inspection failed with `Sky Computer Use native pipe startup failed`
twice, including after reset. Browser discovery returned `No browser is available`.
No fresh captures, visual score, pinning/keyboard run or slop-scan result is claimed.
The preserve-lane preflight passed; design completion remains open. Scratch receipt
and logs are retained locally under `scripts/scratch/design-boundaries/`.

The running local package and installed apps were not replaced in this pass.
PerformanceDaddy's menu battery, wall and hook setup remain migration compatibility
until Inbox proves replacement parity. Physical sleep/wake, OS notifications and
outside-session handoff/permission delivery retain their existing qualification
gates; see [the migration ledger](performance-migration.md). Do not remove those
surfaces or describe the migration as complete from tests/build alone.
