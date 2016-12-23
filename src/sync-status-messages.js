import SyncState from './sync-states';

// Eventually we'll localize this...
export const SyncStatusMessages = [];
SyncStatusMessages[SyncState.OK] = 'Sync is up to date';
SyncStatusMessages[SyncState.IN_PROGRESS] = 'Sync is in progress';
SyncStatusMessages[SyncState.PAUSED] = 'Sync is paused';
SyncStatusMessages[SyncState.OFFLINE] = 'Sync offline';
SyncStatusMessages[SyncState.ERROR] = 'Sync had a problem';
SyncStatusMessages[SyncState.NOT_CONFIGURED] = 'Sync is not configured';

export default SyncStatusMessages;
