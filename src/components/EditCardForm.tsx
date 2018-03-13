import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
import TokenList from './TokenList';

import { debounce } from '../utils';
import { Card } from '../model';
import KeywordSuggester from '../edit/KeywordSuggester';
import TagSuggester from '../edit/TagSuggester';
import { SuggestionResult } from '../edit/SuggestionResult';

interface Props {
  card: Partial<Card>;
  keywordSuggester: KeywordSuggester;
  tagSuggester: TagSuggester;
  onChange?: (topic: string, value: string | string[]) => void;
}

interface SuggestionState {
  suggestions: string[];
  loading: boolean;
}

interface State {
  keywords: SuggestionState;
  tags: SuggestionState;
}

export class EditCardForm extends React.Component<Props, State> {
  state: State = {
    keywords: { suggestions: [], loading: false },
    tags: { suggestions: [], loading: false },
  };
  questionTextBox?: CardFaceInput;
  debouncedUpdateSuggestions: {
    keywords: (text: string) => void;
    tags: (text: string) => void;
  };
  // I know this is an anti-pattern but the amount of code needed to be able to
  // cancel both the debounced functions and lookup promises is much more than
  // is justified for the sake of placating the purists.
  mounted: boolean = false;

  static get propTypes() {
    return {
      // eslint-disable-next-line react/forbid-prop-types
      card: PropTypes.object.isRequired,
      keywordSuggester: PropTypes.object.isRequired,
      tagSuggester: PropTypes.object.isRequired,
      onChange: PropTypes.func,
    };
  }

  constructor(props: Props) {
    super(props);

    this.handlePromptChange = this.handlePromptChange.bind(this);
    this.handleAnswerChange = this.handleAnswerChange.bind(this);

    // Token lists
    this.handleTagsChange = this.handleTagsChange.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);

    this.debouncedUpdateSuggestions = {
      keywords: debounce(this.updateKeywordSuggestions, 200).bind(this),
      tags: debounce(this.updateTagSuggestions, 200).bind(this),
    };
  }

  componentDidMount() {
    this.mounted = true;
    this.updateKeywordSuggestions('');
    this.updateTagSuggestions('');
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  updateTokenSuggestions(result: SuggestionResult, list: keyof State) {
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
          /* Ignore, request was canceled. */
        });
    }
  }

  updateKeywordSuggestions(text: string) {
    if (!this.mounted) {
      return;
    }

    const result = this.props.keywordSuggester.getSuggestions(
      text || this.props.card
    );
    this.updateTokenSuggestions(result, 'keywords');
  }

  updateTagSuggestions(text: string) {
    if (!this.mounted) {
      return;
    }

    const result = this.props.tagSuggester.getSuggestions(text);
    this.updateTokenSuggestions(result, 'tags');
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

  handleKeywordsChange(keywords: string[], addedKeywords: string[]) {
    if (this.props.onChange) {
      this.props.onChange('keywords', keywords);
    }

    for (const keyword of addedKeywords) {
      this.props.keywordSuggester.recordAddedKeyword(keyword);
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
        <div
          className="keywords -yellow"
          title="Add words here to cross-reference with notes and other resources. For example, if this card is about &ldquo;running&rdquo;, adding &ldquo;run&rdquo; as a keyword will make it easy to find related notes, pictures, and dictionary entries."
        >
          <span className="icon -key" />
          <TokenList
            className="tokens -yellow -seamless"
            tokens={this.props.card.keywords || []}
            placeholder="Keywords"
            onTokensChange={this.handleKeywordsChange}
            onTextChange={this.debouncedUpdateSuggestions.keywords}
            suggestions={this.state.keywords.suggestions}
            loadingSuggestions={this.state.keywords.loading}
          />
        </div>
        <div
          className="tags"
          title="Add labels here to help organize your cards such as &ldquo;vocabulary&rdquo;, &ldquo;Intermediate French Conversation&rdquo;, &ldquo;Needs picture&rdquo; etc."
        >
          <span className="icon -tag -grey" />
          <TokenList
            className="tokens -seamless"
            tokens={this.props.card.tags || []}
            placeholder="Tags"
            onTokensChange={this.handleTagsChange}
            onTextChange={this.debouncedUpdateSuggestions.tags}
            suggestions={this.state.tags.suggestions}
            loadingSuggestions={this.state.tags.loading}
          />
        </div>
      </form>
    );
  }
}

export default EditCardForm;
