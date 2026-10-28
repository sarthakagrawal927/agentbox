import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, '.cloudflare/output/v0');
const worker = resolve(output, 'workers/default');
const assets = resolve(worker, 'assets');
mkdirSync(assets, { recursive: true });
// Only the authored public assets enter the deployable artifact.
for (const file of ['index.html', 'style.css', 'favicon.svg', 'robots.txt', '_headers']) {
  copyFileSync(resolve(root, 'public', file), resolve(assets, file));
}
writeFileSync(resolve(output, 'config.json'), JSON.stringify({ buildContext: { isPreview: false } }));
writeFileSync(resolve(worker, 'worker.config.json'), JSON.stringify({ name: 'agent-inbox-site', compatibilityDate: '2026-10-28', workersDev: true, assets: { notFoundHandling: 'none' } }));
console.log('Built the Agent Inbox static site for cf deploy --prebuilt.');
