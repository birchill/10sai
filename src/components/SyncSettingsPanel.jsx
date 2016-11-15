import React from 'react';

import SyncState from '../sync-states';
import SyncStatusMessages from '../sync-status-messages';

import SortOfRelativeDate from './SortOfRelativeDate.jsx';
import SyncServerForm from './SyncServerForm.jsx';

function translateError(error) {
  if (typeof error === 'undefined') {
    return <p>Unknown error</p>;
  }

  if (error instanceof SyntaxError) {
    return <p>Couldn't understand server's response. Not a sync server?</p>;
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
                  href="https://github.com/pouchdb/add-cors-to-couchdb"
                  target="_blank" rel="noopener">support
                  cross-origin access</a></li>
                <li>The server is temporarily offline</li>
              </ul>
            </div>);
  }

  if (typeof error.message === 'string') {
    return <p>{error.message}</p>;
  }

  // eslint-disable-next-line no-console
  console.log(error);
  return <p>Unknown error</p>;
}

export class SyncSettingsPanel extends React.Component {
  static get propTypes() {
    return {
      syncState: React.PropTypes.symbol.isRequired,
      server: React.PropTypes.string.isRequired,
      onSubmit: React.PropTypes.func.isRequired,
      onEdit: React.PropTypes.func.isRequired,
      onCancel: React.PropTypes.func.isRequired,
      onPause: React.PropTypes.func.isRequired,
      lastSyncTime: React.PropTypes.instanceOf(Date),
      errorDetail: React.PropTypes.object,
      editingServer: React.PropTypes.bool,
    };
  }

  constructor(props) {
    super(props);

    [ 'handleEditServer',
      'handleServerChange',
      'handleServerChangeCancel',
      'handlePause',
      'handleRetry' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  handleEditServer() {
    this.props.onEdit();
  }

  handleServerChange(options) {
    this.props.onSubmit(options);
  }

  handleServerChangeCancel() {
    this.props.onCancel();
  }

  handlePause() {
    this.props.onPause();
  }

  handleRetry() {
    this.props.onSubmit({ server: this.props.server });
  }

  render() {
    const syncClasses = [];
    syncClasses[SyncState.OK] = 'ok';
    syncClasses[SyncState.IN_PROGRESS] = 'in-progress';
    syncClasses[SyncState.PAUSED] = 'paused';
    syncClasses[SyncState.OFFLINE] = 'offline';
    syncClasses[SyncState.ERROR] = 'error';
    syncClasses[SyncState.NOT_CONFIGURED] = 'not-configured';

    const syncClass = this.props.editingServer
                      ? syncClasses[SyncState.NOT_CONFIGURED]
                      : syncClasses[this.props.syncState];

    const summary = this.props.editingServer
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
      : <fieldset name="sync-server">
          <legend>Sync server</legend>
          <div className="server-summary">
            <div className="server-name">{this.props.server}</div>
            { this.props.lastSyncTime
              ?  <div className="server-sync-time">
                   Last synced <SortOfRelativeDate
                     value={this.props.lastSyncTime} />
                 </div>
              : '' }
          </div>
          <button name="edit-server"
            onClick={this.handleEditServer}>Change</button>
        </fieldset>;

    const errorDetail =
      this.props.syncState !== SyncState.ERROR ||
      <div className="error-panel">
        <div className="error-details">{
          translateError(this.props.errorDetail)}</div>
        <button name="retry" onClick={this.handleRetry}>Retry</button>
      </div>;

    return (
      <div className={ `sync-settings summary-panel ${syncClass}` }>
        <div className="sync-overview">
          <div className="icon sync-icon"></div>
        </div>
        <div className="sync-details">
          <h4 className="summary">{summary}</h4>
          { this.props.syncState === SyncState.IN_PROGRESS &&
            <div>
              <progress />
              <button name="cancel-sync"
                onClick={this.handlePause}>Cancel</button>
            </div> }
          { !this.props.editingServer
            ? <div>
                { errorDetail }
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
