import SyncStatus from './sync-status';

// Eventually we'll localize this...
export const SyncStatusMessages = [];
SyncStatusMessages[SyncStatus.OK] = 'Sync is up to date';
SyncStatusMessages[SyncStatus.IN_PROGRESS] = 'Sync is in progress';
SyncStatusMessages[SyncStatus.PAUSED] = 'Sync is paused to date';
SyncStatusMessages[SyncStatus.OFFLINE] = 'Sync offline';
SyncStatusMessages[SyncStatus.ERROR] = 'Sync had a problem';
SyncStatusMessages[SyncStatus.NOT_CONFIGURED] = 'Sync is not configured';

export default SyncStatusMessages;
