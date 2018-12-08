import { SyncServer } from './SyncServer';

export type SyncAction =
  | SetSyncServerAction
  | UpdateSyncServerAction
  | UpdateSyncProgressAction
  | FinishSyncAction
  | NotifySyncErrorAction
  | RetrySyncAction
  | PauseSyncAction
  | ResumeSyncAction
  | GoOnlineAction
  | GoOfflineAction
  | EditSyncServerAction
  | FinishEditSyncServerAction;

export interface SetSyncServerAction {
  type: 'SET_SYNC_SERVER';
  server: SyncServer | undefined;
}

export function setSyncServer(
  server: SyncServer | undefined
): SetSyncServerAction {
  return {
    type: 'SET_SYNC_SERVER',
    server,
  };
}

export interface UpdateSyncServerAction {
  type: 'UPDATE_SYNC_SERVER';
  server: SyncServer | undefined;
  lastSyncTime: Date | undefined;
  paused: boolean;
}

export function updateSyncServer(options: {
  server: SyncServer | undefined;
  lastSyncTime: Date | undefined;
  paused: boolean;
}): UpdateSyncServerAction {
  return {
    type: 'UPDATE_SYNC_SERVER',
    ...options,
  };
}

export interface UpdateSyncProgressAction {
  type: 'UPDATE_SYNC_PROGRESS';
  progress: number | null;
}

export function updateSyncProgress(
  progress: number | null
): UpdateSyncProgressAction {
  return {
    type: 'UPDATE_SYNC_PROGRESS',
    progress,
  };
}

export interface FinishSyncAction {
  type: 'FINISH_SYNC';
  lastSyncTime: Date;
}

export function finishSync(lastSyncTime: Date): FinishSyncAction {
  return {
    type: 'FINISH_SYNC',
    lastSyncTime,
  };
}

export interface NotifySyncErrorAction {
  type: 'NOTIFY_SYNC_ERROR';
  details: any;
}

export function notifySyncError(errorDetail: any): NotifySyncErrorAction {
  return {
    type: 'NOTIFY_SYNC_ERROR',
    details: errorDetail,
  };
}

export interface RetrySyncAction {
  type: 'RETRY_SYNC';
}

export function retrySync(): RetrySyncAction {
  return { type: 'RETRY_SYNC' };
}

export interface PauseSyncAction {
  type: 'PAUSE_SYNC';
}

export function pauseSync(): PauseSyncAction {
  return { type: 'PAUSE_SYNC' };
}

export interface ResumeSyncAction {
  type: 'RESUME_SYNC';
}

export function resumeSync(): ResumeSyncAction {
  return { type: 'RESUME_SYNC' };
}

export interface GoOnlineAction {
  type: 'GO_ONLINE';
}

export function goOnline(): GoOnlineAction {
  return { type: 'GO_ONLINE' };
}

export interface GoOfflineAction {
  type: 'GO_OFFLINE';
}

export function goOffline(): GoOfflineAction {
  return { type: 'GO_OFFLINE' };
}

// XXX Move this to React state
export interface EditSyncServerAction {
  type: 'EDIT_SYNC_SERVER';
}

export function editSyncServer(): EditSyncServerAction {
  return { type: 'EDIT_SYNC_SERVER' };
}

// XXX Move this to React state
export interface FinishEditSyncServerAction {
  type: 'FINISH_EDIT_SYNC_SERVER';
}

export function finishEditSyncServer(): FinishEditSyncServerAction {
  return { type: 'FINISH_EDIT_SYNC_SERVER' };
}
