import { connect } from 'react-redux';
import SyncSettingsPanel from './SyncSettingsPanel.jsx';

const mapStateToProps =
  state => ({ syncState: state.sync.state,
              server: state.sync.server || '',
              lastSyncTime: state.sync.lastSyncTime
                            ? new Date(state.sync.lastSyncTime)
                            : null,
              editingServer: !!state.sync.editingServer,
              errorDetail: state.sync.errorDetail,
              progress: state.sync.progress });

const mapDispatchToProps = dispatch => (
  {
    onEdit: () => dispatch({ type: 'EDIT_SYNC_SERVER' }),
    onCancel: () => dispatch({ type: 'CANCEL_EDIT_SYNC_SERVER' }),
    onSubmit: server => dispatch({ type: 'SET_SYNC_SERVER', server }),
    onPause: () => {
      // TODO
    },
  });

const SyncSettingsPanelContainer =
  connect(mapStateToProps, mapDispatchToProps)(SyncSettingsPanel);

export default SyncSettingsPanelContainer;
