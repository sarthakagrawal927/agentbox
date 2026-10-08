// Inherited settings offered automatic optimization even in the local fork.
// Keep explicit worker concurrency, but never offer machine-derived pacing.
import {it,expect} from 'vitest';
import {agentCountOptions} from '../renderer/src/components/Settings';
import {localInboxConfig} from '../main/local-inbox-profile.mjs';
import fs from 'node:fs';
it('marks the effective runtime as local without changing upstream settings',()=>{
 expect(localInboxConfig({}).localInbox).toBe(true);
});
it('keeps manual worker counts and removes automatic from the local picker',()=>{
 const options=agentCountOptions({localInbox:true,accounts:[],slotsMax:3});
 expect(options.map(o=>o.value)).toEqual(['1','2','3']);
 expect(agentCountOptions({slotsMax:3})[0].value).toBe('auto');
});
it('carries local scope into the settings read and gates inherited controls',()=>{
 const read=fs.readFileSync('main/settings.mjs','utf8'),ui=fs.readFileSync('renderer/src/components/Settings.tsx','utf8');
 expect(read.includes('localInbox: !!config.localInbox')).toBe(true);
 for(const gate of ['!w.localInbox && w.memoryGate','!w.localInbox && w.leftovers','!w.localInbox && w.agentsAuto','w.localInbox ? <Group']) expect(ui.includes(gate)).toBe(true);
 expect(ui.includes('!w?.localInbox && (')).toBe(true);
 expect(ui.includes('Telemetry is off in this local build.')).toBe(true);
});
