import React from 'react';
import PropTypes from 'prop-types';

import SyncState from '../sync-states';
import Link from './Link.jsx';

export class Navbar extends React.Component {
  static get propTypes() {
    return {
      syncState: PropTypes.symbol.isRequired,
    };
  }

  renderSyncIcon() {
    if (this.props.syncState === SyncState.NOT_CONFIGURED) {
      return null;
    }

    const syncClasses = [];
    syncClasses[SyncState.OK] = '-ok';
    syncClasses[SyncState.IN_PROGRESS] = '-inprogress';
    syncClasses[SyncState.PAUSED] = '-paused';
    syncClasses[SyncState.OFFLINE] = '-offline';
    syncClasses[SyncState.ERROR] = '-error';

    const syncClass = `nav-icon -sync ${syncClasses[this.props.syncState]}`;

    return (
      <Link id="sync-settings" href="/settings#sync">
        <div id="sync-status" className={syncClass}>
          <div className="overlay" />
        </div>
      </Link>);
  }

  render() {
    return (
      <header className="nav-bar">
        <hgroup className="app-title">
          <h1 className="appname">Tensai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        { this.renderSyncIcon() }
        <Link href="/settings">
          <div id="settings-menu" className="nav-icon -selectable -settings" />
        </Link>
      </header>
    );
  }
}

export default Navbar;
