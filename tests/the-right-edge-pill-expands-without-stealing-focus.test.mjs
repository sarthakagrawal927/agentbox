// The companion must surface new requests beside the work without another tray
// icon, focus theft, stale row navigation, or repeated expansion after collapse.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createCompanion, companionBounds } from '../main/companion.mjs';

class Window extends EventEmitter {
  constructor(options) { super(); this.options = options; this.bounds = options; this.focused = false; this.webContents = Object.assign(new EventEmitter(), { send: vi.fn(), setWindowOpenHandler: vi.fn() }); }
  setBounds(bounds) { this.bounds = bounds; }
  getBounds() { return this.bounds; }
  showInactive = vi.fn();
  show = vi.fn();
  focus = vi.fn();
  isFocused() { return this.focused; }
  isDestroyed() { return false; }
  loadFile = vi.fn(async () => {});
  destroy = vi.fn();
}
const row = { id: 'thread-one', title: 'Review the changes', product: 'project', provider: 'Codex', status: 'waiting' };
function setup() {
  const handlers = new Map(); const ipcMain = { handle: (name, f) => handlers.set(name, f), removeHandler: vi.fn() };
  const screen = Object.assign(new EventEmitter(), { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 24, width: 1280, height: 776 } }), getDisplayMatching: () => screen.getPrimaryDisplay() });
  const open = vi.fn(); const c = createCompanion({ BrowserWindow: Window, screen, ipcMain, appDir: '/app', open, focused: () => false, autoCollapseMs: 1000 });
  const event = { sender: c.window.webContents, senderFrame: { parent: null } };
  return { ...c, handlers, event, open, screen };
}
afterEach(() => vi.useRealTimers());
describe('right-edge companion', () => {
  it('carries observed battery status separately from a conversation request, with bounded values', () => {
    const c = setup();
    c.publish([{...row,live:true,observedStatus:'working'}]);
    expect(c.state().rows[0]).toMatchObject({status:'waiting',live:true,observedStatus:'working'});
    c.publish([{...row,observedStatus:'working'}, {...row,id:'bad',live:true,observedStatus:'invented'}]);
    expect(c.state().rows.every(r=>!Object.hasOwn(r,'observedStatus'))).toBe(true);
    c.dispose();
  });
  it('keeps sound off until explicitly chosen, persists it, and cues only admitted attention', () => {
    const c = setup(); expect(c.state().soundEnabled).toBe(false);
    c.publish([row]); expect(c.state().noticeSequence).toBe(0);
    c.notify([]); expect(c.state().noticeSequence).toBe(0);
    c.notify([{id:row.id}]); expect(c.state().noticeSequence).toBe(1);
    c.handlers.get('inbox:companion-sound')(c.event,true); expect(c.state().soundEnabled).toBe(true);
    c.handlers.get('inbox:companion-expand')(c.event,true); expect(c.state().noticeSequence).toBe(1);
    c.handlers.get('inbox:companion-sound')(c.event,false); expect(c.state().soundEnabled).toBe(false);
    expect(()=>c.handlers.get('inbox:companion-sound')(c.event,'yes')).toThrow(); c.dispose();
  });
  it('shows a saved thread without expanding or claiming attention and opens its exact key', () => {
    const c = setup(); const saved = { ...row, id: 'local:codex:one', status: 'saved' };
    c.publish([saved]); expect(c.state().rows).toEqual([saved]);
    expect(c.state().expanded).toBe(false); expect(c.window.show).not.toHaveBeenCalled();
    expect(c.handlers.get('inbox:companion-open')(c.event, saved.id)).toEqual({ ok: true });
    expect(c.open).toHaveBeenCalledWith(saved.id); c.dispose();
  });
  it('rejects opening an observed status-only row without touching any conversation', () => {
    const c = setup(); c.publish([{...row,status:'limited',action:'status'}]);
    expect(c.handlers.get('inbox:companion-open')(c.event,row.id).ok).toBe(false);
    expect(c.open).not.toHaveBeenCalled(); c.dispose();
  });
  it('anchors both sizes inside an offset work area, keeping the right edge stable', () => {
    const area = { x: -1920, y: 80, width: 1920, height: 1000 };
    const pill = companionBounds(area, false), panel = companionBounds(area, true);
    expect(pill.x + pill.width).toBe(panel.x + panel.width);
    for (const b of [pill, panel]) { expect(b.x).toBeGreaterThanOrEqual(area.x); expect(b.y).toBeGreaterThanOrEqual(area.y); expect(b.y + b.height).toBeLessThanOrEqual(area.y + area.height); }
    expect(companionBounds({ x: 0, y: 0, width: 300, height: 240 }, true)).toMatchObject({ width: 284, height: 224 });
  });
  it('starts collapsed, isolated and sandboxed with no borrowed full-app preload', () => {
    const c = setup(); expect(c.state().expanded).toBe(false); expect(c.state().ready).toBe(false);
    expect(c.window.options).toMatchObject({ frame: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, preload: '/app/main/companion-preload.cjs' } }); c.dispose();
  });
  it('expands for new attention using showInactive and collapses after the glance', () => {
    vi.useFakeTimers(); const c = setup(); c.publish([row]); c.notify([{ id: row.id, kind: 'ready' }]);
    expect(c.state().expanded).toBe(true); expect(c.window.showInactive).toHaveBeenCalled(); expect(c.window.focus).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(c.state().expanded).toBe(false); c.dispose();
  });
  it('does not auto-collapse while the user is answering or explicitly expanded', () => {
    vi.useFakeTimers(); const c = setup(); c.publish([row]); c.notify([{ id: row.id }]); c.window.focused = true;
    vi.advanceTimersByTime(1000); expect(c.state().expanded).toBe(true);
    c.window.focused = false; c.handlers.get('inbox:companion-expand')(c.event, true); vi.advanceTimersByTime(5000); expect(c.state().expanded).toBe(true); c.dispose();
  });
  it('opens the exact current conversation but refuses stale or unknown ids', () => {
    const c = setup(); c.publish([row]); expect(c.handlers.get('inbox:companion-open')(c.event, row.id)).toEqual({ ok: true }); expect(c.open).toHaveBeenCalledWith(row.id);
    c.publish([]); expect(c.handlers.get('inbox:companion-open')(c.event, row.id).ok).toBe(false); expect(c.open).toHaveBeenCalledTimes(1); c.dispose();
  });
  it('keeps the full inbox reachable when there are no rows', () => {
    const c = setup(); c.publish([]); expect(c.handlers.get('inbox:companion-open')(c.event, null)).toEqual({ ok: true }); expect(c.open).toHaveBeenCalledWith(null); c.dispose();
  });
  it('rejects other windows and embedded frames on every companion door', () => {
    const c = setup(); c.publish([row]);
    for (const [name, fn] of c.handlers) { expect(() => fn({ sender: {} }, true)).toThrow(); expect(() => fn({ ...c.event, senderFrame: { parent: {} } }, true)).toThrow(); }
    expect(c.open).not.toHaveBeenCalled(); c.dispose();
  });
  it('publishes bounded display metadata without forwarding bodies or capabilities', () => {
    const c = setup(); c.publish([{ ...row, title: 'x'.repeat(1000), body: 'private transcript', canReply: true }, row, { id: '', title: 'bad' }]);
    expect(c.state().rows).toHaveLength(1); expect(c.state().rows[0].title.length).toBeLessThanOrEqual(121); expect(c.state().rows[0]).not.toHaveProperty('body'); expect(c.state().rows[0]).not.toHaveProperty('canReply'); c.dispose();
  });
  it('repositions on a display change and removes handlers/listeners when disposed', () => {
    const c = setup(); c.screen.getDisplayMatching = () => ({ workArea: { x: -1000, y: 20, width: 1000, height: 500 } });
    c.screen.emit('display-metrics-changed'); expect(c.window.bounds.x).toBeLessThan(0); c.dispose(); expect(c.screen.listenerCount('display-metrics-changed')).toBe(0); expect(c.window.destroy).toHaveBeenCalled();
  });
  it('collapses on close without destroying the persistent companion',()=>{
    const c=setup();c.handlers.get('inbox:companion-expand')(c.event,true);
    const event={preventDefault:vi.fn()};c.window.emit('close',event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);expect(c.state().expanded).toBe(false);c.dispose();
  });
  it('does not deliver into a destroyed window or touch it from an old collapse timer',()=>{
    vi.useFakeTimers();const c=setup();c.notify([{id:row.id}]);
    c.window.isDestroyed=()=>true;c.window.isFocused=()=>{throw Error('destroyed window');};
    expect(c.notify([{id:row.id}])).toBe(false);expect(()=>vi.advanceTimersByTime(1000)).not.toThrow();c.dispose();
  });
  it('reloads a failed renderer with the same rows and bounds recovery attempts',async()=>{
    vi.useFakeTimers();const c=setup();c.publish([row]);
    c.window.webContents.emit('render-process-gone',{}, {reason:'crashed'});
    expect(c.notify([{id:row.id}])).toBe(false);await vi.advanceTimersByTimeAsync(500);
    expect(c.window.loadFile).toHaveBeenCalledTimes(1);
    c.window.webContents.emit('did-finish-load');expect(c.state().rows).toEqual([row]);expect(c.notify([{id:row.id}])).toBe(true);
    for(let i=0;i<5;i++){c.window.webContents.emit('render-process-gone',{}, {reason:'crashed'});await vi.advanceTimersByTimeAsync(500);}
    expect(c.window.loadFile).toHaveBeenCalledTimes(3);expect(c.notify([{id:row.id}])).toBe(false);c.dispose();
  });
  it('cancels pending renderer recovery when the app quits',async()=>{
    vi.useFakeTimers();const c=setup();c.window.webContents.emit('render-process-gone',{}, {reason:'crashed'});c.dispose();
    await vi.advanceTimersByTimeAsync(1000);expect(c.window.loadFile).not.toHaveBeenCalled();
  });
});
