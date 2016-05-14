import React from 'react';

import SyncStatus from '../sync-status';
import SyncStatusMessages from '../sync-status-messages';
import SyncServerForm from './SyncServerForm.jsx';

export class SyncSettingsPanel extends React.Component {
  static get propTypes() {
    return {
      // This should be 'symbol' once they are supported:
      // https://github.com/facebook/react/issues/4917
      syncState: React.PropTypes.any.isRequired,
      server: React.PropTypes.string.isRequired,
      onSubmit: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = { editingServer: false };
    [ 'handleEditServer',
      'handleServerChange',
      'handleServerChangeCancel',
      'handlePause' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  handleEditServer() {
    this.setState({ editingServer: true });
  }

  handleServerChange(options) {
    this.setState({ editingServer: false });
    this.props.onSubmit(options);
  }

  handleServerChangeCancel() {
    this.setState({ editingServer: false });
  }

  handlePause() {
  }

  render() {
    const summary = SyncStatusMessages[this.props.syncState];

    const existingServer =
      this.props.syncState === SyncStatus.NOT_CONFIGURED
      ? <p className="explanation">Adding a sync server lets you
          access your cards from another computer, phone, or tablet.
          <button name="edit-server"
            onClick={this.handleEditServer}>Add a sync server</button>
        </p>
      : <div className="server-settings">
          Server name: {this.props.server}
          <button name="edit-server"
            onClick={this.handleEditServer}>Change</button>
        </div>;

    return (
      <div className="sync-settings">
        <div className="sync-overview">
          <div className="sync-icon"></div>
          <button name="pause">Pause / Play</button>
        </div>
        <div className="sync-details">
          <h4 className="summary">{summary}</h4>
          { this.props.syncState === SyncStatus.IN_PROGRESS &&
            <div>
              <progress />
              <button name="cancel-sync"
                onClick={this.handlePause}>Cancel</button>
            </div> }
          { !this.state.editingServer
            ? existingServer
            : <SyncServerForm server={this.props.server}
              onSubmit={this.handleServerChange}
              onCancel={this.handleServerChangeCancel} /> }
        </div>
      </div>
    );
  }
}

export default SyncSettingsPanel;
