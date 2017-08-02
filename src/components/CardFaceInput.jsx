import React from 'react';
import PropTypes from 'prop-types';
import { ContentState, Editor, EditorState } from 'draft-js';

function getEditorContent(editorState) {
  return editorState.getCurrentContent().getPlainText();
}

export class CardFaceInput extends React.Component {
  static get propTypes() {
    return {
      value: PropTypes.string,
      className: PropTypes.string,
      placeholder: PropTypes.string,
      // eslint-disable-next-line react/no-unused-prop-types
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

  componentWillMount() {
    if (this.props.value) {
      this.updateValue(this.props.value);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.value !== nextProps.value) {
      this.updateValue(nextProps.value);
    }
  }

  updateValue(value) {
    // Setting editorState can reset the selection so we should avoid doing it
    // when the content hasn't changed (since it can interrupt typing).
    const currentValue = getEditorContent(this.state.editorState);
    if (currentValue === value) {
      return;
    }

    const contentState = ContentState.createFromText(value || '');
    const editorState = EditorState.push(this.state.editorState, contentState);
    this.setState({ editorState });
  }

  handleChange(editorState) {
    // We defer calling |onChange| until the state is actually updated so that
    // if that triggers a call to updateValue we can successfully recognize it
    // as a redundant change and avoid re-setting the editor state.
    this.setState((prevState, props) => {
      if (props.onChange) {
        const valueAsString = getEditorContent(editorState);
        if (valueAsString !== this.props.value) {
          props.onChange(valueAsString);
        }
      }

      return { editorState };
    });
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
