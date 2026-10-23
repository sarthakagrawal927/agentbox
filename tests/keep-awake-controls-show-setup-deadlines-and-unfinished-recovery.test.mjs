// Render every native power-session state so a timer never conceals recovery
// or suggests the closed lid is safe merely because a request was sent.
import {it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {KeepAwakeView} from '../renderer/src/components/KeepAwake';
import {searchSettings} from '../renderer/src/settings-search';

const view=state=>renderToStaticMarkup(React.createElement(KeepAwakeView,{state,busy:false,error:null,minutes:30,onMinutes:()=>{},onCommand:()=>{}}));
it('explains setup before asking for administrator access',()=>{
 const html=view({phase:'setup',message:'Setup required.'});
 expect(html).toContain('Set up lid-closed mode');expect(html).toContain('administrator');expect(html).toContain('other apps');expect(html).not.toContain('Start session');
});
it('shows an acknowledged deadline, extension and early end together',()=>{
 const html=view({phase:'active',endsAt:Date.now()+1800000,warnings:[]});
 expect(html).toContain('Awake until');expect(html).toContain('Add time');expect(html).toContain('End session');expect(html).not.toContain('Start session');
});
it('keeps recovery visible and offers retry instead of a new start',()=>{
 const html=view({phase:'recovery',endsAt:null,warnings:['Display restoration pending']});
 expect(html).toContain('Restoration unfinished');expect(html).toContain('Display restoration pending');expect(html).toContain('Retry restoration');expect(html).not.toContain('Start session');
});
it('does not offer a session on unsupported hosts',()=>{
 const html=view({phase:'unsupported',message:'Requires macOS 26.'});expect(html).toContain('Requires macOS 26.');expect(html).not.toContain('Start session');
});
it('finds the controls using insomnia, sleep and lid words',()=>{
 for(const query of ['insomnia','sleep','lid'])expect(searchSettings(query,{pages:['running']}).some(hit=>hit.anchor==='keep-awake')).toBe(true);
});
