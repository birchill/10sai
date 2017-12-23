import React from 'react';
import PropTypes from 'prop-types';

import SortOfRelativeDate from './SortOfRelativeDate.jsx';

function ServerStatus(props) {
  return (
    <fieldset className="server-status" name="server-status">
      <legend>Sync server</legend>
      <div className="server-summary">
        <div className="server-name">{props.server}</div>
        {props.lastSyncTime ? (
          <div className="server-sync-time">
            Last synced <SortOfRelativeDate value={props.lastSyncTime} />
          </div>
        ) : (
          ''
        )}
      </div>
      <button name="edit-server" onClick={props.onEdit}>
        Change
      </button>
    </fieldset>
  );
}

ServerStatus.propTypes = {
  server: PropTypes.string.isRequired,
  lastSyncTime: PropTypes.instanceOf(Date),
  onEdit: PropTypes.func.isRequired,
};

export default ServerStatus;
