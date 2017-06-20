import React from 'react';
import PropTypes from 'prop-types';
import { Editor, EditorState } from 'draft-js';

export class CardFaceInput extends React.Component {
  static get propTypes() {
    return {
      className: PropTypes.string,
      placeholder: PropTypes.string,
    };
  }

  constructor(props) {
    super(props);

    this.state = { editorState: EditorState.createEmpty() };
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(editorState) {
    this.setState({ editorState });
  }

  render() {
    return (
      <div className={this.props.className + ' cardface-input'}>
        <Editor
          editorState={this.state.editorState}
          onChange={this.handleChange}
          placeholder={this.props.placeholder}
          textAlignment="center"
          stripPastedStyles />
      </div>
    );
  }
}

export default CardFaceInput;
