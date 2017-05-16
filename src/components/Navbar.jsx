import React from 'react';
import PropTypes from 'prop-types';

import SyncState from '../sync-states';
import Link from './Link.jsx';

export class Navbar extends React.Component {
  static get propTypes() {
    return {
      syncState: PropTypes.symbol.isRequired,
      settingsActive: PropTypes.bool,
      currentScreenLink: PropTypes.string,
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
    const settingsLink = this.props.settingsActive
                         ? this.props.currentScreenLink
                         : '/settings';
    let settingsClass = 'nav-icon -selectable -settings';
    if (this.props.settingsActive) {
      settingsClass += ' -active';
    }

    return (
      <header className="nav-bar">
        <hgroup className="app-title">
          <h1 className="appname">Tensai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        { this.renderSyncIcon() }
        <Link href={settingsLink}>
          <div id="settings-menu" className={settingsClass} />
        </Link>
      </header>
    );
  }
}

export default Navbar;
