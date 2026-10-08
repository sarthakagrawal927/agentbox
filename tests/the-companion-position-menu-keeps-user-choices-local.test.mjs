// A dragged or explicitly pinned position must survive disclosure and restart.
// Native display choices never expose arbitrary coordinates or file paths to IPC.
import {it,expect,vi,afterEach} from 'vitest';
import {EventEmitter} from 'node:events';
import {createCompanion} from '../main/companion.mjs';
class Window extends EventEmitter {
  constructor(options){super();this.bounds=options;this.webContents=Object.assign(new EventEmitter(),{send:vi.fn(),setWindowOpenHandler:vi.fn()});}
  getBounds(){return this.bounds;} setBounds(b){this.bounds=b;}
  isDestroyed(){return false;} isFocused(){return false;}
  show=vi.fn();focus=vi.fn();showInactive=vi.fn();destroy=vi.fn();setVisibleOnAllWorkspaces=vi.fn();
}
const displays=[{id:1,label:'First display',workArea:{x:0,y:30,width:1440,height:870}},{id:2,label:'Second display',workArea:{x:-1440,y:30,width:1440,height:870}}];
function setup(saved){
  const handlers=new Map(),save=vi.fn(),popup=vi.fn();let menu=[];
  const screen=Object.assign(new EventEmitter(),{getPrimaryDisplay:()=>displays[0],getAllDisplays:()=>displays,getDisplayMatching:rect=>rect.x<0?displays[1]:displays[0]});
  const Menu={buildFromTemplate:template=>{menu=template;return{popup};}};
  const c=createCompanion({BrowserWindow:Window,screen,Menu,ipcMain:{handle:(name,fn)=>handlers.set(name,fn),removeHandler:vi.fn()},appDir:'/app',placementStore:{load:()=>saved,save}});
  const event={sender:c.window.webContents,senderFrame:{parent:null}};
  return{...c,handlers,save,screen,popup,event,menu:()=>menu};
}
afterEach(()=>vi.useRealTimers());
it('restores and saves sound alongside placement without resetting pinning',()=>{
 const c=setup({displayId:2,x:0,y:.2,locked:true,soundEnabled:true});
 expect(c.state().soundEnabled).toBe(true);
 c.handlers.get('inbox:companion-sound')(c.event,false);
 expect(c.save).toHaveBeenLastCalledWith(expect.objectContaining({displayId:2,x:0,y:.2,locked:true,soundEnabled:false}));
 c.handlers.get('inbox:companion-position')(c.event);c.menu().find(row=>row.label==='Pin to bottom').click();
 expect(c.state().soundEnabled).toBe(false);c.dispose();
});
it('restores a saved monitor and placement instead of reverting to the right edge',()=>{
  const c=setup({displayId:2,x:0,y:0,locked:true});expect(c.window.getBounds().x).toBe(-1432);expect(c.state().side).toBe('left');expect(c.state().placement.locked).toBe(true);c.dispose();
});
it('offers keyboard-accessible native edge and display choices and saves them',()=>{
  const c=setup();c.handlers.get('inbox:companion-position')(c.event);expect(c.popup).toHaveBeenCalledWith({window:c.window});
  c.menu().find(row=>row.label==='Pin to left').click();expect(c.state().side).toBe('left');expect(c.save).toHaveBeenLastCalledWith(expect.objectContaining({x:0,y:.5}));
  c.menu().find(row=>row.label==='Display').submenu[1].click();expect(c.window.getBounds().x).toBeLessThan(0);expect(c.save).toHaveBeenLastCalledWith(expect.objectContaining({displayId:2}));c.dispose();
});
it('remembers a manual drag but never treats a programmatic resize as a user move',()=>{
  vi.useFakeTimers();const c=setup();expect(c.save).not.toHaveBeenCalled();c.handlers.get('inbox:companion-expand')(c.event,true);expect(c.save).not.toHaveBeenCalled();
  c.window.emit('will-move',{}, {...c.window.getBounds(),x:-1100,y:150});vi.advanceTimersByTime(250);expect(c.save).toHaveBeenCalledTimes(1);expect(c.state().placement.displayId).toBe(2);c.dispose();
});
it('can lock dragging and opt into Spaces without creating another menu-bar item',()=>{
  const c=setup();c.handlers.get('inbox:companion-position')(c.event);
  c.menu().find(row=>row.label==='Lock position').click({checked:true});expect(c.state().placement.locked).toBe(true);
  c.menu().find(row=>row.label==='Show on all Spaces').click({checked:true});expect(c.window.setVisibleOnAllWorkspaces).toHaveBeenLastCalledWith(true,{visibleOnFullScreen:true});c.dispose();
});
it('falls back safely when a saved display disappears and reports save failures',()=>{
  const c=setup({displayId:999,x:0,y:0});expect(c.window.getBounds().x).toBe(8);c.save.mockImplementation(()=>{throw Error('disk unavailable');});
  c.handlers.get('inbox:companion-position')(c.event);c.menu().find(row=>row.label==='Pin to bottom').click();expect(c.state().placementError).toContain('could not be saved');c.dispose();
});
it('rejects other windows and child frames before opening a position menu',()=>{
  const c=setup();const fn=c.handlers.get('inbox:companion-position');expect(()=>fn({sender:{}})).toThrow();expect(()=>fn({...c.event,senderFrame:{parent:{}}})).toThrow();expect(c.popup).not.toHaveBeenCalled();c.dispose();
});
it('cancels pending position writes when disposed',()=>{
  vi.useFakeTimers();const c=setup();c.window.emit('will-move',{},c.window.getBounds());c.dispose();vi.advanceTimersByTime(250);expect(c.save).not.toHaveBeenCalled();
});
