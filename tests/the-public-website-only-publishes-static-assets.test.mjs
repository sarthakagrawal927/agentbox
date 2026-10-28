// The new public site must publish only authored static files, never the app or inbox state.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '../website');
test('public build excludes unrelated product files and declares an assets-only Worker', () => {
  const temp = mkdtempSync(join(tmpdir(), 'agent-inbox-site-test-'));
  mkdirSync(join(temp, 'public'));
  copyFileSync(join(root, 'build.mjs'), join(temp, 'build.mjs'));
  for (const name of ['index.html', 'style.css', 'favicon.svg', 'robots.txt', '_headers']) copyFileSync(join(root, 'public', name), join(temp, 'public', name));
  writeFileSync(join(temp, 'public', 'internal-note.txt'), 'synthetic file that must not be published');
  writeFileSync(join(temp, 'app-state.json'), '{"synthetic":true}');
  execFileSync(process.execPath, [join(temp, 'build.mjs')]);
  const out = join(temp, '.cloudflare/output/v0/workers/default');
  assert.deepEqual(readdirSync(join(out, 'assets')).sort(), ['_headers', 'favicon.svg', 'index.html', 'robots.txt', 'style.css']);
  const config = JSON.parse(readFileSync(join(out, 'worker.config.json'), 'utf8'));
  assert.equal(config.manifest, undefined);
  assert.equal(config.env, undefined);
  const html = readFileSync(join(out, 'assets/index.html'), 'utf8');
  assert.match(html, /Illustrative interface with fictional tasks/);
  assert.match(html, /not notarized/);
  assert.doesNotMatch(html, /<script|<form|noindex/i);
  assert.match(html, /<main[^>]*id="main"/);
});
