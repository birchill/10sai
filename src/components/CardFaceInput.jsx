import React from 'react';
import PropTypes from 'prop-types';
import { Editor, EditorState } from 'draft-js';

export class CardFaceInput extends React.Component {
  static get propTypes() {
    return {
      className: PropTypes.string,
      placeholder: PropTypes.string,
      onChange: PropTypes.func,
    };
  }

  constructor(props) {
    super(props);

    this.state = { editorState: EditorState.createEmpty(),
                   hasFocus: false };
    this.handleChange = this.handleChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  handleChange(editorState) {
    this.setState({ editorState });

    if (this.props.onChange) {
      this.props.onChange(this.state.editorState
                                    .getCurrentContent()
                                    .getPlainText());
    }
  }

  handleFocus() {
    this.setState({ hasFocus: true });
  }

  handleBlur() {
    this.setState({ hasFocus: false });
  }

  render() {
    const classes = [ this.props.className, 'cardface-input' ];
    if (this.state.hasFocus) {
      classes.push('hasFocus');
    }

    return (
      <div className={classes.join(' ')}>
        <Editor
          editorState={this.state.editorState}
          onChange={this.handleChange}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          placeholder={this.props.placeholder}
          textAlignment="center"
          stripPastedStyles />
      </div>
    );
  }
}

export default CardFaceInput;
