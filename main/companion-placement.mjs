// Only window preferences live here. No conversation, provider or filesystem
// location comes from the companion renderer.
import fs from 'node:fs';
import path from 'node:path';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function normalizePlacement(input) {
  const p=input && typeof input==='object' ? input : {};
  return {displayId:Number.isSafeInteger(p.displayId)?p.displayId:null,
    x:Number.isFinite(p.x)?clamp(p.x,0,1):1,y:Number.isFinite(p.y)?clamp(p.y,0,1):.5,
    locked:p.locked===true,allSpaces:p.allSpaces===true,
    ...(typeof p.soundEnabled==='boolean'?{soundEnabled:p.soundEnabled}:{})};
}
export function placementLayout(area,expanded,input) {
  const p=normalizePlacement(input),side=p.x<=.5?'left':'right';
  const closedWidth=Math.min(64,Math.max(1,area.width-16));
  const closedHeight=Math.min(192,Math.max(1,area.height-16));
  const closedX=Math.round(area.x+8+p.x*Math.max(0,area.width-16-closedWidth));
  const closedY=Math.round(area.y+8+p.y*Math.max(0,area.height-16-closedHeight));
  const closedPillLeft=Math.max(0,closedWidth-54);
  const leftOpenX=closedX+closedPillLeft-6;
  // Grow toward the roomier side rather than moving the user's pinned pill.
  const available=side==='left'?area.x+area.width-8-leftOpenX:closedX+closedWidth-area.x-8;
  const width=expanded?Math.min(396,Math.max(closedWidth,available)):closedWidth;
  const height=expanded?Math.min(520,Math.max(1,area.height-16)):closedHeight;
  const x=!expanded?closedX:side==='left'?leftOpenX:closedX+closedWidth-width;
  const y=Math.round(clamp(closedY-(height-closedHeight)/2,area.y+8,area.y+area.height-height-8));
  const pillLeft=!expanded?closedPillLeft:side==='left'?6:Math.max(0,width-54);
  const pillHeight=Math.min(180,Math.max(1,height-12));
  const pillTop=clamp(closedY+6-y,6,Math.max(6,height-pillHeight-6));
  return {bounds:{x,y,width:Math.round(width),height},side,pillLeft,pillTop,pillHeight};
}
export function placementFromBounds(area,bounds,layout,displayId) {
  const closedWidth=Math.min(64,Math.max(1,area.width-16)),closedHeight=Math.min(192,Math.max(1,area.height-16));
  const closedLeft=Math.max(0,closedWidth-54);
  const x=bounds.x+layout.pillLeft-closedLeft,y=bounds.y+layout.pillTop-6;
  return normalizePlacement({displayId,x:(x-area.x-8)/Math.max(1,area.width-16-closedWidth),y:(y-area.y-8)/Math.max(1,area.height-16-closedHeight)});
}
export function createPlacementStore(file) {
  return {
    load(){try{if(fs.statSync(file).size>4096)return normalizePlacement(null);return normalizePlacement(JSON.parse(fs.readFileSync(file,'utf8')));}catch{return normalizePlacement(null);}},
    save(input){
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const temp=`${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp,JSON.stringify(normalizePlacement(input))+'\n',{mode:0o600});
      fs.renameSync(temp,file);
    },
  };
}
