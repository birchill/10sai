import * as React from 'react';

import { Link } from './Link';

export const EditCardToolbar: React.FC<{}> = props => {
  return (
    <nav className="buttons tool-bar editcard-toolbar">
      <div className="-center">
        <Link
          href="/cards/new"
          className="add button -icon -plus -borderless"
          title="Add card (Ctrl+Shift+C)"
          active
        >
          Add
        </Link>
      </div>
      <div>
        <Link
          href="/"
          className="button close-button -borderless"
          direction="backwards"
        >
          Close
        </Link>
      </div>
    </nav>
  );
};
