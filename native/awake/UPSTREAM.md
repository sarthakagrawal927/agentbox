Insomnia power and recovery engine, MIT licensed.
Source: https://github.com/krishhgg/Insomnia
Pinned commit: e242782584451a4fa4479bbd8f5a5e149d2f254c (2026-10-19).

Core, Model, Store, System and DurationInput sources, backstop.sh, and selected
non-destructive tests are retained from that commit. Local changes namespace
Paths, LaunchdBackstop log paths and backstop.sh to AgentInboxAwake. The native
menu bar UI is replaced by a bounded JSON-lines protocol controlled by Inbox.
Menu-only assertions are omitted from LidActionsTests; RecoveryLockTests bounds
the OS process before using the pinned engine's ProcessExit.exited() API.
The original license is in LICENSE. No upstream installer is executed.

Inbox disables freezing, Docker pausing, App Nap preference changes, hotspot
handoff and tmux input. Lid darkening, audio restoration, low-power rules,
battery/thermal session ends, journaling and launchd recovery remain upstream.
Requires Apple silicon and macOS 26+. Fake-device tests never change live power.
