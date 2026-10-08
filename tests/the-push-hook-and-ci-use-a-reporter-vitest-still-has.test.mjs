// The move to vitest 4 removed the `basic` reporter. The pre-push hook and
// the GitHub workflow both still asked for it, so every push was refused with
// "Failed to load custom Reporter from basic" before a single test ran, and
// the workflow would have failed the same way. Measured on the first push
// after the upgrade: both hook attempts died at reporter loading.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...f) => fs.readFileSync(path.join(root, ...f), 'utf8');

describe('the reporters the gates ask vitest for', () => {
  for (const file of [['scripts', 'hooks', 'pre-push'], ['.github', 'workflows', 'tests.yml']]) {
    it(`are ones vitest still ships, in ${file.join('/')}`, () => {
      const text = read(...file);
      expect(text).toMatch(/vitest[^\n]*--reporter=/);
      expect(text).not.toMatch(/--reporter=basic\b/);
    });
  }

  it('leaves a reporter name that is not "basic" alone', () => {
    expect('vitest run --reporter=default').not.toMatch(/--reporter=basic\b/);
    expect('vitest run --reporter=basic').toMatch(/--reporter=basic\b/);
  });
});
