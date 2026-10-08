import fs from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it, expect, vi, beforeEach, afterEach} from 'vitest';
import {Focus} from '../renderer/src/components/Focus.tsx';
import {Supervisor} from '../main/supervisor.mjs';

const noop=()=>{};
beforeEach(()=>{
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:noop,removeItem:noop});
 vi.stubGlobal('location',{search:''});
});
afterEach(()=>vi.unstubAllGlobals());
function draw(engine, codexMode, extra={}) {
 const props={item:{id:'w-smoke',product:'smoke',name:'Qualification',status:'waiting',priority:2,history:[],...extra},parent:null,blockedBy:null,
  runningMode:'plan',runningCodexMode:codexMode,runningEngine:engine,session:null,live:{},stoppable:false,
  productDir:null,repoDir:null,selectedOption:null,replyOpen:true};
 for(const key of ['onOpenItem','onNotice','onRedeliver','onClose','onResolve','onPick','onReply','onReplySend','onReplyClose','onStop','onReopen'])props[key]=noop;
 return renderToStaticMarkup(createElement(Focus,props));
}
it('prints the effective Codex mode instead of Auto on a read-only workspace',()=>{
 expect(draw('codex','read-only')).toContain('Read Only');
 expect(draw('codex','full-access')).toContain('Full Access');
 expect(draw('claude','read-only')).toContain('Plan');
 expect(draw('codex','read-only',{answerMode:'auto'})).toContain('>Auto<');
});
it('gets the Codex workspace and project answers from the same resolver as spawning',()=>{
 const sup=Object.create(Supervisor.prototype);
 sup.config={codexMode:'read-only',projectCodexMode:{smoke:'full-access'}};
 expect(sup.effectiveCodexMode('')).toBe('read-only');
 expect(sup.effectiveCodexMode('smoke')).toBe('full-access');
 const ipc=fs.readFileSync(new URL('../main/ipc.mjs',import.meta.url),'utf8');
 expect(ipc.includes("['', supervisor.effectiveCodexMode('')]")).toBe(true);
 expect(ipc.includes('[p.slug, supervisor.effectiveCodexMode(p.slug)]')).toBe(true);
 const app=fs.readFileSync(new URL('../renderer/src/App.tsx',import.meta.url),'utf8');
 expect(app.includes("runningCodexMode={snap.config?.codexPermission?.[focused.product] ?? snap.config?.codexPermission?.['']}")).toBe(true);
});
