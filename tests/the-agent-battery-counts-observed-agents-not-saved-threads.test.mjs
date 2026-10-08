// The old pill dots included saved history and hid all but four states.
// Preserve the segmented battery with observed-agent membership and bounded marks.
import {it,expect} from 'vitest';
import * as model from '../renderer/src/companion-model';
const row=(id,status,live=true)=>({id,title:id,product:'Example',provider:'Codex',status,live});
it('excludes history and queued work, and keeps unavailable live agents neutral',()=>{
 const battery=model.agentBattery([row('saved','saved',false),row('queue','waiting',false),row('work','working'),row('ask','approval'),row('lost','unknown')]);
 expect(battery.total).toBe(3);
 expect(battery.segments.map(s=>s.tone)).toEqual(['working','attention','unknown']);
 expect(battery.label).toContain('1 status unavailable');
 expect(battery.label).not.toMatch(/percent|charge|tokens/i);
});
it('uses an empty outline when no live agent has been observed',()=>{
 expect(model.agentBattery([row('history','saved',false)])).toMatchObject({total:0,segments:[]});
 expect(model.agentBattery([]).label).toContain('No live agents observed');
});
it('shows one mark per agent through twelve, then proportional state strips',()=>{
 const twelve=model.agentBattery(Array.from({length:12},(_,i)=>row(String(i),'working')));
 expect(twelve.segments).toHaveLength(12);
 expect(twelve.segments.at(-1).x+twelve.segments.at(-1).width).toBeCloseTo(25);
 const crowded=model.agentBattery([...Array.from({length:11},(_,i)=>row(String(i),'working')),row('failed','failed'),row('idle','done')]);
 expect(crowded.total).toBe(13);expect(crowded.segments).toHaveLength(3);
 expect(crowded.segments[0].width).toBeCloseTo(21*11/13);
 expect(crowded.segments.reduce((n,s)=>n+s.width,0)).toBeCloseTo(21);
});
it('requires a running worker or connected agent before queued rows fill the battery',()=>{
 const rows=model.companionRows({inbox:[{id:'queued',title:'Queued'}],progress:[{id:'run',title:'Running'}],agents:[{id:'agent:7',title:'Connected',agent:{pid:7,status:'idle'}}],running:[{itemId:'run'}],approvals:[],engines:{}});
 expect(model.agentBattery(rows).total).toBe(2);
});
it('keeps outside hook evidence in the battery when its imported conversation is already queued',()=>{
 const rows=model.companionRows({inbox:[{id:'imported',title:'Imported conversation'}],progress:[],agents:[],running:[],approvals:[],engines:{},
  lifecycle:[row('imported','working')]});
 expect(rows).toHaveLength(1);expect(rows[0].status).toBe('waiting');
 expect(model.agentBattery(rows)).toMatchObject({total:1,segments:[{tone:'working'}]});
});
