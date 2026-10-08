# Move agent workflow ownership out of PerformanceDaddy

## Migration boundary

| PerformanceDaddy source | Destination | State |
| --- | --- | --- |
| `PerformanceCore/AgentWallStatus.swift` lifecycle rules | Inbox lifecycle model | Pure model ported; 16 normalization, freshness, identity and boundary tests pass |
| `AgentHookCommand.swift` event normalization, bounded labels and session hashing | Inbox hook adapter | Pure rules and native receiver implemented; legacy/current macOS transport and Codex Stop stdout have native fixture proof; complete rendered qualification pending |
| `AgentWallView.swift` session wall and session linking | Inbox session surface | Selected right-edge companion runs locally; exact session joins implemented; outside-provider and removal parity still pending |
| `AgentStatusMenu.swift` distribution and per-agent status | Inbox right-edge companion | Segmented battery ported in source; individual marks through twelve, proportional strips above twelve, saved threads excluded and unknown neutral. Fresh rendered qualification pending; retain the PerformanceDaddy battery |
| `AgentHookSetupView` setup instructions | Inbox connection setup | Reviewed migration path pending; no real agent settings changed |
| Host-app jump-back and conversation identity | Inbox connection/handoff | Upstream baseline exists; provider-specific verification pending |
| Process tree, agent workload grouping, CPU/RSS and thermal evidence | PerformanceDaddy | Retain for diagnosis |
| Load alerts, capture history and comparable follow-up measurements | PerformanceDaddy | Retain |

## Order and acceptance

1. Port lifecycle semantics before removing their current source. Preserve
   normalization, freshness, redaction and conversation isolation tests. Never
   infer reply capability from an observed lifecycle event.
2. Select the replacement inbox/menu/session direction from rendered previews.
   The prior separate-product approval does not select a visual direction.
3. Connect lifecycle evidence through a supported local transport. Match both
   PID and process start identity. Carry session identity independently for
   shared Codex app servers. Keep metadata bounded and local.
4. Verify notifications while the app is unfocused, exact-row navigation,
   acknowledged replies, rejected/stale connections, app restart and unavailable
   sources. Verify app-started and outside sessions separately for each provider.
5. Move wall/menu/setup ownership to Agent Inbox only after those paths work.
   Keep old hook commands compatible during an explicit, reviewed configuration
   transition. Remove PerformanceDaddy's workflow navigation with native
   build/tests and rendered evidence. Preserve diagnostic process attribution.

## Migration safeguards

The agent-status battery is a required retained feature. Its long-term home is
the pinnable Inbox pill. Device battery/power diagnosis remains in PerformanceDaddy;
provider allowances, token history and run telemetry remain in ContextDaddy.
Never replace agent states with a quota percentage or fill live segments from
saved transcripts. Keep the original menu battery until the replacement passes
rendered and live-state qualification.

Do not remove the existing agent wall or hook entry point before the replacement
can receive events and open the correct conversation. Do not modify provider
settings, copy credentials, automatically import all history, or grant agents
new permissions as part of this move. Source features, fixture checks, live
provider behavior, OS notification delivery and released installation remain
distinct evidence states.

## Design lane

This is an overhaul of workflow navigation: three different rendered systems
must be reviewed and one selected before UI implementation. The inbox fork is a
standalone development app with no separate landing page. PerformanceDaddy's
existing diagnostic design remains the authority for its eventual leaner UI;
inspect its app and landing page before implementing that navigation change.

## Local development verification

The isolated fork runs a neutral-black right-edge pill and opens the existing
conversation window on demand. An app-owned Codex conversation accepted a reply
and returned the exact smoke-check result. With the conversation window hidden,
the pill expanded for the resulting attention item. Escape collapses the panel,
restores pill focus, and removes hidden conversation buttons from keyboard access.
The default conversation window shares the pill's neutral palette.

The fork also detects recent Claude Code, Claude Desktop and Codex conversations
automatically in a background worker. Saved-thread discovery is separate from
the native hook migration and from live activity. Discovery does not import,
resume, reply to or approve a session. Its scope is ten days and at most 256
results, with partial/unavailable scan states shown. Exact-row selection opens
the existing import review without starting an agent.

The companion's IPC scope, stale-row rejection, bounded metadata, display bounds,
focus preservation, notification coalescing, and unavailable states have focused
checks. Browser captures at 390, 768 and 1440 pixels use explicitly labeled
example data; they do not establish live provider permissions or hook transport.

Native hook receipt, shared-process Codex lifecycle linking, provider-specific
outside-session handoffs, and removal of PerformanceDaddy's workflow navigation
remain pending. No provider configuration, PerformanceDaddy source, installed
application, or released package was changed in this prototype phase.

## Native receiver continuation

`native/` uses Foundation and read-only libproc APIs, with no third-party Swift
dependencies. Both the legacy PerformanceDaddy and new Agentbox distributed
notification channels reach the actual receiver in native fixture tests. The
native hook command also satisfies Codex Stop's empty-JSON output contract.
PID plus microsecond start identity rejects reused processes; provider/session
hash joins keep shared-server conversations distinct. Conversation lookup is
indexed once per snapshot, and newest evidence deduplicates repeated session
observations. Missing receivers, dead processes, invalid payloads, stale work,
obsolete child streams and repeated failures have separate source checks.

The existing companion row pattern now distinguishes Rate limited and Status
only. Unlinked observations cannot open a conversation or offer an approval.
Linked saved rows retain Review import; hook evidence creates no reply capability.
Fresh observed attention uses the existing notification coalescing rules.

The shared Fleet managed-workspace disk budget blocked the earlier continuation.
That blocker is now resolved: the complete desktop build and full suite pass.
PerformanceDaddy workflow controls and real hook settings remain preserved
until replacement parity is verified. The historical prototype evidence above
remains separate from the latest qualification.

The subsequent [reliability qualification](reliability.md) records sleep/wake
observer recovery, stale-scan cancellation, bounded notification retention,
fallback delivery, companion Close protection and renderer crash recovery.
The [2026-10-07 qualification](local-qualification-2026-10-07.md) adds actual
Claude/Codex replies, exact-row navigation, restart retention, renderer recovery
and receiver reconnection. Physical sleep/wake and outside-session connection,
handoff and permission delivery still block removal of PerformanceDaddy's wall,
menu and hook setup. Runtime diagnostic attribution will remain there.
