// The oversized announcement repeated the row status and delayed the list.
// Keep the expanded companion list-first while retaining empty-state guidance
// and the collapsed pill's accessible status summary.
import fs from 'node:fs';
import {it, expect} from 'vitest';
const source = fs.readFileSync(new URL('../renderer/src/companion.tsx', import.meta.url), 'utf8');
it('starts with a compact identity and the actual threads', () => {
  const header = source.match(/<header>(.*?)<\/header>/s)?.[1];
  expect(header).toContain('Agent Inbox');
  expect(header).not.toMatch(/<h1\b|One thing|for you/);
  expect(source).not.toContain('className="overview"');
  expect(source).toContain('rows.map(row =>');
});
it('keeps empty and unavailable guidance plus the pill status accessible', () => {
  expect(source).toContain('rows.length === 0');
  expect(source).toContain('{empty.title}');
  expect(source).toContain('Thread discovery unavailable');
  expect(source).toContain('aria-label={`Agent Inbox: ${summary}');
  expect(source).toContain('aria-label="Collapse companion"');
});
it('fits a short list while keeping long lists bounded and scrollable', () => {
  const css = fs.readFileSync(new URL('../renderer/src/companion.css', import.meta.url), 'utf8');
  expect(css).toContain('height: auto;');
  expect(css).toContain('max-height: min(512px, calc(100% - 8px));');
  expect(css).toMatch(/\.requests\{overflow:auto;min-height:0;/);
});
