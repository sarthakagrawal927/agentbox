// Live qualification found that a focused but idle inbox admitted a notice,
// then the companion rejected it merely for being focused. A refused OS banner
// left no attention surface. Both paths must use the same measured activity rule.
import fs from 'node:fs';
import {it, expect} from 'vitest';
import {isAtInbox} from '../main/notify.mjs';
const window={isDestroyed:()=>false,isFocused:()=>true};
const power=seconds=>({getSystemIdleTime:()=>seconds});
it('suppresses only an actively attended inbox and preserves the idle boundary',()=>{
 expect(isAtInbox(window,power(299))).toBe(true);
 expect(isAtInbox(window,power(300))).toBe(false);
 expect(isAtInbox(window,power(301))).toBe(false);
 expect(isAtInbox({...window,isFocused:()=>false},power(0))).toBe(false);
});
it('does not crash on missing windows or clocks and suppresses uncertain idle time when focused',()=>{
 expect(isAtInbox(null,power(0))).toBe(false);
 expect(isAtInbox({...window,isDestroyed:()=>true},power(0))).toBe(false);
 expect(isAtInbox(window,{getSystemIdleTime:()=>{throw Error('unavailable');}})).toBe(true);
});
it('wires the notifier and companion to this same rule',()=>{
 const main=fs.readFileSync(new URL('../main/main.mjs',import.meta.url),'utf8');
 expect(main).toContain('focused: () => isAtInbox(window, powerMonitor)');
 const source=fs.readFileSync(new URL('../main/notify.mjs',import.meta.url),'utf8');
 expect(source.match(/if \(isAtInbox\(window, powerMonitor\)\)/g)).toHaveLength(2);
});
