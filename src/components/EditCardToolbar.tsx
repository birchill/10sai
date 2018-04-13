import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link.jsx';
import EditorState from '../edit/EditorState';

interface Props {
  editorState: symbol;
  onDelete: () => void;
}

export class EditCardToolbar extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      editorState: PropTypes.symbol.isRequired,
      onDelete: PropTypes.func.isRequired,
    };
  }

  render() {
    const disabled =
      this.props.editorState === EditorState.EMPTY ||
      this.props.editorState === EditorState.LOADING ||
      this.props.editorState === EditorState.NOT_FOUND;
    return (
      <nav className="buttons tool-bar editcard-toolbar">
        <div>
          <button
            className="delete -icon -delete -link"
            disabled={disabled}
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
