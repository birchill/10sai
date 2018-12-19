import * as React from 'react';

import { SyncDisplayState } from '../sync/SyncDisplayState';
import { Link } from './Link';

interface Props {
  syncState: SyncDisplayState;
}

export class Navbar extends React.PureComponent<Props> {
  renderSyncIcon() {
    if (this.props.syncState === SyncDisplayState.NotConfigured) {
      return null;
    }

    const syncClasses = [];
    syncClasses[SyncDisplayState.Ok] = '-ok';
    syncClasses[SyncDisplayState.InProgress] = '-inprogress';
    syncClasses[SyncDisplayState.Paused] = '-paused';
    syncClasses[SyncDisplayState.Offline] = '-offline';
    syncClasses[SyncDisplayState.Error] = '-error';

    const syncClass = `nav-icon -sync ${syncClasses[this.props.syncState]}`;

    return (
      <Link id="sync-settings" href="/settings#sync">
        <div id="sync-status" className={syncClass}>
          <div className="overlay" />
        </div>
      </Link>
    );
  }

  render() {
    return (
      <header className="nav-bar">
        <hgroup className="app-title">
          <h1 className="appname">10sai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        {this.renderSyncIcon()}
        <Link href="/settings">
          <div id="settings-menu" className="nav-icon -selectable -settings" />
        </Link>
      </header>
    );
  }
}
