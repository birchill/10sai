import { connect } from 'react-redux';
import { setSyncServer } from '../actions';
import SyncSettingsPanel from './SyncSettingsPanel.jsx';

const mapStateToProps =
  state => ({ syncState: state.sync.state,
              server: state.settings.syncServer.server || '',
              errorDetail: state.sync.errorDetail });
const mapDispatchToProps = (dispatch, ownProps) => (
  {
    onSubmit: syncServer => {
      dispatch(setSyncServer(syncServer, ownProps.settings, ownProps.cards));
    },
    onPause: () => {
      // TODO
    },
  });

const SyncSettingsPanelContainer =
  connect(mapStateToProps, mapDispatchToProps)(SyncSettingsPanel);

export default SyncSettingsPanelContainer;
