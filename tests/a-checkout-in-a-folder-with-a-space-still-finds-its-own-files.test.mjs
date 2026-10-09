// A CHECKOUT WHOSE PATH HAS A SPACE IN IT COULD NOT FIND ITS OWN FILES.
//
// Several tests and two scripts turned `import.meta.url` into a path with
// `new URL(...).pathname`. That keeps the URL's escaping, so a checkout under
// ".../Application Support/..." looked for ".../Application%20Support/..." and
// got ENOENT. Measured 2026-10-09 in a worktree under Application Support:
// 6 tests failed and 1 file did not load, all green in CI, whose path has no
// spaces. fileURLToPath decodes; .pathname does not. This keeps it out.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const self = fileURLToPath(import.meta.url);

// Built from pieces so this file does not match itself.
const META = 'import' + '.meta.url';
const UNDECODED = new RegExp(`new URL\\((?:[^()]*,\\s*)?${META.replace(/\./g, '\\.')}\\)\\.pathname`);

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'scratch' || entry.name === 'dist') continue;
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(at));
    else if (/\.(mjs|cjs|js|mts|ts|tsx)$/.test(entry.name)) out.push(at);
  }
  return out;
}

describe('turning a module URL into a path', () => {
  it('decodes a space with fileURLToPath, which .pathname does not', () => {
    const url = pathToFileURL('/tmp/a folder/b.mjs');
    expect(url.pathname).toBe('/tmp/a%20folder/b.mjs');
    expect(fileURLToPath(url)).toBe('/tmp/a folder/b.mjs');
  });

  it('the check catches both spellings of the mistake, and not a request URL', () => {
    expect(UNDECODED.test(`new URL(${META}).pathname`)).toBe(true);
    expect(UNDECODED.test(`new URL('../build/icon.icns', ${META}).pathname`)).toBe(true);
    expect(UNDECODED.test(`fileURLToPath(new URL('../a', ${META}))`)).toBe(false);
    expect(UNDECODED.test('decodeURIComponent(new URL(req.url).pathname)')).toBe(false);
  });

  it('nothing in the repository reads a module URL as a path without decoding it', () => {
    const offenders = ['tests', 'scripts', 'main', 'shared', 'bin', 'mcp', 'renderer/src', 'cloud']
      .map((d) => path.join(root, d))
      .filter((d) => fs.existsSync(d))
      .flatMap(sourceFiles)
      .filter((f) => f !== self && UNDECODED.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
