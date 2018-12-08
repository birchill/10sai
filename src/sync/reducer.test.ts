import { sync as subject } from './reducer';
import * as syncActions from './actions';

describe('reducer:sync', () => {
  it('updates the server', () => {
    const initialState = subject(undefined, { type: 'NONE' } as any);

    const updatedState = subject(
      initialState,
      syncActions.updateSyncServer({
        server: { name: 'server-name' },
        lastSyncTime: undefined,
        paused: false,
      })
    );

    expect(updatedState).not.toBe(initialState);
    expect(updatedState.server!.name).toBe('server-name');
    expect(updatedState.lastSyncTime).toBe(undefined);
  });
});
