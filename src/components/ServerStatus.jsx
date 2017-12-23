import React from 'react';
import PropTypes from 'prop-types';

import SortOfRelativeDate from './SortOfRelativeDate.jsx';

function ServerStatus(props) {
  return (
    <fieldset
      className={`${props.className || ''} server-status`}
      name="server-status">
      <legend>Sync server</legend>
      <div className="summary">
        <div className="name">{props.server}</div>
        {props.lastSyncTime ? (
          <div className="sync-time">
            Last synced <SortOfRelativeDate value={props.lastSyncTime} />
          </div>
        ) : (
          ''
        )}
      </div>
      <button className="button" name="edit-server" onClick={props.onEdit}>
        Change
      </button>
    </fieldset>
  );
}

ServerStatus.propTypes = {
  className: PropTypes.string,
  server: PropTypes.string.isRequired,
  lastSyncTime: PropTypes.instanceOf(Date),
  onEdit: PropTypes.func.isRequired,
};

export default ServerStatus;
