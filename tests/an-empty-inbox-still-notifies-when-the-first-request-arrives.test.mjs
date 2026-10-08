// Previously an empty set meant both 'not initialized' and 'nothing waiting',
// so the first arrival after clearing the inbox was silently treated as startup.
import { it, expect } from 'vitest';
import { freshArrivals, companionSummary } from '../renderer/src/companion-model';
it('suppresses startup history but not the first arrival after an empty inbox', () => {
  expect(freshArrivals(null, [{ id: 'old' }])).toEqual([]);
  expect(freshArrivals(new Set(), [{ id: 'new' }])).toEqual([{ id: 'new' }]);
  expect(freshArrivals(new Set(['same']), [{ id: 'same' }, { id: 'new' }])).toEqual([{ id: 'new' }]);
  expect(freshArrivals(new Set(['gone']), [])).toEqual([]);
});
it('does not claim a quiet inbox when observers or row status are unavailable', () => {
  const state = { ready: true, rows: [], discovery: { status: 'ready', partial: false } };
  expect(companionSummary(state, 0, true)).toBe('Nothing needs you.');
  expect(companionSummary({ ...state, rows: [{ status: 'unknown' }] }, 0, true)).toBe('Status unavailable.');
  expect(companionSummary({ ...state, discovery: { ...state.discovery, status: 'unavailable' } }, 0, true)).toBe('Status unavailable.');
  expect(companionSummary({ ...state, discovery: { ...state.discovery, lifecycleStatus: 'unavailable' } }, 0, true)).toBe('Status unavailable.');
  expect(companionSummary({ ...state, discovery: { ...state.discovery, status: 'scanning' } }, 0, true)).toBe('Checking your threads.');
  expect(companionSummary({ ...state, discovery: { ...state.discovery, partial: true } }, 0, true)).toBe('Some status is missing.');
  expect(companionSummary({ ...state, rows: [{ status: 'unknown' }] }, 1, true)).toBe('One thing for you.');
  expect(companionSummary(state, 2, true)).toBe('2 things for you.');
  expect(companionSummary({ ...state, ready: false }, 0, true)).toBe('Connecting…');
  expect(companionSummary({ ...state, ready: false }, 0, false)).toBe('Desktop connection unavailable');
});
