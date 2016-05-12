import React from 'react';

import LocalSyncSettingsPanel from './LocalSyncSettingsPanel.jsx';

export class SettingsPanel extends React.Component {
  render() {
    return (
      <div>
        <h3>Sync</h3>
        <LocalSyncSettingsPanel />
      </div>
    );
  }
}

export default SettingsPanel;
