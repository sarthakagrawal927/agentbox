# Agent Inbox reliability qualification

This is local development evidence, not a released installation or owner
acceptance. PerformanceDaddy controls and provider hook settings are preserved.

## Hardened failure paths

- Sleep cancels the read-only lifecycle receiver, its restart timers, and the
  transcript scan. Wake restarts the receiver with a fresh bounded retry budget,
  refreshes saved-thread discovery, and reapplies display placement. These paths
  also operate when app-owned agent workers are disabled.
- Scan generations prevent a cancelled pre-sleep result from overwriting a
  post-wake result or scheduling an extra polling loop.
- Receiver stdout errors clear live evidence and enter bounded recovery rather
  than throwing into the app. Old child messages remain ignored.
- Notification delivery falls back to the existing macOS banner if the companion
  fails. The unseen-notice queue retains at most 512 entries, independently of
  the durable inbox, preserving urgent approvals ahead of ordinary notices.
  Existing focus and coalescing rules remain authoritative.
- Closing the companion collapses it instead of destroying it. Notification and
  collapse callbacks avoid destroyed windows. A crashed companion renderer gets
  at most three reload attempts per app run; cached rows are resent after load.
  While it is recovering, notification delivery uses the fallback path.
- Desktop build preparation checks the actual deployment target in both native
  architecture slices, refusing a helper that raises the macOS 13 requirement.

## Evidence and outstanding gates

Tests first reproduced absent wake recovery, a broken stdout pipe, uncaught
companion delivery failures, unbounded notification retention, destructive
companion Close behavior, and missing renderer recovery. Focused tests verify
the fixes, cancellation after quit, provider-qualified conversation joins,
process-start identity, and pinning bounds. The original 84 focused checks
passed; subsequent regression checks cover idle-focus suppression, effective
reply permissions, asynchronous host handoff, isolated local packaging and
metadata-only discovery. TypeScript checking and the repository's public-content
audit pass. Current full-suite and runtime results are recorded in the
[dated qualification report](local-qualification-2026-10-07.md).

The earlier six native tests exercised both actual distributed notification
channels and the hook command with disposable local processes. Current sleep,
renderer-crash, notification-fallback and display-change tests inject events;
they do not establish physical sleep/wake, OS banner delivery or another display
on the user's Mac.

The complete desktop build and full suite now pass through the managed workspace
runner. The earlier workspace-budget blocker is historical. Actual Claude and
Codex acknowledged replies, restart retention, companion crash recovery and
receiver reconnection have live evidence. Injected suspend/resume also recovered
observers, but is not physical sleep/wake proof. Development Electron's macOS
banner request was refused; native banner delivery remains unverified.

Final packaged UI verification is blocked by the Mac screen locking during the
qualification run. Provider-specific outside-session reply and permission
delivery, physical sleep/wake, all-Spaces/external-display behavior, and
PerformanceDaddy removal parity remain separate acceptance gates.
