import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
import TokenList from './TokenList';

import { debounce } from '../utils';
import { Card } from '../model';
import KeywordSuggester from '../suggestions/KeywordSuggester';
import TagSuggester from '../suggestions/TagSuggester';
import { SuggestionResult } from '../suggestions/SuggestionResult';

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
  keywordText: string;
  keywordsTokenList?: TokenList;
  tagsTokenList?: TokenList;
  debouncedUpdateSuggestions: {
    keywords: (input: string | Partial<Card>) => void;
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
    this.handleKeywordsClick = this.handleKeywordsClick.bind(this);
    this.handleKeywordsTextChange = this.handleKeywordsTextChange.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
    this.handleTagsClick = this.handleTagsClick.bind(this);
    this.handleTagsChange = this.handleTagsChange.bind(this);

    this.debouncedUpdateSuggestions = {
      keywords: debounce(this.updateKeywordSuggestions, 200).bind(this),
      tags: debounce(this.updateTagSuggestions, 200).bind(this),
    };
  }

  componentDidMount() {
    this.mounted = true;
    this.updateKeywordSuggestions(this.props.card || this.keywordText);
    this.updateTagSuggestions('');
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  componentWillReceiveProps(nextProps: Props) {
    // If we have (or will have) card data, but there's no current text in
    // the keywords box, make sure we update the suggestions in case the card
    // data has changed.
    if (
      !this.keywordText &&
      (nextProps.card.question || nextProps.card.answer)
    ) {
      this.updateKeywordSuggestions(nextProps.card);
    }
  }

  updateTokenSuggestions(result: SuggestionResult, list: 'keywords' | 'tags') {
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

  updateKeywordSuggestions(input: string | Partial<Card>) {
    if (!this.mounted) {
      return;
    }

    const result = this.props.keywordSuggester.getSuggestions(input);
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

  handleKeywordsClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!e.defaultPrevented && this.keywordsTokenList) {
      this.keywordsTokenList.focus();
    }
  }

  handleKeywordsTextChange(text: string) {
    this.keywordText = text;
    // We only need to debounce when doing a text-lookup but we call the
    // debounced version in both cases since otherwise we can end up with the
    // non-debounced version racing with the debounced version (unless we
    // actually cancel the debounced one when doing a non-text lookup).
    this.debouncedUpdateSuggestions.keywords(text || this.props.card);
  }

  handleKeywordsChange(keywords: string[], addedKeywords: string[]) {
    if (this.props.onChange) {
      this.props.onChange('keywords', keywords);
    }

    for (const keyword of addedKeywords) {
      this.props.keywordSuggester.recordAddedKeyword(keyword);
    }
  }

  handleTagsClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!e.defaultPrevented && this.tagsTokenList) {
      this.tagsTokenList.focus();
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
          onClick={this.handleKeywordsClick}
          title="Add words here to cross-reference with notes and other resources. For example, if this card is about &ldquo;running&rdquo;, adding &ldquo;run&rdquo; as a keyword will make it easy to find related notes, pictures, and dictionary entries."
        >
          <span className="icon -key" />
          <TokenList
            className="tokens -yellow -seamless"
            tokens={this.props.card.keywords || []}
            placeholder="Keywords"
            onTokensChange={this.handleKeywordsChange}
            onTextChange={this.handleKeywordsTextChange}
            suggestions={this.state.keywords.suggestions}
            loadingSuggestions={this.state.keywords.loading}
            ref={e => {
              this.keywordsTokenList = e || undefined;
            }}
          />
        </div>
        <div
          className="tags"
          onClick={this.handleTagsClick}
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
            ref={e => {
              this.tagsTokenList = e || undefined;
            }}
          />
        </div>
      </form>
    );
  }
}

export default EditCardForm;
