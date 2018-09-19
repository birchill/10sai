import React from 'react';
import PropTypes from 'prop-types';

import SortOfRelativeDate from './SortOfRelativeDate';

interface Props {
  className?: string;
  server: string;
  lastSyncTime?: Date;
  onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ServerStatus: React.SFC<Props> = (props: Props) => {
  return (
    <fieldset
      className={`${props.className || ''} server-status`}
      name="server-status"
    >
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
};

ServerStatus.propTypes = {
  className: PropTypes.string,
  server: PropTypes.string.isRequired,
  lastSyncTime: PropTypes.instanceOf(Date),
  onEdit: PropTypes.func.isRequired,
};

export default ServerStatus;
