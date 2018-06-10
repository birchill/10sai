import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
import KeywordSuggestionProvider from './KeywordSuggestionProvider';
import TokenList from './TokenList';

import { debounce } from '../utils';
import { Card } from '../model';
import TagSuggester from '../suggestions/TagSuggester';
import { SuggestionResult } from '../suggestions/SuggestionResult';

interface Props {
  card: Partial<Card>;
  tagSuggester: TagSuggester;
  onChange?: (topic: string, value: string | string[]) => void;
}

interface SuggestionState {
  suggestions: string[];
  loading: boolean;
}

interface State {
  keywordText: string;
  tags: SuggestionState;
}

export class EditCardForm extends React.Component<Props, State> {
  state: State = {
    keywordText: '',
    tags: { suggestions: [], loading: false },
  };
  questionTextBox?: CardFaceInput;
  keywordsTokenList?: TokenList;
  tagsTokenList?: TokenList;
  debouncedUpdateSuggestions: {
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
    this.handleTagsClick = this.handleTagsClick.bind(this);
    this.handleTagsChange = this.handleTagsChange.bind(this);

    this.debouncedUpdateSuggestions = {
      tags: debounce(this.updateTagSuggestions, 200).bind(this),
    };
  }

  componentDidMount() {
    this.mounted = true;
    this.updateTagSuggestions('');
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  updateTokenSuggestions(result: SuggestionResult, list: 'tags') {
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
    this.setState({ keywordText: text });
  }

  handleKeywordsChange(
    keywords: string[],
    addedKeywords: string[],
    addRecentEntry: (entry: string) => void
  ) {
    if (this.props.onChange) {
      this.props.onChange('keywords', keywords);
    }

    for (const keyword of addedKeywords) {
      addRecentEntry(keyword);
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
          <KeywordSuggestionProvider
            text={this.state.keywordText}
            card={this.props.card}
          >
            {(
              suggestions: string[],
              loading: boolean,
              addRecentEntry: (entry: string) => void
            ) => (
              <TokenList
                className="tokens -yellow -seamless"
                tokens={this.props.card.keywords || []}
                placeholder="Keywords"
                onTokensChange={(
                  keywords: string[],
                  addedKeywords: string[]
                ) => {
                  this.handleKeywordsChange(
                    keywords,
                    addedKeywords,
                    addRecentEntry
                  );
                }}
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
