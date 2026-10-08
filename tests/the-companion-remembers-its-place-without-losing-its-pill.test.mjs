// The first companion always returned to the right edge. Placement must survive
// expansion, restart and display changes, without persisting conversation data.
import {it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {placementLayout, placementFromBounds, normalizePlacement, createPlacementStore} from '../main/companion-placement.mjs';

const area={x:-1440,y:30,width:1440,height:870};
const inside=b=>{expect(b.x).toBeGreaterThanOrEqual(area.x);expect(b.y).toBeGreaterThanOrEqual(area.y);expect(b.x+b.width).toBeLessThanOrEqual(area.x+area.width);expect(b.y+b.height).toBeLessThanOrEqual(area.y+area.height);};
it('keeps the pill at the same desktop coordinates at either edge and corner',()=>{
  for(const x of [0,.2,.5,.8,1])for(const y of [0,.5,1]){
    const p={displayId:2,x,y};const closed=placementLayout(area,false,p),open=placementLayout(area,true,p);
    inside(closed.bounds);inside(open.bounds);
    expect(open.bounds.x+open.pillLeft).toBe(closed.bounds.x+closed.pillLeft);
    expect(open.bounds.y+open.pillTop).toBe(closed.bounds.y+closed.pillTop);
  }
});
it('opens inward and fits a small work area',()=>{
  expect(placementLayout(area,true,{x:0,y:.5}).side).toBe('left');
  expect(placementLayout(area,true,{x:1,y:.5}).side).toBe('right');
  const small=placementLayout({x:10,y:40,width:300,height:240},true,{x:1,y:1});
  expect(small.bounds).toMatchObject({width:284,height:224});expect(small.pillLeft).toBeGreaterThanOrEqual(0);expect(small.pillTop+180).toBeLessThanOrEqual(224);
});
it('recovers a normalized collapsed anchor after moving an expanded panel',()=>{
  const layout=placementLayout(area,true,{displayId:2,x:.2,y:.3});
  const moved={...layout.bounds,x:layout.bounds.x+70,y:layout.bounds.y+50};
  const p=placementFromBounds(area,moved,layout,2);
  const next=placementLayout(area,true,p);
  expect(next.bounds.x+next.pillLeft).toBe(moved.x+layout.pillLeft);
  expect(next.bounds.y+next.pillTop).toBe(moved.y+layout.pillTop);
});
it('keeps the physical pill anchor when a drag changes the opening side',()=>{
  for(const x of [0,1]){
    const layout=placementLayout(area,true,{displayId:2,x,y:.5});
    const targetX=area.x+(x===0?1100:220);
    const moved={...layout.bounds,x:targetX-layout.pillLeft};
    const p=placementFromBounds(area,moved,layout,2);
    const next=placementLayout(area,true,p);
    expect(next.bounds.x+next.pillLeft).toBe(targetX);
  }
});
it('rejects corrupt coordinates and drops unknown fields',()=>{
  expect(normalizePlacement({x:NaN,y:Infinity,displayId:'wrong',body:'private'})).toEqual({displayId:null,x:1,y:.5,locked:false,allSpaces:false});
  expect(normalizePlacement({x:-10,y:99,displayId:4,locked:true,allSpaces:true,body:'private'})).toEqual({displayId:4,x:0,y:1,locked:true,allSpaces:true});
});
it('persists only bounded placement preferences and recovers from malformed files',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inbox-placement-'));const file=path.join(dir,'placement.json');
  try{
    const s=createPlacementStore(file);expect(s.load().x).toBe(1);
    s.save({displayId:3,x:.2,y:.8,locked:true,allSpaces:false,rows:[{body:'private'}]});
    expect(createPlacementStore(file).load()).toEqual({displayId:3,x:.2,y:.8,locked:true,allSpaces:false});expect(fs.readFileSync(file,'utf8')).not.toContain('private');
    fs.writeFileSync(file,'not json');expect(s.load().x).toBe(1);
    fs.writeFileSync(file,'x'.repeat(5000));expect(s.load().x).toBe(1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
