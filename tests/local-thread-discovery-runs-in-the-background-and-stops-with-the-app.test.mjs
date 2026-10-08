// Synchronous transcript walks must not run on the UI thread or overlap ticks.
// Check start, refresh, failure recovery, cancellation and stale completions.
import { it, expect, vi, afterEach } from 'vitest';
import { createThreadDiscovery } from '../main/local-thread-discovery.mjs';
afterEach(()=>vi.useRealTimers());
const result={threads:[{id:'one',source:'codex',title:'One',when:100}],sources:[],partial:false};
it('can retry after a scanner throws synchronously',async()=>{
  let calls=0;const d=createThreadDiscovery({scan:()=>{if(++calls===1)throw Error('failed');return Promise.resolve(result);}});
  await d.scanNow(); await d.scanNow(); expect(calls).toBe(2); expect(d.state().status).toBe('ready'); d.stop();
});
it('starts automatically, refreshes after completion and coalesces overlapping requests',async()=>{
  vi.useFakeTimers(); let resolve; const scan=vi.fn(()=>new Promise(r=>resolve=r));
  const changed=vi.fn(); const d=createThreadDiscovery({scan,onChange:changed,firstDelayMs:5,pollMs:50});
  d.start(); expect(d.state().status).toBe('scanning'); await vi.advanceTimersByTimeAsync(5);
  const same=d.scanNow(); expect(scan).toHaveBeenCalledTimes(1); resolve(result); await same;
  expect(d.state()).toMatchObject({status:'ready',threads:result.threads});
  await vi.advanceTimersByTimeAsync(49); expect(scan).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(scan).toHaveBeenCalledTimes(2); d.stop();
});
it('keeps the last result on failure, discloses unavailable discovery, then recovers',async()=>{
  const scan=vi.fn().mockResolvedValueOnce(result).mockRejectedValueOnce(Error('private path')).mockResolvedValueOnce({...result,threads:[]});
  const d=createThreadDiscovery({scan}); await d.scanNow(); await d.scanNow();
  expect(d.state()).toMatchObject({status:'unavailable',threads:result.threads,partial:true});
  expect(JSON.stringify(d.state())).not.toContain('private path'); await d.scanNow();
  expect(d.state()).toMatchObject({status:'ready',threads:[],partial:false}); d.stop();
});
it('aborts an in-flight scan and ignores completion after shutdown',async()=>{
  let finish; let signal; const changed=vi.fn();
  const d=createThreadDiscovery({scan:opts=>{signal=opts.signal;return new Promise(r=>finish=r);},onChange:changed});
  const pending=d.scanNow(); d.stop(); expect(signal.aborted).toBe(true); const before=changed.mock.calls.length;
  finish(result); await pending; expect(changed).toHaveBeenCalledTimes(before); expect(d.state().threads).toEqual([]);
});
it('schedules no background ticks until started and cleans timers after stopping',async()=>{
  vi.useFakeTimers(); const scan=vi.fn().mockResolvedValue(result); const d=createThreadDiscovery({scan,pollMs:5});
  await d.scanNow(); await vi.advanceTimersByTimeAsync(20); expect(scan).toHaveBeenCalledTimes(1);
  d.start(); await d.scanNow(); d.stop(); await vi.advanceTimersByTimeAsync(10000); expect(scan).toHaveBeenCalledTimes(2);
});
it('refreshes after wake without allowing an old scan to replace it or restart a poll',async()=>{
 vi.useFakeTimers();let finishOld;let oldSignal;
 const scan=vi.fn().mockImplementationOnce(opts=>{oldSignal=opts.signal;return new Promise(r=>finishOld=r);}).mockResolvedValue({...result,threads:[]});
 const d=createThreadDiscovery({scan,firstDelayMs:5,pollMs:50});d.start();await vi.advanceTimersByTimeAsync(5);
 d.suspend();expect(oldSignal.aborted).toBe(true);await vi.advanceTimersByTimeAsync(100);expect(scan).toHaveBeenCalledTimes(1);
 await d.resume();expect(scan).toHaveBeenCalledTimes(2);expect(d.state().threads).toEqual([]);
 finishOld(result);await Promise.resolve();expect(d.state().threads).toEqual([]);
 await vi.advanceTimersByTimeAsync(49);expect(scan).toHaveBeenCalledTimes(2);
 d.stop();await d.resume();await vi.advanceTimersByTimeAsync(100);expect(scan).toHaveBeenCalledTimes(2);
});
