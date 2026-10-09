// A RELEASE OF THIS FORK WOULD HAVE SHIPPED AS UPSTREAM AGENTBOX.
//
// Read on 2026-10-09 at 4975c71: `npm run release` built bundle ID
// ac.astral.app, signed with whatever Developer ID was on the Mac, and wrote an
// update feed at agentboxhq/agentbox-releases, which is upstream's. Signed and
// published, that is an Agent Inbox build claiming to be Agentbox and updating
// from a feed this fork does not own. The three values are the owner's to
// choose, so the release path now refuses until agent-inbox-release.json names
// them. These run the real scripts with every tool they could reach for
// (npm, npx, security, gh, xcrun, codesign) replaced by a stub that records a
// call, and check that nothing was called.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkReleaseIdentity, identityBuilderArgs, IDENTITY_FILE } from '../scripts/lib/release-identity.mjs';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GOOD = { bundleId: 'com.example.agentinbox', developerIdTeamId: 'ABCDE12345', updateFeed: 'example/agent-inbox-releases' };

describe('the committed identity', () => {
  const committed = JSON.parse(fs.readFileSync(path.join(repo, IDENTITY_FILE), 'utf8'));

  it('is marked unset, with every value empty, until the owner chooses', () => {
    expect(committed._status).toMatch(/^UNSET\b/);
    expect(committed.bundleId).toBeNull();
    expect(committed.developerIdTeamId).toBeNull();
    expect(committed.updateFeed).toBeNull();
  });

  it('is refused, naming all three values', () => {
    const r = checkReleaseIdentity(committed);
    expect(r.ok).toBe(false);
    expect(r.problems.join('\n')).toMatch(/bundleId is unset/);
    expect(r.problems.join('\n')).toMatch(/developerIdTeamId is unset/);
    expect(r.problems.join('\n')).toMatch(/updateFeed is unset/);
  });
});

describe('checking an identity', () => {
  it('accepts three well-formed values that are not upstream', () => {
    expect(checkReleaseIdentity(GOOD)).toEqual({ ok: true, identity: GOOD });
  });

  it('refuses upstream Agentbox and the local review build', () => {
    for (const bad of [
      { ...GOOD, bundleId: 'ac.astral.app' },
      { ...GOOD, bundleId: 'com.significanthobbies.agentinbox.local' },
      { ...GOOD, updateFeed: 'agentboxhq/agentbox-releases' },
      { ...GOOD, updateFeed: 'Astral-Agent/astral-releases' },
    ]) expect(checkReleaseIdentity(bad).ok, JSON.stringify(bad)).toBe(false);
  });

  it('refuses a placeholder, an empty string, and a malformed value', () => {
    for (const bad of [
      { ...GOOD, bundleId: 'UNSET' },
      { ...GOOD, developerIdTeamId: '' },
      { ...GOOD, developerIdTeamId: 'XXXXXXXXXX' },
      { ...GOOD, developerIdTeamId: 'abcde12345' },
      { ...GOOD, developerIdTeamId: 'ABCDE1234' },
      { ...GOOD, bundleId: 'agentinbox' },
      { ...GOOD, updateFeed: 'https://example.com/feed' },
      { ...GOOD, updateFeed: 42 },
      null,
      [],
    ]) expect(checkReleaseIdentity(bad).ok, JSON.stringify(bad)).toBe(false);
  });

  it('puts the bundle ID and the feed onto the build, over upstream', () => {
    expect(identityBuilderArgs(GOOD)).toEqual([
      '-c.appId=com.example.agentinbox',
      '-c.publish.provider=github',
      '-c.publish.owner=example',
      '-c.publish.repo=agent-inbox-releases',
    ]);
  });
});

describe('the scripts, run for real against the committed file', () => {
  let stubs, calls;

  beforeAll(() => {
    stubs = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-release-stubs-'));
    calls = path.join(stubs, 'calls.log');
    for (const tool of ['npm', 'npx', 'security', 'gh', 'xcrun', 'codesign', 'spctl']) {
      fs.writeFileSync(path.join(stubs, tool), `#!/bin/sh\necho "${tool} $*" >> "${calls}"\nexit 1\n`, { mode: 0o755 });
    }
  });
  afterAll(() => { if (stubs) fs.rmSync(stubs, { recursive: true, force: true }); });

  const run = (script, args, env = {}) => spawnSync(process.execPath, [path.join(repo, 'scripts', script), ...args], {
    cwd: repo, encoding: 'utf8',
    env: { HOME: process.env.HOME, PATH: `${stubs}${path.delimiter}/usr/bin${path.delimiter}/bin`, ...env },
  });
  const called = () => (fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '');

  it('npm run release refuses before it builds, signs, or reads the keychain', () => {
    const r = run('release.mjs', [], { APPLE_ID: 'a@example.invalid', APPLE_TEAM_ID: 'ABCDE12345', APPLE_APP_SPECIFIC_PASSWORD: 'x' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Not releasing: the Agent Inbox release identity is not configured.');
    expect(r.stderr).toContain('docs/release-identity.md');
    expect(r.stdout).not.toContain('building the renderer');
    expect(called()).toBe('');
  });

  it('npm run pack refuses too, and points at the local review build', () => {
    const r = run('release.mjs', ['--no-sign']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Not packaging');
    expect(r.stderr).toContain('scripts/pack-local-inbox.mjs');
    expect(called()).toBe('');
  });

  it('publishing the download refuses before it asks GitHub anything', () => {
    const r = run('publish-download.mjs', ['release/Agentbox.dmg', '--publish']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Not publishing: the Agent Inbox release identity is not configured.');
    expect(called()).toBe('');
  });

  it('the documentation names the three values the owner provides', () => {
    const doc = fs.readFileSync(path.join(repo, 'docs', 'release-identity.md'), 'utf8');
    for (const key of ['bundleId', 'developerIdTeamId', 'updateFeed']) expect(doc).toContain(`**\`${key}\`**`);
  });
});
