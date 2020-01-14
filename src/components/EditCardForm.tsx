import * as React from 'react';

import { CardFaceEditControls } from './CardFaceEditControls';
import { KeywordSuggestionProvider } from './KeywordSuggestionProvider';
import { MenuButton } from './MenuButton';
import { MenuItem } from './MenuItem';
import { MenuItemLink } from './MenuItemLink';
import { SaveStatus } from './SaveStatus';
import { TagSuggestionProvider } from './TagSuggestionProvider';
import { TokenList, TokenListInterface } from './TokenList';

import { Card } from '../model';
import { SaveState } from '../edit/reducer';
import { URLFromRoute } from '../route/router';
import { StoreError } from '../store/DataStore';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';
import { hasCommandModifier, localizeShortcut } from '../utils/keyboard';

interface Props {
  active: boolean;
  card: Partial<Card>;
  saveState: SaveState;
  saveError?: StoreError;
  canDelete: boolean;
  onChange?: (topic: string, value: string | string[]) => void;
  onDelete: () => void;
  onAddReverse: (href: string) => void;
}

export interface EditCardFormInterface {
  focus: () => void;
}

const EditCardFormImpl: React.FC<Props> = (props, ref) => {
  const cardControlsRef = React.useRef<CardFaceEditControls>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (!cardControlsRef.current) {
          return;
        }

        cardControlsRef.current.focus();
      },
    }),
    [cardControlsRef.current]
  );

  const [keywordsText, setKeywordsText] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');

  const addReverseLink = getAddReverseLink(props);
  const keywordSuggestions = KeywordSuggester.getSuggestionsFromCard(
    props.card
  );

  const onCardChange = React.useCallback(
    (field: 'front' | 'back', value: string | string[]) => {
      props.onChange && props.onChange(field, value);
    },
    [props.onChange]
  );

  const keywordsTokenListRef = React.useRef<TokenListInterface>(null);
  const tagsTokenListRef = React.useRef<TokenListInterface>(null);

  const onKeywordsClick = React.useCallback(
    onTokenListClick.bind(null, keywordsTokenListRef),
    [keywordsTokenListRef]
  );
  const onTagsClick = React.useCallback(
    onTokenListClick.bind(null, tagsTokenListRef),
    [tagsTokenListRef]
  );

  const onTokenListChange = React.useCallback(
    (
      field: 'keywords' | 'tags',
      tokens: string[],
      addedTokens: string[],
      addRecentEntry: (entry: string) => void
    ) => {
      if (props.onChange) {
        props.onChange(field, tokens);
      }

      for (const token of addedTokens) {
        addRecentEntry(token);
      }
    },
    [props.onChange]
  );

  // Handle Ctrl+Shift+X for adding a reversed card.
  //
  // See notes in App.tsx for why we use the Ctrl+Shift+<Letter> pattern.
  //
  // We don't use Ctrl+Shift+R because that's the shortcut for the review
  // screen.
  //
  // We don't use Ctrl+Shift+F (flip) because we'll likely want to use that as
  // a shortcut for searching in future.
  //
  // X is close to C (for creating) so we use that for now.
  React.useEffect(() => {
    if (!props.active || !addReverseLink) {
      return;
    }

    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) {
        return;
      }

      if (e.key.toLowerCase() === 'x' && hasCommandModifier(e) && e.shiftKey) {
        props.onAddReverse(addReverseLink);
        e.preventDefault();
      }
    };

    document.documentElement.addEventListener('keydown', keyDownHandler);

    return () => {
      document.documentElement.removeEventListener('keydown', keyDownHandler);
    };
  }, [props.active, props.onAddReverse, addReverseLink]);

  const addReverseAccelerator = localizeShortcut('Ctrl+Shift+X');

  return (
    <>
      <form className="form editcard-form" autoComplete="off">
        <MenuButton
          id="card-edit-menu"
          className="button menubutton -icon -dotdotdot -grey -borderless -nolabel -large"
        >
          <MenuItemLink
            className="-iconic -add-reversed"
            label="Add reverse card"
            accelerator={addReverseAccelerator}
            disabled={!addReverseLink}
            href={addReverseLink || ''}
          />
          <MenuItem
            className="-iconic -delete"
            label="Delete"
            disabled={!props.canDelete}
            onClick={props.onDelete}
          />
        </MenuButton>
        <CardFaceEditControls
          card={props.card}
          onChange={onCardChange}
          ref={cardControlsRef}
        />
        <div
          className="keywords -yellow"
          onClick={onKeywordsClick}
          title="Words to cross-reference with notes and other resources"
        >
          <span className="icon -key" />
          <KeywordSuggestionProvider
            text={keywordsText}
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
                tokens={props.card.keywords || []}
                placeholder="Keywords"
                onTokensChange={(keywords: string[], addedKeywords: string[]) =>
                  onTokenListChange(
                    'keywords',
                    keywords,
                    addedKeywords,
                    addRecentEntry
                  )
                }
                onTextChange={setKeywordsText}
                suggestions={suggestions}
                loadingSuggestions={loading}
                ref={keywordsTokenListRef}
              />
            )}
          </KeywordSuggestionProvider>
        </div>
        <div
          className="tags"
          onClick={onTagsClick}
          title="Labels to help organize your cards"
        >
          <span className="icon -tag -grey" />
          <TagSuggestionProvider text={tagsText}>
            {(
              suggestions: string[],
              loading: boolean,
              addRecentEntry: (entry: string) => void
            ) => (
              <TokenList
                className="tokens -seamless"
                tokens={props.card.tags || []}
                placeholder="Tags"
                onTokensChange={(tags: string[], addedTags: string[]) =>
                  onTokenListChange('tags', tags, addedTags, addRecentEntry)
                }
                onTextChange={setTagsText}
                suggestions={suggestions}
                loadingSuggestions={loading}
                ref={tagsTokenListRef}
              />
            )}
          </TagSuggestionProvider>
        </div>
      </form>
      <SaveStatus
        className="savestate"
        saveState={props.saveState}
        saveError={props.saveError ? props.saveError.message : undefined}
      />
    </>
  );
};

function getAddReverseLink(props: Props): string | null {
  if (!props.card.front || !props.card.back) {
    return null;
  }

  return URLFromRoute({
    screen: 'edit-card',
    search: {
      front: props.card.back || undefined,
      back: props.card.front || undefined,
      keywords: props.card.keywords || undefined,
      tags: props.card.tags || undefined,
    },
  });
}

function onTokenListClick(
  tokenListRef: React.RefObject<TokenListInterface>,
  e: React.MouseEvent<HTMLDivElement>
) {
  if (!e.defaultPrevented && tokenListRef.current) {
    tokenListRef.current.focus();
  }
}

export const EditCardForm = React.forwardRef<EditCardFormInterface, Props>(
  EditCardFormImpl
);
