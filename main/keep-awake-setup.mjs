import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createAwakeController} from './keep-awake.mjs';

const exec=promisify(execFile);
const run=(file,args)=>exec(file,args,{timeout:180000,maxBuffer:65536});
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const appleString=value=>'"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';

export function awakeSupported({platform=process.platform,arch=process.arch,release=os.release()}={}) {
 return platform==='darwin'&&arch==='arm64'&&Number(release.split('.')[0])>=25;
}
export function powerRule(username) {
 if(!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(username))throw Error('Cannot create a power rule for this local username.');
 return `${username} ALL=(root) NOPASSWD: /usr/bin/pmset -a disablesleep 1, /usr/bin/pmset -a disablesleep 0, /usr/bin/pmset -b lowpowermode 1, /usr/bin/pmset -b lowpowermode 0\n`;
}

export async function installAwakeHelper({source,destination,username=os.userInfo().username,run:execute=run,resume=false}) {
 const exists=fs.existsSync(destination);
 if(exists&&!resume)throw Error('The recovery helper is already installed. End any session before changing or removing its installation.');
 await execute('/usr/bin/codesign',['--verify','--strict','-R=identifier "com.agentinbox.awake"',exists?destination:source]);
 const rule=powerRule(username);
 fs.mkdirSync(path.dirname(destination),{recursive:true});
 // Copy exclusively: overwriting a bundle would invalidate the code requirement
 // pinned by a live recovery agent. Setup never upgrades or deletes a helper.
 if(!exists)await execute('/usr/bin/ditto',[source,destination]);
 await execute('/usr/bin/codesign',['--verify','--strict','-R=identifier "com.agentinbox.awake"',destination]);
 const encoded=Buffer.from(rule).toString('base64');
 // All root work is fixed commands and validated rule bytes. No user-writable
 // script is executed as root; the password remains in macOS's own dialog.
 const command=`set -eu; candidate=$(/usr/bin/mktemp /etc/sudoers.d/.agentinbox-awake.XXXXXX); trap '/bin/rm -f "$candidate"' EXIT; /usr/bin/printf %s ${quote(encoded)} | /usr/bin/base64 -D > "$candidate"; /usr/sbin/chown root:wheel "$candidate"; /bin/chmod 0440 "$candidate"; /usr/sbin/visudo -cf "$candidate"; /bin/mv -f "$candidate" /etc/sudoers.d/agentinbox-awake`;
 try{
  await execute('/usr/bin/osascript',['-e',`do shell script ${appleString(command)} with administrator privileges with prompt "Agent Inbox needs four restricted power commands for timed lid-closed sessions. Any app running as your user can use these commands."`]);
  for(const args of [['-a','disablesleep','1'],['-a','disablesleep','0'],['-b','lowpowermode','1'],['-b','lowpowermode','0']]){
   await execute('/usr/bin/sudo',['-n','-l','/usr/bin/pmset',...args]);
  }
 }catch(error){
  // Keep the verified bundle for recovery and a retry; no power command ran.
  throw Error('Administrator setup was cancelled or could not be verified. The helper was copied, but no session was started. '+error.message);
 }
}

export function desktopAwakeController({appDir,resourcesPath,packaged}) {
 const destination=path.join(os.homedir(),'Applications','AgentInboxAwake.app');
 const source=packaged?path.join(resourcesPath,'native','AgentInboxAwake.app'):path.join(appDir,'native','awake','bin','AgentInboxAwake.app');
 const binary=path.join(destination,'Contents','MacOS','AgentInboxAwake');
 const ready=path.join(os.homedir(),'Library','Application Support','AgentInboxAwake','.setup-ready');
 return createAwakeController({supported:awakeSupported(),installed:()=>fs.existsSync(binary)&&fs.existsSync(ready),
  install:async()=>{await installAwakeHelper({source,destination,resume:true});fs.mkdirSync(path.dirname(ready),{recursive:true,mode:0o700});fs.writeFileSync(ready,'1\n',{mode:0o600});},
  spawnHelper:()=>spawn(binary,['--serve'],{stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',HOME:os.homedir(),LANG:'en_US.UTF-8'}}),
 });
}
