import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED };

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'UPDATE_SYNC_STATE':
      return { ...initialState, state: action.state };

    default:
      return state;
  }
}
