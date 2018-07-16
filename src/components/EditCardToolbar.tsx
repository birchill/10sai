import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link';

interface Props {
  canDelete: boolean;
  onDelete: () => void;
}

export class EditCardToolbar extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      canDelete: PropTypes.bool.isRequired,
      onDelete: PropTypes.func.isRequired,
    };
  }

  render() {
    return (
      <nav className="buttons tool-bar editcard-toolbar">
        <div>
          <button
            className="delete -icon -delete -link"
            disabled={!this.props.canDelete}
            onClick={this.props.onDelete}
          >
            Discard
          </button>
        </div>
        <div className="-center">
          <Link
            href="/cards/new"
            className="add button -icon -plus -link"
            active
          >
            Add
          </Link>
        </div>
        <div>
          <Link href="/" className="close-button" direction="backwards">
            Close
          </Link>
        </div>
      </nav>
    );
  }
}

export default EditCardToolbar;
