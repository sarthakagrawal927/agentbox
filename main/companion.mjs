// A screen-edge attention surface. Conversation/reply/permission behavior stays
// in the existing inbox. This window has no general-purpose IPC or file access.
import path from 'node:path';
import { clip } from '../shared/notify-rules.mjs';
import { normalizePlacement, placementLayout, placementFromBounds } from './companion-placement.mjs';

export function companionBounds(area, expanded) {
  return placementLayout(area, expanded).bounds;
}

export function createCompanion({ BrowserWindow, screen, ipcMain, Menu, appDir, open, focused, placementStore, autoCollapseMs = 8000 }) {
  let expanded = false, ready = false, rows = [], discovery = null, timer = null, moveTimer = null, disposed = false, window;
  let rendererFailed = false, reloadTimer = null, reloadAttempts = 0;
  let noticeSequence = 0;
  let placement = normalizePlacement(null), placementError = '', appliedSpaces = false;
  try { placement = normalizePlacement(placementStore?.load()); } catch { /* Defaults stay on screen. */ }
  const displays = () => screen.getAllDisplays?.() ?? [screen.getPrimaryDisplay()];
  const display = () => placement.displayId !== null
    ? displays().find(d => d.id === placement.displayId) ?? screen.getPrimaryDisplay()
    : window ? screen.getDisplayMatching(window.getBounds()) : screen.getPrimaryDisplay();
  let layout = placementLayout(display().workArea, false, placement);
  window = new BrowserWindow({
    ...layout.bounds,
    title: 'Agent Inbox · Companion', frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, maximizable: false, minimizable: false,
    fullscreenable: false, skipTaskbar: true, show: false, hasShadow: false,
    webPreferences: { preload: path.join(appDir, 'main', 'companion-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  const state = () => ({ expanded, ready, rows, discovery, placement, placementError, soundEnabled: placement.soundEnabled === true, noticeSequence, side: layout.side, pillTop: layout.pillTop, pillLeft: layout.pillLeft, pillHeight: layout.pillHeight });
  const send = () => { if (!disposed && !rendererFailed && !window.isDestroyed()) window.webContents.send('inbox:companion-state', state()); };
  const position = () => {
    if (disposed || window.isDestroyed()) return;
    layout = placementLayout(display().workArea, expanded, placement);
    window.setBounds(layout.bounds);
    send();
  };
  const persist = () => {
    try { placementStore?.save(placement); placementError = ''; }
    catch { placementError = 'Your position could not be saved. It will reset after restart.'; }
  };
  const spaces = () => {
    if (placement.allSpaces === appliedSpaces) return;
    window.setVisibleOnAllWorkspaces?.(placement.allSpaces, { visibleOnFullScreen: placement.allSpaces });
    appliedSpaces = placement.allSpaces;
  };
  const choose = next => {
    if (disposed || window.isDestroyed()) return;
    placement = normalizePlacement({ ...placement, ...next });
    position(); spaces(); persist(); send();
  };
  spaces();
  const moved = (_event, bounds) => {
    if (disposed || placement.locked || !bounds) return;
    const pillBounds = { x: bounds.x + layout.pillLeft, y: bounds.y + layout.pillTop, width: 48, height: layout.pillHeight };
    const target = screen.getDisplayMatching(pillBounds);
    placement = normalizePlacement({ ...placement, ...placementFromBounds(target.workArea, bounds, layout, target.id), locked: placement.locked, allSpaces: placement.allSpaces });
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(() => { moveTimer = null; if (!disposed) { position(); persist(); send(); } }, 200);
  };
  window.on('will-move', moved);
  const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };
  const load = () => window.loadFile(path.join(appDir, 'renderer', 'dist', 'companion.html'));
  const recoverRenderer = () => {
    if (disposed || window.isDestroyed()) return;
    rendererFailed = true; clearTimer();
    if (reloadTimer || reloadAttempts >= 3) return;
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      if (disposed || window.isDestroyed()) return;
      reloadAttempts++;
      void load().catch(recoverRenderer);
    }, 500);
  };
  window.webContents.on('render-process-gone', recoverRenderer);
  const resize = (value, manual = false) => {
    if (disposed || window.isDestroyed()) return;
    clearTimer(); expanded = !!value; position(); send();
    if (manual && expanded) { window.show(); window.focus(); }
  };
  const close = event => { if (!disposed) { event.preventDefault(); resize(false); } };
  window.on('close', close);
  const guard = (event) => {
    if (disposed || event?.sender !== window.webContents || event?.senderFrame?.parent) throw Error('Companion actions are only available in the companion window.');
  };
  const handlers = {
    'inbox:companion-state': (event) => { guard(event); return state(); },
    'inbox:companion-position': (event) => {
      guard(event);
      if (!Menu) return { ok: false, reason: 'Position controls are available in the desktop app.' };
      Menu.buildFromTemplate([
        ...[['left', 0, .5], ['right', 1, .5], ['top', .5, 0], ['bottom', .5, 1]].map(([label, x, y]) => ({ label: `Pin to ${label}`, click: () => choose({ x, y }) })),
        { label: 'Display', submenu: displays().map((d, index) => ({ label: d.label || `Display ${index + 1}`, type: 'radio', checked: d.id === display().id, click: () => choose({ displayId: d.id }) })) },
        { type: 'separator' },
        { label: 'Lock position', type: 'checkbox', checked: placement.locked, click: item => choose({ locked: item.checked }) },
        { label: 'Show on all Spaces', type: 'checkbox', checked: placement.allSpaces, click: item => choose({ allSpaces: item.checked }) },
      ]).popup({ window });
      return { ok: true };
    },
    'inbox:companion-expand': (event, value) => { guard(event); if (typeof value !== 'boolean') throw Error('Invalid expansion.'); resize(value, true); return state(); },
    'inbox:companion-sound': (event, value) => {
      guard(event); if (typeof value !== 'boolean') throw Error('Invalid sound preference.');
      choose({ soundEnabled: value }); return state();
    },
    'inbox:companion-open': (event, id) => {
      guard(event);
      if (id !== null && (typeof id !== 'string' || !rows.some(row => row.id === id && row.action !== 'status'))) return { ok: false, reason: 'This conversation is no longer linked in the companion. Open the inbox to find it.' };
      open(id); resize(false); return { ok: true };
    },
  };
  for (const [name, handler] of Object.entries(handlers)) ipcMain.handle(name, handler);
  const events = ['display-metrics-changed', 'display-added', 'display-removed'];
  for (const name of events) screen.on(name, position);
  window.once('ready-to-show', () => { if (!disposed) window.showInactive(); });
  window.webContents.on('did-finish-load', () => { rendererFailed = false; send(); });
  return {
    window, state,
    load,
    publish(input, scan) {
      if (!Array.isArray(input)) return;
      const unique = new Map();
      for (const row of input.slice(0, 512)) {
        if (!row || typeof row.id !== 'string' || !row.id || row.id.length > 300 || unique.has(row.id)) continue;
        if (!['waiting', 'approval', 'working', 'unknown', 'done', 'failed', 'saved', 'limited'].includes(row.status)) continue;
        unique.set(row.id, { id: row.id, title: clip(row.title, 120), product: clip(row.product, 64), provider: clip(row.provider, 32), status: row.status,
          ...(['conversation', 'import', 'status'].includes(row.action) ? { action: row.action } : {}),
          ...(row.live === true ? { live: true } : {}),
          ...(row.live === true && ['waiting', 'approval', 'working', 'unknown', 'done', 'failed', 'limited'].includes(row.observedStatus)
            ? { observedStatus: row.observedStatus } : {}) });
      }
      discovery = scan && ['scanning', 'ready', 'unavailable'].includes(scan.status)
        ? { status: scan.status, partial: !!scan.partial, days: 10,
          ...(['connecting', 'ready', 'unavailable'].includes(scan.lifecycleStatus) ? { lifecycleStatus: scan.lifecycleStatus } : {}) } : null;
      ready = true; rows = [...unique.values()]; send();
    },
    notify(arrivals) {
      if (disposed || rendererFailed || window.isDestroyed() || focused?.() || !Array.isArray(arrivals) || !arrivals.length) return false;
      noticeSequence++;
      resize(true); window.showInactive();
      timer = setTimeout(() => { timer = null; if (!disposed && !window.isDestroyed() && !window.isFocused()) resize(false); }, autoCollapseMs);
      return true;
    },
    collapse: () => resize(false),
    reposition: position,
    dispose() {
      if (disposed) return; disposed = true; clearTimer(); if (moveTimer) clearTimeout(moveTimer);
      if (reloadTimer) clearTimeout(reloadTimer);
      window.removeListener('will-move', moved);
      window.removeListener('close', close);
      for (const name of events) screen.removeListener(name, position);
      for (const name of Object.keys(handlers)) ipcMain.removeHandler(name);
      if (!window.isDestroyed()) window.destroy();
    },
  };
}
