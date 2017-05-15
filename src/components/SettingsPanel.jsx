import React from 'react';
import PropTypes from 'prop-types';

function SettingsPanel(props) {
  return (
    <div className="settings-panel">
      <h3>{props.heading}</h3>
      {props.children}
    </div>
  );
}

SettingsPanel.propTypes = {
  heading: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default SettingsPanel;
