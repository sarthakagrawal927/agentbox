// A saved transcript is identity evidence, not a running or replyable agent.
// Titles originate in user prompts. Scrub before clipping: a truncated URI can
// still contain its password even when the hostname has been cut off.
export function safeThreadLabel(value, limit = 120) {
  return String(value ?? '')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s]+/gi, '[link]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [private]')
    .replace(/\b(api[_ -]?key|token|secret|password|authorization)\s*[:=]\s*[^\s]+/gi, '$1=[private]')
    .replace(/(?:\/Users\/|\/home\/|~\/)[^\s]+/g, '[private path]')
    .replace(/\b(?:sk-|ghp_|github_pat_|xox[baprs]-)[a-z0-9_-]+/gi, '[private]')
    .replace(/\b[a-z0-9_-]{28,}\b/gi, '[private]')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}
export function threadKey(thread) {
  if (!thread || !['terminal', 'desktop', 'codex'].includes(thread.source)) return null;
  const id = typeof thread.id === 'string' ? thread.id.trim() : '';
  if (!id || id.length > 300) return null;
  return `local:${thread.source === 'codex' ? 'codex' : 'claude'}:${encodeURIComponent(id)}`;
}

export function visibleDiscoveredThreads(threads = [], { items = [], agents = [], ownedSessions = [] } = {}) {
  const hidden = new Set();
  for (const item of items) {
    const labels = item?.labels ?? [];
    const declined = item?.status === 'done' && labels.includes('not-imported');
    for (const label of labels) {
      if (typeof label !== 'string') continue;
      if (label.startsWith('thread:')) hidden.add(threadKey({ source: 'terminal', id: label.slice(7) }));
      if (label.startsWith('codex:') && !declined) hidden.add(threadKey({ source: 'codex', id: label.slice(6) }));
    }
  }
  for (const id of [...ownedSessions, ...agents.map(a => a.sessionId)]) hidden.add(threadKey({ source: 'terminal', id }));
  const rows = new Map();
  for (const t of [...threads].sort((a, b) => (b?.when ?? 0) - (a?.when ?? 0))) {
    const key = threadKey(t);
    if (!key || hidden.has(key) || rows.has(key) || typeof t.title !== 'string' || !t.title.trim()) continue;
    rows.set(key, {
      key, id: t.id.trim(), source: t.source,
      title: safeThreadLabel(t.title),
      folderName: typeof t.folderName === 'string' ? safeThreadLabel(t.folderName, 64) : '',
      when: Number.isFinite(t.when) && t.when > 0 ? t.when : 0,
    });
  }
  return [...rows.values()];
}

export function selectThreadKeys(threads, keys) {
  const wanted = new Set(Array.isArray(keys) ? keys.filter(k => typeof k === 'string') : []);
  return threads.filter(t => wanted.has(threadKey(t)));
}
