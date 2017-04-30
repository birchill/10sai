import React from 'react';

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
  children: React.PropTypes.node,
};

export default ControlOverlay;
