import React from 'react';

import SyncStatusMessages from '../sync-status-messages';
import SyncServerForm from './SyncServerForm';

export class SyncSettingsPanel extends React.Component {
  static get propTypes() {
    return {
      // This should be 'symbol' once they are supported:
      // https://github.com/facebook/react/issues/4917
      syncState: React.PropTypes.any.isRequired,
      server: React.PropTypes.string.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = { editingServer: false };

    ['handleServerChange', 'handleServerChangeCancel'].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  handleServerChange() {
    this.setState({ editingServer: false });
    // XXX Call passed-in action creator to set server
    // In fact, maybe we don't even need this method?
  }

  handleServerChangeCancel() {
    this.setState({ editingServer: false });
  }

  /*
  'Sync is up-to-date'
    - server name (Change)
    - last updated
  'Sync in progress'
    - server name (Change)
    - progress bar (Cancel)
      (Detailed progress?)
  'Sync is paused'
    - server name (Change)
    - last updated
  'Sync offline'
    - server name (Change)
    - last updated
  'Sync had a problem'
    - server name (Change)
    - error message (date)
  'Sync is not configured'
    - Explanation
    - (Add a sync server)

  (Change) / (Add) button => reveals form:
    [ Server name ] (Ok) (Cancel)
    (Ok) => Try login (Clear disable form and display "trying")
            success => sync in progress
                       (triggers state change)
            fail => re-show form
                    (returns failure directly without triggering state change)
    (Cancel) Hide form
    */

  render() {
    const summary = SyncStatusMessages[this.props.syncState];

    return (
      <div className="sync-settings">
        <div className="sync-overview">
          <div className="sync-icon"></div>
          <button name="pause">Pause / Play</button>
        </div>
        <div className="sync-details">
          <h4 className="summary">{summary}</h4>
          { this.state.editingServer
            ? <div className="server-settings">
                Server name:
                <button name="change-server">Change</button>
              </div>
            : <SyncServerForm server={this.props.server}
                onSubmit={this.handleServerChange}
                onCancel={this.handleServerChangeCancel} /> }
        </div>
      </div>
    );
  }
}

export default SyncSettingsPanel;
