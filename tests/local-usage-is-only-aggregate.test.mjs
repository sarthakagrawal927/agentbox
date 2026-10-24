// Local measurement must count only completed local actions and foreground
// access without retaining conversation text, identifiers, or fake delivery claims.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createLocalUsage, localUsageFile, readLocalUsageReport } from '../main/local-usage.mjs';

const roots = [];
function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-inbox-local-usage-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('local usage measurement', () => {
  it('counts a reply only after submitReply returns the saved item', () => {
    const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'main', 'ipc.mjs'), 'utf8');
    expect(source).toMatch(/if \(out && localInbox && !isPractice\(product\)[\s\S]{0,180}record\('savedReply'\)/);
  });

  it('stores only bounded event kinds and reports exact rolling counts separately', () => {
    const dataDir = tempRoot();
    const file = localUsageFile(dataDir);
    const now = Date.UTC(2026, 9, 24, 12);
    const usage = createLocalUsage({ dataDir, now: () => now });

    expect(usage.record('foregroundFocus')).toBe(true);
    expect(usage.record('savedReply')).toBe(true);
    expect(usage.record('permissionResponse')).toBe(true);
    expect(usage.record('heartbeat')).toBe(false);

    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(Object.keys(stored).sort()).toEqual(['coverageSince', 'droppedThroughAt', 'events', 'version']);
    expect(stored.events).toEqual([
      { at: now, kind: 'foregroundFocus' },
      { at: now, kind: 'savedReply' },
      { at: now, kind: 'permissionResponse' },
    ]);
    expect(JSON.stringify(stored)).not.toMatch(/answer|title|body|conversation|item|path|prompt|note/i);

    expect(readLocalUsageReport({ file, now })).toEqual({
      schemaVersion: 1,
      windowHours: 720,
      counts: { foregroundFocuses: 1, savedReplies: 1, permissionResponses: 1 },
      localDeviceUnits: 1,
      coreActionDeviceUnits: 1,
      coverageSince: new Date(now).toISOString(),
      coverageStatus: 'partial',
      storageStatus: 'available',
      coverageComplete: false,
      lastUseAt: new Date(now).toISOString(),
      lastForegroundAt: new Date(now).toISOString(),
      eventLastSeen: {
        foregroundFocuses: new Date(now).toISOString(),
        savedReplies: new Date(now).toISOString(),
        permissionResponses: new Date(now).toISOString(),
      },
    });
  });

  it('uses an exact rolling 720-hour cutoff and excludes older records', () => {
    const dataDir = tempRoot();
    const now = Date.UTC(2026, 9, 24, 12);
    let clock = now - 720 * 60 * 60 * 1000 - 1;
    const usage = createLocalUsage({ dataDir, now: () => clock });
    usage.record('savedReply');
    clock += 1;
    usage.record('foregroundFocus');
    clock = now;
    usage.record('permissionResponse');

    expect(readLocalUsageReport({ file: localUsageFile(dataDir), now })).toMatchObject({
      counts: { foregroundFocuses: 1, savedReplies: 0, permissionResponses: 1 },
      localDeviceUnits: 1,
      coreActionDeviceUnits: 1,
      coverageComplete: true,
    });
  });

  it('reports missing history as unknown rather than measured inactivity', () => {
    const root = tempRoot();
    expect(readLocalUsageReport({ file: localUsageFile(root), now: Date.UTC(2026, 9, 24, 12) })).toEqual({
      schemaVersion: 1,
      windowHours: 720,
      counts: { foregroundFocuses: 0, savedReplies: 0, permissionResponses: 0 },
      localDeviceUnits: 0,
      coreActionDeviceUnits: 0,
      coverageSince: null,
      coverageStatus: 'unknown',
      storageStatus: 'missing',
      coverageComplete: false,
      lastUseAt: null,
      lastForegroundAt: null,
      eventLastSeen: { foregroundFocuses: null, savedReplies: null, permissionResponses: null },
    });
  });

  it('marks capped history as an incomplete lower bound when an omitted event can be in-window', () => {
    const root = tempRoot();
    const file = localUsageFile(root);
    const now = Date.UTC(2026, 9, 24, 12);
    const cutoff = now - 720 * 60 * 60 * 1000;
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      coverageSince: cutoff - 1,
      droppedThroughAt: cutoff,
      events: [{ at: now, kind: 'savedReply' }],
    }));

    expect(readLocalUsageReport({ file, now })).toMatchObject({
      counts: { savedReplies: 1 },
      coverageComplete: false,
      localDeviceUnits: 1,
      coreActionDeviceUnits: 1,
    });
  });

  it('labels foreground-only device presence separately from core action', () => {
    const dataDir = tempRoot();
    const now = Date.UTC(2026, 9, 24, 12);
    const usage = createLocalUsage({ dataDir, now: () => now });
    usage.record('foregroundFocus');

    expect(readLocalUsageReport({ file: localUsageFile(dataDir), now })).toMatchObject({
      localDeviceUnits: 1,
      coreActionDeviceUnits: 0,
      lastUseAt: null,
      lastForegroundAt: new Date(now).toISOString(),
    });
  });

  it('leaves corrupt measurement untouched and fails open when storage is unavailable', () => {
    const root = tempRoot();
    const file = localUsageFile(root);
    fs.writeFileSync(file, 'unknown-old-content');
    const usage = createLocalUsage({ dataDir: root });
    expect(usage.record('savedReply')).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('unknown-old-content');

    const blockedDir = path.join(root, 'is-a-file');
    fs.writeFileSync(blockedDir, 'not a directory');
    expect(() => createLocalUsage({ dataDir: blockedDir })).not.toThrow();
    expect(createLocalUsage({ dataDir: blockedDir }).record('savedReply')).toBe(false);
  });

  it('does not follow a measurement-file symlink', () => {
    const root = tempRoot();
    const target = path.join(root, 'target.json');
    const contents = '{"private":"leave untouched"}';
    fs.writeFileSync(target, contents);
    fs.symlinkSync(target, localUsageFile(root));

    expect(createLocalUsage({ dataDir: root }).record('savedReply')).toBe(false);
    expect(fs.readFileSync(target, 'utf8')).toBe(contents);
    expect(readLocalUsageReport({ file: localUsageFile(root) }).coverageStatus).toBe('unknown');
  });

  it('exports one parser-compatible portfolio usage record without qualifying core actions', () => {
    const dataDir = tempRoot();
    const now = Date.now();
    const usage = createLocalUsage({ dataDir, now: () => now });
    usage.record('foregroundFocus');
    usage.record('savedReply');
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'export-local-usage.mjs');
    const output = execFileSync(process.execPath, [script, '--usage-file', localUsageFile(dataDir), '--portfolio'], { encoding: 'utf8' });
    const portfolio = JSON.parse(output);
    const record = portfolio.usage.records['agent-inbox'];

    expect(portfolio).toMatchObject({ kind: 'portfolio-usage', schemaVersion: 1, usage: { schemaVersion: 1 } });
    expect(Date.parse(record.windowEnd) - Date.parse(record.windowStart)).toBe(720 * 60 * 60 * 1000);
    expect(record.proxy).toEqual({ count: 1, unit: 'devices', precision: 'lower_bound' });
    expect(record.core).toMatchObject({ count: null, qualified: false, precision: 'unknown', coverage: 'partial', lastUsedAt: null });
    expect(record.tracking).toBe('partial');
    expect(record.events).toEqual([
      { name: 'foreground_focus', count: 1, lastSeen: new Date(now).toISOString(), precision: 'estimate' },
      { name: 'saved_reply', count: 1, lastSeen: new Date(now).toISOString(), precision: 'estimate' },
      { name: 'permission_response', count: 0, lastSeen: null, precision: 'estimate' },
    ]);
  });

  it('reports an absent counter file as missing with unknown coverage, never zero events', () => {
    const root = tempRoot();
    const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'export-local-usage.mjs');
    const output = execFileSync(process.execPath, [script, '--usage-file', localUsageFile(root), '--portfolio'], { encoding: 'utf8' });
    const record = JSON.parse(output).usage.records['agent-inbox'];

    expect(record).toMatchObject({ tracking: 'missing', core: { count: null, coverage: 'unknown' } });
    expect(record.proxy).toEqual({ count: null, unit: 'devices', precision: 'unknown' });
    expect(record.events).toEqual([]);
    expect(record.evidence[0].note).toContain('No local counter file exists');
  });
});
