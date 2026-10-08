// Tiptap 3 emits updates from setContent unless explicitly suppressed. Loading
// another product or a late description must not write an untouched note.
// Execute each actual component call with a command spy, without a browser.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

describe('programmatic editor loads are quiet', () => {
  for (const name of ['DocText', 'RailNote']) {
    it(`${name} never treats a load as an edit`, () => {
      const source = readFileSync(new URL(`../renderer/src/components/${name}.tsx`, import.meta.url), 'utf8');
      const calls = source.split('\n').filter(line => line.includes('editor.commands.setContent('));
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        const setContent = vi.fn();
        new Function('editor', 'doc', 'mdToPmDoc', 'seed', 'text', call)(
          { commands: { setContent } }, { type: 'doc' }, value => value, 'description', 'note');
        expect(setContent.mock.calls[0][1]).toEqual({ emitUpdate: false });
      }
    });
  }
});
