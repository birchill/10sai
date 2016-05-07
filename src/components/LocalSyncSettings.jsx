import { connect } from 'react-redux';

import SyncSettings from './SyncSettings.jsx';

const mapStateToProps = state => ({ syncState: state.sync.state });
const LocalSyncSettings = connect(mapStateToProps)(SyncSettings);

export default LocalSyncSettings;
