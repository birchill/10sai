import React from 'react';
import PropTypes from 'prop-types';
import { Note } from '../model';
import KeywordSuggester from '../suggestions/KeywordSuggester';
import NoteFrame from './NoteFrame';
import TokenList from './TokenList';
import { debounce } from '../utils';
import { ContentState, Editor, EditorState } from 'draft-js';

interface Props {
  className?: string;
  note: Partial<Note>;
  // relatedKeywords: string[];
  // keywordSuggester: KeywordSuggester;
  // onChange?: (topic: string, value: string | string[]) => void;
}

interface State {
  contentEditorState: EditorState;
  keywordSuggestions: string[];
  loadingSuggestions: boolean;
}

const getEditorContent = (editorState: EditorState): string => {
  return editorState.getCurrentContent().getPlainText();
};

export class EditNoteForm extends React.Component<Props, State> {
  state: State;
  keywordsTokenList?: TokenList;

  /*
  keywordText: string;
  debouncedUpdateSuggestions: (input: string | Partial<Note>) => void;
  */

  static get propTypes() {
    return {
      className: PropTypes.string,
      // eslint-disable-next-line react/forbid-prop-types
      note: PropTypes.object.isRequired,
      /*
      cardKeywords: PropTypes.arrayOf(PropTypes.string).isRequired,
      keywordSuggester: PropTypes.object.isRequired,
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

  constructor(props: Props) {
    super(props);

    // Content editor
    this.state = {
      contentEditorState: EditorState.createEmpty(),
      keywordSuggestions: [],
      loadingSuggestions: false,
    };
    this.handleContentChange = this.handleContentChange.bind(this);

    // Keyword suggestion feature
    this.handleKeywordsClick = this.handleKeywordsClick.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
    this.handleKeywordsTextChange = this.handleKeywordsTextChange.bind(this);
    /*
    this.debouncedUpdateSuggestions = debounce(
      this.updateKeywordSuggestions,
      200
    ).bind(this);
    */
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
    /*
    this.keywordText = text;
    this.debouncedUpdateSuggestions(text || this.props.note);
    */
  }

  handleKeywordsChange(keywords: string[], addedKeywords: string[]) {
    /*
    if (this.props.onChange) {
      this.props.onChange('keywords', keywords);
    }

    for (const keyword of addedKeywords) {
      this.props.keywordSuggester.recordAddedKeyword(keyword);
    }
    */
  }

  /*
  updateKeywordSuggestions(input: string | Partial<Note>) {
    if (!this.mounted) {
      return;
    }

    const result = this.props.keywordSuggester.getSuggestions(input);
    this.updateTokenSuggestions(result, 'keywords');
  }

  updateTokenSuggestions(result: SuggestionResult) {
    const updatedState: Partial<State> = {};
    updatedState[list] = this.state[list];
    if (result.initialResult) {
      updatedState[list]!.suggestions = result.initialResult;
    }
    updatedState[list]!.loading = !!result.asyncResult;
    // The typings for setState are just messed up.
    this.setState(updatedState as any);

    if (result.asyncResult) {
      result.asyncResult
        .then(suggestions => {
          if (!this.mounted) {
            return;
          }

          // Again, setState typings
          this.setState({
            [list]: { suggestions, loading: false },
          } as any);
        })
        .catch(() => {
          // Ignore, request was canceled.
        });
    }
  }
  */

  render() {
    let className = 'editnote-form form';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    return (
      <form className={className} autoComplete="off">
        <NoteFrame>
          <div
            className="keywords -yellow"
            onClick={this.handleKeywordsClick}
            title="Add words here to cross-reference with cards."
          >
            <span className="icon -key" />
            <TokenList
              className="tokens -yellow -seamless -inline"
              tokens={this.props.note.keywords || []}
              placeholder="Keywords"
              onTokensChange={this.handleKeywordsChange}
              onTextChange={this.handleKeywordsTextChange}
              suggestions={this.state.keywordSuggestions}
              loadingSuggestions={this.state.loadingSuggestions}
              ref={e => {
                this.keywordsTokenList = e || undefined;
              }}
            />
          </div>
          <div className="content">
            <Editor
              editorState={this.state.contentEditorState}
              onChange={this.handleContentChange}
              /*
              onFocus={this.handleFocus}
              onBlur={this.handleBlur}
              */
              placeholder="Note"
              stripPastedStyles
              /*
              ref={editor => {
                this.editor = editor || undefined;
              }}
              */
            />
          </div>
          <div className="controls">
            <button className="delete -icon -delete -link">Discard</button>
          </div>
        </NoteFrame>
      </form>
    );
  }
}

export default EditNoteForm;
