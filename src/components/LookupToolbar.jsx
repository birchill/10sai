import React from 'react';

import Link from './Link.jsx';

class LookupToolbar extends React.Component {
  constructor(props) {
    super(props);
    this.assignSearchBox = elem => { this.searchBox = elem; };
  }

  focus() {
    if (this.searchBox) {
      this.searchBox.focus();
    }
  }

  render() {
    return (
      <nav className="tool-bar lookup-toolbar">
        <div className="search">
          <input
            name="q"
            type="search"
            placeholder="Lookup"
            className="search -compact -rounded -icon -search"
            spellCheck="false"
            aria-label="Lookup"
            ref={this.assignSearchBox} />
        </div>
        <Link href="/lookup/settings" className="settings-button -right">
          Settings
        </Link>
        <Link href="/" className="close-button" direction="backwards">
          Close
        </Link>
      </nav>
    );
  }
}

export default LookupToolbar;
