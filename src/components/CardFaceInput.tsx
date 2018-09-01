import React from 'react';
import PropTypes from 'prop-types';
import {
  ContentState,
  Editor,
  EditorState,
  RichUtils,
  SelectionState,
} from 'draft-js';
import { cardKeyBindings } from '../text/key-bindings';

function getEditorContent(editorState: EditorState): string {
  return editorState.getCurrentContent().getPlainText();
}

interface Props {
  value?: string;
  className?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onSelectRange?: () => void;
}

interface State {
  editorState: EditorState;
  hasFocus: boolean;
}

export class CardFaceInput extends React.PureComponent<Props, State> {
  state: State;
  editor?: Editor;
  containerRef: React.RefObject<HTMLDivElement>;

  static get propTypes() {
    return {
      value: PropTypes.string,
      className: PropTypes.string,
      placeholder: PropTypes.string,
      onChange: PropTypes.func,
      onBlur: PropTypes.func,
    };
  }

  constructor(props: Props) {
    super(props);

    this.containerRef = React.createRef<HTMLDivElement>();

    this.state = {
      editorState: EditorState.createEmpty(),
      hasFocus: false,
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleKeyCommand = this.handleKeyCommand.bind(this);
    this.handleContainerFocus = this.handleContainerFocus.bind(this);
  }

  componentWillMount() {
    if (this.props.value) {
      this.updateValue(this.props.value);
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.value !== nextProps.value) {
      this.updateValue(nextProps.value);
    }
  }

  updateValue(value?: string) {
    // Setting editorState can reset the selection so we should avoid doing it
    // when the content hasn't changed (since it can interrupt typing).
    const currentValue = getEditorContent(this.state.editorState);
    if (currentValue === value) {
      return;
    }

    const contentState = ContentState.createFromText(value || '');
    // Ok, so insert-characters is not quite right, but it's good enough for now
    // until we implement proper rich text editing.
    const editorState = EditorState.push(
      this.state.editorState,
      contentState,
      'insert-characters'
    );
    this.setState({ editorState });
  }

  handleChange(editorState: EditorState) {
    if (
      this.props.onSelectRange &&
      !editorState.getSelection().isCollapsed() &&
      editorState.getSelection().getHasFocus() &&
      editorState.getSelection() !== this.state.editorState.getSelection()
    ) {
      this.props.onSelectRange();
    }

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
    if (this.props.onBlur) {
      this.props.onBlur();
    }
  }

  handleKeyCommand(command: string, editorState: EditorState) {
    // XXX Make this check more restrictive
    // e.g. Ctrl+Shift+B should _not_ trigger bold
    // Don't allow Ctrl+J
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      this.handleChange(newState);
      return 'handled';
    }
    return 'not-handled';
  }

  handleContainerFocus() {
    if (this.state.hasFocus) {
      return;
    }

    this.focus();
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    }
    this.setState({ hasFocus: true });
  }

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  collapseSelection() {
    const { editorState } = this.state;
    const selection: SelectionState = editorState.getSelection();
    if (selection.isCollapsed()) {
      return;
    }

    const collapsedSelection: SelectionState = selection
      .set('focusKey', selection.getAnchorKey())
      .set('focusOffset', selection.getAnchorOffset()) as SelectionState;
    // No need to call handleChange here since that's only used for detecting
    // content changes or when we newly select a range.
    this.setState({
      editorState: EditorState.acceptSelection(editorState, collapsedSelection),
    });
  }

  toggleMark(type: 'bold') {
    this.handleChange(
      RichUtils.toggleInlineStyle(this.state.editorState, 'BOLD')
    );
  }

  render() {
    const classes = [this.props.className, 'cardface-input'];
    if (this.state.hasFocus) {
      classes.push('hasFocus');
    }

    return (
      <div
        className={classes.join(' ')}
        onClick={this.handleContainerFocus}
        ref={this.containerRef}
      >
        <Editor
          editorState={this.state.editorState}
          onChange={this.handleChange}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          handleKeyCommand={this.handleKeyCommand}
          keyBindingFn={cardKeyBindings}
          placeholder={this.props.placeholder}
          textAlignment="center"
          stripPastedStyles
          ref={editor => {
            this.editor = editor || undefined;
          }}
        />
      </div>
    );
  }
}

export default CardFaceInput;
