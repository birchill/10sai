import * as React from 'react';

import { SortOfRelativeDate } from './SortOfRelativeDate';

interface Props {
  className?: string | null;
  server: string;
  lastSyncTime?: Date | null;
  onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const ServerStatus: React.SFC<Props> = (props: Props) => {
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
