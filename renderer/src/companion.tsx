import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CompanionState, CompanionRow } from './companion-model';
import { companionSummary, companionEmptyState, agentBattery } from './companion-model';
import './inbox-dark.css';
import './companion.css';
import { SidebarIcon } from './components/SidebarIcon';
import { createCompanionAudio, soundForTransition } from './companion-audio';

declare global { interface Window { inboxCompanion?: {
  state(): Promise<CompanionState>; expand(value: boolean): Promise<CompanionState>;
  open(id: string | null): Promise<{ ok: boolean; reason?: string }>;
  position(): Promise<{ok: boolean; reason?: string}>;
  sound(value: boolean): Promise<CompanionState>;
  onState(callback: (state: CompanionState) => void): () => void;
} } }
const words: Record<CompanionRow['status'], string> = { waiting: 'Needs you', approval: 'Approval required', working: 'Working', unknown: 'Status unavailable', done: 'At prompt', failed: 'Blocked', saved: 'Saved thread', limited: 'Rate limited' };
const priority = { approval: 0, waiting: 1, failed: 2, limited: 2, working: 3, unknown: 4, done: 5, saved: 6 };
function Companion() {
  const api = window.inboxCompanion;
  const [state, setState] = useState<CompanionState>({ expanded: !api, ready: false, rows: [] });
  const [error, setError] = useState('');
  const pill = useRef<HTMLButtonElement>(null);
  const audio = useRef<ReturnType<typeof createCompanionAudio> | null>(null);
  const previous = useRef<CompanionState | null>(null);
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    if (!state.noticeSequence) return;
    setDropping(true);
    const timer = setTimeout(() => setDropping(false), 750);
    return () => clearTimeout(timer);
  }, [state.noticeSequence]);
  useEffect(() => {
    const before = previous.current; previous.current = state;
    const cue = soundForTransition(before, state);
    if (!state.soundEnabled) { audio.current?.dispose(); audio.current = null; }
    else if (cue) { audio.current ??= createCompanionAudio(); void audio.current.play(cue); }
  }, [state]);
  useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);
  useEffect(() => {
    if (!api) return;
    let alive = true;
    const off = api.onState(value => { if (alive) setState(value); });
    void api.state().then(value => { if (alive) setState(value); }).catch(() => { if (alive) setError('Connection unavailable. Reopen the inbox.'); });
    return () => { alive = false; off(); };
  }, [api]);
  const expand = async (value: boolean) => {
    if (!api) return;
    try { setState(await api.expand(value)); if (!value) pill.current?.focus(); }
    catch { setError('Could not update the companion. Reopen the inbox.'); }
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); void expand(false); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [api]);
  const open = async (id: string | null) => {
    setError('');
    try { const result = await api?.open(id); if (!result?.ok) setError(result?.reason ?? 'Open this companion in the desktop app.'); }
    catch { setError('The conversation could not be opened. Your session is unchanged.'); }
  };
  const position = async () => {
    setError('');
    try { const result = await api?.position(); if (!result?.ok) setError(result?.reason ?? 'Position controls are available in the desktop app.'); }
    catch { setError('Could not open position controls. Try again.'); }
  };
  const toggleSound = async () => {
    setError('');
    try {
      if (!api) { setError('Sound controls are available in the desktop app.'); return; }
      setState(await api.sound(!state.soundEnabled));
    } catch { setError('Could not change sound. Try again.'); }
  };
  const rows = [...state.rows].sort((a, b) => priority[a.status] - priority[b.status]);
  const needs = rows.filter(row => ['waiting', 'approval', 'failed', 'limited'].includes(row.status)).length;
  const working = rows.filter(row => row.status === 'working').length;
  const unknown = rows.filter(row => row.status === 'unknown').length;
  const summary = companionSummary(state, needs, !!api);
  const empty = companionEmptyState(state);
  const battery = agentBattery(rows);
  return <main className={`companion ${state.expanded ? 'expanded' : ''}`} data-side={state.side ?? 'right'} style={{'--pill-top': `${state.pillTop ?? (state.expanded ? 170 : 6)}px`, '--pill-height': `${state.pillHeight ?? 180}px`, '--pill-left': state.pillLeft === undefined ? undefined : `${state.pillLeft}px`} as React.CSSProperties}>
    <section className="attention t-panel-slide" data-open={state.expanded} aria-hidden={!state.expanded} {...(!state.expanded ? { inert: '' } : {})} aria-label="Agent Inbox attention">
      <header><span className="identity"><SidebarIcon view="inbox"/> Agent Inbox</span><button className="collapse" aria-label="Collapse companion" onClick={() => void expand(false)}>×</button></header>
      {state.discovery && (state.discovery.status !== 'ready' || state.discovery.partial) && <p className="discovery-note">{state.discovery.status === 'scanning' ? 'Finding local threads…' : state.discovery.status === 'unavailable' ? 'Thread discovery unavailable; saved results may be out of date.' : 'Recent threads · some results may be missing'}</p>}
      {state.discovery?.lifecycleStatus === 'unavailable' && <p className="discovery-note">External hook status unavailable.</p>}
      <div className="requests">
        {rows.length === 0 && <div className="empty"><span className="empty-mark" aria-hidden="true">↗</span><h2>{empty.title}</h2><p>{empty.message}</p></div>}
        {rows.map(row => <button className="request" key={row.id} disabled={row.action === 'status'} onClick={() => void open(row.id)}>
          <span className="request-source"><span>{row.product || 'Local conversation'}</span><span>{row.provider}</span></span>
          <span className="request-title">{row.title || 'Agent conversation'}</span>
          <span className={`request-state ${row.status}`}><i aria-hidden="true"/>{words[row.status]}{row.action !== 'status' && <span className="request-arrow" aria-hidden="true">↗</span>}</span>
          {(row.action === 'status' || row.status === 'approval' || row.status === 'saved' || row.action === 'import') && <span className="request-action">{row.action === 'status' ? 'Status only · conversation not linked' : row.status === 'approval' ? 'Review permission request' : 'Review import'}</span>}
        </button>)}
      </div>
      {(error || state.placementError) && <p className="error" role="alert">{error || state.placementError}</p>}
      <footer><button className="open-inbox" onClick={() => void open(null)}>All conversations <span aria-hidden="true">↗</span></button><div className="companion-options"><span className="discovery-scope">{state.discovery ? 'Recent 10 days' : 'Local threads'}</span><button onClick={() => void toggleSound()} aria-pressed={state.soundEnabled ?? false} title="Soft drops for new requests, a whoosh when the panel opens">Sound {state.soundEnabled ? 'on' : 'off'}</button><button onClick={() => void position()} aria-label="Position companion">{state.placement?.locked ? 'Pinned' : 'Position'} <span aria-hidden="true">⌖</span></button></div></footer>
    </section>
    <div className="pill-rail" data-locked={state.placement?.locked ?? false}>
    <span className="pill-grip" title={state.placement?.locked ? 'Position locked; use Position to unlock' : 'Drag to move. Your position is saved.'} aria-hidden="true"><i/><i/></span>
    <button ref={pill} className="edge-pill" title={`Agent status · ${battery.label}`} aria-label={`Agent Inbox: ${summary} ${battery.label} ${working} working threads. ${unknown} unavailable threads. ${state.expanded ? 'Collapse' : 'Expand'} companion.`} aria-expanded={state.expanded} onClick={() => void expand(!state.expanded)}>
      <span className="pill-mark liquid-mark" data-dropping={dropping} aria-hidden="true"><span className="droplet"/><span className="ripple"/></span>
      <svg className="agent-battery" viewBox="0 0 33 18" aria-hidden="true">
        <rect className="battery-outline" x=".5" y="1.5" width="29" height="15" rx="3"/>
        <rect className="battery-terminal" x="30.5" y="6" width="2.5" height="6" rx="1"/>
        {battery.segments.map((segment, i) => <rect key={i} className={`battery-segment ${segment.tone}`} x={segment.x} y="4.5" width={segment.width} height="9" rx=".4"/>)}
      </svg>
      <span className={`pill-count ${needs ? 'needs' : ''}`} aria-hidden="true">{state.ready ? needs > 99 ? '99+' : needs : '·'}</span>
    </button>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Companion/>);
