import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED,
                       editingServer: false };

export default function sync(state = initialState, action) {
  switch (action.type) {
    // XXX Go through and probably make it delete the server/lastSyncTime
    // entries when we clear the server.
    // (Or would it be easier to have these always defined but possibly null?)
    // XXX We should also make sure that when we clear the server we don't
    // store anything in the settings database
    case 'UPDATE_SETTING':
      if (action.key !== 'syncServer') {
        return state;
      }
      return { ...state,
               server: action.value ? action.value.server : undefined,
               lastSyncTime: action.value
                             ? action.value.lastSyncTime
                             : undefined };

    case 'UPDATE_SYNC_PROGRESS':
      return { ...state,
               state: SyncState.IN_PROGRESS,
               progress: typeof action.progress === 'undefined'
                         ? null
                         : action.progress };

    case 'FINISH_SYNC':
      return { ...state,
               state: SyncState.OK,
               lastSyncTime: action.lastSyncTime };

    case 'NOTIFY_SYNC_ERROR':
      return { ...state, state: SyncState.ERROR, errorDetail: action.detail };

    case 'EDIT_SYNC_SERVER':
      return { ...state, editingServer: true };

    case 'CANCEL_EDIT_SYNC_SERVER':
      return { ...state, editingServer: false };

    // XXX See notes in sagas/sync.js -- we might be able to remove this
    case 'COMMIT_SYNC_SERVER':
      return { ...state, state: SyncState.IN_PROGRESS, editingServer: false };

    case 'CLEAR_SYNC_SERVER':
      return { ...state,
               state: SyncState.NOT_CONFIGURED,
               lastSyncTime: undefined };

    case 'CHANGE_LOCATION':
      return { ...state, editingServer: false };

    default:
      return state;
  }
}
