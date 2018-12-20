import { connect } from 'react-redux';
import { Dispatch } from 'redux';

import { SyncSettingsPanel } from './SyncSettingsPanel';
import { SyncServer } from '../sync/SyncServer';
import {
  getSyncDisplayState,
  SyncDisplayState,
} from '../sync/SyncDisplayState';
import * as Actions from '../actions';
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

const mapDispatchToProps = (dispatch: Dispatch<Actions.Action>) => ({
  onSubmit: (server?: SyncServer) => dispatch(Actions.setSyncServer(server)),
  onRetry: () => dispatch(Actions.retrySync()),
  onEdit: () => dispatch(Actions.editSyncServer()),
  onCancel: () => dispatch(Actions.finishEditSyncServer()),
  onPause: () => dispatch(Actions.pauseSync()),
  onResume: () => dispatch(Actions.resumeSync()),
});

export const SyncSettingsPanelContainer = connect<StateProps, DispatchProps>(
  mapStateToProps,
  mapDispatchToProps
)(SyncSettingsPanel);
