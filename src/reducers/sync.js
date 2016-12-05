import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED,
                       editingServer: false,
                       server: undefined,
                       lastSyncTime: undefined,
                       progress: null };

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'UPDATE_SETTING':
      {
        if (action.key !== 'syncServer') {
          return state;
        }
        const getProp = prop => (action.value ? action.value[prop] : undefined);
        return { ...state,
                server: getProp('server'),
                lastSyncTime: getProp('lastSyncTime') };
      }

    case 'COMMIT_SYNC_SERVER':
      return { ...state,
               server: action.server,
               state: action.server
                      ? SyncState.IN_PROGRESS
                      : SyncState.NOT_CONFIGURED,
               editingServer: false,
               lastSyncTime: undefined,
               progress: null };

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

    case 'RETRY_SYNC':
      return { ...state, state: SyncState.IN_PROGRESS, progress: null };

    case 'CHANGE_LOCATION':
      return { ...state, editingServer: false };

    default:
      return state;
  }
}
