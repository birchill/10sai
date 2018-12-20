import { connect } from 'react-redux';
import { Dispatch } from 'redux';

import { SyncSettingsPanel } from './SyncSettingsPanel';
import { SyncServer } from '../sync/SyncServer';
import {
  getSyncDisplayState,
  SyncDisplayState,
} from '../sync/SyncDisplayState';
import * as syncActions from '../sync/actions';
import { Action } from '../actions';
import { AppState } from '../reducer';

interface StateProps {
  syncState: SyncDisplayState;
  server?: SyncServer;
  lastSyncTime?: Date;
  progress: number | null | undefined;
  editingServer?: boolean;
  errorDetail?: any;
}

const mapStateToProps = (state: AppState): StateProps => ({
  syncState: getSyncDisplayState(state.sync),
  server: state.sync.server,
  lastSyncTime: state.sync.lastSyncTime,
  editingServer: !!state.sync.editingServer,
  errorDetail: state.sync.errorDetail,
  progress: state.sync.progress,
});

interface DispatchProps {
  onSubmit: (server?: SyncServer) => void;
  onRetry: (server?: SyncServer) => void;
  onEdit: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}

const mapDispatchToProps = (dispatch: Dispatch<Action>) => ({
  onSubmit: (server?: SyncServer) =>
    dispatch(syncActions.setSyncServer(server)),
  onRetry: () => dispatch(syncActions.retrySync()),
  onEdit: () => dispatch(syncActions.editSyncServer()),
  onCancel: () => dispatch(syncActions.finishEditSyncServer()),
  onPause: () => dispatch(syncActions.pauseSync()),
  onResume: () => dispatch(syncActions.resumeSync()),
});

export const SyncSettingsPanelContainer = connect<StateProps, DispatchProps>(
  mapStateToProps,
  mapDispatchToProps
)(SyncSettingsPanel);
