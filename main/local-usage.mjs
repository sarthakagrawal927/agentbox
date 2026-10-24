// Content-free, local-only counters for the separate Agent Inbox build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 50_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const KINDS = new Set(['foregroundFocus', 'savedReply', 'permissionResponse']);
const EMPTY = () => ({
  schemaVersion: 1,
  windowHours: 720,
  counts: { foregroundFocuses: 0, savedReplies: 0, permissionResponses: 0 },
  localDeviceUnits: 0,
  coreActionDeviceUnits: 0,
  coverageStatus: 'unknown',
  coverageSince: null,
  coverageComplete: false,
  lastUseAt: null,
  lastForegroundAt: null,
  eventLastSeen: { foregroundFocuses: null, savedReplies: null, permissionResponses: null },
});

export const localUsageFile = (dataDir) => path.join(dataDir, 'local-usage.json');

function validState(value) {
  return value && value.version === 1 && Number.isFinite(value.coverageSince)
    && Number.isFinite(new Date(value.coverageSince).getTime())
    && (value.droppedThroughAt === null || (Number.isFinite(value.droppedThroughAt)
      && Number.isFinite(new Date(value.droppedThroughAt).getTime())))
    && Array.isArray(value.events) && value.events.length <= MAX_EVENTS
    && value.events.every((event) => event && Number.isFinite(event.at)
      && Number.isFinite(new Date(event.at).getTime()) && KINDS.has(event.kind))
    && value.events.every((event, index, events) => index === 0 || events[index - 1].at <= event.at);
}

function writeState(file, state) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* best effort */ }
    throw error;
  }
}

export function createLocalUsage({ dataDir, now = Date.now } = {}) {
  if (typeof dataDir !== 'string' || !dataDir) throw new TypeError('A local data directory is required.');
  const file = localUsageFile(dataDir);
  const noOp = () => ({ record: () => false });
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch { return noOp(); }
  let state;
  try {
    const info = fs.lstatSync(file);
    if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_FILE_BYTES) return noOp();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!validState(parsed)) return noOp();
    state = parsed;
  } catch (error) {
    if (error?.code !== 'ENOENT') return noOp();
  }
  if (!state) state = { version: 1, coverageSince: now(), droppedThroughAt: null, events: [] };
  try { writeState(file, state); } catch { return noOp(); }

  return {
    record(kind) {
      if (!KINDS.has(kind)) return false;
      const at = now();
      if (!Number.isFinite(at) || !Number.isFinite(new Date(at).getTime())) return false;
      state.events.push({ at, kind });
      state.events.sort((left, right) => left.at - right.at);
      const cutoff = at - WINDOW_MS;
      const expired = state.events.filter((event) => event.at < cutoff);
      state.events = state.events.filter((event) => event.at >= cutoff);
      if (expired.length) {
        state.droppedThroughAt = Math.max(state.droppedThroughAt ?? -Infinity, ...expired.map((event) => event.at));
      }
      if (state.events.length > MAX_EVENTS) {
        const removed = state.events.splice(0, state.events.length - MAX_EVENTS);
        state.droppedThroughAt = Math.max(state.droppedThroughAt ?? -Infinity, ...removed.map((event) => event.at));
      }
      try { writeState(file, state); } catch { return false; }
      return true;
    },
  };
}

export function readLocalUsageReport({ file, now = Date.now() } = {}) {
  const report = EMPTY();
  if (typeof file !== 'string' || !file) return report;
  let state;
  try {
    const info = fs.lstatSync(file);
    if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_FILE_BYTES) return report;
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!validState(state)) return report;
  } catch { return report; }

  const cutoff = now - WINDOW_MS;
  const events = state.events.filter((event) => event.at >= cutoff && event.at <= now);
  for (const event of events) {
    if (event.kind === 'foregroundFocus') report.counts.foregroundFocuses += 1;
    if (event.kind === 'savedReply') report.counts.savedReplies += 1;
    if (event.kind === 'permissionResponse') report.counts.permissionResponses += 1;
  }
  const coreEvents = events.filter((event) => event.kind !== 'foregroundFocus');
  report.localDeviceUnits = events.length ? 1 : 0;
  report.coreActionDeviceUnits = coreEvents.length ? 1 : 0;
  report.coverageSince = new Date(state.coverageSince).toISOString();
  report.coverageComplete = state.coverageSince <= cutoff
    && (state.droppedThroughAt === null || state.droppedThroughAt < cutoff);
  report.coverageStatus = report.coverageComplete ? 'complete' : 'partial';
  const lastCore = coreEvents.reduce((last, event) => !last || event.at > last.at ? event : last, null);
  const lastForeground = events.reduce((last, event) => event.kind === 'foregroundFocus'
    && (!last || event.at > last.at) ? event : last, null);
  const lastSavedReply = events.reduce((last, event) => event.kind === 'savedReply'
    && (!last || event.at > last.at) ? event : last, null);
  const lastPermissionResponse = events.reduce((last, event) => event.kind === 'permissionResponse'
    && (!last || event.at > last.at) ? event : last, null);
  report.lastUseAt = lastCore ? new Date(lastCore.at).toISOString() : null;
  report.lastForegroundAt = lastForeground ? new Date(lastForeground.at).toISOString() : null;
  report.eventLastSeen = {
    foregroundFocuses: report.lastForegroundAt,
    savedReplies: lastSavedReply ? new Date(lastSavedReply.at).toISOString() : null,
    permissionResponses: lastPermissionResponse ? new Date(lastPermissionResponse.at).toISOString() : null,
  };
  return report;
}
