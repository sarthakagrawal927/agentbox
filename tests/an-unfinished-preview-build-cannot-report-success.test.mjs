// The first signed preview exited zero in the middle of signing, without
// archives or a manifest. Exercise the real entry point with a build promise
// that succeeds, rejects, or loses its last event-loop handle before finishing.
import {it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

it.each(['unfinished','rejected','complete'])('%s builds report their actual completion',outcome=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'inbox-release-completion-')));
 try{
  for(const file of ['scripts/release-inbox.mjs','scripts/pack-local-inbox.mjs','scripts/lib/release-identity.mjs']){
   fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.copyFileSync(file,path.join(dir,file));
  }
  fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),'dir');
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({type:'module',version:'0.1.12',build:{mac:{extendInfo:{}},directories:{},files:[]}}));
  fs.writeFileSync(path.join(dir,'agent-inbox-release.json'),JSON.stringify({bundleId:'com.example.agentinbox',developerIdTeamId:'ABCDE12345',updateFeed:'example/agent-inbox'}));
  fs.writeFileSync(path.join(dir,'preload.mjs'),`
import {registerHooks,syncBuiltinESMExports} from 'node:module';
import cp from 'node:child_process';
Object.defineProperty(process,'platform',{value:'darwin'});
Object.defineProperty(process,'arch',{value:'arm64'});
const realSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(callback,ms,...args)=>realSetTimeout(callback,ms===600000?30:ms,...args);
cp.execFileSync=(file,args)=>{
 if(file==='git')return args[0]==='rev-parse'?'a'.repeat(40):'';
 if(file==='/usr/bin/security')return '1) "Developer ID Application: Example (ABCDE12345)"';
 return '';
};
syncBuiltinESMExports();
const builder=\`import fs from 'node:fs';import path from 'node:path';
export const Platform={MAC:{createTarget:()=>({})}};export const Arch={arm64:1};
export async function build({config}){
 const outcome=process.env.RELEASE_TEST_OUTCOME;
 if(outcome==='unfinished'){process.once('beforeExit',()=>process.exit(0));return new Promise(()=>{});}
 if(outcome==='rejected')throw Error('signing failed');
 fs.mkdirSync(path.join(config.directories.output,'mac-arm64','Agent Inbox.app'),{recursive:true});
 for(const ext of ['zip','dmg'])fs.writeFileSync(path.join(config.directories.output,'Agent-Inbox-0.1.12-arm64.'+ext),'test archive');
}\`;
registerHooks({resolve(specifier,context,next){return specifier==='electron-builder'?{url:'data:text/javascript,'+encodeURIComponent(builder),shortCircuit:true}:next(specifier,context)}});
`);
  const run=spawnSync(process.execPath,['--import',path.join(dir,'preload.mjs'),path.join(dir,'scripts/release-inbox.mjs')],{encoding:'utf8',timeout:15000,env:{...process.env,RELEASE_TEST_OUTCOME:outcome}});
  expect(run.error).toBeUndefined();
  if(outcome==='complete'){
   expect(run.stderr).toBe('');expect(run.status).toBe(0);
   expect(fs.existsSync(path.join(dir,'release/inbox-v0.1.12/preview-manifest.json'))).toBe(true);
  }else{
   expect(run.status).not.toBe(0);
   if(outcome==='rejected')expect(run.stderr).toContain('signing failed');
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
