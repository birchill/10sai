import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link.jsx';
import EditState from '../edit-states';

export class EditCardToolbar extends React.Component {
  static get propTypes() {
    return {
      editState: PropTypes.symbol.isRequired,
      onClose: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);
    this.state = { editState: EditState.LOADING };
    this.handleClose = this.handleClose.bind(this);
  }

  handleClose(href, doClose) {
    this.props.onClose(doClose);
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
          <Link
            href="/cards/new"
            className="add button -icon -plus -link">Add</Link>
        </div>
        <div>
          <Link
            href="/"
            className="close-button"
            direction="backwards"
            onClick={this.handleClose}>Close</Link>
        </div>
      </nav>
    );
  }
}

export default EditCardToolbar;
