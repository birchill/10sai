import { Action } from '../actions';
import { SyncServer } from './SyncServer';

export interface SyncState {
  server?: SyncServer;
  editingServer: boolean;
  lastSyncTime?: Date;
  // `progress` values:
  // number - fraction between 0.0 and 1.0 indicating total sync progress
  // null - indeterminate progress
  // undefined - no sync in progress
  progress?: number | null | undefined;
  paused: boolean;
  offline: boolean;
  // XXX Fix the type of this
  errorDetail?: any;
}

const initialState: SyncState = {
  server: undefined,
  editingServer: false,
  lastSyncTime: undefined,
  progress: undefined,
  paused: false,
  offline: typeof navigator !== 'undefined' && !navigator.onLine,
  errorDetail: undefined,
};

export function sync(state = initialState, action: Action) {
  switch (action.type) {
    case 'UPDATE_SYNC_SERVER':
      return {
        ...state,
        server: action.server,
        lastSyncTime: action.lastSyncTime,
        progress: undefined,
        paused: !!action.paused,
        errorDetail: undefined,
      };

    case 'UPDATE_SYNC_PROGRESS':
      return {
        ...state,
        progress: action.progress,
      };

    case 'FINISH_SYNC':
      return {
        ...state,
        lastSyncTime: action.lastSyncTime,
        progress: undefined,
      };

    case 'NOTIFY_SYNC_ERROR':
      // If we don't put *something* in errorDetail, updateSyncState won't
      // know that we are in the error state. Furthermore, errorDetail is
      // expected to be an object.
      return {
        ...state,
        errorDetail: action.details || {},
        progress: undefined,
      };

    case 'RETRY_SYNC':
      return {
        ...state,
        progress: undefined,
        errorDetail: undefined,
      };

    case 'PAUSE_SYNC':
      return {
        ...state,
        paused: true,
        errorDetail: undefined,
      };

    case 'RESUME_SYNC':
      return {
        ...state,
        paused: false,
        progress: undefined,
        errorDetail: undefined,
      };

    case 'GO_ONLINE':
      return { ...state, offline: false };

    case 'GO_OFFLINE':
      return { ...state, offline: true };

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

export default sync;
