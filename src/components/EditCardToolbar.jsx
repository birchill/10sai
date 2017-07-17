import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link.jsx';
import EditState from '../edit-states';

export class EditCardToolbar extends React.Component {
  static get propTypes() {
    return {
      editState: PropTypes.symbol.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.state = { editState: EditState.LOADING };
  }

  render() {
    const disabled = this.props.editState === EditState.EMPTY ||
                     this.props.editState === EditState.LOADING ||
                     this.props.editState === EditState.NOT_FOUND;
    return (
      <nav className="buttons tool-bar editcard-toolbar">
        <div>
          <button
            className="delete -icon -delete -link"
            disabled={disabled}>Discard</button>
        </div>
        <div className="-center">
          <button
            className="add -icon -plus -link">Add</button>
        </div>
        <div>
          <Link
            href="/"
            className="close-button"
            direction="backwards">Close</Link>
        </div>
      </nav>
    );
  }
}

export default EditCardToolbar;
