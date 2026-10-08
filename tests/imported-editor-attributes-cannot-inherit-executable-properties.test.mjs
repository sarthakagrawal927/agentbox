// The release audit found GHSA-cp6q-959q-f8rh in the bundled editor.
// Reproduce its JSON-origin prototype manipulation against the installed API;
// legitimate classes and attributes must still merge normally.
import { describe, it, expect } from 'vitest';
import { mergeAttributes } from '@tiptap/core';

describe('imported editor attributes stay ordinary data', () => {
  it('does not inherit attributes from an own JSON __proto__ key', () => {
    const input = JSON.parse('{"__proto__":{"onerror":"attack","src":"unsafe"},"title":"safe"}');
    const result = mergeAttributes(input);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.onerror).toBeUndefined();
    expect(result.src).toBeUndefined();
    expect(result.title).toBe('safe');
    expect(Object.prototype.onerror).toBeUndefined();
  });

  it('keeps ordinary classes and later attributes', () => {
    expect(mergeAttributes({ class: 'one', title: 'before' }, { class: 'two', title: 'after' }))
      .toEqual({ class: 'one two', title: 'after' });
  });
});
