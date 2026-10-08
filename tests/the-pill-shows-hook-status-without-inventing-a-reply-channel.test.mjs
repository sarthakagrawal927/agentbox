// Hook evidence must replace its saved row, not duplicate it or offer permission
// control through a lifecycle event. Keep the approved companion composition.
import {it,expect} from 'vitest';
import fs from 'node:fs';
import {companionRows} from '../renderer/src/companion-model';
const base={inbox:[],progress:[],agents:[],running:[],approvals:[],engines:{}};
it('replaces one saved row with exact matched hook evidence and preserves its import action',()=>{
 const saved={key:'local:codex:one',id:'one',source:'codex',title:'Saved',folderName:'fixture'};
 const live={id:saved.key,title:'Review tests',provider:'Codex',product:'fixture',status:'working',action:'import'};
 expect(companionRows({...base,discovered:[saved],lifecycle:[live]})).toEqual([live]);
});
it('does not overwrite an app-owned conversation status with outside hook evidence',()=>{
 const item={id:'owned',title:'Own thread'};
 expect(companionRows({...base,inbox:[item],lifecycle:[{id:'owned',title:'Outside',status:'working',action:'conversation'}]})[0].status).toBe('waiting');
});
it('renders unavailable and unlinked observations honestly in the existing row pattern',()=>{
 const ui=fs.readFileSync('renderer/src/companion.tsx','utf8');
 expect(ui).toContain("row.action === 'status'");expect(ui).toContain('Status only');expect(ui).toContain('Rate limited');expect(ui).toContain('External hook status unavailable');
 const main=fs.readFileSync('main/main.mjs','utf8');expect(main).toContain('createLifecycleMonitor');expect(main).toContain('lifecycleMonitor.stop()');
 expect(main).toContain('lifecycleMonitor.onAttention');expect(main).toContain('notifier.add');
});
