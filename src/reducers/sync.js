import SyncState from '../sync-states';

const initialState = { state: SyncState.NOT_CONFIGURED,
                       server: undefined,
                       editingServer: false,
                       lastSyncTime: undefined,
                       progress: undefined,
                       paused: false,
                       offline: false,
                       errorDetail: undefined };

function updateSyncState(state, inProgress = false) {
  if (!state.server) {
    state.state = SyncState.NOT_CONFIGURED;
  } else if (state.errorDetail) {
    state.state = SyncState.ERROR;
  } else if (state.paused) {
    state.state = SyncState.PAUSED;
  } else if (state.offline) {
    state.state = SyncState.OFFLINE;
  } else if (inProgress) {
    state.state = SyncState.IN_PROGRESS;
  } else {
    state.state = SyncState.OK;
  }
  return state;
}

export default function sync(state = initialState, action) {
  switch (action.type) {
    case 'COMMIT_SYNC_SERVER':
      return updateSyncState({ ...state,
                               server: action.server,
                               editingServer: false,
                               lastSyncTime: undefined,
                               progress: undefined,
                               errorDetail: undefined }, true);

    case 'UPDATE_SYNC_PROGRESS':
      return updateSyncState({ ...state,
                               progress: action.progress }, true);

    case 'FINISH_SYNC':
      return updateSyncState({ ...state,
                               lastSyncTime: action.lastSyncTime,
                               progress: undefined });

    case 'UPDATE_SYNC_TIME':
      return { ...state, lastSyncTime: action.lastSyncTime };

    case 'NOTIFY_SYNC_ERROR':
      // If we don't put *something* in errorDetail, updateSyncState won't
      // know that we are in the error state. Furthermore, errorDetail is
      // expected to be an object.
      return updateSyncState({ ...state,
                               errorDetail: action.details || {} });

    case 'EDIT_SYNC_SERVER':
      return { ...state, editingServer: true };

    case 'CANCEL_EDIT_SYNC_SERVER':
      return { ...state, editingServer: false };

    case 'RETRY_SYNC':
      return updateSyncState({ ...state,
                               progress: undefined,
                               errorDetail: undefined }, true);

    case 'PAUSE_SYNC':
      return updateSyncState({ ...state,
                               paused: true,
                               errorDetail: undefined }, true);

    case 'RESUME_SYNC':
      return updateSyncState({ ...state,
                               paused: false,
                               progress: undefined,
                               errorDetail: undefined }, true);

    case 'CHANGE_LOCATION':
      return { ...state, editingServer: false };

    default:
      return state;
  }
}
