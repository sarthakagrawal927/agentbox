import type { WorkItem, Approval } from './types';
import type { DiscoveredThread } from '../../shared/local-threads.mjs';
export type CompanionStatus = 'waiting' | 'approval' | 'working' | 'unknown' | 'done' | 'failed' | 'saved' | 'limited';
export type CompanionRow = { id: string; title: string; product: string; provider: string; status: CompanionStatus; action?: 'conversation' | 'import' | 'status'; live?: boolean; observedStatus?: Exclude<CompanionStatus, 'saved'> };
export type CompanionState = { expanded: boolean; ready: boolean; rows: CompanionRow[]; soundEnabled?: boolean; noticeSequence?: number; discovery?: { status: 'scanning' | 'ready' | 'unavailable'; partial: boolean; days: number; lifecycleStatus?: 'connecting' | 'ready' | 'unavailable' } | null; side?: 'left' | 'right'; pillTop?: number; pillLeft?: number; pillHeight?: number; placement?: { displayId: number | null; x: number; y: number; locked: boolean; allSpaces: boolean }; placementError?: string };
export function companionSummary(state: CompanionState, needs: number, connected: boolean): string {
  if (!state.ready) return connected ? 'Connecting…' : 'Desktop connection unavailable';
  if (needs) return needs === 1 ? 'One thing for you.' : `${needs} things for you.`;
  if (state.rows.some(row => row.status === 'unknown') || state.discovery?.status === 'unavailable' || state.discovery?.lifecycleStatus === 'unavailable') return 'Status unavailable.';
  if (state.discovery?.status === 'scanning' || state.discovery?.lifecycleStatus === 'connecting') return 'Checking your threads.';
  if (state.discovery?.partial) return 'Some status is missing.';
  return 'Nothing needs you.';
}
export function companionEmptyState(state: CompanionState): { title: string; message: string } {
  if (!state.ready) return { title: 'Waiting for the inbox', message: 'Open the desktop inbox to connect your conversations.' };
  if (state.discovery?.status === 'unavailable' || state.discovery?.lifecycleStatus === 'unavailable') return { title: 'Waiting for status', message: 'Local thread status is unavailable. Open the inbox to check your conversations.' };
  if (state.discovery?.status === 'scanning' || state.discovery?.lifecycleStatus === 'connecting') return { title: 'Finding your threads', message: 'Checking recent local conversations. Results will appear here.' };
  if (state.discovery?.partial) return { title: 'Some threads may be missing', message: 'Open the inbox to check your conversations while discovery catches up.' };
  return { title: 'You’re clear for now', message: 'New requests will appear here. Keep working; we’ll bring them to you.' };
}
export function companionRows({ inbox, progress, agents, running, approvals, engines, discovered = [], lifecycle = [] }: {
  inbox: WorkItem[]; progress: WorkItem[]; agents: WorkItem[];
  running: { itemId: string }[]; approvals: Approval[];
  engines: { workspace?: string; byItem?: Record<string, string> };
  discovered?: DiscoveredThread[];
  lifecycle?: CompanionRow[];
}): CompanionRow[] {
  const working = new Set(running.map(row => row.itemId));
  const asking = new Set(approvals.map(row => row.item));
  const rows = new Map<string, CompanionRow>();
  const add = (item: WorkItem, status: CompanionRow['status']) => {
    const agent = item.agent;
    if (agent) {
      status = agent.waitingFor === 'permission prompt' ? 'approval'
        : agent.status === 'waiting' ? 'waiting'
        : agent.status === 'busy' || agent.status === 'shell' ? 'working'
        : agent.status === 'idle' ? 'done' : 'unknown';
    }
    if (asking.has(item.id)) status = 'approval';
    const engine = engines.byItem?.[item.id] ?? engines.workspace;
    rows.set(item.id, { id: item.id, title: item.label || item.title, product: item.productName || item.product || '', provider: agent ? 'Claude' : engine === 'codex' ? 'Codex' : engine === 'claude' ? 'Claude' : 'Agent', status,
      ...(agent || working.has(item.id) ? {live: true} : {}) });
  };
  inbox.forEach(item => add(item, item.status === 'blocked' ? 'failed' : 'waiting'));
  progress.forEach(item => { if (!rows.has(item.id)) add(item, working.has(item.id) ? 'working' : 'unknown'); });
  agents.forEach(item => { if (!rows.has(item.id)) add(item, 'unknown'); });
  discovered.forEach(thread => rows.set(thread.key, { id: thread.key, title: thread.title, product: thread.folderName,
    provider: thread.source === 'codex' ? 'Codex' : 'Claude', status: 'saved' }));
  lifecycle.forEach(row => {
    const existing = rows.get(row.id);
    if (!existing || existing.status === 'saved') rows.set(row.id, row);
    // An imported row can need a reply while its outside process is working.
    // Preserve the conversation action and display status; keep battery evidence.
    else if (row.live && !existing.live && row.status !== 'saved') rows.set(row.id, {...existing, live: true, observedStatus: row.status});
  });
  return [...rows.values()];
}

type BatteryTone = 'working' | 'attention' | 'failed' | 'idle' | 'unknown';
export function agentBattery(rows: CompanionRow[]) {
  const live = rows.filter(row => row.live === true && row.status !== 'saved');
  const tones: BatteryTone[] = ['working', 'attention', 'failed', 'idle', 'unknown'];
  const tone = (row: CompanionRow): BatteryTone => {
    const activity = row.observedStatus ?? row.status;
    return activity === 'working' ? 'working'
      : ['waiting', 'approval', 'limited'].includes(activity) ? 'attention'
      : activity === 'failed' ? 'failed' : activity === 'done' ? 'idle' : 'unknown';
  };
  const counts = Object.fromEntries(tones.map(t => [t, live.filter(row => tone(row) === t).length])) as Record<BatteryTone, number>;
  const total = live.length;
  const segments: {tone: BatteryTone; x: number; width: number}[] = [];
  let x = 4;
  if (total <= 12) {
    const width = total ? (21 - (total - 1)) / total : 0;
    for (const t of tones) for (let i = 0; i < counts[t]; i++) {
      segments.push({tone: t, x, width}); x += width + 1;
    }
  } else for (const t of tones) if (counts[t]) {
    const width = 21 * counts[t] / total;
    segments.push({tone: t, x, width}); x += width;
  }
  const label = total ? `${total} observed agents: ${counts.working} working, ${counts.attention} need attention, ${counts.failed} blocked, ${counts.idle} at prompt, ${counts.unknown} status unavailable.`
    : 'No live agents observed. Discovery may be incomplete.';
  return {total, segments, label};
}

// Null is startup; an initialized empty inbox must still announce new work.
export function freshArrivals<T extends { id: string }>(previous: Set<string> | null, rows: T[]): T[] {
  return previous === null ? [] : rows.filter(row => !previous.has(row.id));
}
