// Live probes found a missing sitemap and two public hosts without a canonical URL.
import { beforeAll, test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '../website');
let assets;
beforeAll(() => {
  const temp = mkdtempSync(join(tmpdir(), 'agent-inbox-discovery-test-'));
  cpSync(join(root, 'build.mjs'), join(temp, 'build.mjs'));
  cpSync(join(root, 'public'), join(temp, 'public'), { recursive: true });
  execFileSync(process.execPath, [join(temp, 'build.mjs')]);
  assets = join(temp, '.cloudflare/output/v0/workers/default/assets');
});

test('both public hosts identify the custom-domain homepage as canonical', () => {
  const html = readFileSync(join(assets, 'index.html'), 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/agentinbox\.significanthobbies\.com\/">/);
  assert.doesNotMatch(html, /<meta[^>]+(?:noindex|nofollow)/i);
});

test('robots advertises the canonical sitemap without blocking the introduction', () => {
  const robots = readFileSync(join(assets, 'robots.txt'), 'utf8');
  assert.match(robots, /^User-agent: \*\r?\nAllow: \/\r?\n/m);
  assert.match(robots, /^Sitemap: https:\/\/agentinbox\.significanthobbies\.com\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m);
});

test('the published sitemap lists only the public canonical homepage', () => {
  const sitemap = readFileSync(join(assets, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), [
    'https://agentinbox.significanthobbies.com/',
  ]);
  assert.doesNotMatch(sitemap, /workers\.dev|github\.com|\/app|\/api|#/);
});
