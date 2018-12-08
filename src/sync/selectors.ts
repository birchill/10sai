import { SyncState } from './reducer';
import { SyncServer } from './SyncServer';

// XXX
interface State {
  sync: SyncState;
}

export const normalizeServer = (
  server: SyncServer | undefined
): SyncServer | undefined => {
  if (!server || !server.name || !server.name.trim()) {
    return undefined;
  }
  const normalizedServer: SyncServer = { name: server.name.trim() };
  if (server.username && server.username.trim()) {
    normalizedServer.username = server.username.trim();
    normalizedServer.password =
      (server.password ? server.password.trim() : undefined) || undefined;
  }
  return normalizedServer;
};

export const getServer = (state: State): SyncServer | undefined =>
  normalizeServer(state.sync.server);
export const getPaused = (state: State): boolean => state.sync.paused;
export const getOffline = (state: State): boolean => state.sync.offline;
export const getLastSyncTime = (state: State): Date | undefined =>
  state.sync.lastSyncTime;
