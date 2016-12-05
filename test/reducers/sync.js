/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import sync from '../../src/reducers/sync';
import SyncState from '../../src/sync-states';

describe('reducer:sync', () => {
  it('ignores unrelated settings', () => {
    const initialState = {};
    const action = { type: 'UPDATE_SETTING', key: 'unrelated' };

    const updatedState = sync(initialState, action);

    assert.strictEqual(updatedState, initialState,
                       'state object is the object passed-in');
  });

  it('updates the server', () => {
    const initialState = { state: SyncState.NOT_CONFIGURED,
                           editingServer: false };
    const action = { type: 'UPDATE_SETTING',
                     key: 'syncServer',
                     value: { server: 'server-name' } };

    const updatedState = sync(initialState, action);

    assert.notStrictEqual(updatedState, initialState,
                          'state object is NOT the object passed-in');
    assert.strictEqual(updatedState.server, 'server-name');
    assert.strictEqual(updatedState.lastSyncTime, undefined);
  });

  it('updates the lastSyncTime', () => {
    const now = Date.now();
    const action = { type: 'UPDATE_SETTING',
                     key: 'syncServer',
                     value: { server: 'server-name',
                              lastSyncTime: now } };

    const updatedState = sync({}, action);

    assert.strictEqual(updatedState.lastSyncTime, now);
  });
});
