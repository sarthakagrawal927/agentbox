// CUA's 768px render showed a centered title below left-aligned metadata;
// the list heading was only 17px and the actions still had square corners.
// Scope the correction to the selected dark system so explicit skins survive.
import fs from 'node:fs';
import {it,expect} from 'vitest';
const css=fs.readFileSync(new URL('../renderer/src/inbox-dark.css',import.meta.url),'utf8');
it('keeps the conversation title on the same left reading edge as its metadata',()=>{
 const block=css.match(/\.thread-crumb-name\s*\{([^}]+)\}/)[1];
 expect(block).toMatch(/text-align:\s*left/);
 expect(block).toMatch(/min-width:\s*0/);
});
it('reserves compact width for titles rather than fixed metadata columns',()=>{
 expect(css).toMatch(/@media\s*\(max-width:\s*1000px\)[\s\S]*?\.th-grid[^{}]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
 expect(css).toMatch(/\.th-cell-title\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
 expect(css).toMatch(/\.tm-tab\s*\{[^}]*flex:\s*none/);
 expect(css).toMatch(/\.th-new\s*\{[^}]*width:\s*32px/);
});
it('matches the list heading and small conversation actions to the selected system',()=>{
 expect(css).toMatch(/:root\[data-theme="dark"\][^{}]+\.workspace-title\s*\{[^}]*font-size:\s*24px/);
 expect(css).toMatch(/:root\[data-theme="dark"\][^{}]+\.ts-more\s*\{[^}]*border-radius:\s*8px/);
});
