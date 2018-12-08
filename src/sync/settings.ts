import { SyncServer } from './SyncServer';

export interface SyncServerSetting {
  server: SyncServer | undefined;
  lastSyncTime?: Date;
  paused?: boolean;
}
