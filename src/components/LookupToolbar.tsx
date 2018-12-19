import * as React from 'react';

import { Link } from './Link';

interface Props {}

export class LookupToolbar extends React.PureComponent<Props> {
  searchBoxRef: React.RefObject<HTMLInputElement>;

  constructor(props: Props) {
    super(props);

    this.searchBoxRef = React.createRef<HTMLInputElement>();
  }

  focus() {
    if (this.searchBoxRef.current) {
      this.searchBoxRef.current.focus();
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
            spellCheck={false}
            aria-label="Lookup"
            ref={this.searchBoxRef}
          />
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
