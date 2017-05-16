import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED,
                       server: undefined,
                       editingServer: false,
                       lastSyncTime: undefined,
                       progress: undefined,
                       paused: false,
                       offline: typeof navigator !== 'undefined' &&
                                !navigator.onLine,
                       errorDetail: undefined };

function updateSyncState(state) {
  if (!state.server) {
    state.state = SyncState.NOT_CONFIGURED;
  } else if (state.errorDetail) {
    state.state = SyncState.ERROR;
  } else if (state.paused) {
    state.state = SyncState.PAUSED;
  } else if (state.offline) {
    state.state = SyncState.OFFLINE;
  } else {
    state.state = SyncState.OK;
  }
  return state;
}

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'UPDATE_SYNC_SERVER': {
      return updateSyncState({ ...state,
                               server: action.server,
                               lastSyncTime: action.lastSyncTime,
                               progress: undefined,
                               paused: !!action.paused,
                               errorDetail: undefined });
    }

    case 'UPDATE_SYNC_PROGRESS':
      return { ...state,
               state: SyncState.IN_PROGRESS,
               progress: action.progress };

    case 'FINISH_SYNC':
      return updateSyncState({ ...state,
                               lastSyncTime: action.lastSyncTime,
                               progress: undefined });

    case 'NOTIFY_SYNC_ERROR':
      // If we don't put *something* in errorDetail, updateSyncState won't
      // know that we are in the error state. Furthermore, errorDetail is
      // expected to be an object.
      return updateSyncState({ ...state,
                               errorDetail: action.details || {} });

    case 'RETRY_SYNC':
      return updateSyncState({ ...state,
                               progress: undefined,
                               errorDetail: undefined });

    case 'PAUSE_SYNC':
      return updateSyncState({ ...state,
                               paused: true,
                               errorDetail: undefined });

    case 'RESUME_SYNC':
      return updateSyncState({ ...state,
                               paused: false,
                               progress: undefined,
                               errorDetail: undefined });

    case 'GO_ONLINE':
      return updateSyncState({ ...state, offline: false });

    case 'GO_OFFLINE':
      return updateSyncState({ ...state, offline: true });

    case 'EDIT_SYNC_SERVER':
      return { ...state, editingServer: true };

    case 'FINISH_EDIT_SYNC_SERVER':
      return { ...state, editingServer: false };

    case 'NAVIGATE':
      return { ...state, editingServer: false };

    default:
      return state;
  }
}
