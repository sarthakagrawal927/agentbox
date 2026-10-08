// Owns only the bundled, read-only native child. No provider settings, secrets,
// shell, reply channel or approval API. Losing the receiver clears its evidence.
import fs from 'node:fs';
import { spawn as nodeSpawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { AgentLifecycleCatalog } from '../shared/agent-lifecycle.mjs';
export function createLifecycleMonitor({binary,spawn=nodeSpawn,exists=fs.existsSync,onChange=()=>{},heartbeatMs=15_000,retryMs=1000,maxRetries=3}={}) {
  let child=null,catalog=new AgentLifecycleCatalog(),processes=[],status='connecting',started=false,disposed=false,paused=false,heartbeat=null,retry=null,retries=0,generation=0,attention=()=>{};
  let previousActivities=new Map();const openedAt=Date.now()/1000;
  const state=()=>({status,processes:status==='ready'?processes:[],signals:status==='ready'?catalog.snapshot({liveProcesses:processes}).filter(s=>processes.some(p=>p.pid===s.pid&&p.started===s.started&&p.provider===s.provider)):[]});
  const changed=()=>onChange();
  const clearHeartbeat=()=>{if(heartbeat)clearTimeout(heartbeat);heartbeat=null;};
  const fail=token=>{
    if(disposed||paused||token!==generation)return;
    generation++;clearHeartbeat();const old=child;child=null;old?.kill();catalog=new AgentLifecycleCatalog();processes=[];previousActivities.clear();status='unavailable';changed();
    if(retries++<maxRetries) { retry=setTimeout(()=>{retry=null;launch();},retryMs*Math.min(30,2**(retries-1)));retry.unref?.(); }
  };
  const launch=()=>{
    if(disposed||paused)return;
    if(!binary||!exists(binary)){status='unavailable';changed();return;}
    const token=++generation;let buffer='';const decoder=new StringDecoder('utf8');status='connecting';changed();
    try {child=spawn(binary,['--listen'],{stdio:['ignore','pipe','ignore'],shell:false,env:{PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'}});}catch{fail(token);return;}
    const arm=()=>{clearHeartbeat();heartbeat=setTimeout(()=>fail(token),heartbeatMs);heartbeat.unref?.();};arm();
    child.on('error',()=>fail(token));child.on('exit',()=>fail(token));
    child.stdout.on('error',()=>fail(token));
    child.stdout.on('data',chunk=>{
      if(disposed||token!==generation)return;
      buffer+=decoder.write(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));if(Buffer.byteLength(buffer)>262_144){fail(token);return;}
      let end;
      while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let message;try{message=JSON.parse(line);}catch{continue;}
        if(message?.type==='event'){if(catalog.record(message.payload))changed();}
        else if(message?.type==='inventory'&&Array.isArray(message.processes)&&message.processes.length<=512){
          processes=message.processes.filter(p=>Number.isInteger(p?.pid)&&p.pid>1&&Number.isSafeInteger(p.started)&&p.started>0&&typeof p.provider==='string');status='ready';arm();changed();
          const signals=state().signals,next=new Map();
          for(const signal of signals){next.set(signal.key,signal.activity);
            if(signal.timestamp>=openedAt && previousActivities.get(signal.key)!==signal.activity && ['needs-input','rate-limited','failed','stopped'].includes(signal.activity))attention(signal);
          }
          previousActivities=next;
        }
      }
    });
  };
  const retire=()=>{generation++;clearHeartbeat();if(retry)clearTimeout(retry);retry=null;child?.kill();child=null;catalog=new AgentLifecycleCatalog();processes=[];previousActivities.clear();status='unavailable';};
  return {state,onAttention(callback){attention=typeof callback==='function'?callback:()=>{};},
    start(){if(started||disposed)return;started=true;launch();},
    suspend(){if(disposed||paused)return;paused=true;retire();changed();},
    resume(){if(disposed||!started||(!paused&&child))return;paused=false;retries=0;launch();},
    stop(){if(disposed)return;disposed=true;retire();}};
}
