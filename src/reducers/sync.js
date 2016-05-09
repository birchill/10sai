import SyncStatus from '../sync-status';

const initialState = { state: SyncStatus.NOT_CONFIGURED };

export default function sync(state = initialState, action) {
  switch (action.type) {
    default:
      return state;
  }
}
