# Agent Inbox source qualification and release handoff — 2026-10-09

Exact commit: `4975c71e43edef5ba8d328066b81ddb3c7a15821` (owner-fork `main`,
squash of #3). GitHub Actions do not run on this fork, so every result below
is a local run. These are source, build and package checks. They are not live
acceptance, rendered UI review or a release. Nothing was signed, notarized,
installed, published or pushed to the upstream repository. The owner's running
app, provider configuration and PerformanceDaddy were left untouched.

Earlier evidence in the [2026-10-07 report](local-qualification-2026-10-07.md)
and the [2026-10-08 detection note](active-agent-detection-2026-10-08.md)
stays historical. This record replaces their counts for this commit only.

## Source checks

| Check | Result |
| --- | --- |
| Full suite (Node 22.23.1, npm 10.9.8, `LANG=en_US.UTF-8`; this is CI's Node major) | 856 files passed, 1 skipped; **10,312 tests passed, 17 skipped** (10,329) |
| Renderer typecheck | pass |
| Desktop build, including the universal macOS 13 lifecycle helper | pass (existing chunk-size warning) |
| Native helper `swift test` (Swift 6.4) | **6 of 6 passed** |
| `npm audit` | 0 findings across 677 dependencies |
| `npm run check:public` | nothing private |

The suite ran in a clean checkout at the exact commit, with dependencies
byte-identical to a fresh frozen `npm ci` (`node_modules/.package-lock.json`
compared). Build, swift and package steps ran in a managed worktree.

### Environment-dependent failures (not regressions)

On this Mac's defaults (Node 24.21.0, npm 12.2.0, `en_IN` locale, a worktree
path containing spaces), the same commit reports 15 failed tests in 12 files.
All of them pass under the CI-equivalent environment above:

- **7 date tests assume US month-day order.** They read `Oct 11`, and `en-IN`
  produces `11 Oct`. Files: `a-repeating-task-is-a-row-like-every-other`,
  `a-status-runs-until-any-time-you-choose`, `every-thing-you-do-shows-in-the-thread`,
  `team-a-status-you-write-yourself`, `team-the-company-list` (2) and
  `the-time-is-the-door`.
- **6 tests and 1 file fail to load when the checkout path has spaces.** They
  read `new URL(import.meta.url).pathname` without decoding, so `%20` stays in
  the path. Files: `agents-start-when-her-limit-resets-not-half-an-hour-later`
  (load), `a-copy-run-from-source-says-agentbox-not-electron`,
  `a-test-that-reads-a-file-runs-when-that-file-changes` (4) and
  `nothing-leaves-without-her-switch`.
- **npm 12 changed the shape of `npm pack --dry-run --json`.** It now returns an
  object keyed by package name, not an array. `scripts/before-publish.mjs` and
  `the-published-package-carries-nothing-personal` take the text from the first
  `[` onward, so under npm 12 the publish guard falls back to refusing any
  uncommitted packable file (2 tests fail), and the package privacy test does
  not load at all. This is a real follow-up before anyone publishes with npm 12.

## GPL corresponding source

- `LICENSE` (GPL-3.0, SHA-256 `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`)
  matches upstream `main` byte for byte. It is also present in the packaged
  `app.asar`, identical to the committed file. `package.json` declares
  `GPL-3.0-or-later`.
- The complete corresponding source is the public commit itself. Running
  `git archive --format=tar --prefix=agentbox-<sha>/ <sha>` twice produced
  the same tar, SHA-256 `6c6019287c0799f399abbdb673382f47747311862fb52f895a9f5f46d993e796`,
  with 1,513 files. The `gzip -n -9` form has SHA-256
  `4385b7cb5341517f9e824aa0cbfca914bd774c3bc21d123befaa35d097e589b4`.
- The 2026-10-08 receipt's selection rules cover the app and build source and
  leave out private briefs, cloud, designs and CI. Applied to the committed
  tree, they select 1,488 files, digest
  `d520776aeb4b8d624d34976610e341ec8c99d1b06ce81013b4ab12affd021297`.
  Compared with the uncommitted 2026-10-08 receipt (1,487 files, `3c83ad21…`),
  the only differences are the #2 and #3 changes: `AGENTS.md`, `CLAUDE.md`,
  `scripts/hooks/pre-push`, two edited tests and one added test. No other drift.
- Of the files packaged in `app.asar` outside `node_modules`, 212 match the
  committed blobs exactly. Two differ by construction. electron-builder
  rewrites `package.json` (local entry point and name, no telemetry key), and
  the build regenerates `shared/claude-commands.generated.mjs` from the
  installed Claude Code (2.1.295 here, 2.1.294 in the commit). The other 25
  files are `renderer/dist` output built from committed renderer source.
  No packaged file is absent from the commit.

## Unsigned local review package

`node scripts/pack-local-inbox.mjs` was run at the exact commit. It is the
documented local-only path, with `identity: null`, no notarization and
`publish: never`. Output: Agent Inbox 0.1.11, arm64, directory target.

- Assertions passed: local bundle ID `com.significanthobbies.agentinbox.local`,
  local entry point, product name, macOS 13 minimum on the app and on both
  helper slices, privacy strings without Agentbox branding, no baked telemetry
  key, LICENSE present, private briefs excluded, no publisher, signing skipped.
- Signature: electron-builder skipped signing. Only the arm64 linker's ad-hoc
  signature remains on the Electron binary, with no Team ID.
- Review ZIP `Agent-Inbox-2026-10-08T21-06-51-742Z-arm64-review.zip`:
  `cb1e6af251cebc54003cda1466dbdf061b2875b16eeff7a168e08f509dd557a1`.
  `app.asar`: `916cc868f4187fd4ad6914d160330f3c41949490653f18015f20016e1d46ae76`.
  Native helper: `20517c9156e9179e98a91ef244cc1f21156352b64d80deb17a533f83a719ddcb`.

Receipts, logs, the review ZIP and the source tarball are kept in the ignored
`scripts/scratch/qual-2026-10-09/` folder of the primary checkout. This package
was not launched. It is the candidate the owner should review, and it does
not replace the running app.

## The release path is not app-owned yet

`npm run release` builds the **upstream** Agentbox identity: bundle ID
`ac.astral.app`, product Agentbox, universal DMG and ZIP, and an update feed at
`agentboxhq/agentbox-releases`. `pack-local-inbox.mjs` only produces an
unsigned directory build. So no command yet signs and notarizes Agent Inbox
under its own identity with its own update destination. Running `release` as
it stands would sign an Agentbox build that points at the upstream feed.

## Owner checklist

Native and live checks need desktop access and the owner present. Run them on
the review package above, or on a rebuild from the same commit with matching
hashes, using a separate data folder. Do not replace the running app.

- [ ] Identify the exact package under review by its `app.asar` hash, and
      record it.
- [ ] States on the final package: active, attention, failed or rate-limited,
      and unknown. Saved threads and queued work must not fill the battery.
      Unhooked processes show activity as unavailable.
- [ ] Linking, separately for Claude and Codex and for app-started and outside
      sessions: exact thread, PID plus start-time identity, shared hosts,
      exit and PID reuse, stale transport, acknowledged reply. A hook alone
      never unlocks Reply or Approve.
- [ ] Outside-session notification while unfocused, exact-row navigation,
      handoff, permission denial, interruption and recovery. No provider
      configuration changes.
- [ ] On-screen review of the A / Onyx pill and the conversation UI: keyboard
      and focus, drag and pin, display bounds and Spaces, optional sound,
      reduced motion, restart, physical sleep and wake.
- [ ] Finish `scripts/scratch/design-boundaries/receipt.json` with fresh
      rendered evidence and the design-workflow completion check.
- [ ] Decide the release identity and destination: bundle ID, Developer ID
      team, update feed and repository. Add an Agent Inbox release path for
      them (owned by the app, not upstream's `release`), and fix the npm 12
      `pack --json` parsing before relying on the publish guard.
- [ ] Give explicit written authorization to publish. Then rebuild from a
      clean checkout of the exact commit, sign, notarize and staple, publish,
      and check the public bytes, the update route and the installed behavior.
- [ ] Remove PerformanceDaddy's compatibility workflow only after replacement
      parity is proven and the migration has been reviewed.
