import React from 'react';
import { Link } from 'react-router';

import SyncState from '../sync-states';

export class Navbar extends React.Component {
  static get propTypes() {
    return {
      syncState: React.PropTypes.symbol.isRequired,
      settingsActive: React.PropTypes.bool,
      currentScreenLink: React.PropTypes.string,
    };
  }

  renderSyncIcon() {
    if (this.props.syncState === SyncState.NOT_CONFIGURED) {
      return null;
    }

    const syncClasses = [];
    syncClasses[SyncState.OK] = 'ok';
    syncClasses[SyncState.IN_PROGRESS] = 'in-progress';
    syncClasses[SyncState.PAUSED] = 'paused';
    syncClasses[SyncState.OFFLINE] = 'offline';
    syncClasses[SyncState.ERROR] = 'error';

    const syncClass =  `icon ${syncClasses[this.props.syncState]}`;

    return (
      <Link id="sync-settings" to="/settings#sync">
        <div id="sync-status" className={syncClass}>
          <div className="overlay"></div>
        </div>
      </Link>);
  }

  render() {
    const settingsLink = this.props.settingsActive
                         ? this.props.currentScreenLink
                         : '/settings';
    const settingsClass = `icon ${this.props.settingsActive ? 'active' : ''}`;

    return (
      <header>
        <hgroup>
          <h1>Tensai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        { this.renderSyncIcon() }
        <Link to={settingsLink}>
          <div id="settings-menu" className={settingsClass}></div>
        </Link>
      </header>
    );
  }
}

export default Navbar;
