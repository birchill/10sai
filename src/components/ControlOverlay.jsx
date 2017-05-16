import React from 'react';
import PropTypes from 'prop-types';

function ControlOverlay(props) {
  return (
    <div className="control-overlay">
      <div className="buttons">
        {props.children}
      </div>
    </div>
  );
}

ControlOverlay.propTypes = {
  children: PropTypes.node,
};

export default ControlOverlay;
