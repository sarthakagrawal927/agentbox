import { scanInWorker } from './local-thread-scan.mjs';

export const THREAD_DISCOVERY_POLL_MS = 60_000;
export function createThreadDiscovery({ scan = scanInWorker, onChange = () => {}, firstDelayMs = 500, pollMs = THREAD_DISCOVERY_POLL_MS, now = Date.now } = {}) {
  let active = false, stopped = false, paused = false, generation = 0, timer = null, pending = null, abort = null;
  let current = { status: 'scanning', threads: [], sources: [], checkedAt: null, partial: false, days: 10, limit: 256 };
  const schedule = delay => {
    if (!active || stopped || paused) return;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void scanNow(); }, delay);
    timer.unref?.();
  };
  const scanNow = () => {
    if (stopped || paused) return Promise.resolve(current);
    if (pending) return pending;
    clearTimeout(timer); timer = null;
    abort = new AbortController();
    const token = ++generation;
    let scanned;
    try { scanned = scan({ signal: abort.signal, now: now() }); }
    catch { scanned = Promise.reject(Error('Thread discovery unavailable.')); }
    pending = (async () => {
      try {
        const out = await scanned;
        if (!stopped && token === generation) current = { ...out, status: 'ready', checkedAt: now() };
      } catch {
        if (!stopped && token === generation) current = { ...current, status: 'unavailable', partial: true };
      } finally {
        if (token === generation) {
          pending = null; abort = null;
          if (!stopped) { onChange(); schedule(pollMs); }
        }
      }
      return current;
    })();
    return pending;
  };
  return {
    state: () => current,
    scanNow,
    start() { if (active || stopped) return; active = true; schedule(firstDelayMs); },
    suspend() { if (stopped || paused) return; paused = true; generation++; clearTimeout(timer); timer = null; abort?.abort(); abort = null; pending = null; },
    resume() { if (stopped || !paused) return pending ?? Promise.resolve(current); paused = false; return scanNow(); },
    stop() { stopped = true; active = false; generation++; clearTimeout(timer); timer = null; abort?.abort(); abort = null; pending = null; },
  };
}
