import path from 'node:path';
import {describe} from './updater.mjs';

// The fork has its own store and starts no work until a user asks it to.
export function localInboxDefaults(userData) {
 return {storeRoot:path.join(userData,'store'),diagnostics:false,cleanupLeftovers:false,
  agentsAuto:false,autonomousProducts:[],maxConcurrentSessions:1,outsideAgents:true,
  sessionArgs:['--permission-mode','plan'],codexMode:'read-only',
  engineChoice:new Date().toISOString()};
}

// Apply product scope to the runtime only; existing settings remain recoverable.
export function localInboxConfig(config) {
 return {...config,localInbox:true,diagnostics:false,agentsAuto:false,memoryGate:false,
  cleanupLeftovers:false,autonomousProducts:[]};
}

export function assertLocalInboxSetting(scope,{key}={}) {
 const excluded=scope==='project' ? ['autonomous']
  : ['diagnostics','agentsAuto','agentsFeltSlow','memoryGate','memoryGateSlots','cleanupLeftovers'];
 if(excluded.includes(key)) throw new Error('This setting is outside Agent Inbox’s local scope.');
}

// Lazy readers matter: a Claude allowance read can spawn a provider request.
export function inboxUsage({local,engine,choices,read,claude,codex,peekClaude=()=>null}) {
 if(local) return {usage:null,usageByEngine:[]};
 const reading=read ? read() : engine==='claude'?claude():codex();
 return {usage:reading&&{engine,...reading},usageByEngine:choices.map(({id})=>{
  const value=id===engine?reading:id==='claude'?peekClaude():codex();
  return value?{engine:id,...value}:null;
 }).filter(Boolean)};
}

// Upstream releases must never replace this fork. No network client is made.
export function localInboxUpdater() {
 const state=()=>describe({phase:'unsupported',error:'Updates are manual for this local build.'});
 return {state,check:state,start(){},stop(){},install:()=>false};
}
