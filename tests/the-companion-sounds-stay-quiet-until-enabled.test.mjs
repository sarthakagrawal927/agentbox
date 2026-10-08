// A liquid cue must never sound on startup, discovery refresh or a muted inbox.
// Exercise transition decisions and bounded audio lifetime rather than CSS text.
import {it,expect,vi} from 'vitest';
import {soundForTransition,createCompanionAudio} from '../renderer/src/companion-audio';
import {normalizePlacement} from '../main/companion-placement.mjs';
const state={expanded:false,soundEnabled:true,noticeSequence:0};
it('stays silent at startup, when muted, and on ordinary row updates',()=>{
 expect(soundForTransition(null,state)).toBe(null);
 expect(soundForTransition({...state,ready:false,soundEnabled:false},{...state,ready:true})).toBe(null);
 expect(soundForTransition(state,{...state,rows:[{id:'saved'}]})).toBe(null);
 expect(soundForTransition(state,{...state,soundEnabled:false,expanded:true,noticeSequence:1})).toBe(null);
});
it('uses one drop for a fresh attention cue and one whoosh for manual disclosure',()=>{
 expect(soundForTransition(state,{...state,expanded:true})).toBe('whoosh');
 expect(soundForTransition(state,{...state,expanded:true,noticeSequence:1})).toBe('drop');
 expect(soundForTransition({...state,noticeSequence:1},{...state,noticeSequence:1})).toBe(null);
 expect(soundForTransition({...state,soundEnabled:false},state)).toBe('drop');
 expect(soundForTransition(state,{...state,noticeSequence:-1})).toBe(null);
});
it('remembers an explicit sound choice without enabling old or malformed preferences',()=>{
 expect(normalizePlacement(null).soundEnabled).not.toBe(true);
 expect(normalizePlacement({soundEnabled:'true'}).soundEnabled).not.toBe(true);
 expect(normalizePlacement({soundEnabled:true}).soundEnabled).toBe(true);
 expect(normalizePlacement({soundEnabled:false}).soundEnabled).toBe(false);
});
function audioContext(){
 const nodes=[];
 const param=()=>({setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
 const node=()=>{const value={connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),frequency:param(),gain:param(),Q:{value:0},onended:null};nodes.push(value);return value;};
 return {nodes,currentTime:0,sampleRate:48000,destination:{},resume:vi.fn(async()=>{}),close:vi.fn(async()=>{}),createGain:node,createBiquadFilter:node,createBufferSource:node,createOscillator:node,createBuffer:(_channels,count)=>({getChannelData:()=>new Float32Array(count)})};
}
it('creates audio lazily, limits overlaps, and disconnects every node on finish',async()=>{
 const ctx=audioContext(),factory=vi.fn(()=>ctx),audio=createCompanionAudio(factory);
 expect(factory).not.toHaveBeenCalled();
 expect(await audio.play('whoosh')).toBe(true);
 expect(await audio.play('drop')).toBe(false);
 const source=ctx.nodes.find(n=>n.start.mock.calls.length);source.onended();
 expect(ctx.nodes.every(n=>n.disconnect.mock.calls.length===1)).toBe(true);
 expect(await audio.play('drop')).toBe(true);
 audio.dispose();expect(ctx.close).toHaveBeenCalledTimes(1);
 expect(await audio.play('whoosh')).toBe(false);
});
it('fails quietly on unavailable audio and cancels an in-flight resume when muted',async()=>{
 const missing=createCompanionAudio(()=>{throw Error('unavailable');});
 expect(await missing.play('drop')).toBe(false);missing.dispose();
 const ctx=audioContext();let resumed;ctx.resume=()=>new Promise(resolve=>{resumed=resolve;});
 const audio=createCompanionAudio(()=>ctx),pending=audio.play('whoosh');
 audio.dispose();resumed();expect(await pending).toBe(false);
 expect(ctx.nodes).toHaveLength(0);expect(ctx.close).toHaveBeenCalledTimes(1);
});
it('disconnects partial audio graphs when the output cannot be created',async()=>{
 const ctx=audioContext();ctx.createOscillator=()=>{throw Error('output unavailable');};
 const audio=createCompanionAudio(()=>ctx);expect(await audio.play('drop')).toBe(false);
 expect(ctx.nodes.every(node=>node.disconnect.mock.calls.length===1)).toBe(true);
 audio.dispose();
});
