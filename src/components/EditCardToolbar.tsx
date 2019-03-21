import * as React from 'react';

import { Link } from './Link';

export const EditCardToolbar: React.FC<{}> = props => {
  return (
    <nav className="buttons tool-bar editcard-toolbar">
      <div>
        <Link
          href="/cards/new"
          className="add button -icon -plus -borderless"
          title="New card (Ctrl+Shift+C)"
          active
        >
          New
        </Link>
      </div>
      <div>
        <Link
          href="/"
          className="close button -icon -close -borderless"
          direction="backwards"
        >
          Done
        </Link>
      </div>
    </nav>
  );
};
