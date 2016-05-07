import React from 'react';

import LocalSyncSettings from './LocalSyncSettings.jsx';

export class SettingsPanel extends React.Component {
  render() {
    return (
      <div>
        <h3>Sync</h3>
        <LocalSyncSettings />
      </div>
    );
  }
}

export default SettingsPanel;
