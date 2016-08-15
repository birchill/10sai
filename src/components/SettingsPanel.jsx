import React from 'react';

function SettingsPanel(props) {
  return (
    <div className="settings-panel">
      <h3>{props.heading}</h3>
      {props.children}
    </div>
  );
}

SettingsPanel.propTypes = {
  heading: React.PropTypes.string.isRequired,
  children: React.PropTypes.object,
};

export default SettingsPanel;
