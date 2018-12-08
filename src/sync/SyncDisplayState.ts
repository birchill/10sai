import { SyncState } from './reducer';

export const enum SyncDisplayState {
  Ok,
  InProgress,
  Paused,
  Offline,
  Error,
  NotConfigured,
}

export const getSyncDisplayState = (state: SyncState): SyncDisplayState => {
  if (!state.server) {
    return SyncDisplayState.NotConfigured;
  }
  if (state.errorDetail) {
    return SyncDisplayState.Error;
  }
  if (state.paused) {
    return SyncDisplayState.Paused;
  }
  if (state.offline) {
    return SyncDisplayState.Offline;
  }
  if (typeof state.progress !== 'undefined') {
    return SyncDisplayState.InProgress;
  }

  return SyncDisplayState.Ok;
};

export default SyncDisplayState;
