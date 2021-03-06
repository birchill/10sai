import { AppState } from '../reducer';
import { SyncServer } from './SyncServer';

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

export const getServer = (state: AppState): SyncServer | undefined =>
  normalizeServer(state.sync.server);
export const getPaused = (state: AppState): boolean => state.sync.paused;
export const getOffline = (state: AppState): boolean => state.sync.offline;
export const getLastSyncTimeAsNumber = (state: AppState): number | undefined =>
  state.sync.lastSyncTime ? state.sync.lastSyncTime.getTime() : undefined;
