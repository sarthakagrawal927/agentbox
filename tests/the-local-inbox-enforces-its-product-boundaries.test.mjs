// Local defaults could be overridden by inherited settings, and snapshots
// launched provider allowance probes. The local fork must enforce its scope.
import {it,expect,vi} from 'vitest';
import fs from 'node:fs';
const profile=await import('../main/local-inbox-profile.mjs');
it('disables inherited autonomous work, machine control and telemetry without mutating saved configuration',()=>{
 const original={diagnostics:true,agentsAuto:true,memoryGate:true,cleanupLeftovers:true,autonomousProducts:['one'],maxConcurrentSessions:3,codexMode:'read-only'};
 const effective=profile.localInboxConfig(original);
 expect(effective).toMatchObject({diagnostics:false,agentsAuto:false,memoryGate:false,cleanupLeftovers:false,autonomousProducts:[],maxConcurrentSessions:3,codexMode:'read-only'});
 expect(original.autonomousProducts).toEqual(['one']);expect(original.diagnostics).toBe(true);
});
it('refuses inherited control writes but keeps manual concurrency, connections and execution permissions',()=>{
 for(const key of ['diagnostics','agentsAuto','agentsFeltSlow','memoryGate','memoryGateSlots','cleanupLeftovers'])
  expect(()=>profile.assertLocalInboxSetting('workspace',{key,value:true})).toThrow(/outside Agent Inbox/);
 expect(()=>profile.assertLocalInboxSetting('project',{key:'autonomous',value:true})).toThrow(/outside Agent Inbox/);
 for(const key of ['sessionsAtOnce','outsideAgents','codexMode','permissionMode'])
  expect(()=>profile.assertLocalInboxSetting('workspace',{key,value:1})).not.toThrow();
});
it('does not evaluate either provider allowance reader for a local snapshot',()=>{
 const claude=vi.fn(()=>({used:12})),codex=vi.fn(()=>({used:20}));
 expect(profile.inboxUsage({local:true,engine:'claude',choices:[{id:'claude'},{id:'codex'}],claude,codex})).toEqual({usage:null,usageByEngine:[]});
 expect(claude).not.toHaveBeenCalled();expect(codex).not.toHaveBeenCalled();
 expect(profile.inboxUsage({local:false,engine:'codex',choices:[{id:'codex'}],claude,codex})).toEqual({usage:{engine:'codex',used:20},usageByEngine:[{engine:'codex',used:20}]});
 expect(codex).toHaveBeenCalledTimes(1);expect(claude).not.toHaveBeenCalled();
});
it('enforces the policy at startup, snapshot and both settings doors',()=>{
 const main=fs.readFileSync('main/main.mjs','utf8'),ipc=fs.readFileSync('main/ipc.mjs','utf8');
 expect(main).toContain('LOCAL_INBOX ? localInboxConfig(loadConfig(dataDir))');
 expect(main).toContain('localInbox: LOCAL_INBOX');
 expect(ipc).toContain('inboxUsage({local: localInbox');
 for(const scope of ['project','workspace']){
  const start=ipc.indexOf(`ipcMain.handle('zero:settings-set-${scope}'`);
  const block=ipc.slice(start,ipc.indexOf('\n  });',start));
  expect(block.indexOf(`assertLocalInboxSetting('${scope}'`)).toBeGreaterThan(-1);
  expect(block.indexOf('assertLocalInboxSetting')).toBeLessThan(block.indexOf(scope==='project'?'setProjectSetting({':'setWorkspaceSetting({'));
 }
});
