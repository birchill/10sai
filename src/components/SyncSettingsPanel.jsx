import React from 'react';

import SyncState from '../sync-states';
import SyncStatusMessages from '../sync-status-messages';

import SyncServerForm from './SyncServerForm.jsx';
import ExistingServerBox from './ExistingServerBox.jsx';

function translateError(error) {
  if (typeof error === 'undefined') {
    return <p>Unknown error</p>;
  }

  if (error instanceof SyntaxError) {
    return <p>Couldn’t understand server’s response. Not a sync server?</p>;
  }

  if (typeof error.status === 'number' && error.status === 0) {
    return (
      <div>
        <p>
          Network error. Some possible causes might be:
        </p>
        <ul>
          <li>The server name was misspelled</li>
          <li>The server has not been set up to <a
            href="https://github.com/pouchdb/add-cors-to-couchdb"
            target="_blank" rel="noopener noreferrer">support
            cross-origin access</a></li>
          <li>The server is temporarily offline</li>
        </ul>
      </div>);
  }

  if (typeof error.status === 'number' && error.status === 404) {
    return <p>Sync server not found</p>;
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
      server: React.PropTypes.shape({ name: React.PropTypes.string,
                                      username: React.PropTypes.string,
                                      password: React.PropTypes.string }),
      lastSyncTime: React.PropTypes.instanceOf(Date),
      errorDetail: React.PropTypes.object,
      progress: React.PropTypes.number,
      editingServer: React.PropTypes.bool,
      onSubmit: React.PropTypes.func.isRequired,
      onRetry: React.PropTypes.func.isRequired,
      onEdit: React.PropTypes.func.isRequired,
      onCancel: React.PropTypes.func.isRequired,
      onPause: React.PropTypes.func.isRequired,
      onResume: React.PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    [ 'handleEditServer',
      'handleServerChange',
      'handleServerChangeCancel',
      'handlePause',
      'handleResume',
      'handleRetry',
      'handleKeyDown' ].forEach(
      handler => { this[handler] = this[handler].bind(this); }
    );
  }

  componentDidMount() {
    if (this.props.editingServer) {
      document.addEventListener('keydown', this.handleKeyDown,
                                { capture: true });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.editingServer && !prevProps.editingServer) {
      document.addEventListener('keydown', this.handleKeyDown,
                                { capture: true });
    } else if (!this.props.editingServer && prevProps.editingServer) {
      document.removeEventListener('keydown', this.handleKeyDown,
                                { capture: true });
    }
  }

  componentWillUnmount() {
    if (this.props.editingServer) {
      document.removeEventListener('keydown', this.handleKeyDown,
                                   { capture: true });
    }
  }

  handleEditServer() {
    this.props.onEdit();
  }

  handleServerChange(server) {
    this.props.onSubmit(server);
  }

  handleServerChangeCancel() {
    this.props.onCancel();
  }

  handlePause() {
    this.props.onPause();
  }

  handleResume() {
    this.props.onResume();
  }

  handleRetry() {
    this.props.onRetry(this.props.server);
  }

  handleKeyDown(e) {
    if (e.keyCode && e.keyCode === 27) {
      e.stopPropagation();
      this.handleServerChangeCancel();
    }
  }

  renderServerInputBox() {
    const server = this.props.server ? this.props.server.name : '';
    return (
      <ExistingServerBox
        server={server}
        lastSyncTime={this.props.lastSyncTime}
        onEdit={this.handleEditServer} />);
  }

  renderOkOrOffline() {
    return (
      <div>
        <div><button
          name="pause-sync"
          onClick={this.handlePause}>Pause</button></div>
        { this.renderServerInputBox() }
      </div>);
  }

  renderInProgress() {
    return (
      <div>
        <progress value={this.props.progress} />
        <div><button
          name="cancel-sync"
          onClick={this.handlePause}>Cancel</button></div>
      </div>);
  }

  renderPaused() {
    return (
      <div>
        <div><button
          name="resume-sync"
          onClick={this.handleResume}>Resume</button></div>
        { this.renderServerInputBox() }
      </div>);
  }

  renderNotConfigured() {
    return (
      <div>
        <p className="explanation">Adding a sync server lets you
          access your cards from another computer, phone, or tablet.
        </p>
        <button
          name="edit-server" className="action primary"
          onClick={this.handleEditServer}>Add a sync server</button>
      </div>);
  }

  renderError() {
    return (
      <div>
        <div className="error-panel">
          <div className="error-details">{
            translateError(this.props.errorDetail)}</div>
          <button name="retry" onClick={this.handleRetry}>Retry</button>
        </div>
        { this.renderServerInputBox() }
      </div>);
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

    let body;
    if (this.props.editingServer) {
      body = (
        <SyncServerForm
          server={this.props.server ? this.props.server.name : ''}
          username={this.props.server ? this.props.server.username : ''}
          password={this.props.server ? this.props.server.password : ''}
          onSubmit={this.handleServerChange}
          onCancel={this.handleServerChangeCancel} />);
    } else {
      const renderFns = [];
      renderFns[SyncState.OK]             = this.renderOkOrOffline;
      renderFns[SyncState.IN_PROGRESS]    = this.renderInProgress;
      renderFns[SyncState.PAUSED]         = this.renderPaused;
      renderFns[SyncState.OFFLINE]        = this.renderOkOrOffline;
      renderFns[SyncState.ERROR]          = this.renderError;
      renderFns[SyncState.NOT_CONFIGURED] = this.renderNotConfigured;
      body = renderFns[this.props.syncState].call(this);
    }

    return (
      <div className={`sync-settings summary-panel ${syncClass}`}>
        <div className="sync-overview">
          <div className="icon sync-icon" />
        </div>
        <div className="sync-details">
          <h4 className="summary">{summary}</h4>
          { body }
        </div>
      </div>
    );
  }
}

export default SyncSettingsPanel;
