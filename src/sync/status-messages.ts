import SyncState from './states';

// Eventually we'll localize this...
export const SyncStatusMessages = new Map<symbol, string>([
  [SyncState.OK, 'Sync is up to date'],
  [SyncState.IN_PROGRESS, 'Sync is in progress'],
  [SyncState.PAUSED, 'Sync is paused'],
  [SyncState.OFFLINE, 'Sync offline'],
  [SyncState.ERROR, 'Sync had a problem'],
  [SyncState.NOT_CONFIGURED, 'Sync is not configured'],
]);

export default SyncStatusMessages;
