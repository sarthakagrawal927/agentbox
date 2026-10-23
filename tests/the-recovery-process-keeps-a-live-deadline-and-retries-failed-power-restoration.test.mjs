// Exercise the shipped recovery shell in separate OS processes, with only sudo
// and pmset replaced. Real JSON parsing, locks, deadlines and journal writes
// run; the fakes change files in a temporary directory, never live power state.
import {it,expect,afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const directories=[];
afterEach(()=>{for(const dir of directories.splice(0))fs.rmSync(dir,{recursive:true,force:true});});
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
function fixture({future=false,dirty=true}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inbox-recovery-'));directories.push(dir);
 const pmset=path.join(dir,'pmset'),sudo=path.join(dir,'sudo'),calls=path.join(dir,'calls'),hardware=path.join(dir,'hardware'),fail=path.join(dir,'fail');
 fs.writeFileSync(hardware,dirty?'1':'0');
 fs.writeFileSync(pmset,`#!/bin/bash\nprintf '%s\\n' "$*" >> ${quote(calls)}\nif [[ "$1" == '-g' ]]; then printf 'System-wide power settings:\\n SleepDisabled\\t\\t%s\\n' "$(cat ${quote(hardware)})"; exit 0; fi\nif [[ -e ${quote(fail)} ]]; then exit 1; fi\nif [[ "$2" == 'disablesleep' ]]; then printf '%s' "$3" > ${quote(hardware)}; fi\n`,{mode:0o755});
 fs.writeFileSync(sudo,'#!/bin/bash\nif [[ "$1" == "-n" ]]; then shift; fi\nexec "$@"\n',{mode:0o755});
 let source=fs.readFileSync('native/awake/scripts/backstop.sh','utf8');
 source=source.replace(/^PMSET=.*$/m,'PMSET='+quote(pmset)).replace(/^SUDO=.*$/m,'SUDO='+quote(sudo));
 const script=path.join(dir,'backstop.sh');fs.writeFileSync(script,source);
 const state=path.join(dir,'state.json'),session=path.join(dir,'session.json');
 fs.writeFileSync(state,JSON.stringify({appNapOverrides:[],dockerFrozen:false,frozenProcesses:[],lowPowerSetByUs:false,savedAudioOutputs:[],sleepDisabledByUs:dirty}));
 fs.writeFileSync(session,JSON.stringify({startedAt:new Date(Date.now()-120000).toISOString().replace(/\.\d{3}Z$/,'Z'),endsAt:new Date(Date.now()+(future?120000:-60000)).toISOString().replace(/\.\d{3}Z$/,'Z'),extensions:[]}));
 const run=()=>spawnSync('/bin/bash',[script],{encoding:'utf8',timeout:15000,env:{HOME:dir,PATH:'/usr/bin:/bin:/usr/sbin:/sbin',INSOMNIA_HOME:dir}});
 return {dir,state,session,calls,hardware,fail,run};
}
it('leaves an unexpired session and its power state untouched',()=>{
 const f=fixture({future:true}),before=fs.readFileSync(f.state,'utf8');
 expect(f.run().status).toBe(0);expect(fs.readFileSync(f.state,'utf8')).toBe(before);expect(fs.readFileSync(f.hardware,'utf8')).toBe('1');
 expect(fs.existsSync(f.calls)).toBe(false);
});
it('restores an expired session after the app has gone away',()=>{
 const f=fixture(),result=f.run();expect(result.status,result.stderr).toBe(0);
 expect(fs.readFileSync(f.hardware,'utf8')).toBe('0');expect(JSON.parse(fs.readFileSync(f.state,'utf8')).sleepDisabledByUs).toBe(false);expect(fs.existsSync(f.session)).toBe(false);
});
it('keeps a failed undo journaled and succeeds on a later recovery run',()=>{
 const f=fixture();fs.writeFileSync(f.fail,'1');expect(f.run().status).toBe(1);
 expect(JSON.parse(fs.readFileSync(f.state,'utf8')).sleepDisabledByUs).toBe(true);expect(fs.readFileSync(f.hardware,'utf8')).toBe('1');
 fs.unlinkSync(f.fail);expect(f.run().status).toBe(0);expect(fs.readFileSync(f.hardware,'utf8')).toBe('0');
 expect(JSON.parse(fs.readFileSync(f.state,'utf8')).sleepDisabledByUs).toBe(false);
});
it('refuses a corrupt journal without issuing any power command',()=>{
 const f=fixture();fs.writeFileSync(f.state,'{"sleepDisabledByUs":"unknown"}');expect(f.run().status).toBe(1);
 expect(fs.readFileSync(f.hardware,'utf8')).toBe('1');expect(fs.existsSync(f.calls)).toBe(false);
});
