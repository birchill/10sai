import { SyncDisplayState } from './SyncDisplayState';

// Eventually we'll localize this...
export const SyncStatusMessages = new Map<SyncDisplayState, string>([
  [SyncDisplayState.Ok, 'Sync is up to date'],
  [SyncDisplayState.InProgress, 'Sync is in progress'],
  [SyncDisplayState.Paused, 'Sync is paused'],
  [SyncDisplayState.Offline, 'Sync offline'],
  [SyncDisplayState.Error, 'Sync had a problem'],
  [SyncDisplayState.NotConfigured, 'Sync is not configured'],
]);

export default SyncStatusMessages;
