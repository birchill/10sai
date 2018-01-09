import React from 'react';
import PropTypes from 'prop-types';

import SyncState from '../sync-states';
import SyncStatusMessages from '../sync-status-messages';

import SyncServerForm from './SyncServerForm.jsx';
import ServerStatus from './ServerStatus.jsx';

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
        <p>Network error. Some possible causes might be:</p>
        <ul>
          <li>The server name was misspelled</li>
          <li>
            The server has not been set up to{' '}
            <a
              href="https://github.com/pouchdb/add-cors-to-couchdb"
              target="_blank"
              rel="noopener noreferrer">
              support cross-origin access
            </a>
          </li>
          <li>The server is temporarily offline</li>
        </ul>
      </div>
    );
  }

  if (typeof error.status === 'number' && error.status === 404) {
    return <p>Sync server not found</p>;
  }

  if (typeof error.message === 'string') {
    return <p>{error.message}</p>;
  }

  console.error(error);
  return <p>Unknown error</p>;
}

export class SyncSettingsPanel extends React.PureComponent {
  static get propTypes() {
    return {
      syncState: PropTypes.symbol.isRequired,
      server: PropTypes.shape({
        name: PropTypes.string,
        username: PropTypes.string,
        password: PropTypes.string,
      }),
      lastSyncTime: PropTypes.instanceOf(Date),
      // eslint-disable-next-line react/forbid-prop-types
      errorDetail: PropTypes.object,
      progress: PropTypes.number,
      editingServer: PropTypes.bool,
      onSubmit: PropTypes.func.isRequired,
      onRetry: PropTypes.func.isRequired,
      onEdit: PropTypes.func.isRequired,
      onCancel: PropTypes.func.isRequired,
      onPause: PropTypes.func.isRequired,
      onResume: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    [
      'handleEditServer',
      'handleServerChange',
      'handleServerChangeCancel',
      'handlePause',
      'handleResume',
      'handleRetry',
      'handleKeyDown',
    ].forEach(handler => {
      this[handler] = this[handler].bind(this);
    });
  }

  componentDidMount() {
    if (this.props.editingServer) {
      document.addEventListener('keydown', this.handleKeyDown, {
        capture: true,
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.editingServer && !prevProps.editingServer) {
      document.addEventListener('keydown', this.handleKeyDown, {
        capture: true,
      });
    } else if (!this.props.editingServer && prevProps.editingServer) {
      document.removeEventListener('keydown', this.handleKeyDown, {
        capture: true,
      });
    }
  }

  componentWillUnmount() {
    if (this.props.editingServer) {
      document.removeEventListener('keydown', this.handleKeyDown, {
        capture: true,
      });
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
      <ServerStatus
        className="server"
        server={server}
        lastSyncTime={this.props.lastSyncTime}
        onEdit={this.handleEditServer}
      />
    );
  }

  renderOkOrOffline() {
    return (
      <React.Fragment>
        <button
          className="-primary -icon -pause -center"
          onClick={this.handlePause}>
          Pause
        </button>
        {this.renderServerInputBox()}
      </React.Fragment>
    );
  }

  renderInProgress() {
    return (
      <React.Fragment>
        <progress
          className="progress"
          value={this.props.progress} />
        <button
          className="-primary -center"
          name="cancel-sync"
          onClick={this.handlePause}>
          Cancel
        </button>
      </React.Fragment>
    );
  }

  renderPaused() {
    return (
      <React.Fragment>
        <button
          className="-primary -center -icon -play"
          onClick={this.handleResume}>
          Resume
        </button>
        {this.renderServerInputBox()}
      </React.Fragment>
    );
  }

  renderNotConfigured() {
    return (
      <button
        name="edit-server"
        className="-primary"
        onClick={this.handleEditServer}>
        Add a sync server
      </button>
    );
  }

  renderError() {
    return (
      <React.Fragment>
        <div className="error-panel">
          <div className="error-details">
            {translateError(this.props.errorDetail)}
          </div>
          <button
            className="-primary -center"
            name="retry"
            onClick={this.handleRetry}>
            Retry
          </button>
        </div>
        {this.renderServerInputBox()}
      </React.Fragment>
    );
  }

  render() {
    const iconClasses = [];
    iconClasses[SyncState.OK] = '-uptodate';
    iconClasses[SyncState.IN_PROGRESS] = '-inprogress';
    iconClasses[SyncState.PAUSED] = '-paused';
    iconClasses[SyncState.OFFLINE] = '-offline';
    iconClasses[SyncState.ERROR] = '-error';
    iconClasses[SyncState.NOT_CONFIGURED] = '-notconfigured';

    const iconClass = this.props.editingServer
      ? iconClasses[SyncState.NOT_CONFIGURED]
      : iconClasses[this.props.syncState];

    const summary = this.props.editingServer
      ? 'Configure sync server'
      : SyncStatusMessages[this.props.syncState];

    let body;
    if (this.props.editingServer) {
      body = (
        <SyncServerForm
          className="form"
          server={this.props.server ? this.props.server.name : ''}
          username={this.props.server ? this.props.server.username : ''}
          password={this.props.server ? this.props.server.password : ''}
          onSubmit={this.handleServerChange}
          onCancel={this.handleServerChangeCancel}
        />
      );
    } else {
      const renderFns = [];
      renderFns[SyncState.OK] = this.renderOkOrOffline;
      renderFns[SyncState.IN_PROGRESS] = this.renderInProgress;
      renderFns[SyncState.PAUSED] = this.renderPaused;
      renderFns[SyncState.OFFLINE] = this.renderOkOrOffline;
      renderFns[SyncState.ERROR] = this.renderError;
      renderFns[SyncState.NOT_CONFIGURED] = this.renderNotConfigured;
      body = renderFns[this.props.syncState].call(this);
    }

    let subheading;
    if (this.props.syncState === SyncState.NOT_CONFIGURED) {
      subheading = (
        <div className="subheading">
          Adding a sync server lets you access your cards from another computer,
          phone, or tablet.
        </div>
      );
    }

    return (
      <div className="summary-panel">
        <div className={`icon -sync ${iconClass}`} />
        <h4 className="heading">{summary}</h4>
        {subheading}
        <div className="details sync-details">{body}</div>
      </div>
    );
  }
}

export default SyncSettingsPanel;
