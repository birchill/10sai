import React from 'react';
import { Link } from 'react-router';

export class Navbar extends React.Component {
  render() {
    return (
      <header>
        <hgroup>
          <h1>Tensai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        <Link id="sync-settings" to="/settings#sync">
          <div id="sync-status" className="icon"></div>
        </Link>
        <Link to="/settings">
          <div id="settings-menu" className="icon"></div>
        </Link>
      </header>
    );
  }
}

export default Navbar;
