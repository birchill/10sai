import { connect } from 'react-redux';
import { Dispatch, Action } from 'redux';
import SyncSettingsPanel from './SyncSettingsPanel';
import { SyncServer } from '../sync/SyncServer';

// XXX Use actual state here
type State = any;

interface StateProps {
  syncState: symbol;
  server?: SyncServer;
  lastSyncTime?: Date;
  progress?: number;
  editingServer?: boolean;
}

const mapStateToProps = (state: State) => ({
  syncState: state.sync.state,
  server: state.sync.server,
  lastSyncTime: state.sync.lastSyncTime
    ? new Date(state.sync.lastSyncTime)
    : undefined,
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

const mapDispatchToProps = (dispatch: Dispatch<Action<any>>) => ({
  onSubmit: (server?: SyncServer) =>
    dispatch({ type: 'SET_SYNC_SERVER', server }),
  onRetry: (server?: SyncServer) => dispatch({ type: 'RETRY_SYNC', server }),
  onEdit: () => dispatch({ type: 'EDIT_SYNC_SERVER' }),
  onCancel: () => dispatch({ type: 'FINISH_EDIT_SYNC_SERVER' }),
  onPause: () => dispatch({ type: 'PAUSE_SYNC' }),
  onResume: () => dispatch({ type: 'RESUME_SYNC' }),
});

const SyncSettingsPanelContainer = connect<StateProps, DispatchProps>(
  mapStateToProps,
  mapDispatchToProps
)(SyncSettingsPanel);

export default SyncSettingsPanelContainer;
