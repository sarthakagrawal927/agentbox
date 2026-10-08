// The patched editor's StarterKit also supplies Link and Underline. Duplicate
// extensions can override our shortcuts and renderer; inspect the resolved
// schema and options used by the actual editor, without mounting a DOM.
import { describe, it, expect, vi } from 'vitest';
import { getSchema } from '@tiptap/core';
import { buildExtensions } from '../renderer/src/editor/extensions.ts';
import config from '../vitest.config.mjs';

describe('the editor upgrade preserves behavior', () => {
  it('does not register duplicate extensions', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      getSchema(buildExtensions('Write anything…', { tables: false }));
      expect(warning.mock.calls.flat().join(' ')).not.toMatch(/Duplicate extension/);
    } finally { warning.mockRestore(); }
  });

  it('does not insert new trailing nodes into stored documents', () => {
    const kit = buildExtensions('Write anything…', { tables: false }).find(e => e.name === 'starterKit');
    expect(kit.options.trailingNode).toBe(false);
  });

  it('keeps the suite within the shared Mac worker budget', () => {
    expect(config.test.maxWorkers).toBeGreaterThan(0);
    expect(config.test.maxWorkers).toBeLessThanOrEqual(2);
  });
});
