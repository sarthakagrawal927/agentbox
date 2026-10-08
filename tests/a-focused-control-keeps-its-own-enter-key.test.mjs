// Enter on the compact All tab opened the selected thread through the global
// shortcut. Native button/link activation must keep the key it is already using.
import {it,expect} from 'vitest';
import fs from 'node:fs';
import {controlOwnsActivation} from '../renderer/src/keys';
const control={closest:()=>({tagName:'BUTTON'})},page={closest:()=>null};
it('leaves Enter and Space with buttons, including their nested icons',()=>{
 expect(controlOwnsActivation('Enter',control)).toBe(true);
 expect(controlOwnsActivation(' ',control)).toBe(true);
 expect(controlOwnsActivation('r',control)).toBe(false);
});
it('keeps list shortcuts available when a control does not own the key',()=>{
 expect(controlOwnsActivation('Enter',page)).toBe(false);
 expect(controlOwnsActivation('Enter',null)).toBe(false);
 expect(controlOwnsActivation('ArrowDown',control)).toBe(false);
});
it('returns before global Enter can open or answer a different thread',()=>{
 const app=fs.readFileSync(new URL('../renderer/src/App.tsx',import.meta.url),'utf8');
 expect(app.includes('if (controlOwnsActivation(e.key, target)) return;')).toBe(true);
 expect(app.indexOf('if (controlOwnsActivation(e.key, target)) return;')).toBeLessThan(app.indexOf("else if (e.key === 'Enter') { e.preventDefault();"));
});
