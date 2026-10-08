import fs from 'node:fs';
import path from 'node:path';
import {it, expect} from 'vitest';
const profile=await import('../main/local-inbox-profile.mjs').catch(()=>({}));
it('defaults to its own store with no autonomous work or telemetry',()=>{
 expect(typeof profile.localInboxDefaults).toBe('function');
 const defaults=profile.localInboxDefaults('/disposable/Agent Inbox');
 expect(defaults.storeRoot).toBe(path.join('/disposable/Agent Inbox','store'));
 expect(defaults).toMatchObject({diagnostics:false,agentsAuto:false,cleanupLeftovers:false,maxConcurrentSessions:1,codexMode:'read-only',sessionArgs:['--permission-mode','plan']});
});
it('never checks, downloads or installs upstream updates',()=>{
 expect(typeof profile.localInboxUpdater).toBe('function');
 const updater=profile.localInboxUpdater();
 updater.start();updater.stop();
 expect(updater.state()).toMatchObject({phase:'unsupported',ready:false});
 expect(updater.check()).toMatchObject({phase:'unsupported'});
 expect(updater.install()).toBe(false);
});
it('keeps local state, telemetry, cloud and updates on the explicit local entry point',()=>{
 const main=fs.readFileSync(new URL('../main/main.mjs',import.meta.url),'utf8');
 expect(main.includes('if (!PROFILE && !LOCAL_INBOX)')).toBe(true);
 expect(main.includes('const cloudConfig = LOCAL_INBOX ? null : loadCloudConfig')).toBe(true);
 expect(main.includes('const updater = LOCAL_INBOX ? localInboxUpdater()')).toBe(true);
 expect(main.includes('LOCAL_INBOX ? localInboxConfig(loadConfig(dataDir))')).toBe(true);
 expect(profile.localInboxConfig({diagnostics:true}).diagnostics).toBe(false);
 const entry=fs.readFileSync(new URL('../main/local-inbox.mjs',import.meta.url),'utf8');
 expect(entry.includes("app.setName('Agent Inbox')")).toBe(true);
 expect(entry.includes("await import('./main.mjs')")).toBe(true);
});
