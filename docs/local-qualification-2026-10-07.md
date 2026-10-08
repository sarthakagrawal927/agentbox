# Agent Inbox local qualification — 2026-10-07

This report separates executable source checks, actual provider responses and
desktop behavior. The working checkout is intentionally uncommitted. No provider
configuration was rewritten, no PerformanceDaddy control was removed, and no
package was signed, notarized, installed into Applications or published.

## Verified behavior

| Path | Evidence |
| --- | --- |
| App-started Claude Code | Real Sonnet conversation returned `INBOX_CLAUDE_READY`; replying in Plan mode returned `INBOX_CLAUDE_REPLY_PONG` in the same history |
| App-started Codex | Real GPT conversation returned `INBOX_CODEX_READY`; replying in Read Only mode returned `INBOX_CODEX_REPLY_PONG` in the same history |
| Exact-row navigation | With the conversation window hidden, selecting each provider's pill row opened that exact smoke-check conversation |
| Automatic discovery | 113 raw saved-thread identities/titles; 111 after live/imported deduplication in the running inbox; partial=false |
| Attention | Actual lifecycle attention expanded the companion and advanced its notice sequence; saved-thread discovery produces no attention notice |
| Restart | Both app-started smoke threads survived qualification-runtime restarts |
| Renderer crash | Forcefully crashing the owned companion renderer reloaded it and resent cached rows in 0.558 seconds |
| Receiver disconnect | Terminating only the qualification app's own native receiver cleared live evidence, then recovered to ready in about 1.4 seconds |
| Injected suspend/resume | Observers became unavailable on suspend, recovered to ready after resume and retained discovery; this was an injected event, not physical sleep |

Live verification used the shipping entry point and renderer with a separate
qualification data/store folder. Existing provider sign-ins stayed in their
normal locations. Smoke prompts prohibited tools, file reads, writes and command
execution. Evidence files are ignored local scratch artifacts under
`scripts/scratch/live-qualification/`, including `claude-reply.png`,
`codex-reply.png`, `runtime.jsonl` and `power.jsonl`. Raw private conversation
history was not copied into this report.

## Changes qualified in this continuation

- Focus suppression now uses the same idle-aware rule for both the main inbox
  and companion. A window left focused while the user is away no longer swallows
  an attention event indefinitely.
- The reply footer reflects the effective project/workspace Codex permission
  mode. Explicit row overrides still win. Claude Plan remains distinct.
- Host handoff awaits the measured parent-process table before resolving the
  owning application; missing or cyclic ancestry fails closed.
- A separate local entry point preserves existing user state, uses a dedicated
  application/data identity, and disables telemetry, teams and automatic updates.
- Automatic Codex discovery reads bounded metadata instead of replaying whole
  histories. Explicit import retains the full reader. The inherited mirror
  timer skips history replay when no imported/pending-import row needs updating.

Each production change had a failing regression check before implementation.
The final full run passed **848 files and 10,284 tests**, with one file and 17
tests skipped by the repository. The complete desktop build and renderer
typecheck passed. Existing bundle-size and toolchain deprecation warnings do not
establish a release-quality or performance pass.

## Resource measurement

A same-process, same-cutoff paired scan returned identical identities and titles
for all 113 threads. Full-history scanning consumed 3,280.407 ms of CPU time;
metadata scanning consumed 54.521 ms, a 98.34% reduction for that operation.
This is scanner evidence, not a claim about total application resource use.

The first desktop measurement was contaminated by accessibility requests timing
out after the screen locked. It is retained as unknown rather than used as an
idle baseline. Subsequent controlled measurements excluded UI automation,
app-owned active workers and the first 30 seconds after startup. Both windows
were visible and unfocused with the pill collapsed; the screen remained locked.
The final 180.034-second interval consumed 2.411 CPU seconds across Electron
processes: **1.34% of one core**. Summed process resident memory had a median of
**639.17 MiB** (range 623.84–654.25 MiB). See `idle-final.json` for the interval
and process totals. The Electron memory footprint remains substantial; this
report does not call the application lean.

CPU totals sum the change in Electron process cumulative CPU seconds and divide
by elapsed wall time, expressed as a percentage of one CPU core. Resident memory
is the sum of process working sets, which can count shared pages multiple times;
it is not exclusive application memory. The native receiver and provider CLI
children are excluded from these Electron metrics. Method definitions:
[Electron CPU usage](https://www.electronjs.org/docs/latest/api/structures/cpu-usage)
and [memory information](https://www.electronjs.org/docs/latest/api/structures/memory-info).

This constrained measurement does not establish unlocked, hidden-window idle
cost, battery impact or memory efficiency under many active sessions. Imported
Codex mirror histories still require full reads when those rows are present.

## Local package

The prepared arm64 bundle is:

`release/local-inbox-2026-10-07T16-21-39-604Z/mac-arm64/Agent Inbox.app`

Its application identifier is `com.significanthobbies.agentinbox.local`, and its
data lives in Application Support/Agent Inbox. New local defaults disable
autonomous agents and cleanup, use Claude Plan and Codex Read Only, and allow
read-only outside-agent discovery. It includes the native lifecycle receiver
and retains upstream GPL licensing/attribution. Signing and publishing were
explicitly disabled. Earlier package directories are historical, not the final
candidate.

XcodeBuildMCP launched this exact final bundle successfully and confirmed its
dedicated bundle identity. The executable remained running afterward. Native
launch success does not establish rendered UI verification while the screen is
locked. A local `Agent-Inbox-local.zip` is prepared alongside the bundle; SHA-256:

`4deefc2d323e72e104b3776824380a320525e92c7e4bdf6119cc8dcec36d67fa`

## Open acceptance gates

The Mac recorded a real screen lock during qualification; no subsequent unlock
was observed. Native UI automation then timed out. Final packaged rendered
verification requires the owner to unlock the Mac. Physical sleep/wake also
requires an owner-coordinated hardware cycle.

Development Electron's OS notification request was refused with
`UNErrorDomain` code 1. This is not native banner-delivery proof. Pill attention
is verified separately. Outside-provider permission delivery and acknowledged
replies, actual host-app handoff, all-Spaces pinning and external-display changes
remain unverified on the owner's desktop.

PerformanceDaddy's agent wall, status menu and hook setup stay in place until
these replacement paths have parity. Its diagnostic process attribution stays
permanently. ContextDaddy and CodeVetter retain their separate product ownership.
