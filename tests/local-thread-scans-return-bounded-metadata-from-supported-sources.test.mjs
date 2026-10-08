// The background scan must reuse existing source filters, expose missing or
// partial sources honestly, and keep raw conversations off its result bridge.
import { it, expect, vi } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { collectRecentThreads, scanInWorker, readImportThreadInWorker } from '../main/local-thread-scan.mjs';
const home=()=>fs.mkdtempSync(path.join(os.tmpdir(),'inbox-discovery-'));
it('discovers real Claude and Codex fixtures in a worker without provider configuration',async()=>{
  const root=home();const project=path.join(root,'project');fs.mkdirSync(project);
  const claude=path.join(root,'.claude','projects','fixture');fs.mkdirSync(claude,{recursive:true});
  fs.writeFileSync(path.join(claude,'claude-one.jsonl'),JSON.stringify({type:'user',entrypoint:'cli',cwd:project,message:{content:'Review the local changes'}})+'\n');
  const codex=path.join(root,'.codex','sessions','2026','10','07');fs.mkdirSync(codex,{recursive:true});
  fs.writeFileSync(path.join(codex,'rollout-one.jsonl'),[
    {type:'session_meta',payload:{id:'codex-one',cwd:project,timestamp:new Date().toISOString(),thread_source:'user'}},
    {type:'event_msg',payload:{type:'user_message',message:'Check the tests postgres://demo:fake-password@localhost/database'}} // public-check: allow -- deliberately fake credential-redaction fixture
  ].map(r=>JSON.stringify(r)).join('\n')+'\n');
  const out=await scanInWorker({home:root});
  expect(out.threads.map(t=>t.id).sort()).toEqual(['claude-one','codex-one']);
  expect(out.threads.every(t=>!('path' in t)&&!('prompt' in t))).toBe(true);
  expect(out.sources.find(s=>s.provider==='Claude').status).toBe('available');
  const chosen=await readImportThreadInWorker({home:root,threadKey:'local:codex:codex-one'});
  expect(chosen.threads.map(t=>t.id)).toEqual(['codex-one']);
  expect(chosen.threads[0].title).toBe('Check the tests [link]');
  expect(JSON.stringify(out)).not.toContain('fake-password');
  expect(chosen.threads[0]).toHaveProperty('path');
  expect(chosen.threads[0]).toHaveProperty('prompt');
  expect((await readImportThreadInWorker({home:root,threadKey:'/private/other'})).threads).toEqual([]);
});
it('reports a missing provider without presenting an empty scan as universal coverage',()=>{
  const out=collectRecentThreads({home:home()});expect(out.threads).toEqual([]);
  expect(out.sources.map(s=>s.status)).toEqual(['missing','missing']);
  expect(out.days).toBe(10);
});
it('survives one source throwing, sanitizes errors and limits newest results',()=>{
  const root=home();fs.mkdirSync(path.join(root,'.claude','projects'),{recursive:true});fs.mkdirSync(path.join(root,'.codex','sessions'),{recursive:true});
  const readCodex=vi.fn(()=>({threads:Array.from({length:300},(_,i)=>({id:`c${i}`,source:'codex',title:'Thread',when:i,path:'/private/path',prompt:'body'}))}));
  const out=collectRecentThreads({home:root,readClaude:()=>{throw Error('private account');},readCodex});
  expect(out.threads).toHaveLength(256);expect(out.threads[0].when).toBe(299);expect(out.partial).toBe(true);
  expect(JSON.stringify(out)).not.toContain('private');expect(out.sources[0].status).toBe('unavailable');
});
it('does not run a worker for an already-cancelled scan',async()=>{
  const abort=new AbortController();abort.abort();await expect(scanInWorker({home:home(),signal:abort.signal})).rejects.toThrow();
});
