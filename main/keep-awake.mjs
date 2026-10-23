import {awakeCommand,awakeReply} from '../shared/keep-awake.mjs';

export function createAwakeController({supported,installed,spawnHelper,install,requestTimeout=45000}) {
 let child=null,nextId=0,buffer='',fault=null;
 const pending=new Map();
 const unavailable=message=>({phase:'unavailable',message});
 const refused=(error,state=unavailable(error))=>({ok:false,error,state});
 function disconnect(message) {
  fault=message;child=null;buffer='';
  for(const {resolve,timer} of pending.values()){clearTimeout(timer);resolve(refused(message));}
  pending.clear();
 }
 function connect() {
  if(child)return;
  fault=null;
  const worker=spawnHelper();child=worker;
  worker.on('error',()=>{if(child===worker)disconnect('Keep-awake helper could not start. Recovery is unverified; reopen Agent Inbox.');});
  worker.on('exit',()=>{if(child===worker)disconnect('Keep-awake helper stopped. Recovery is unverified; the installed recovery agent will retry at the deadline.');});
  worker.stdin.on('error',()=>{if(child===worker)disconnect('Keep-awake connection was lost. Recovery is unverified.');});
  worker.stderr.on('data',()=>{});
  worker.stdout.on('data',chunk=>{
   if(child!==worker)return;
   buffer+=chunk.toString();
   if(buffer.length>65536){disconnect('Keep-awake helper returned an oversized response. Recovery is unverified.');return;}
   let end;
   while((end=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
    let parsed;try{parsed=awakeReply.safeParse(JSON.parse(line));}catch{continue;}
    if(!parsed.success)continue;
    const reply=parsed.data,request=pending.get(reply.id);if(!request)continue;
    pending.delete(reply.id);clearTimeout(request.timer);
    const {id,...result}=reply;request.resolve(result);
   }
  });
 }
 async function command(input) {
  const parsed=awakeCommand.safeParse(input);
  if(!parsed.success)return refused('Choose a duration from 1 minute to 30 days and a valid keep-awake action.');
  if(!supported)return refused('Lid-closed sessions require an Apple silicon Mac with macOS 26 or later.',{phase:'unsupported',message:'Requires Apple silicon and macOS 26 or later.'});
  if(parsed.data.action==='setup'){
   if(child)return refused('End the session and restart Agent Inbox before updating keep-awake setup.');
   try{await install();}catch(error){return refused(error.message??'Keep-awake setup did not finish.');}
  }
  if(!installed()){
   const state={phase:'setup',message:'Set up the recovery helper and four restricted power commands. macOS will ask for your administrator password.'};
   return parsed.data.action==='status'?{ok:true,state}:refused(state.message,state);
  }
  try{connect();}catch{return refused('Keep-awake helper could not start. Run setup again.');}
  if(fault||!child)return refused(fault??'Keep-awake helper is unavailable.');
  return new Promise(resolve=>{
   const id=++nextId;
   const timer=setTimeout(()=>{pending.delete(id);resolve(refused('Keep-awake helper has not acknowledged this request. Recovery is unverified; keep Agent Inbox open and check again.'));},requestTimeout);
   pending.set(id,{resolve,timer});
   const payload=parsed.data.action==='setup'?{action:'status'}:parsed.data;
   try{child.stdin.write(JSON.stringify({id,...payload})+'\n');}catch{clearTimeout(timer);pending.delete(id);resolve(refused('Keep-awake connection was lost. Recovery is unverified.'));}
  });
 }
 return {command,shutdown:()=>child?command({action:'quit'}):Promise.resolve(fault?refused(fault):{ok:true,state:{phase:'idle',endsAt:null,warnings:[]}})};
}

export function registerAwakeIpc({ipcMain,window,controller}) {
 ipcMain.handle('inbox:keep-awake',(event,payload)=>{
  if(event.sender!==window.webContents)return {ok:false,error:'Keep-awake controls are available only in the inbox window.',state:{phase:'unavailable',message:'Open the desktop inbox to control keep-awake.'}};
  return controller.command(payload);
 });
}
