import { SyncServer } from './SyncServer';

export interface SyncServerSetting {
  server: SyncServer | undefined;
  // We need to represent this as a number so that we can serialize it
  lastSyncTime?: number;
  paused?: boolean;
}
