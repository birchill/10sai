import React from 'react';
import SortOfRelativeDate from './SortOfRelativeDate.jsx';

function ExistingServerBox(props) {
  return (
    <fieldset name="sync-server">
      <legend>Sync server</legend>
      <div className="server-summary">
        <div className="server-name">{props.server}</div>
        { props.lastSyncTime
          ?  <div className="server-sync-time">
                Last synced <SortOfRelativeDate value={props.lastSyncTime} />
              </div>
          : '' }
      </div>
      <button name="edit-server"
        onClick={props.onEdit}>Change</button>
    </fieldset>);
}

ExistingServerBox.propTypes = {
  server: React.PropTypes.string.isRequired,
  lastSyncTime: React.PropTypes.instanceOf(Date),
  onEdit: React.PropTypes.func.isRequired,
};

export default ExistingServerBox;
