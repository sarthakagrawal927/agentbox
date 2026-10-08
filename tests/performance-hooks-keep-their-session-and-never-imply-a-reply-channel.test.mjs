// Migrated lifecycle evidence must expire honestly and keep shared-host
// conversations and reused PIDs separate. Status is never a delivery channel.
import { describe, expect, it } from 'vitest';
import {
  AgentLifecycleCatalog, carryLifecycle, lifecycleKey, normalizeHookEvent,
  normalizeLifecycle, parseHookJSON, resolveActivity, sessionKey, shortTaskLabel,
} from '../shared/agent-lifecycle.mjs';

const now = 1_800_000_000;
const raw = (overrides = {}) => ({ pid: 42, started: 100, provider: 'Codex',
  event: 'PreToolUse', timestamp: now, ...overrides });
const signal = (overrides = {}) => normalizeLifecycle(raw(overrides), { now });

describe('the PerformanceDaddy hook contract moves into the inbox', () => {
  it('normalizes documented attention notifications, without treating unknown notifications as input', () => {
    for (const notification_type of ['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input']) {
      expect(normalizeHookEvent('Claude', { hook_event_name: 'Notification', notification_type })).toBe('PermissionRequest');
    }
    for (const notification_type of ['idle_prompt', 'agent_completed']) {
      expect(normalizeHookEvent('Claude', { hook_event_name: 'Notification', notification_type })).toBe('Stop');
    }
    expect(normalizeHookEvent('Devin', { hook_event_name: 'Notification', notification_type: 'quota_auto_resume_fired' })).toBeNull();
  });
  it('accepts a rate limit only through the documented Claude failure', () => {
    expect(normalizeHookEvent('Claude', { hook_event_name: 'StopFailure', error: 'rate_limit' })).toBe('RateLimit');
    expect(normalizeHookEvent('Codex', { hook_event_name: 'StopFailure', error: 'rate_limit' })).toBe('StopFailure');
    expect(normalizeHookEvent('Claude', { hook_event_name: 'RateLimit' })).toBeNull();
    expect(normalizeHookEvent('Unknown', { hook_event_name: 'Stop' })).toBeNull();
  });
  it('bounds hook input and rejects malformed JSON or non-object payloads', () => {
    expect(parseHookJSON('{"hook_event_name":"Stop"}')).toEqual({ hook_event_name: 'Stop' });
    for (const text of ['{', '[]', 'null', '1', ' '.repeat(262_145)]) expect(parseHookJSON(text)).toBeNull();
    expect(parseHookJSON(JSON.stringify({ prompt: 'é'.repeat(140_000) }))).toBeNull();
  });
  it('uses a one-way session equality key with the original UTF-8 limit', () => {
    const key = sessionKey('fixture-session');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(sessionKey('fixture-session'));
    expect(key).not.toContain('fixture-session');
    expect(sessionKey('é'.repeat(128))).not.toBeNull();
    expect(sessionKey('é'.repeat(129))).toBeNull();
    expect(sessionKey('')).toBeNull();
  });
  it('filters machine completion prompts and redacts links and long opaque strings', () => {
    expect(shortTaskLabel('  <task-notification>\nA command completed.')).toBeNull();
    expect(shortTaskLabel('<pasted_content>\n```\n\nRead README.md.')).toBe('Read README.md.');
    expect(shortTaskLabel('Review https://example.test/private with ' + 'x'.repeat(40))).toBe('Review [link] with [private]');
    expect(shortTaskLabel('one '.repeat(40))).toHaveLength(89);
  });
  it('counts nonempty lines for the bounded request label, as the native hook does', () => {
    expect(shortTaskLabel('\n'.repeat(20) + 'Read README.md.')).toBe('Read README.md.');
    expect(shortTaskLabel('<pasted_content>\n'.repeat(12) + 'Outside the label window')).toBeNull();
  });
  it('accepts fresh process evidence and drops full prompts, paths and arbitrary extra fields', () => {
    const normalized = signal({ workspace: 'fixture', taskLabel: 'Read README.md', sessionKey: sessionKey('one'), prompt: 'private', cwd: '/private', canReply: true });
    expect(normalized).toMatchObject({ pid: 42, started: 100, provider: 'Codex', workspace: 'fixture', taskLabel: 'Read README.md', taskObservedAt: now });
    expect(normalized).not.toHaveProperty('prompt');
    expect(normalized).not.toHaveProperty('cwd');
    expect(normalized).not.toHaveProperty('canReply');
  });
  it('refuses invalid process identities and the edges of the event freshness window', () => {
    for (const overrides of [{ pid: 1 }, { pid: 2.5 }, { started: 0 }, { started: Number.MAX_SAFE_INTEGER + 1 },
      { provider: 'Unknown' }, { event: 'Invented' }, { timestamp: NaN }, { timestamp: now - 120 }, { timestamp: now + 120 }]) {
      expect(signal(overrides)).toBeNull();
    }
    expect(signal({ timestamp: now - 119.999 })).not.toBeNull();
    expect(signal({ timestamp: now + 119.999 })).not.toBeNull();
  });
  it('discards oversized optional labels and malformed session equality keys', () => {
    const normalized = signal({ workspace: 'w'.repeat(65), taskLabel: 't'.repeat(97), sessionKey: 'A'.repeat(64) });
    expect(normalized.workspace).toBeNull();
    expect(normalized.taskLabel).toBeNull();
    expect(normalized.sessionKey).toBeNull();
    expect(normalized.taskObservedAt).toBeNull();
  });
});

