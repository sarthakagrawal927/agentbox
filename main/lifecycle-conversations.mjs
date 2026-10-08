// Session joins use provider + SHA-256 identity, never PID or workspace guessing.
import { sessionKey } from '../shared/agent-lifecycle.mjs';
import { safeThreadLabel } from '../shared/local-threads.mjs';
const status={working:'working','needs-input':'waiting','rate-limited':'limited',failed:'failed',stopped:'done',unknown:'unknown'};
export function lifecycleConversationRows(signals=[],{threads=[],items=[],agents=[],ownedSessions=[],processes=[],ownedPids=[]}={}) {
  const identity=(provider,id)=>{const hash=sessionKey(id);return hash?`${provider}:${hash}`:null;};
  const byThread=new Map(),byItem=new Map(),byAgent=new Map(),owned=new Set(),rows=new Map();
  for(const t of threads){const provider=t.source==='codex'?'codex':['terminal','desktop'].includes(t.source)?'claude':null;const key=provider&&identity(provider,t.id);if(key&&!byThread.has(key))byThread.set(key,t);}
  for(const i of items){if(i.status==='done')continue;for(const label of i.labels??[]){if(typeof label!=='string')continue;const provider=label.startsWith('codex:')?'codex':label.startsWith('thread:')?'claude':null;const key=provider&&identity(provider,label.slice(provider==='codex'?6:7));if(key&&!byItem.has(key))byItem.set(key,i);}}
  for(const a of agents){const key=identity('claude',a.sessionId);if(key)byAgent.set(key,a);}
  for(const s of ownedSessions){const key=identity(s.engine??'claude',s.sessionId);if(key)owned.add(key);}
  for(const signal of [...signals].sort((a,b)=>(b.timestamp??0)-(a.timestamp??0))){
    const codex=signal.provider==='Codex';
    const provider=codex?'codex':signal.provider==='Claude'?'claude':null;
    const key=provider&&signal.sessionKey?`${provider}:${signal.sessionKey}`:null;
    if(key&&owned.has(key))continue;
    const thread=byThread.get(key),item=byItem.get(key),candidate=byAgent.get(key);
    const connected=candidate?.pid===signal.pid?candidate:null;
    const id=connected?`agent:${connected.pid}`:item?.id??thread?.key??`lifecycle:${signal.key}`;
    if(rows.has(id))continue;
    rows.set(id,{id,live:true,status:status[signal.activity]??'unknown',
      title:safeThreadLabel(signal.taskLabel||thread?.title||`${signal.provider} session`),
      product:safeThreadLabel(signal.workspace||thread?.folderName||'',64),provider:signal.provider,
      action:connected||item?'conversation':thread?'import':'status'});
  }
  const represented=new Set(signals.map(s=>`${s.provider}:${s.pid}:${s.started}`));
  const connectedPids=new Set(agents.map(a=>a.pid));
  const ownPids=new Set([...ownedPids,...ownedSessions.map(s=>s.pid)].filter(Number.isInteger));
  for(const process of processes){
    if(represented.has(`${process.provider}:${process.pid}:${process.started}`)||ownPids.has(process.pid)||
       (process.provider==='Claude'&&connectedPids.has(process.pid)))continue;
    const id=`process:${process.provider}:${process.pid}:${process.started}`;
    rows.set(id,{id,title:`${process.provider} process · PID ${process.pid}`,product:'Detected on this Mac',
      provider:process.provider,status:'unknown',action:'status',live:true});
  }
  return [...rows.values()];
}
