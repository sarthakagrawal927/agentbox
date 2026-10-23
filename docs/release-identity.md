# Agent Inbox release identity

`package.json` still carries upstream Agentbox's release identity: bundle ID
`ac.astral.app` and the update feed `agentboxhq/agentbox-releases`. This fork
must not sign or publish under either. So the release path fails closed: it
reads `agent-inbox-release.json` and refuses while any value there is unset,
malformed, or still upstream's.

| Command | Without a configured identity |
| --- | --- |
| `npm run release` (signed, notarized) | refuses before building or reading the keychain |
| `npm run pack` (`release.mjs --no-sign`) | refuses before building |
| `node scripts/publish-download.mjs` | refuses before reading or uploading anything |
| `node scripts/pack-local-inbox.mjs` | unaffected: unsigned local review build, `publish: never` |

The release identity is configured for the owner-authorized Agent Inbox preview:
bundle ID `com.significanthobbies.agentinbox`, the available Fleet Developer ID
team, and releases in `sarthakagrawal927/agentbox`. The local review build keeps
its separate `com.significanthobbies.agentinbox.local` ID.

## Signed Inbox previews

Use `npm run release:inbox` to build a Developer ID-signed Apple silicon DMG
and ZIP. This uses the local Inbox entry point and preserves its data folder,
disabled telemetry/cloud teams, and manual updates. It does not read analytics
or provider credentials. The native recovery helper is signed with the same
Developer ID before it is bundled.

The output is `release/inbox-v<version>/`. Its manifest records the exact
source commit, signing team, SHA-256 hashes, and qualification limits. Preview
builds are **not notarized** and do not claim physical lid-close qualification.
The ordinary unsigned review packager remains available for local development.

After the exact commit is shipped to public main, publish the verified build:

```sh
npm run release:inbox -- --publish
```

Publishing creates an `inbox-v<version>` draft in the configured owner repository,
uploads both downloads, checksums and the manifest, then publishes it as a
prerelease. Automatic updates remain disabled; install previews manually.
The legacy `release.mjs` and `publish-download.mjs` paths still concern upstream
packaging and must not be used to publish this local-contract preview.

## The three values the owner provides

1. **`bundleId`**: the macOS bundle ID (`CFBundleIdentifier`) in reverse-DNS
   form, for example `com.example.agentinbox`. It decides which app macOS
   treats this as: permissions, Keychain items and the update identity all
   attach to it. Treat it as permanent once a signed build ships.
   `ac.astral.app` and the local review ID
   `com.significanthobbies.agentinbox.local` are refused.
2. **`developerIdTeamId`**: the 10-character Apple Developer team ID that owns
   the "Developer ID Application" certificate the build is signed with. The
   release refuses unless the certificate in this Mac's keychain and
   `APPLE_TEAM_ID` both match it.
3. **`updateFeed`**: the public GitHub releases repository, as `owner/repo`,
   that installed copies check for updates and that `publish-download.mjs`
   uploads to. `agentboxhq/agentbox-releases` and `Astral-Agent/astral-releases`
   are refused.

## What the values change

- `scripts/release.mjs` passes `bundleId` and `updateFeed` to electron-builder
  (`-c.appId`, and `-c.publish.*` onto the first `build.publish` entry), so the
  packaged `app-update.yml` points at the owner's feed. `package.json` itself is
  left as it is.
- `scripts/publish-download.mjs` also requires `updateFeed` to equal
  `RELEASE_REPO` in `scripts/lib/live-download.mjs`. When the feed is chosen,
  change `RELEASE_REPO` and `build.publish` in `package.json` to the same
  repository. `tests/the-download-lives-in-a-public-release-repo` checks that
  those two agree.
- The product name, artifact names (`Agentbox-<v>-universal.dmg`,
  `Agentbox.dmg`) and the `agentbox.ac/download` wording are unchanged. They
  are separate branding decisions.

The rules live in `scripts/lib/release-identity.mjs`, and
`tests/a-release-refuses-to-build-without-the-agent-inbox-identity.test.mjs`
covers them.
