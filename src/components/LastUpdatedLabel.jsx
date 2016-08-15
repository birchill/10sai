import React from 'react';

function LastUpdatedLabel(props) {
  // XXX Format this (e.g. 20 seconds ago -- make it live update?)
  //     Needs to handle when the time is not set too
  return (<span className="last-updated">Last updated
            <time dateTime={props.updateTime}>{props.updateTime}</time>
          </span>);
}

LastUpdatedLabel.propTypes = {
  updateTime: React.PropTypes.instanceOf(Date),
};

export default LastUpdatedLabel;
