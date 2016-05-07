import * as SyncStatus from '../sync-status-codes';

const initialState = { state: SyncStatus.NOT_CONFIGURED };

export default function sync(state = initialState, action) {
  switch (action.type) {
    default:
      return state;
  }
}
