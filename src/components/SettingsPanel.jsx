import React from 'react';

export class SettingsPanel extends React.Component {
  render() {
    return (
      <div>
        <h3>Sync</h3>
        <input type="button" value="Add sync server"
          className="link-button"></input>
      </div>
    );
  }
}

export default SettingsPanel;
