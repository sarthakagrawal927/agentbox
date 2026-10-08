// Discovery was manual. Measure automatic saved rows separately from live
// activity, preserve provider identity, and never forward transcript content.
import { it, expect } from 'vitest';
import { threadKey, visibleDiscoveredThreads, selectThreadKeys } from '../shared/local-threads.mjs';
import { companionRows } from '../renderer/src/companion-model';
import { markImported } from '../shared/agent-import.mjs';
const t = (id, source = 'terminal', extra = {}) => ({ id, source, title: `Thread ${id}`, folderName: 'Project', when: 100, ...extra });
it('keeps provider identities distinct and folds Claude terminal/desktop duplicates', () => {
  expect(threadKey(t('same'))).toBe(threadKey(t('same', 'desktop')));
  expect(threadKey(t('same', 'codex'))).not.toBe(threadKey(t('same')));
  expect(visibleDiscoveredThreads([t('same'),t('same','desktop'),t('same','codex')])).toHaveLength(2);
});
it('marks an imported thread only for its own provider in the review card',()=>{
  const rows=markImported([t('same'),t('same','codex')],[{labels:['codex:same']}]);
  expect(rows[0].imported).toBeUndefined();expect(rows[1].imported).toBe(true);
});
it('hides imported, live and owned sessions by provider without hiding unrelated threads', () => {
  const rows = visibleDiscoveredThreads([t('same'), t('same','codex'),t('live'),t('owned'),t('keep')], {
    items:[{labels:['codex:same']}], agents:[{sessionId:'live'}], ownedSessions:['owned']
  });
  expect(rows.map(r=>r.id)).toEqual(['same','keep']);
});
it('permits a previously declined Codex thread but hides an accepted mirror', () => {
  expect(visibleDiscoveredThreads([t('x','codex')],{items:[{status:'done',labels:['codex:x','not-imported']}]})).toHaveLength(1);
  expect(visibleDiscoveredThreads([t('x','codex')],{items:[{labels:['codex:x']}]})).toHaveLength(0);
});
it('bounds display metadata and excludes paths, prompts, answers and reply claims', () => {
  const [row] = visibleDiscoveredThreads([t('x','codex',{title:'a'.repeat(500),path:'/private/transcript',folder:'/private/project',prompt:'secret text',last:'answer',live:true,canReply:true})]);
  expect(Object.keys(row).sort()).toEqual(['folderName','id','key','source','title','when'].sort());
  expect(row.title.length).toBeLessThanOrEqual(120);
  expect(visibleDiscoveredThreads([t(''),t('x','unsupported'),{source:'codex',id:'no-title'}])).toEqual([]);
});
it('redacts sensitive first-line labels before clipping while preserving useful titles', () => {
  const titles = ['Connect postgres://demo:fake-password@localhost/db', 'Connect postgres://demo:fake-pass', 'API_KEY=demo-secret-value', 'Authorization: Bearer example-token-value', 'Read /Users/example/private/report.md', 'token: demo-value']; // public-check: allow -- deliberately fake credential-redaction fixtures
  for (const title of titles) {
    const [row] = visibleDiscoveredThreads([t('x', 'codex', { title })]);
    expect(row.title).not.toMatch(/fake-pass|demo-secret|example-token|\/Users\/example|demo-value/);
  }
  expect(visibleDiscoveredThreads([t('normal', 'codex', {title:'Review the notification flow'})])[0].title).toBe('Review the notification flow');
});
it('selects only an exact provider-qualified thread and never trusts a supplied path', () => {
  const rows=[t('same'),t('same','codex')];
  expect(selectThreadKeys(rows,[threadKey(rows[1])])).toEqual([rows[1]]);
  expect(selectThreadKeys(rows,['local:codex:missing','/tmp/other'])).toEqual([]);
});
it('publishes saved conversations without turning them into working or needs-you rows', () => {
  const rows=companionRows({inbox:[],progress:[],agents:[],running:[],approvals:[],engines:{},discovered:visibleDiscoveredThreads([t('c'),t('x','codex')])});
  expect(rows.map(r=>[r.provider,r.status])).toEqual([['Claude','saved'],['Codex','saved']]);
});
