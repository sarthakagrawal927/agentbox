// Agent Inbox had no lid-closed session controls. Exercise the helper protocol
// with an injected child transport, so validation and lost acknowledgements cannot
// turn a requested power change into a claimed successful session.
import {it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createAwakeController,registerAwakeIpc} from '../main/keep-awake.mjs';

function fixture() {
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
 child.kill=vi.fn();
 const requests=[];
 child.stdin.on('data',line=>requests.push(JSON.parse(line)));
 const spawn=vi.fn(()=>child),setup=vi.fn(async()=>{});
 const controller=createAwakeController({supported:true,installed:()=>true,spawnHelper:spawn,install:setup,requestTimeout:50});
 const answer=(phase='idle',endsAt=null,warnings=[])=>{const request=requests.at(-1);child.stdout.write(JSON.stringify({id:request.id,ok:true,state:{phase,endsAt,warnings}})+'\n');};
 return {child,requests,spawn,setup,controller,answer};
}

it('refuses unsupported hosts and missing setup without starting a helper',async()=>{
 const spawnHelper=vi.fn();
 const unsupported=createAwakeController({supported:false,installed:()=>false,spawnHelper});
 expect((await unsupported.command({action:'start',minutes:30})).ok).toBe(false);expect(spawnHelper).not.toHaveBeenCalled();
 const setup=createAwakeController({supported:true,installed:()=>false,spawnHelper});
 expect((await setup.command({action:'status'})).state.phase).toBe('setup');expect(spawnHelper).not.toHaveBeenCalled();
});
it.each([0,-1,0.5,43201,Infinity,NaN,'30',null])('rejects duration %s before writing to the helper',async minutes=>{
 const f=fixture();expect((await f.controller.command({action:'start',minutes})).ok).toBe(false);expect(f.spawn).not.toHaveBeenCalled();
});
it.each([1,30,43200])('uses an acknowledged deadline for %s minutes',async minutes=>{
 const f=fixture(),pending=f.controller.command({action:'start',minutes});
 await vi.waitFor(()=>expect(f.requests).toHaveLength(1));
 expect(f.requests[0]).toMatchObject({action:'start',minutes});
 const deadline=Date.now()+minutes*60000;f.answer('active',deadline);
 expect(await pending).toEqual({ok:true,state:{phase:'active',endsAt:deadline,warnings:[]}});
 f.child.emit('exit',0);
});
it('does not accept malformed or unrelated acknowledgements',async()=>{
 const f=fixture(),pending=f.controller.command({action:'status'});
 await vi.waitFor(()=>expect(f.requests).toHaveLength(1));
 f.child.stdout.write(JSON.stringify({id:999,ok:true,state:{phase:'active',endsAt:10,warnings:[]}})+'\n');
 f.child.stdout.write(JSON.stringify({id:f.requests[0].id,ok:true,state:{phase:'active',endsAt:null,warnings:[]}})+'\n');
 expect((await pending).ok).toBe(false);f.child.emit('exit',0);
});
it('says recovery is unverified when the helper exits before its answer',async()=>{
 const f=fixture(),pending=f.controller.command({action:'end'});
 await vi.waitFor(()=>expect(f.requests).toHaveLength(1));f.child.emit('exit',1);
 const result=await pending;expect(result.ok).toBe(false);expect(result.state.phase).toBe('unavailable');expect(result.error).toMatch(/recovery/i);
});
it('reports a timed-out command without killing the recovery helper',async()=>{
 const f=fixture(),pending=f.controller.command({action:'end'});
 await vi.waitFor(()=>expect(f.requests).toHaveLength(1));
 expect((await pending).ok).toBe(false);expect(f.child.kill).not.toHaveBeenCalled();f.child.emit('exit',0);
});
it('keeps native recovery warnings visible and refuses quit until undo is confirmed',async()=>{
 const f=fixture(),pending=f.controller.command({action:'quit'});
 await vi.waitFor(()=>expect(f.requests).toHaveLength(1));f.answer('recovery',null,['Audio restoration pending']);
 expect((await pending).state).toEqual({phase:'recovery',endsAt:null,warnings:['Audio restoration pending']});expect(f.child.kill).not.toHaveBeenCalled();f.child.emit('exit',0);
});
it('only lets the inbox window operate the desktop-only channel',async()=>{
 const handlers=new Map(),controller={command:vi.fn(async()=>({ok:true}))},window={webContents:{id:7}};
 registerAwakeIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},window,controller});
 const handler=handlers.get('inbox:keep-awake');
 expect((await handler({sender:{id:8}},{action:'start',minutes:30})).ok).toBe(false);expect(controller.command).not.toHaveBeenCalled();
 await handler({sender:window.webContents},{action:'status'});expect(controller.command).toHaveBeenCalledWith({action:'status'});
});
