/* global afterEach, beforeEach, define, describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import sync from '../../src/reducers/sync';
import SyncState from '../../src/sync-states';

describe('reducer:sync', () => {
  it('updates the server', () => {
    const initialState = { state: SyncState.NOT_CONFIGURED,
                           editingServer: false };
    const action = { type: 'UPDATE_SYNC_SERVER',
                     server: { name: 'server-name' } };

    const updatedState = sync(initialState, action);

    assert.notStrictEqual(updatedState, initialState,
                          'state object is NOT the object passed-in');
    assert.strictEqual(updatedState.server.name, 'server-name');
    assert.strictEqual(updatedState.lastSyncTime, undefined);
  });
});
