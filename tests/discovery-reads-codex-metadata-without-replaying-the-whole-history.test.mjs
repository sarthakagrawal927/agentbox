import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {it,expect,vi,afterEach} from 'vitest';
import {readCodexThreads} from '../main/codex-threads.mjs';
import {collectRecentThreads} from '../main/local-thread-scan.mjs';
const roots=[];
afterEach(()=>{vi.restoreAllMocks();for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
function fixture(){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'inbox-metadata-'));roots.push(home);
 const dir=path.join(home,'.codex/sessions/2026/10/07');fs.mkdirSync(dir,{recursive:true});
 const at='2026-10-07T10:00:00Z',now=Date.parse(at)+1000;
 const put=(id,source)=>fs.writeFileSync(path.join(dir,`rollout-${id}.jsonl`),[
  {type:'session_meta',payload:{id,cwd:path.join(home,'real-project'),thread_source:source,timestamp:at}},
  {type:'event_msg',payload:{type:'user_message',message:'A first prompt 🌊'}},
  {type:'event_msg',payload:{type:'agent_message',message:'x'.repeat(2*1024*1024)}},
 ].map(x=>JSON.stringify(x)).join('\n')+'\n');
 put('named','user');put('unnamed','user');put('guardian','guardian_review');
 fs.writeFileSync(path.join(home,'.codex/session_index.jsonl'),JSON.stringify({id:'named',thread_name:'Saved title',updated_at:at})+'\n');
 return {home,now};
}
it('keeps the same visible identities and titles while reading only the necessary head',()=>{
 const options=fixture(),full=readCodexThreads(options);let bytes=0;
 const read=fs.readSync.bind(fs);vi.spyOn(fs,'readSync').mockImplementation((...args)=>{const count=read(...args);bytes+=count;return count;});
 const metadata=readCodexThreads({...options,metadataOnly:true});
 const rows=out=>out.threads.map(({id,title,folder,source})=>({id,title,folder,source}));
 expect(rows(metadata)).toEqual(rows(full));
 expect(bytes).toBeLessThan(256*1024);
 expect(metadata.threads.every(t=>t.last==='')).toBe(true);
 expect(full.threads.every(t=>t.last.length===2*1024*1024)).toBe(true);
});
it('reads a prompt when an index entry exists but has no usable title',()=>{
 const options=fixture();
 fs.appendFileSync(path.join(options.home,'.codex/session_index.jsonl'),JSON.stringify({id:'unnamed',thread_name:'',updated_at:'2026-10-07T10:00:00Z'})+'\n');
 expect(readCodexThreads({...options,metadataOnly:true}).threads.find(t=>t.id==='unnamed')?.title).toBe('A first prompt 🌊');
});
it('uses metadata only for automatic discovery, preserving the explicit full import reader',()=>{
 const options=fixture(),readCodex=vi.fn(()=>({threads:[]}));
 collectRecentThreads({...options,readClaude:()=>({threads:[]}),readCodex});
 expect(readCodex).toHaveBeenCalledWith(expect.objectContaining({metadataOnly:true}));
});
