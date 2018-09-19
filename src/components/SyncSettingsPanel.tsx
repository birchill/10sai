import React from 'react';
import PropTypes from 'prop-types';

import SyncState from '../sync/states';
import { SyncStatusMessages } from '../sync/status-messages';
import { SyncServer } from '../sync/SyncServer';

import SyncServerForm from './SyncServerForm';
import ServerStatus from './ServerStatus';

function translateError(error: any) {
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
              rel="noopener noreferrer"
            >
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

const iconClasses = new Map<symbol, string>();
iconClasses.set(SyncState.OK, '-uptodate');
iconClasses.set(SyncState.IN_PROGRESS, '-inprogress');
iconClasses.set(SyncState.PAUSED, '-paused');
iconClasses.set(SyncState.OFFLINE, '-offline');
iconClasses.set(SyncState.ERROR, '-error');
iconClasses.set(SyncState.NOT_CONFIGURED, '-notconfigured');

interface Props {
  syncState: symbol;
  server?: SyncServer;
  lastSyncTime?: Date;
  errorDetail?: any;
  progress?: number;
  editingServer?: boolean;
  onSubmit: (server?: SyncServer) => void;
  onRetry: (server?: SyncServer) => void;
  onEdit: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
}

export class SyncSettingsPanel extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      syncState: PropTypes.symbol.isRequired,
      server: PropTypes.shape({
        name: PropTypes.string.isRequired,
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

  constructor(props: Props) {
    super(props);

    this.handleEditServer = this.handleEditServer.bind(this);
    this.handleServerChange = this.handleServerChange.bind(this);
    this.handleServerChangeCancel = this.handleServerChangeCancel.bind(this);
    this.handlePause = this.handlePause.bind(this);
    this.handleResume = this.handleResume.bind(this);
    this.handleRetry = this.handleRetry.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    if (!!this.props.editingServer) {
      document.addEventListener('keydown', this.handleKeyDown, {
        capture: true,
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
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

  handleServerChange(server?: SyncServer) {
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

  handleKeyDown(e: KeyboardEvent) {
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
          onClick={this.handlePause}
        >
          Pause
        </button>
        {this.renderServerInputBox()}
      </React.Fragment>
    );
  }

  renderInProgress() {
    return (
      <React.Fragment>
        <progress className="progress" value={this.props.progress} />
        <button
          className="-primary -center"
          name="cancel-sync"
          onClick={this.handlePause}
        >
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
          onClick={this.handleResume}
        >
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
        onClick={this.handleEditServer}
      >
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
            onClick={this.handleRetry}
          >
            Retry
          </button>
        </div>
        {this.renderServerInputBox()}
      </React.Fragment>
    );
  }

  render() {
    const iconClass = this.props.editingServer
      ? iconClasses.get(SyncState.NOT_CONFIGURED)
      : iconClasses.get(this.props.syncState);

    const summary = this.props.editingServer
      ? 'Configure sync server'
      : SyncStatusMessages.get(this.props.syncState);

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
      switch (this.props.syncState) {
        case SyncState.OK:
        case SyncState.OFFLINE:
          body = this.renderOkOrOffline();
          break;
        case SyncState.IN_PROGRESS:
          body = this.renderInProgress();
          break;
        case SyncState.PAUSED:
          body = this.renderPaused();
          break;
        case SyncState.ERROR:
          body = this.renderError();
          break;
        case SyncState.NOT_CONFIGURED:
          body = this.renderNotConfigured();
          break;
      }
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
