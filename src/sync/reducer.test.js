/* global describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import sync from './reducer';
import SyncState from './states';

describe('reducer:sync', () => {
  it('updates the server', () => {
    const initialState = {
      state: SyncState.NOT_CONFIGURED,
      editingServer: false,
    };
    const action = {
      type: 'UPDATE_SYNC_SERVER',
      server: { name: 'server-name' },
    };

    const updatedState = sync(initialState, action);

    expect(updatedState).not.toBe(initialState);
    expect(updatedState.server.name).toBe('server-name');
    expect(updatedState.lastSyncTime).toBe(undefined);
  });
});
