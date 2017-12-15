import React from 'react';
import PropTypes from 'prop-types';

function TabPanel(props) {
  const className =
    typeof props.className === 'undefined'
      ? 'tab-panel'
      : `tab-panel ${props.className}`;
  return <div {...props} className={className}>{props.children}</div>;
}

TabPanel.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

export default TabPanel;
