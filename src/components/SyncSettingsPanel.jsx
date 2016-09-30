import React from 'react';

import SyncState from '../sync-states';
import SyncStatusMessages from '../sync-status-messages';

import LastUpdatedLabel from './LastUpdatedLabel.jsx';
import SyncServerForm from './SyncServerForm.jsx';

function translateError(error) {
  if (error instanceof SyntaxError) {
    return 'Couldn\'t understand server\'s response. Not a sync server?';
  }

  if (typeof error.status === 'number' &&
      error.status === 0) {
    return (<div>
              <p>
                Network error. Some possible causes might be:
              </p>
              <ul>
                <li>The server name was misspelled</li>
                <li>The server has not been set up to <a
                  href="https://github.com/pouchdb/add-cors-to-couchdb">support
                  cross-origin access</a></li>
                <li>The server is temporarily offline</li>
              </ul>
            </div>);
  }

  console.log(error);
  return 'Unknown error';
}

export class SyncSettingsPanel extends React.Component {
  static get propTypes() {
    return {
      syncState: React.PropTypes.symbol.isRequired,
      server: React.PropTypes.string.isRequired,
      onSubmit: React.PropTypes.func.isRequired,
      onPause: React.PropTypes.func.isRequired,
      lastUpdateTime: React.PropTypes.instanceOf(Date),
      errorDetail: React.PropTypes.object,
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

    const lastUpdated = [ SyncState.OK,
                          SyncState.PAUSED,
                          SyncState.ERROR,
                          SyncState.OFFLINE ]
                        .indexOf(this.props.syncState) === -1 ||
                        <LastUpdatedLabel
                          updateTime={this.props.lastUpdateTime} />;

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

    const errorDetail =
      this.props.syncState !== SyncState.ERROR ||
      <div className="error-panel">
        <div className="error-details">{
          translateError(this.props.errorDetail)}</div>
        <button name="retry">Retry</button>
      </div>;

    return (
      <div className="sync-settings summary-panel">
        <div className="sync-overview">
          <div className="sync-icon"></div>
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
            ? <div>
                { errorDetail }
                { lastUpdated }
                { existingServer }
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
