// The selected companion identity should carry into its conversation window,
// without changing a named team's identity or the upstream component default.
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {WorkspaceNavigation} from '../renderer/src/components/WorkspaceNavigation';
import {Name} from '../shared/product-name.mjs';
const noop=()=>{};
const draw=extra=>renderToStaticMarkup(createElement(WorkspaceNavigation,{view:'inbox',collapsed:false,onToggle:noop,onView:noop,onSearch:noop,onCompose:noop,...extra}));
it('names the local companion inbox in the conversation navigation',()=>{
 const html=draw({companionIdentity:true});expect(html).toContain('Agent Inbox');expect(html).toContain('aria-label="Collapse sidebar"');
});
it('preserves the upstream default and a real team name',()=>{
 expect(draw({})).toContain(Name);
 const html=draw({companionIdentity:true,team:{team:{name:'Example team'}}});
 expect(html).toContain('Example team');expect(html).not.toContain('Agent Inbox');
});
it('keeps the expand control named when compact',()=>{
 expect(draw({companionIdentity:true,collapsed:true})).toContain('aria-label="Expand sidebar"');
});