describe('the inbox keeps evidence attached to the right live session', () => {
  it('expires work at five minutes and does not invent status for startup or future events', () => {
    expect(resolveActivity('PreToolUse', 300)).toBe('working');
    expect(resolveActivity('PreToolUse', 300.001)).toBe('unknown');
    expect(resolveActivity('PostCompaction', 3)).toBe('working');
    expect(resolveActivity('SessionStart', 0)).toBe('unknown');
    expect(resolveActivity('Stop', -1)).toBe('unknown');
    expect(resolveActivity(null, 0)).toBe('unknown');
  });
  it('retains terminal and attention evidence while the session process is alive', () => {
    for (const event of ['Stop', 'Interrupt', 'SessionEnd']) expect(resolveActivity(event, 3600)).toBe('stopped');
    for (const event of ['PermissionRequest', 'Elicitation']) expect(resolveActivity(event, 3600)).toBe('needs-input');
    expect(resolveActivity('RateLimit', 3600)).toBe('rate-limited');
    expect(resolveActivity('StopFailure', 3600)).toBe('failed');
  });
  it('carries labels forward only within the same process and conversation', () => {
    const first = signal({ sessionKey: sessionKey('one'), workspace: 'first', taskLabel: 'First task' });
    expect(carryLifecycle(signal({ sessionKey: sessionKey('one') }), first).taskLabel).toBe('First task');
    expect(carryLifecycle(signal({ sessionKey: sessionKey('two') }), first).taskLabel).toBeNull();
    expect(carryLifecycle(signal({ sessionKey: null }), first).taskLabel).toBeNull();
    expect(carryLifecycle(signal({ started: 101, sessionKey: sessionKey('one') }), first).taskLabel).toBeNull();
    expect(carryLifecycle(signal({ provider: 'Claude' }), first).taskLabel).toBeNull();
  });
  it('keeps two Codex conversations on one app server as separate rows', () => {
    const catalog = new AgentLifecycleCatalog();
    catalog.record(raw({ sessionKey: sessionKey('one'), taskLabel: 'First task' }), { now });
    catalog.record(raw({ sessionKey: sessionKey('two'), taskLabel: 'Second task' }), { now });
    const rows = catalog.snapshot({ now, liveProcesses: [{ pid: 42, started: 100 }] });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(row => row.key)).size).toBe(2);
    expect(rows.map(row => row.taskLabel).sort()).toEqual(['First task', 'Second task']);
    expect(lifecycleKey(rows[0])).not.toBe(lifecycleKey(rows[1]));
  });
  it('ignores delayed old events rather than rewinding a session', () => {
    const catalog = new AgentLifecycleCatalog();
    expect(catalog.record(raw({ event: 'Stop', timestamp: now + 1 }), { now })).toBe(true);
    expect(catalog.record(raw({ event: 'PreToolUse', timestamp: now }), { now })).toBe(false);
    expect(catalog.snapshot({ now: now + 2, liveProcesses: [{ pid: 42, started: 100 }] })[0].activity).toBe('stopped');
  });
  it('refuses to show dead or reused PIDs and reveals stale work as unknown', () => {
    const catalog = new AgentLifecycleCatalog();
    catalog.record(raw(), { now });
    expect(catalog.snapshot({ now, liveProcesses: [] })).toEqual([]);
    expect(catalog.snapshot({ now, liveProcesses: [{ pid: 42, started: 101 }] })).toEqual([]);
    const rows = catalog.snapshot({ now: now + 301, liveProcesses: [{ pid: 42, started: 100 }] });
    expect(rows[0].activity).toBe('unknown');
    expect(rows[0]).not.toHaveProperty('canReply');
  });
  it('bounds the catalog even when many sessions arrive on a shared host', () => {
    const catalog = new AgentLifecycleCatalog();
    for (let i = 0; i < 513; i++) catalog.record(raw({ sessionKey: sessionKey(`fixture-${i}`) }), { now });
    const rows = catalog.snapshot({ now, liveProcesses: [{ pid: 42, started: 100 }] });
    expect(rows).toHaveLength(512);
    expect(rows.find(row => row.sessionKey === sessionKey('fixture-0'))).toBeUndefined();
    expect(rows.find(row => row.sessionKey === sessionKey('fixture-512'))).toBeDefined();
  });
});
