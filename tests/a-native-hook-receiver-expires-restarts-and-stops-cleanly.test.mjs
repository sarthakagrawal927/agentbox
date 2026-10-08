// A failed native receiver must never leave old work looking live. Exercise the
// real streaming parser and lifecycle controller with an app-owned child fake.
import { it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createLifecycleMonitor } from '../main/lifecycle-monitor.mjs';
afterEach(()=>vi.useRealTimers());
function setup(){vi.useFakeTimers();vi.setSystemTime(1_800_000_000_000);const children=[];const spawn=vi.fn(()=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kill=vi.fn();children.push(c);return c;});const changed=vi.fn();const m=createLifecycleMonitor({binary:'/fixture/receiver',spawn,exists:()=>true,onChange:changed});return{m,spawn,children,changed};}
const inventory={type:'inventory',processes:[{pid:42,started:100,provider:'Codex'}]};
const event={type:'event',payload:{pid:42,started:100,provider:'Codex',event:'PreToolUse',timestamp:1_800_000_000,taskLabel:'Review tests'}};
const send=(c,value)=>c.stdout.emit('data',Buffer.from(JSON.stringify(value)+'\n'));
it('starts once, accepts fragmented bounded lines and verifies live identities',()=>{
 const{m,spawn,children:[c]}=(()=>{const s=setup();s.m.start();return s;})();m.start();expect(spawn).toHaveBeenCalledTimes(1);
 const text=JSON.stringify(event)+'\n';c.stdout.emit('data',Buffer.from(text.slice(0,30)));c.stdout.emit('data',Buffer.from(text.slice(30)));send(c,inventory);
 expect(m.state().signals[0].activity).toBe('working');send(c,{...inventory,processes:[{pid:42,started:101,provider:'Codex'}]});expect(m.state().signals).toEqual([]);m.stop();
});
it('clears activity on missing heartbeats, restarts a bounded number of times and cancels timers',()=>{
 const s=setup();s.m.start();send(s.children[0],event);send(s.children[0],inventory);vi.advanceTimersByTime(15_001);
 expect(s.m.state().status).toBe('unavailable');expect(s.m.state().signals).toEqual([]);expect(s.children[0].kill).toHaveBeenCalled();
 s.m.stop();const count=s.spawn.mock.calls.length;vi.advanceTimersByTime(100_000);expect(s.spawn).toHaveBeenCalledTimes(count);
});
it('bounds recovery attempts and ignores obsolete child messages',()=>{
 const s=setup();s.m.start();const old=s.children[0];old.emit('exit',1);send(old,event);send(old,inventory);expect(s.m.state().signals).toEqual([]);
 vi.advanceTimersByTime(200_000);expect(s.spawn).toHaveBeenCalledTimes(4);expect(s.m.state().status).toBe('unavailable');s.m.stop();
});
it('announces only a new verified attention transition, never replay or unverified PID',()=>{
 const s=setup();const attention=vi.fn();s.m.onAttention(attention);s.m.start();
 send(s.children[0],{...event,payload:{...event.payload,event:'PermissionRequest'}});expect(attention).not.toHaveBeenCalled();
 send(s.children[0],inventory);expect(attention).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(1000);send(s.children[0],{...event,payload:{...event.payload,event:'PermissionRequest',timestamp:event.payload.timestamp+1}});send(s.children[0],inventory);expect(attention).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(1000);send(s.children[0],{...event,payload:{...event.payload,event:'PreToolUse',timestamp:event.payload.timestamp+2}});send(s.children[0],inventory);
 vi.advanceTimersByTime(1000);send(s.children[0],{...event,payload:{...event.payload,event:'Stop',timestamp:event.payload.timestamp+3}});send(s.children[0],inventory);expect(attention).toHaveBeenCalledTimes(2);s.m.stop();
});
it('rejects malformed and oversized streams without disclosing native errors',()=>{
 const s=setup();s.m.start();s.children[0].stdout.emit('data',Buffer.from('not-json\n'));send(s.children[0],inventory);expect(s.m.state().status).toBe('ready');
 s.children[0].stdout.emit('data',Buffer.alloc(262_145,120));expect(s.m.state().status).toBe('unavailable');expect(JSON.stringify(s.m.state())).not.toContain('/fixture');s.m.stop();
});
it('reports absent binary honestly and never starts it after stop',()=>{
 const spawn=vi.fn();const m=createLifecycleMonitor({binary:'/missing',spawn,exists:()=>false});m.start();expect(m.state().status).toBe('unavailable');expect(spawn).not.toHaveBeenCalled();m.stop();m.start();expect(spawn).not.toHaveBeenCalled();
});
it('clears sleep evidence, retries after wake and never resurrects after app shutdown',()=>{
 const s=setup();s.m.start();const old=s.children[0];send(old,event);send(old,inventory);
 s.m.suspend();expect(s.m.state().signals).toEqual([]);expect(old.kill).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(100_000);expect(s.spawn).toHaveBeenCalledTimes(1);
 s.m.resume();s.m.resume();expect(s.spawn).toHaveBeenCalledTimes(2);
 send(old,event);send(old,inventory);expect(s.m.state().signals).toEqual([]);
 send(s.children[1],event);send(s.children[1],inventory);expect(s.m.state().status).toBe('ready');
 s.m.stop();s.m.resume();expect(s.spawn).toHaveBeenCalledTimes(2);
});
it('gives an exhausted receiver a fresh bounded attempt on wake',()=>{
 const s=setup();s.m.start();vi.advanceTimersByTime(200_000);expect(s.spawn).toHaveBeenCalledTimes(4);
 s.m.suspend();s.m.resume();expect(s.spawn).toHaveBeenCalledTimes(5);s.m.stop();
});
it('handles a broken stdout pipe as receiver failure rather than an app crash',()=>{
 const s=setup();s.m.start();send(s.children[0],event);send(s.children[0],inventory);
 expect(()=>s.children[0].stdout.emit('error',Error('broken pipe'))).not.toThrow();
 expect(s.m.state().status).toBe('unavailable');expect(s.m.state().signals).toEqual([]);s.m.stop();
});
