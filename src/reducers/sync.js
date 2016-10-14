import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED,
                       editingServer: false };

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'UPDATE_SYNC_STATE':
      return { ...state,
               state: action.state,
               errorDetail: action.errorDetail };

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
