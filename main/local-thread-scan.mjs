// Existing Claude/Codex readers run in a disposable Node worker. Only bounded
// display metadata crosses back; discovery has no store, worker or network API.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readSessionThreads, desktopSessionsDir, RECENT_DAYS } from './agent-sessions.mjs';
import { readCodexThreads } from './codex-threads.mjs';
import { visibleDiscoveredThreads, selectThreadKeys, safeThreadLabel } from '../shared/local-threads.mjs';

export const DISCOVERY_LIMIT = 256;
export function collectRecentThreads({ home = os.homedir(), now = Date.now(), readClaude = readSessionThreads, readCodex = readCodexThreads } = {}) {
  let threads = [], partial = false;
  const sources = [];
  for (const [provider, roots, read] of [
    ['Claude', [path.join(home, '.claude', 'projects'), desktopSessionsDir(home)], readClaude],
    ['Codex', [path.join(home, '.codex', 'sessions')], readCodex],
  ]) {
    const found = roots.filter(root => fs.existsSync(root));
    if (!found.length) { sources.push({ provider, status: 'missing' }); continue; }
    try {
      for (const root of found) fs.accessSync(root, fs.constants.R_OK);
      const out = read({ home, now, days: RECENT_DAYS, ...(provider === 'Codex' ? {metadataOnly:true} : {}) });
      threads.push(...(Array.isArray(out?.threads) ? out.threads : []));
      const incomplete = Number(out?.skipped?.unread ?? 0) > 0 || Number(out?.skipped?.unreadable ?? 0) > 0;
      partial ||= incomplete;
      sources.push({ provider, status: 'available', partial: incomplete });
    } catch { partial = true; sources.push({ provider, status: 'unavailable' }); }
  }
  threads = visibleDiscoveredThreads(threads);
  partial ||= threads.length > DISCOVERY_LIMIT;
  return { threads: threads.slice(0, DISCOVERY_LIMIT), sources, partial, days: RECENT_DAYS, limit: DISCOVERY_LIMIT };
}

export function scanInWorker(options = {}) { return runWorker(options); }
export function readImportThreadInWorker(options = {}) {
  if (typeof options.threadKey !== 'string' || !/^local:(claude|codex):.+$/.test(options.threadKey) || options.threadKey.length > 1000) return Promise.resolve({ threads: [] });
  return runWorker(options);
}
function runWorker({ home = os.homedir(), now = Date.now(), signal, timeoutMs = 15_000, threadKey } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(Error('Thread discovery cancelled.')); return; }
    const worker = new Worker(new URL('./local-thread-scan.mjs', import.meta.url), {
      workerData: { localThreadScan: true, home, now, threadKey },
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      void worker.terminate();
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(Error('Thread discovery cancelled.'));
    const timer = setTimeout(() => finish(Error('Thread discovery timed out.')), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    worker.once('message', value => finish(null, value));
    worker.once('error', () => finish(Error('Thread discovery unavailable.')));
    worker.once('exit', () => finish(Error('Thread discovery unavailable.')));
  });
}

if (!isMainThread && workerData?.localThreadScan) {
  if (workerData.threadKey) {
    const read = workerData.threadKey.startsWith('local:codex:') ? readCodexThreads : readSessionThreads;
    const { threads } = read({ home: workerData.home, now: workerData.now, days: RECENT_DAYS });
    parentPort.postMessage({ threads: selectThreadKeys(threads, [workerData.threadKey]).map(t => ({ ...t, title: safeThreadLabel(t.title), folderName: safeThreadLabel(t.folderName, 64) })) });
  } else parentPort.postMessage(collectRecentThreads(workerData));
}
