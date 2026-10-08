// Native hook evidence was orphaned in PerformanceDaddy. Verify exact session
// joins, provider separation and unavailable/stale behavior before wiring it.
import { it, expect } from 'vitest';
import { sessionKey } from '../shared/agent-lifecycle.mjs';
import { lifecycleConversationRows } from '../main/lifecycle-conversations.mjs';
const signal=(extra={})=>({key:'Codex:42:100:'+sessionKey('one'),pid:42,started:100,provider:'Codex',sessionKey:sessionKey('one'),activity:'working',taskLabel:'Review tests',workspace:'fixture',...extra});
const threads=[{id:'one',source:'codex',key:'local:codex:one',title:'Original title',folderName:'fixture'},{id:'one',source:'terminal',key:'local:claude:one',title:'Other provider'}];
it('joins the exact provider-qualified saved thread without creating reply capability',()=>{
  const [row]=lifecycleConversationRows([signal()],{threads});
  expect(row).toMatchObject({id:'local:codex:one',status:'working',title:'Review tests',action:'import'});
  expect(row).not.toHaveProperty('canReply');expect(row).not.toHaveProperty('pid');
});
it('opens an imported item only for its own provider and skips app-owned active sessions',()=>{
  const items=[{id:'wrong',labels:['thread:one']},{id:'right',labels:['codex:one']}];
  expect(lifecycleConversationRows([signal()],{threads,items})[0].id).toBe('right');
  expect(lifecycleConversationRows([signal()],{threads,items,ownedSessions:[{sessionId:'one',engine:'codex'}]})).toEqual([]);
});
it('does not pick an arbitrary thread on a shared process or invent approval control',()=>{
  const [row]=lifecycleConversationRows([signal({sessionKey:sessionKey('missing'),activity:'needs-input'})],{threads});
  expect(row.action).toBe('status');expect(row.status).toBe('waiting');
  expect(row.id).toMatch(/^lifecycle:/);expect(row.title).toBe('Review tests');
});
it('maps observed failure, limit and stop distinctly and redacts received labels',()=>{
  for(const [activity,status] of [['rate-limited','limited'],['failed','failed'],['stopped','done'],['unknown','unknown']])expect(lifecycleConversationRows([signal({activity})],{threads})[0].status).toBe(status);
  expect(lifecycleConversationRows([signal({taskLabel:'token=demo-private'})],{threads})[0].title).not.toContain('demo-private');
});
it('uses an already connected Claude conversation instead of duplicating its saved row',()=>{
  const claude=signal({provider:'Claude'}),agents=[{pid:42,sessionId:'one'}];
  expect(lifecycleConversationRows([claude],{threads,agents})[0]).toMatchObject({id:'agent:42',action:'conversation'});
  expect(lifecycleConversationRows([claude],{threads,agents:[{pid:43,sessionId:'one'}]})[0].id).toBe('local:claude:one');
});
it('keeps one conversation row when two live processes report the same session, using newest evidence',()=>{
 const rows=lifecycleConversationRows([signal({timestamp:20,activity:'stopped'}),signal({key:'old',pid:43,timestamp:10,activity:'working'})],{threads});
 expect(rows).toHaveLength(1);expect(rows[0].status).toBe('done');
});
