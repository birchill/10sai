import * as React from 'react';

import { Link } from './Link';

interface Props {
  canDelete: boolean;
  onDelete: () => void;
}

export class EditCardToolbar extends React.PureComponent<Props> {
  render() {
    return (
      <nav className="buttons tool-bar editcard-toolbar">
        <div>
          <button
            className="button delete -icon -delete -borderless"
            disabled={!this.props.canDelete}
            onClick={this.props.onDelete}
          >
            Discard
          </button>
        </div>
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
  }
}
