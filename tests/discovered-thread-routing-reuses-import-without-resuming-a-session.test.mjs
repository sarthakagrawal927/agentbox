// Saved rows must open exact-thread review, not a composer or an automatic
// import. The desktop IPC wiring must publish cached metadata, not scan on draw.
import { it, expect } from 'vitest';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
it('loads threads in targeted review while skipping agent-file and folder discovery',()=>{
  const card=read('renderer/src/components/ImportAgents.tsx');
  const effects=card.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g)??[];
  const threadEffect=effects.find(e=>e.includes('api.agentThreads(threadKey)'));
  const fileEffect=effects.find(e=>e.includes('api.agentFiles('));
  expect(threadEffect?.includes('if (threadKey)')).toBe(false);
  expect(fileEffect?.includes('if (threadKey) { setFound')).toBe(true);
});
it('starts and stops automatic discovery with the desktop app and publishes its cached state',()=>{
  const main=read('main/main.mjs');const ipc=read('main/ipc.mjs');
  expect(main).toContain('threadDiscovery.start()');expect(main).toContain('threadDiscovery.stop()');
  expect(ipc).toContain('threadDiscovery.state()');expect(ipc).toContain('localThreads:');
  const snapshot=ipc.slice(ipc.indexOf("ipcMain.handle('zero:snapshot'"),ipc.indexOf("ipcMain.handle('zero:agent-reply'"));
  expect(snapshot).not.toContain('readAllThreads(');expect(snapshot).not.toContain('scanNow(');
});
it('routes a saved key to import review and narrows the existing card to that key',()=>{
  const app=read('renderer/src/App.tsx');const card=read('renderer/src/components/ImportAgents.tsx');
  expect(app).toContain('setDiscoveredThread(thread?.key ?? hookedImport!.id)');expect(app).toContain('threadKey={discoveredThread}');
  expect(card).toContain('selectThreadKeys');expect(card).toContain('threadKeys:');
  expect(card).toContain('Importing does not start an agent.');
  expect(read('main/ipc.mjs')).toContain('selectThreadKeys(lastThreads, threadKeys)');
});
it('keeps the scan read-only, independent of provider account settings and store APIs',()=>{
  const scan=read('main/local-thread-scan.mjs');
  expect(scan).not.toMatch(/writeFile|createWorkItem|importCodexThreads|importThreadRows|spawn\(|\.config|auth\.json/);
  expect(scan).toContain('new Worker(');expect(scan).toContain('worker.terminate()');
});
