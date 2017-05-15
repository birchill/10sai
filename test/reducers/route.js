/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/reducers/route';

// We'd like to make this test independent of the router in use but rather than
// introduce complexity to make the router used by the reducer pluggable, we
// just define a few standard URLs/paths with corresponding routes here.
const urlA   = '/';
const pathA  = { path: '/', search: '', fragment: '' };
const routeA = { screen: '' };

const urlB   = '/?abc=123';
const pathB  = { path: '/', search: '?abc=123', fragment: '' };
const routeB = { screen: '', search: { abc: '123' } };

const urlC   = '/#hash'; // eslint-disable-line no-unused-vars
// eslint-disable-next-line no-unused-vars
const pathC  = { path: '/', search: '', fragment: '#hash' };
const routeC = { screen: '', fragment: 'hash' };

const urlD   = '/?abc=123#hash'; // eslint-disable-line no-unused-vars
const pathD  = { path: '/', search: '?abc=123', fragment: '#hash' };
const routeD = { screen: '', search: { abc: '123' }, fragment: 'hash' };

describe('reducer:route', () => {
  it('updates the current route on an initial NAVIGATE', () => {
    const action = { type: 'NAVIGATE', replace: false, ...pathA };

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [ routeA ], index: 0 });
  });

  it('updates the current route on an initial NAVIGATE given a URL', () => {
    const action = { type: 'NAVIGATE', replace: false, url: urlA };

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [ routeA ], index: 0 });
  });

  it('updates the current route on an initial NAVIGATE given a (non-empty) URL',
  () => {
    const action = { type: 'NAVIGATE', replace: false, url: urlB };

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [ routeB ], index: 0 });
  });

  it('updates the current route on a initial NAVIGATE even if replace is true',
  () => {
    const action = { type: 'NAVIGATE', replace: true, ...pathA };

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [ routeA ], index: 0 });
  });

  it('appends the route on a subsequent NAVIGATE when replace is missing',
  () => {
    const initialState = { history: [ routeA ], index: 0 };
    const action = { type: 'NAVIGATE', ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [ routeA, routeB ], index: 1 });
  });

  it('appends the route on a subsequent NAVIGATE when replace is false', () => {
    const initialState = { history: [ routeA ], index: 0 };
    const action = { type: 'NAVIGATE', replace: false, ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [ routeA, routeB ], index: 1 });
  });

  it('updates the route on a subsequent NAVIGATE when replace is true', () => {
    const initialState = { history: [ routeA ], index: 0 };
    const action = { type: 'NAVIGATE', replace: true, ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [ routeB ], index: 0 });
  });

  it('updates the route on a subsequent NAVIGATE when replace is truthy',
  () => {
    const initialState = { history: [ routeA ], index: 0 };
    const action = { type: 'NAVIGATE', replace: 'yes', ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [ routeB ], index: 0 });
  });

  it('truncates the history when NAVIGATE-ing mid-history', () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 1 };
    const action = { type: 'NAVIGATE', ...pathD };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeD ], index: 2 });
  });

  it('does NOT truncate the history when NAVIGATE-ing mid-history when replace'
     + ' is true',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 1 };
    const action = { type: 'NAVIGATE', replace: true, ...pathD };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeD, routeC ], index: 1 });
  });

  it('updates the index on NAVIGATE_FROM_HISTORY when index is previous item',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 1, ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 1 });
  });

  it('updates the index on NAVIGATE_FROM_HISTORY when index is a few steps'
     + ' back',
  () => {
    const initialState = { history: [ routeA, routeB, routeC, routeD ],
                           index: 3 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 1, ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC, routeD ], index: 1 });
  });

  it('does nothing on NAVIGATE_FROM_HISTORY when index is current item', () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 1 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 1, ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 1 });
  });

  it('updates the index on NAVIGATE_FROM_HISTORY when index is zero', () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 0, ...pathA };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 0 });
  });

  it('does nothing on NAVIGATE_FROM_HISTORY when index is null',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: null, ...pathA };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 2 });
  });

  it('does nothing on NAVIGATE_FROM_HISTORY when index is missing', () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', ...pathB };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 2 });
  });

  it('updates the index on NAVIGATE_FROM_HISTORY when index is future item',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 0 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 2 };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 2 });
  });

  it('pushes to history on NAVIGATE_FROM_HISTORY when index is beyond history'
     + ' bounds',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 4, ...pathD };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC, routeD ], index: 3 });
  });

  it('updates the history item on NAVIGATE_FROM_HISTORY when passed route'
     + ' differs',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 1, ...pathA };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeA, routeC ], index: 1 });
  });

  it('does not update the history item on NAVIGATE_FROM_HISTORY when no route'
     + ' is passed',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 1 };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 1 });
  });

  it('does nothing on NAVIGATE_FROM_HISTORY when no route is passed and the'
     + ' index is out of bounds',
  () => {
    const initialState = { history: [ routeA, routeB, routeC ], index: 2 };
    const action = { type: 'NAVIGATE_FROM_HISTORY', index: 5 };

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState,
                     { history: [ routeA, routeB, routeC ], index: 2 });
  });
});
