import {it,expect} from 'vitest';
import {owningApp} from '../main/agents.mjs';
it('waits for the asynchronous process table before walking to the host app',async()=>{
 const read=async()=>new Map([[21,{ppid:20,command:'claude'}],[20,{ppid:1,command:'/Applications/Warp.app/Contents/MacOS/stable'}]]);
 expect(await owningApp(21,read)).toEqual({path:'/Applications/Warp.app',name:'Warp'});
});
it('reports unavailable instead of inventing a host or looping on a broken chain',async()=>{
 expect(await owningApp(21,async()=>new Map())).toBe(null);
 expect(await owningApp(21,async()=>new Map([[21,{ppid:21,command:'claude'}]]))).toBe(null);
});
