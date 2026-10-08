# Agent Inbox product contract

Agent Inbox helps developers running local coding agents notice work that needs
them and reply to the correct conversation through a verified agent connection.
The working name is Agent Inbox; Agentbox is the upstream implementation baseline.

## Ownership

- Agent Inbox owns agent lifecycle/status views, the segmented agent-status
  battery in the floating pill, attention notifications, session linking,
  host-app handoff, replies and individual permission decisions. The pill replaces
  workflow summaries without requiring an additional menu-bar item.
- PerformanceDaddy owns measured CPU, memory, thermal and workload diagnosis.
  Agent process attribution stays there when it explains a measured workload.
- ContextDaddy owns skills/plugins/MCP structural health, instructions, memory,
  context/invocation policy, token history, provider allowance and run telemetry.
  Inbox execution modes govern its own explicitly started runs, not global
  skill/MCP policy. Provider rate-limit errors still constrain a running worker;
  the inbox does not poll allowances or duplicate ContextDaddy's usage dashboard.
- CodeVetter owns execution-backed code verification.

## First release scope

One local inbox for app-started Claude Code and Codex conversations, plus
explicitly connected outside sessions. A session is replyable only when its
transport and identity have been verified. A hook, process, imported transcript
or status badge alone never establishes a reply or approval channel. Other
providers may have lifecycle evidence without having reply support.

Show working, needs input, failed, rate limited, stopped and unknown states
separately. Stale activity is unknown; process existence is not proof of work.
Keep shared-host conversations separate, and guard against PID reuse. A
notification opens the exact conversation or hands off to its host app.

Replies retain their draft on failure and report acceptance only after the
transport acknowledges it. Permission decisions remain separate from ordinary
replies. An unavailable connection provides a host-app handoff.

## Boundaries

Inbox state stays on this machine. Model requests use the user's existing
provider account and may travel to that provider. Cloud teams, remote access,
voice, analytics, autonomous project driving, process termination, cleanup and
configuration management are outside this first release.

Local scope is enforced at startup and before settings writes, including for
previously saved opt-ins. Automatic machine-based pacing, memory gating, orphan
process termination, autonomous project work and telemetry stay disabled in this
fork. Manual worker concurrency and verified replies remain inbox controls.
Saved settings are preserved rather than silently rewritten by startup.

The agent battery counts only observed live sessions/processes and running or
connected inbox agents. Saved transcripts and queued work do not fill it.
Through twelve agents it uses individual segments; larger groups use proportional
state strips. Working is green, attention amber, blocked red and unavailable
neutral. An empty outline means no live agents observed, not a verified all-clear.
It is neither a charge percentage nor a remaining-token estimate. Device battery
and power diagnosis stay in PerformanceDaddy; provider allowance stays in ContextDaddy.

Connecting a hook requires a visible configuration preview; preserve existing
settings and do not automatically rewrite agent configuration. Capture bounded
lifecycle metadata. Raw hook prompts, transcript paths and payloads are not
persisted by the lifecycle adapter; a short request label is opt-in evidence.

Keep the working Electron baseline until platform evidence justifies a change.
Measure idle cost and behavior before calling the product lean. Preserve the
upstream GPL-3.0-or-later license and attribution.

## Current evidence and remaining work

The development baseline completed live Claude Code and Codex conversations,
exact-thread navigation from the pill, and acknowledged replies on those same
threads. Build, typecheck and the full suite passed. The migrated
lifecycle model lives in `shared/agent-lifecycle.mjs`. A read-only native receiver
now accepts the existing PerformanceDaddy and new inbox notification channels,
verifies PID/start/provider identity and keeps hashed session identities separate.
Native transport tests use disposable processes. The running shipping entry
point recovered from a killed companion renderer and a disconnected native
receiver; restart retained both smoke-check conversations. See the dated
[qualification report](docs/local-qualification-2026-10-07.md) for evidence and
limits. Physical sleep/wake, OS notification banners and provider-specific
outside-session reply/permission delivery still need live verification.
Dependency audit findings remain release work.

The separate local package uses its own application identity and data folder,
disables telemetry, cloud teams and the upstream updater, and defaults new
conversations to Claude Plan and Codex Read Only. It is an unsigned development
build, not a signed/notarized release or an installed production replacement.

Local thread discovery runs automatically at startup and once a minute in a
bounded background worker. It reads existing Claude Code, Claude Desktop and
Codex session history without changing provider configuration. Current coverage
is the last ten days, up to 256 saved conversations, subject to the readers'
history and time limits; unavailable or partial scans are disclosed. Other
providers and older archives are not claimed as discovered.
Automatic Codex discovery reads identity/title metadata without replaying full
histories. The inherited history-mirror timer skips transcript reads when no
imported or pending-import conversation needs refreshing. Explicit import still
reads the conversation body.

Discovered conversations appear as Saved thread, below attention and live
sessions. They do not count as working, needs input or a verified reply channel,
and discovery sends no notification. Exact provider/session selection opens
the existing import review. Import and any later agent start remain explicit.
Already imported conversations and live Claude sessions are deduplicated.

Hook evidence replaces its exact matching saved row, opens a known inbox or
connected Claude conversation, or offers the exact import review. Unlinked
evidence is visibly Status only. A rate limit is distinct from a failed run.
Receiver failure clears live evidence rather than leaving it marked working;
crash recovery is bounded. Native process inspection discovers recognized
provider executables belonging to the current user every five seconds, without
a privileged service or monitoring commands. Unhooked processes appear with
their PID and unavailable activity; process existence never establishes a
working task, a conversation join or a reply channel. Hooked and already
connected rows remain authoritative.
Fresh attention transitions use the existing coalescing/focus suppression path.
Existing PerformanceDaddy hook commands continue to work during migration; no
real provider settings have been changed. PerformanceDaddy workflow navigation
remains until replacement parity is qualified.

There is no separate landing page for this development fork. Its entry point is
the local app and the upstream README. A future landing page must use the same
identity and describe only verified behavior.
