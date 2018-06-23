import React from 'react';
import PropTypes from 'prop-types';
import { Note } from '../model';
import NoteFrame from './NoteFrame';
import TokenList from './TokenList';
import { ContentState, Editor, EditorState } from 'draft-js';
import { KeywordSuggestionProvider } from './KeywordSuggestionProvider';

interface Props {
  className?: string;
  note: Partial<Note>;
  relatedKeywords: string[];
  // onChange?: (topic: string, value: string | string[]) => void;
}

interface State {
  contentEditorState: EditorState;
  keywordText: string;
  keywordSuggestions: string[];
  loadingSuggestions: boolean;
}

const getEditorContent = (editorState: EditorState): string => {
  return editorState.getCurrentContent().getPlainText();
};

export class EditNoteForm extends React.Component<Props, State> {
  state: State;
  editor?: Editor;
  keywordsTokenList?: TokenList;

  static get propTypes() {
    return {
      className: PropTypes.string,
      // eslint-disable-next-line react/forbid-prop-types
      note: PropTypes.object.isRequired,
      relatedKeywords: PropTypes.arrayOf(PropTypes.string).isRequired,
      /*
      onChange: PropTypes.func,
      */
    };
  }

  static getDerivedStateFromProps(
    props: Props,
    state: State
  ): Partial<State> | null {
    // Setting contentEditorState can reset the selection so we should avoid
    // doing it when the content hasn't changed (since it can interrupt typing).
    const currentContent = getEditorContent(state.contentEditorState);
    if (currentContent === props.note.content) {
      return null;
    }

    const contentState = ContentState.createFromText(props.note.content || '');
    // Ok, so insert-characters is not quite right, but it's good enough for now
    // until we implement proper rich text editing.
    const contentEditorState = EditorState.push(
      state.contentEditorState,
      contentState,
      'insert-characters'
    );
    return { contentEditorState };
  }

  formRef: React.RefObject<HTMLFormElement>;

  constructor(props: Props) {
    super(props);

    this.formRef = React.createRef<HTMLFormElement>();

    // Content editor
    this.state = {
      contentEditorState: EditorState.createEmpty(),
      keywordText: '',
      keywordSuggestions: [],
      loadingSuggestions: false,
    };
    this.handleContentClick = this.handleContentClick.bind(this);
    this.handleContentChange = this.handleContentChange.bind(this);

    // Keyword suggestion feature
    this.handleKeywordsClick = this.handleKeywordsClick.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
    this.handleKeywordsTextChange = this.handleKeywordsTextChange.bind(this);
  }

  handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!e.defaultPrevented && this.editor) {
      this.editor.focus();
    }
  }

  handleContentChange(editorState: EditorState) {
    // We defer calling |onChange| until the state is actually updated so that
    // if that triggers a call to updateValue we can successfully recognize it
    // as a redundant change and avoid re-setting the editor state.
    this.setState((prevState, props) => {
      /*
      if (props.onChange) {
        const valueAsString = getEditorContent(editorState);
        if (valueAsString !== this.props.value) {
          props.onChange(valueAsString);
        }
      }
      */

      return { contentEditorState: editorState };
    });
  }

  handleKeywordsClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!e.defaultPrevented && this.keywordsTokenList) {
      this.keywordsTokenList.focus();
    }
  }

  handleKeywordsTextChange(text: string) {
    this.setState({ keywordText: text });
  }

  handleKeywordsChange(keywords: string[], addedKeywords: string[]) {
    /*
    if (this.props.onChange) {
      this.props.onChange('keywords', keywords);
    }
    */
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    }
  }

  get form(): HTMLFormElement | null {
    return this.formRef.current;
  }

  render() {
    let className = 'editnote-form form';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <form className={className} autoComplete="off" ref={this.formRef}>
        <NoteFrame>
          <div
            className="keywords -yellow"
            onClick={this.handleKeywordsClick}
            title="Add words here to cross-reference with cards."
          >
            <span className="icon -key" />
            <KeywordSuggestionProvider
              text={this.state.keywordText}
              defaultSuggestions={this.props.relatedKeywords}
            >
              {(suggestions: string[], loading: boolean) => (
                <TokenList
                  className="tokens -yellow -seamless -inline"
                  tokens={this.props.note.keywords || ['屯所']}
                  placeholder="Keywords"
                  linkedTokens={this.props.relatedKeywords}
                  linkedTooltip="This keyword links the note to the card"
                  onTokensChange={this.handleKeywordsChange}
                  onTextChange={this.handleKeywordsTextChange}
                  suggestions={suggestions}
                  loadingSuggestions={loading}
                  ref={e => {
                    this.keywordsTokenList = e || undefined;
                  }}
                />
              )}
            </KeywordSuggestionProvider>
          </div>
          <div className="content" onClick={this.handleContentClick}>
            <Editor
              editorState={this.state.contentEditorState}
              onChange={this.handleContentChange}
              /*
              onFocus={this.handleFocus}
              onBlur={this.handleBlur}
              */
              placeholder="Note"
              stripPastedStyles
              ref={editor => {
                this.editor = editor || undefined;
              }}
            />
          </div>
          <div className="controls">
            <button className="delete -icon -delete -link -yellow">
              Discard
            </button>
          </div>
        </NoteFrame>
      </form>
    );
  }
}

export default EditNoteForm;
