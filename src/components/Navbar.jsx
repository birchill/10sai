import React from 'react';
import { Link } from 'react-router';

export class Navbar extends React.Component {
  static get propTypes() {
    return {
      settingsActive: React.PropTypes.bool,
      returnLink: React.PropTypes.string,
    };
  }

  render() {
    const settingsLink = this.props.settingsActive
                         ? this.props.returnLink
                         : '/settings';

    const settingsMenuClasses = [ 'icon' ];
    if (this.props.settingsActive) {
      settingsMenuClasses.push('active');
    }

    return (
      <header>
        <hgroup>
          <h1>Tensai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        <Link id="sync-settings" to="/settings#sync">
          <div id="sync-status" className="icon"></div>
        </Link>
        <Link to={settingsLink}>
          <div id="settings-menu"
            className={settingsMenuClasses.join(' ')}></div>
        </Link>
      </header>
    );
  }
}

export default Navbar;
