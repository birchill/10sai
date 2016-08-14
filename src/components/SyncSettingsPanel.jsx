import React from 'react';

import SyncState from '../sync-states';
import SyncStatusMessages from '../sync-status-messages';
import SyncServerForm from './SyncServerForm.jsx';

export class SyncSettingsPanel extends React.Component {
  static get propTypes() {
    return {
      syncState: React.PropTypes.symbol.isRequired,
      server: React.PropTypes.string.isRequired,
      onSubmit: React.PropTypes.func.isRequired,
      onPause: React.PropTypes.func.isRequired,
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
    this.props.onPause();
  }

  render() {
    const summary = this.state.editingServer
                  ? 'Configure sync server'
                  : SyncStatusMessages[this.props.syncState];

    const existingServer =
      this.props.syncState === SyncState.NOT_CONFIGURED
      ? <div>
          <p className="explanation">Adding a sync server lets you
            access your cards from another computer, phone, or tablet.
          </p>
          <button name="edit-server" className="action primary"
            onClick={this.handleEditServer}>Add a sync server</button>
        </div>
      : <div className="server-settings">
          Server name: {this.props.server}
          <button name="edit-server"
            onClick={this.handleEditServer}>Change</button>
        </div>;

    return (
      <div className="sync-settings summary-panel">
        <div className="sync-overview">
          <div className="sync-icon"></div>
          <button name="pause">Pause</button>
        </div>
        <div className="sync-details">
          <h4 className="summary">{summary}</h4>
          { this.props.syncState === SyncState.IN_PROGRESS &&
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
