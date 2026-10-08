// A second attention surface must not guess new status rules or double-notify.
import { it, expect, vi, afterEach } from 'vitest';
import { companionRows } from '../renderer/src/companion-model';
import { createNotifier, installNotifier } from '../main/notify.mjs';
import { EventEmitter } from 'node:events';
afterEach(() => vi.useRealTimers());
it('uses actual running ids and keeps queued work distinct from measured activity', () => {
  const rows = companionRows({ inbox: [{ id: 'ask', title: 'Review', product: 'p', productName: 'Project' }], progress: [{ id: 'run', title: 'Working' }, { id: 'queue', title: 'Queued' }], agents: [], running: [{ itemId: 'run' }], approvals: [{ id: 'approval', item: 'run' }], engines: { workspace: 'codex', byItem: {} } });
  expect(rows.map(r => [r.id, r.status])).toEqual([['ask', 'waiting'], ['run', 'approval'], ['queue', 'unknown']]);
});
it('keeps unmeasured outside agents unknown and permission requests separate', () => {
  const rows = companionRows({ inbox: [], progress: [], running: [], approvals: [], engines: {}, agents: [{ id: 'agent:1', title: 'One', agent: { status: null } }, { id: 'agent:2', title: 'Two', agent: { status: 'waiting', waitingFor: 'permission prompt' } }] });
  expect(rows.map(r => r.status)).toEqual(['unknown', 'approval']);
});
it('sends one coalesced notice to the pill without an OS banner', () => {
  vi.useFakeTimers(); const sink = vi.fn(() => true); const Notification = vi.fn();
  const notifier = createNotifier({ window: { isDestroyed: () => false, isFocused: () => false }, Notification, powerMonitor: { getSystemIdleTime: () => 0 }, attention: sink, coalesceMs: 10 });
  notifier.add([{ id: 'one', title: 'One', kind: 'ready' }]); notifier.add([{ id: 'two', title: 'Two', kind: 'ready' }]); vi.advanceTimersByTime(10);
  expect(sink).toHaveBeenCalledTimes(1); expect(sink.mock.calls[0][0]).toHaveLength(2); expect(Notification).not.toHaveBeenCalled(); expect(notifier._spoken().spoke).toBe(true);
});
it('installs the pill delivery even when native notifications are unsupported', () => {
  const ipcMain = { handle: vi.fn() }; const window = new EventEmitter();
  installNotifier({ window, Notification: { isSupported: () => false }, powerMonitor: new EventEmitter(), ipcMain, attention: () => true });
  expect(ipcMain.handle).toHaveBeenCalledWith('zero:notify', expect.any(Function));
});
it('falls back to a native notice if the companion delivery throws',()=>{
 vi.useFakeTimers();const show=vi.fn(),Notification=vi.fn(function(){return {on:vi.fn(),show,close:vi.fn()};});
 const notifier=createNotifier({window:{isDestroyed:()=>false,isFocused:()=>false},Notification,powerMonitor:{getSystemIdleTime:()=>0},attention:()=>{throw Error('closed window');},coalesceMs:10});
 notifier.add([{id:'one',title:'One',kind:'ready'}]);expect(()=>vi.advanceTimersByTime(10)).not.toThrow();expect(show).toHaveBeenCalledTimes(1);
 notifier.seen();
});
it('bounds unseen notices during a long stretch away while retaining fresh requests',()=>{
 vi.useFakeTimers();const notifier=createNotifier({window:{isDestroyed:()=>false,isFocused:()=>false},Notification:vi.fn(),powerMonitor:{getSystemIdleTime:()=>0},attention:()=>true});
 notifier.add(Array.from({length:2000},(_,id)=>({id:`item-${id}`,title:'Task',kind:'ready'})));
 notifier.add([{id:'latest-approval',title:'Review',kind:'approval'}]);expect(notifier._pending()).toHaveLength(512);expect(notifier._pending().at(-1).id).toBe('latest-approval');notifier.seen();
});
it('retains an urgent approval when trimming a burst of ordinary notices',()=>{
 vi.useFakeTimers();const sink=vi.fn(()=>true),notifier=createNotifier({window:{isDestroyed:()=>false,isFocused:()=>false},Notification:vi.fn(),powerMonitor:{getSystemIdleTime:()=>0},attention:sink,coalesceMs:10});
 notifier.add([{id:'urgent',title:'Review',kind:'approval'}]);notifier.add(Array.from({length:1000},(_,id)=>({id:`item-${id}`,title:'Task',kind:'ready'})));
 expect(notifier._pending()).toHaveLength(512);expect(notifier._pending().some(row=>row.id==='urgent')).toBe(true);
 vi.advanceTimersByTime(10);expect(sink.mock.calls[0][0].some(row=>row.id==='urgent')).toBe(true);notifier.seen();
});
