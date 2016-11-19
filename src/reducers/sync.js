import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED,
                       editingServer: false };

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'UPDATE_SYNC_STATE':
      {
        const newState = { ...state, state: action.state };
        if (newState.state === SyncState.ERROR) {
          newState.errorDetail = action.detail;
        } else if (newState.state === SyncState.IN_PROGRESS) {
          newState.progress = typeof action.detail === 'undefined'
                              ? null
                              : action.detail;
        }
        return newState;
      }

    case 'EDIT_SERVER':
      return { ...state, editingServer: true };

    case 'FINISH_EDIT_SERVER':
      return { ...state, editingServer: false };

    case 'CHANGE_LOCATION':
      return { ...state, editingServer: false };

    default:
      return state;
  }
}
