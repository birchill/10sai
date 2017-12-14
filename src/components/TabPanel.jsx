import React from 'react';
import PropTypes from 'prop-types';

function TabPanel(props) {
  return (
    <div {...props}>
      {props.children}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
};

export default TabPanel;
