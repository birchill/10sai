import { connect } from 'react-redux';

import SyncSettingsPanel from './SyncSettingsPanel.jsx';

const mapStateToProps = state => ({ syncState: state.sync.state });
const LocalSyncSettingsPanel = connect(mapStateToProps)(SyncSettingsPanel);

export default LocalSyncSettingsPanel;
