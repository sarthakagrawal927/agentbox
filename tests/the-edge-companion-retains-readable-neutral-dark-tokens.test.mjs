// The owner requested a black neutral surface. Verify contrast for small status
// text and that the inbox and companion share the same surface tokens.
import fs from 'node:fs';
import { it, expect } from 'vitest';
const css = fs.readFileSync(new URL('../renderer/src/inbox-dark.css', import.meta.url), 'utf8');
const value = name => css.match(new RegExp('--inbox-' + name + ':\\s*(#[0-9a-f]{6})'))?.[1];
function luminance(hex) { const rgb = hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; }
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
it('keeps all small text and status colors at AA on the floating panel',()=>{
  for(const name of ['foreground','muted','attention','working','unavailable','done','failed'])expect(contrast(value(name),value('panel'))).toBeGreaterThanOrEqual(4.5);
});
it('keeps the same black surface roles in the pill and inbox',()=>{
  expect(value('background')).toBe('#000000'); expect(value('panel')).toBe('#0a0a0a');
  expect(css).toContain('--bg: var(--inbox-background)');
  const companion=fs.readFileSync(new URL('../renderer/src/companion.css',import.meta.url),'utf8');
  expect(companion).toContain('--surface:var(--inbox-panel)');
});
