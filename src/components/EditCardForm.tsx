import * as React from 'react';

import { CardFaceEditControls } from './CardFaceEditControls';
import { KeywordSuggestionProvider } from './KeywordSuggestionProvider';
import { MenuButton } from './MenuButton';
import { MenuItem } from './MenuItem';
import { MenuItemLink } from './MenuItemLink';
import { SaveStatus } from './SaveStatus';
import { TagSuggestionProvider } from './TagSuggestionProvider';
import { TokenList } from './TokenList';

import { Card } from '../model';
import { SaveState } from '../edit/reducer';
import { URLFromRoute } from '../route/router';
import { StoreError } from '../store/DataStore';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';

interface Props {
  card: Partial<Card>;
  saveState: SaveState;
  saveError?: StoreError;
  canDelete: boolean;
  onChange?: (topic: string, value: string | string[]) => void;
  onDelete: () => void;
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

  handleKeywordsClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleTagsClick: (e: React.MouseEvent<HTMLDivElement>) => void;

  private cardControlsRef: React.RefObject<CardFaceEditControls>;
  private keywordsTokenListRef: React.RefObject<TokenList>;
  private tagsTokenListRef: React.RefObject<TokenList>;

  constructor(props: Props) {
    super(props);

    this.cardControlsRef = React.createRef<CardFaceEditControls>();
    this.keywordsTokenListRef = React.createRef<TokenList>();
    this.tagsTokenListRef = React.createRef<TokenList>();

    this.handleCardChange = this.handleCardChange.bind(this);

    this.handleKeywordsClick = this.handleTokenListClick.bind(this, 'keywords');
    this.handleTagsClick = this.handleTokenListClick.bind(this, 'tags');

    this.handleKeywordsTextChange = this.handleKeywordsTextChange.bind(this);
    this.handleTagsTextChange = this.handleTagsTextChange.bind(this);
  }

  handleCardChange(field: 'front' | 'back', value: string | string[]) {
    this.props.onChange && this.props.onChange(field, value);
  }

  handleTokenListClick(
    tokenList: 'keywords' | 'tags',
    e: React.MouseEvent<HTMLDivElement>
  ) {
    const tokenListRef =
      tokenList === 'keywords'
        ? this.keywordsTokenListRef
        : this.tagsTokenListRef;
    if (!e.defaultPrevented && tokenListRef.current) {
      tokenListRef.current.focus();
    }
  }

  handleKeywordsTextChange(text: string) {
    this.setState({ keywordsText: text });
  }

  handleTagsTextChange(text: string) {
    this.setState({ tagsText: text });
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

    let addReverseLink: string | undefined;
    if (this.props.card.front || this.props.card.back) {
      addReverseLink = URLFromRoute({
        screen: 'edit-card',
        search: {
          front: this.props.card.back || undefined,
          back: this.props.card.front || undefined,
          keywords: this.props.card.keywords || undefined,
          tags: this.props.card.tags || undefined,
        },
      });
    }

    return (
      <>
        <form className="form editcard-form" autoComplete="off">
          <MenuButton
            id="card-edit-menu"
            className="button menubutton -icon -dotdotdot -grey -borderless -nolabel -large"
          >
            <MenuItemLink
              className="-iconic -add"
              label="Add reverse card"
              disabled={!addReverseLink}
              href={addReverseLink || ''}
            />
            <MenuItem
              className="-iconic -delete"
              label="Delete"
              disabled={!this.props.canDelete}
              onClick={this.props.onDelete}
            />
          </MenuButton>
          <CardFaceEditControls
            card={this.props.card}
            onChange={this.handleCardChange}
            ref={this.cardControlsRef}
          />
          <div
            className="keywords -yellow"
            onClick={this.handleKeywordsClick}
            title="Words to cross-reference with notes and other resources"
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
                  ref={this.keywordsTokenListRef}
                />
              )}
            </KeywordSuggestionProvider>
          </div>
          <div
            className="tags"
            onClick={this.handleTagsClick}
            title="Labels to help organize your cards"
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
                  ref={this.tagsTokenListRef}
                />
              )}
            </TagSuggestionProvider>
          </div>
        </form>
        <SaveStatus
          className="savestate"
          saveState={this.props.saveState}
          saveError={
            this.props.saveError ? this.props.saveError.message : undefined
          }
        />
      </>
    );
  }

  focus() {
    this.cardControlsRef.current && this.cardControlsRef.current.focus();
  }
}
