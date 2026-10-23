import {useCallback,useEffect,useRef,useState} from 'react';
import type {AwakeCommand,AwakeState} from '../../../shared/keep-awake.mjs';
import {api} from '../api';
import './keep-awake.css';

type Props={state:AwakeState|null;busy:boolean;error:string|null;minutes:number;onMinutes:(minutes:number)=>void;onCommand:(command:AwakeCommand)=>void};

export function KeepAwakeView({state,busy,error,minutes,onMinutes,onCommand}:Props) {
 const active=state?.phase==='active',recovering=state?.phase==='recovery';
 return <section className="set-group keep-awake" id="keep-awake" aria-label="Keep Mac awake">
  <h2 className="set-group-label">Keep Mac awake</h2>
  <div className="set-plate">
   <div className="set-row"><div className="set-row-text">
    <div className="set-row-label">{active?`Awake until ${new Date(state.endsAt).toLocaleString(undefined,{hour:'numeric',minute:'2-digit',month:'short',day:'numeric'})}`:recovering?'Restoration unfinished':'Timed lid-closed sessions'}</div>
    <div className="set-row-desc">Keep local agents running with the lid closed. Sleep is restored at the deadline or when you end the session.</div>
   </div></div>
   {!state&&<p className="set-row-desc">Checking keep-awake setup…</p>}
   {state?.phase==='setup'&&<div className="awake-setup">
    <p className="set-row-desc">One-time setup installs a recovery helper and asks macOS for your administrator password. It lets your account run four power commands without a password; other apps running as you can use them too.</p>
    <details><summary>Review power commands</summary><pre>pmset -a disablesleep 1<br/>pmset -a disablesleep 0<br/>pmset -b lowpowermode 1<br/>pmset -b lowpowermode 0</pre></details>
    <button className="set-ghost" disabled={busy} onClick={()=>onCommand({action:'setup'})}>{busy?'Setting up…':'Set up lid-closed mode'}</button>
   </div>}
   {(state?.phase==='unsupported'||state?.phase==='unavailable')&&<p className="set-row-desc">{state.message}</p>}
   {state?.phase==='unavailable'&&<button className="set-ghost" disabled={busy} onClick={()=>onCommand({action:'status'})}>Check again</button>}
   {(state?.phase==='idle'||active)&&<div className="awake-controls">
    <label>Duration <input type="number" aria-label="Keep-awake duration in minutes" value={minutes} min={1} max={43200} step={1} disabled={busy} onChange={event=>onMinutes(Number(event.currentTarget.value))}/><span>minutes</span></label>
    <button className="set-ghost" disabled={busy||!Number.isInteger(minutes)||minutes<1||minutes>43200} onClick={()=>onCommand({action:active?'extend':'start',minutes})}>{busy?'Working…':active?'Add time':'Start session'}</button>
    {active&&<button className="set-ghost" disabled={busy} onClick={()=>onCommand({action:'end'})}>End session</button>}
   </div>}
   {recovering&&<button className="set-ghost" disabled={busy} onClick={()=>onCommand({action:'end'})}>Retry restoration</button>}
   {state&&'warnings' in state&&state.warnings.map(warning=><p role="status" className="awake-warning" key={warning}>{warning}</p>)}
   {error&&<p role="alert" className="awake-warning">{error}</p>}
   {state?.phase!=='unsupported'&&<p className="set-row-desc awake-note">Use a ventilated desk. Low Power Mode turns on below 40% battery and while the lid is closed. The session ends below 10% or at critical heat. If Agent Inbox crashes, recovery retries at the deadline; audio and brightness may need you to reopen the app.</p>}
  </div>
 </section>;
}

export function KeepAwakeSettings() {
 const [state,setState]=useState<AwakeState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[minutes,setMinutes]=useState(30);
 const inFlight=useRef(false);
 const command=useCallback(async(value:AwakeCommand)=>{
  if(inFlight.current)return;
  inFlight.current=true;
  if(value.action!=='status')setBusy(true);
  try{
   const result=await api.keepAwake(value);setState(result.state);setError(result.ok?null:result.error);
  }catch{setError('Could not reach the keep-awake helper. Recovery is unverified.');}
  finally{inFlight.current=false;setBusy(false);}
 },[]);
 useEffect(()=>{void command({action:'status'});const timer=setInterval(()=>void command({action:'status'}),5000);return()=>clearInterval(timer);},[command]);
 return <KeepAwakeView state={state} busy={busy} error={error} minutes={minutes} onMinutes={setMinutes} onCommand={value=>void command(value)}/>;
}
