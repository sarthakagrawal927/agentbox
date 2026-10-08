// The receiver inventoried only previous hook senders. Running Codex agents
// vanished entirely before their first hook. Process presence must be visible
// without inventing activity, conversation identity, replies or notifications.
import { it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createLifecycleMonitor } from '../main/lifecycle-monitor.mjs';
import { lifecycleConversationRows } from '../main/lifecycle-conversations.mjs';
afterEach(() => vi.useRealTimers());
const process = { pid: 42, started: 100, provider: 'Codex' };
it('publishes native process presence before hooks and clears it on exit or receiver failure', () => {
  vi.useFakeTimers();
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.kill = vi.fn();
  const monitor = createLifecycleMonitor({ binary: '/fixture/receiver', exists: () => true, spawn: () => child });
  const attention = vi.fn(); monitor.onAttention(attention); monitor.start();
  const send = processes => child.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'inventory', processes }) + '\n'));
  send([process]);
  expect(monitor.state().processes).toEqual([process]);
  expect(monitor.state().signals).toEqual([]);
  expect(attention).not.toHaveBeenCalled();
  send([]); expect(monitor.state().processes).toEqual([]);
  send([process]); child.emit('exit', 1); expect(monitor.state().processes).toEqual([]);
  monitor.stop();
});
it('shows an unlinked running process without pretending it is working or joining a saved thread', () => {
  const rows = lifecycleConversationRows([], { processes: [process], threads: [{ id: 'other', source: 'codex', key: 'saved', folderName: 'same-folder' }] });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: 'process:Codex:42:100', provider: 'Codex', status: 'unknown', action: 'status' });
  expect(rows[0].title).toContain('42');
  expect(rows[0]).not.toHaveProperty('canReply');
  expect(lifecycleConversationRows([], { processes: [{ ...process, started: 101 }] })[0].id).not.toBe(rows[0].id);
});
it('does not duplicate app-owned workers, connected agents or hooked shared-server sessions', () => {
  const signal = { key: 'one', pid: 42, started: 100, provider: 'Codex', activity: 'working' };
  expect(lifecycleConversationRows([signal], { processes: [process] })).toHaveLength(1);
  expect(lifecycleConversationRows([], { processes: [process], ownedSessions: [{ pid: 42, engine: 'codex' }] })).toEqual([]);
  expect(lifecycleConversationRows([], { processes: [{ ...process, provider: 'Claude' }], agents: [{ pid: 42 }] })).toEqual([]);
});
