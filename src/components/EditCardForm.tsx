import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
import KeywordSuggestionProvider from './KeywordSuggestionProvider';
import TagSuggestionProvider from './TagSuggestionProvider';
import TokenList from './TokenList';

import { Card } from '../model';
import KeywordSuggester from '../suggestions/KeywordSuggester';
import TagSuggester from '../suggestions/TagSuggester';

interface Props {
  card: Partial<Card>;
  onChange?: (topic: string, value: string | string[]) => void;
}

interface State {
  keywordsText: string;
  tagsText: string;
}

export class EditCardForm extends React.Component<Props, State> {
  state: State = {
    keywordsText: '',
    tagsText: '',
  };
  questionTextBox?: CardFaceInput;
  keywordsTokenList?: TokenList;
  tagsTokenList?: TokenList;
  debouncedUpdateSuggestions: {
    tags: (text: string) => void;
  };

  static get propTypes() {
    return {
      // eslint-disable-next-line react/forbid-prop-types
      card: PropTypes.object.isRequired,
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
    this.handleTagsTextChange = this.handleTagsTextChange.bind(this);
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
    this.setState({ keywordsText: text });
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

  handleTagsTextChange(text: string) {
    this.setState({ tagsText: text });
  }

  handleTagsChange(
    tags: string[],
    addedTags: string[],
    addRecentEntry: (entry: string) => void
  ) {
    if (this.props.onChange) {
      this.props.onChange('tags', tags);
    }

    for (const tag of addedTags) {
      addRecentEntry(tag);
    }
  }

  render() {
    const keywordSuggestions = KeywordSuggester.getSuggestionsFromCard(
      this.props.card
    );

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
            text={this.state.keywordsText}
            defaultSuggestions={keywordSuggestions}
            includeRecentKeywords={true}
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
          <TagSuggestionProvider text={this.state.tagsText}>
            {(
              suggestions: string[],
              loading: boolean,
              addRecentEntry: (entry: string) => void
            ) => (
              <TokenList
                className="tokens -seamless"
                tokens={this.props.card.tags || []}
                placeholder="Tags"
                onTokensChange={(tags: string[], addedTags: string[]) => {
                  this.handleTagsChange(tags, addedTags, addRecentEntry);
                }}
                onTextChange={this.handleTagsTextChange}
                suggestions={suggestions}
                loadingSuggestions={loading}
                ref={e => {
                  this.tagsTokenList = e || undefined;
                }}
              />
            )}
          </TagSuggestionProvider>
        </div>
      </form>
    );
  }
}

export default EditCardForm;
