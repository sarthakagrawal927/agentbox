// An empty list looked reassuring while discovery was unavailable. The empty
// message must distinguish unknown/scanning/partial evidence from a clear inbox.
import {it,expect} from 'vitest';
import {companionEmptyState} from '../renderer/src/companion-model';
const ready={ready:true,rows:[],discovery:{status:'ready',partial:false,days:10,lifecycleStatus:'ready'}};
it('is reassuring only after both observers are ready',()=>{
 expect(companionEmptyState(ready).title).toBe('You’re clear for now');
 for(const state of [
  {...ready,discovery:{...ready.discovery,status:'unavailable'}},
  {...ready,discovery:{...ready.discovery,lifecycleStatus:'unavailable'}},
  {...ready,discovery:{...ready.discovery,partial:true}},
  {...ready,discovery:{...ready.discovery,status:'scanning'}},
  {...ready,discovery:{...ready.discovery,lifecycleStatus:'connecting'}},
  {...ready,ready:false},
 ])expect(companionEmptyState(state).title).not.toMatch(/clear/);
});
it('explains unavailable, partial and scanning states without promising delivery',()=>{
 expect(companionEmptyState({...ready,discovery:{...ready.discovery,status:'unavailable'}})).toEqual({title:'Waiting for status',message:'Local thread status is unavailable. Open the inbox to check your conversations.'});
 expect(companionEmptyState({...ready,discovery:{...ready.discovery,partial:true}}).title).toBe('Some threads may be missing');
 expect(companionEmptyState({...ready,discovery:{...ready.discovery,status:'scanning'}}).title).toBe('Finding your threads');
 expect(companionEmptyState({...ready,ready:false}).title).toBe('Waiting for the inbox');
});
