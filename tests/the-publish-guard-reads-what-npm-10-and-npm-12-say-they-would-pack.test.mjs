// THE PUBLISH GUARD COULD NOT READ npm 12, SO IT REFUSED EVERYTHING.
//
// scripts/before-publish.mjs asks `npm pack --dry-run --json` which files would
// ship and refuses only uncommitted files on that list. It took the output from
// the first `[` onward, which is npm 10's array. npm 12 prints an object keyed
// by package name, so that first `[` was the "files" list inside it, the parse
// threw, and the guard fell back to refusing every uncommitted file at all.
// Measured 2026-10-09 on npm 12.2.0: two guard tests failed and the package
// privacy test did not load. These pin both shapes, with and without chatter
// above them, and run the real guard against a stand-in npm printing each.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packManifest, packManifests, packedPaths } from '../shared/npm-pack-json.mjs';

const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GUARD = path.join(here, 'scripts', 'before-publish.mjs');

const manifest = (name, paths) => ({
  id: `${name}@1.0.0`, name, version: '1.0.0', entryCount: paths.length,
  files: paths.map((p) => ({ path: p, size: 1, mode: 420 })),
});
const npm10 = (m) => JSON.stringify([m], null, 2);
const npm12 = (m) => JSON.stringify({ [m.name]: m }, null, 2);

describe('reading npm pack --json', () => {
  const m = manifest('a-test-package', ['package.json', 'ships/a.mjs']);

  it('reads npm 10, an array of manifests', () => {
    expect(packManifest(npm10(m)).name).toBe('a-test-package');
    expect([...packedPaths(npm10(m))]).toEqual(['package.json', 'ships/a.mjs']);
  });

  it('reads npm 12, an object keyed by package name', () => {
    expect(packManifest(npm12(m)).name).toBe('a-test-package');
    expect([...packedPaths(npm12(m))]).toEqual(['package.json', 'ships/a.mjs']);
  });

  it('reads a bare manifest object, in case a later npm drops the key', () => {
    expect(packManifest(JSON.stringify(m)).files).toHaveLength(2);
  });

  it('skips what a lifecycle script printed above the JSON, brackets and all', () => {
    const chatter = '> agentbox-app@1.0.0 prepack\n> vite build [renderer]\n{ not json either\n';
    expect([...packedPaths(chatter + npm10(m))]).toEqual(['package.json', 'ships/a.mjs']);
    expect([...packedPaths(chatter + npm12(m))]).toEqual(['package.json', 'ships/a.mjs']);
  });

  it('keeps every package when npm packs more than one', () => {
    const two = JSON.stringify({ one: manifest('one', ['a']), two: manifest('two', ['b']) });
    expect(packManifests(two).map((x) => x.name)).toEqual(['one', 'two']);
  });

  it('throws, rather than reporting an empty package, on anything else', () => {
    // An empty set would let every uncommitted file through. Throwing sends
    // the guard to its cautious fallback instead.
    expect(() => packedPaths('')).toThrow();
    expect(() => packedPaths('npm error code E404\n')).toThrow();
    expect(() => packedPaths('{}')).toThrow();
    expect(() => packedPaths('[]')).toThrow();
    expect(() => packedPaths('{"error": {"code": "E404"}}')).toThrow();
  });
});

// The real guard, against a real repository, with `npm` on PATH replaced by a
// script that prints the shape under test and lists ships/a.mjs and
// ships/stray.mjs as what it would pack.
let root;

beforeAll(() => {
  const at = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-pack-shape-'));
  const origin = path.join(at, 'origin.git');
  const work = path.join(at, 'work');
  const bin = path.join(at, 'bin');
  execFileSync('git', ['init', '--bare', '--initial-branch=main', origin], { stdio: 'ignore' });
  execFileSync('git', ['clone', origin, work], { stdio: 'ignore' });
  const git = (...args) => execFileSync('git', args, { cwd: work, stdio: 'ignore' });
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'A Test');
  fs.mkdirSync(path.join(work, 'ships'));
  fs.writeFileSync(path.join(work, 'ships', 'a.mjs'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(work, 'package.json'), '{ "name": "a-test-package", "version": "1.0.0" }\n');
  git('add', '-A');
  git('commit', '-m', 'first');
  git('push', 'origin', 'main');

  fs.mkdirSync(bin);
  const m = manifest('a-test-package', ['package.json', 'ships/a.mjs', 'ships/stray.mjs']);
  fs.writeFileSync(path.join(at, 'npm10.json'), npm10(m));
  fs.writeFileSync(path.join(at, 'npm12.json'), npm12(m));
  fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\necho "npm notice chatter"\ncat "$FAKE_PACK_OUTPUT"\n', { mode: 0o755 });
  root = { at, work, bin };
});

afterAll(() => { if (root) fs.rmSync(root.at, { recursive: true, force: true }); });

function guardWith(shape) {
  const env = { ...process.env, PATH: `${root.bin}${path.delimiter}${process.env.PATH}`, FAKE_PACK_OUTPUT: path.join(root.at, `${shape}.json`) };
  delete env.AGENTBOX_PUBLISH_ANYWAY;
  try {
    return { allowed: true, said: execFileSync(process.execPath, [GUARD], { cwd: root.work, encoding: 'utf8', env }) };
  } catch (err) {
    return { allowed: false, said: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe.each(['npm10', 'npm12'])('the publish guard under %s', (shape) => {
  it('lets a scratch file the package does not reach through', () => {
    fs.writeFileSync(path.join(root.work, 'notes.txt'), 'thinking\n');
    const r = guardWith(shape);
    fs.rmSync(path.join(root.work, 'notes.txt'));
    expect(r.allowed, r.said).toBe(true);
  });

  it('refuses an uncommitted file npm says it would pack, and names only that one', () => {
    fs.writeFileSync(path.join(root.work, 'ships', 'stray.mjs'), 'export const stray = 1;\n');
    fs.writeFileSync(path.join(root.work, 'notes.txt'), 'thinking\n');
    const r = guardWith(shape);
    fs.rmSync(path.join(root.work, 'ships', 'stray.mjs'));
    fs.rmSync(path.join(root.work, 'notes.txt'));
    expect(r.allowed).toBe(false);
    expect(r.said).toContain('1 uncommitted file would go into the package');
    expect(r.said).toContain('ships/stray.mjs');
    expect(r.said).not.toContain('notes.txt');
  });
});
