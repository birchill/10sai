import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
import TokenList from './TokenList';

import { Card } from '../model';
import TagSuggester from '../edit/TagSuggester';

interface Props {
  card: Card;
  tagSuggester: TagSuggester;
  onChange?: (topic: string, value: string | string[]) => void;
}

interface State {
  tagSuggestions: string[];
  loadingTagSuggestions: boolean;
}

export class EditCardForm extends React.Component<Props> {
  state: State = {
    tagSuggestions: [],
    loadingTagSuggestions: false,
  };
  questionTextBox?: CardFaceInput;

  static get propTypes() {
    return {
      // eslint-disable-next-line react/forbid-prop-types
      card: PropTypes.object.isRequired,
      tagSuggester: PropTypes.object.isRequired,
      onChange: PropTypes.func,
    };
  }

  constructor(props: Props) {
    super(props);

    this.handlePromptChange = this.handlePromptChange.bind(this);
    this.handleAnswerChange = this.handleAnswerChange.bind(this);
    this.handleTagsChange = this.handleTagsChange.bind(this);
    this.handleTagTextChange = this.handleTagTextChange.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
  }

  componentDidMount() {
    const result = this.props.tagSuggester.getSuggestions('');

    const updatedState: Partial<State> = {};
    if (result.initialResult) {
      updatedState.tagSuggestions = result.initialResult;
    }
    updatedState.loadingTagSuggestions = !!result.asyncResult;
    this.setState(updatedState);

    if (result.asyncResult) {
      result.asyncResult
        .then(suggestions => {
          // XXX Check if we are mounted or not here
          this.setState({
            tagSuggestions: suggestions,
            loadingTagSuggestions: false,
          });
        })
        .catch(() => {
          /* Ignore, request was canceled. */
        });
    }
  }

  handlePromptChange(value: string) {
    if (this.props.onChange) {
      this.props.onChange('question', value);
    }
  }

  handleAnswerChange(value: string) {
    if (this.props.onChange) {
      this.props.onChange('answer', value);
    }
  }

  handleTagsChange(tags: string[], addedTags: string[]) {
    if (this.props.onChange) {
      this.props.onChange('tags', tags);
    }

    for (const tag of addedTags) {
      this.props.tagSuggester.recordAddedTag(tag);
    }
  }

  handleTagRemoved(tag: string, tags: string[]) {
    if (this.props.onChange) {
      this.props.onChange('tags', tags);
    }
  }

  handleTagTextChange(text: string) {
    // XXX Debounce this
    const result = this.props.tagSuggester.getSuggestions(text);

    const updatedState: Partial<State> = {};
    if (result.initialResult) {
      updatedState.tagSuggestions = result.initialResult;
    }
    updatedState.loadingTagSuggestions = !!result.asyncResult;
    this.setState(updatedState);

    if (result.asyncResult) {
      result.asyncResult
        .then(suggestions => {
          // XXX Check if we are mounted or not here
          this.setState({
            tagSuggestions: suggestions,
            loadingTagSuggestions: false,
          });
        })
        .catch(() => {
          /* Ignore, request was canceled. */
        });
    }
  }

  handleKeywordsChange(keywords: string[], addedKeywords: string[]) {
    if (this.props.onChange) {
      this.props.onChange('keywords', keywords);
    }
  }

  render() {
    return (
      <form className="form editcard-form" autoComplete="off">
        <CardFaceInput
          className="prompt"
          value={this.props.card.question || ''}
          placeholder="Prompt"
          onChange={this.handlePromptChange}
          ref={questionTextBox => {
            this.questionTextBox = questionTextBox || undefined;
          }}
        />
        <hr className="card-divider divider" />
        <CardFaceInput
          className="answer"
          value={this.props.card.answer || ''}
          placeholder="Answer"
          onChange={this.handleAnswerChange}
        />
        <div className="keywords -yellow">
          <span className="icon -key" />
          <TokenList
            className="tokens -yellow -seamless"
            tokens={this.props.card.keywords || []}
            placeholder="Keywords"
            onTokensChange={this.handleKeywordsChange}
            suggestions={['漢字', '漢', '字']}
          />
        </div>
        <div className="tags">
          <span className="icon -tag -grey" />
          <TokenList
            className="tokens -seamless"
            tokens={this.props.card.tags || []}
            placeholder="Tags"
            onTokensChange={this.handleTagsChange}
            onTextChange={this.handleTagTextChange}
            suggestions={this.state.tagSuggestions}
            loadingSuggestions={this.state.loadingTagSuggestions}
          />
        </div>
      </form>
    );
  }
}

export default EditCardForm;
