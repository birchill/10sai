import * as React from 'react';

import { getAncestorWithClass } from '../utils/dom';
import { LoadingIndicator } from './LoadingIndicator';

export interface Props {
  className?: string;
  tokens?: string[];
  placeholder?: string;
  linkedTokens?: string[];
  linkedTooltip?: string;
  onTokensChange?: (tokens: string[], addedTokens: string[]) => void;
  onTextChange?: (text: string) => void;
  suggestions?: string[];
  loadingSuggestions?: boolean;
}

const enum FocusRegion {
  TextInput,
  Tokens,
  Suggestions,
}

interface FocusState {
  focusRegion: FocusRegion;
  focusIndex: number;
  inComponent: boolean;
}

export interface TokenListInterface {
  focus: () => void;
  updateText: (value: string) => void;
}

const TokenListImpl: React.RefForwardingComponent<TokenListInterface, Props> = (
  props,
  ref
) => {
  const rootElemRef = React.useRef<HTMLDivElement>(null);
  const textInputRef = React.useRef<HTMLInputElement>(null);
  const isComposing = React.useRef<boolean>(false);

  const [focusState, setFocusState] = React.useState<FocusState>({
    focusRegion: FocusRegion.TextInput,
    focusIndex: 0,
    inComponent: false,
  });

  const [inputText, setInputText] = React.useState<string>('');

  // A utility to set input text and fire the necessary callbacks too
  const updateText = React.useCallback(
    (value: string) => {
      const tokens = value.split(/[,、]/);

      // Make the new text the last token, if any.
      const text = tokens[tokens.length - 1];
      setInputText(text);

      // Add any extra non-empty tokens
      const addedTokens = tokens
        .slice(0, -1)
        .map(token => token.trim())
        .filter(token => token);
      if (addedTokens.length && props.onTokensChange) {
        const tokens = (props.tokens || []).concat(addedTokens);
        props.onTokensChange(tokens, addedTokens);
      }

      // We defer telling our owner until we finish composing since we don't
      // really want to suggestions to update while we're composing.
      if (!isComposing.current && props.onTextChange) {
        props.onTextChange(text);
      }
    },
    [
      props.tokens,
      props.onTokensChange,
      props.onTextChange,
      isComposing.current,
    ]
  );

  const commitText = React.useCallback(() => {
    if (!inputText) {
      return;
    }

    const addedToken = inputText;
    const tokens = (props.tokens || []).concat(addedToken);
    // Presumably we are currently focussed on the text input so we don't need
    // to update focus here.
    setInputText('');

    if (props.onTokensChange) {
      props.onTokensChange(tokens, [addedToken]);
    }
    if (props.onTextChange) {
      props.onTextChange('');
    }
  }, [inputText, props.tokens, props.onTokensChange, props.onTextChange]);

  const isPartOfComponent = React.useCallback(
    (elem: Element | null): boolean =>
      !!elem && !!rootElemRef.current && rootElemRef.current.contains(elem),
    [rootElemRef.current]
  );

  // Utility to update the focus in response to changes to focus state
  const updateFocus = React.useCallback(() => {
    if (!rootElemRef.current) {
      return;
    }

    // If the focus is not inside this widget, then don't force focus back to
    // us.
    if (!focusState.inComponent) {
      return;
    }

    // We do this DOM hackery because it saves us from having to building
    // a dynamic list of references (which is tricky because React doesn't make
    // it easy to free those references).
    const getNthTokenButton = (i: number) =>
      rootElemRef.current
        ? (rootElemRef.current.querySelector(
            `.chip:nth-of-type(${i + 1}) > .clear`
          ) as HTMLButtonElement | null)
        : null;

    const getNthSuggestionLink = (i: number) =>
      rootElemRef.current
        ? (rootElemRef.current.querySelector(
            `.suggestion-list > .item:nth-of-type(${i + 1}) > a`
          ) as HTMLAnchorElement | null)
        : null;

    switch (focusState.focusRegion) {
      case FocusRegion.TextInput:
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
        break;

      case FocusRegion.Tokens:
        const button = getNthTokenButton(focusState.focusIndex);
        if (button) {
          button.focus();
        }
        break;

      case FocusRegion.Suggestions:
        const link = getNthSuggestionLink(focusState.focusIndex);
        if (link) {
          link.focus();
        }
        break;
    }
  }, [
    rootElemRef.current,
    textInputRef.current,
    focusState.focusRegion,
    focusState.focusIndex,
    focusState.inComponent,
  ]);

  React.useLayoutEffect(updateFocus, [
    textInputRef.current,
    focusState.focusRegion,
    focusState.focusIndex,
  ]);

  React.useImperativeHandle(ref, () => ({
    focus: () => {
      setFocusState({
        focusRegion: FocusRegion.TextInput,
        focusIndex: 0,
        inComponent: true,
      });
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    },
    // This is only used for testing
    updateText,
  }));

  // Clamp the focus based on the tokens
  React.useEffect(() => {
    // Make sure the focus is in range for tokens
    if (
      focusState.focusRegion === FocusRegion.Tokens &&
      (!props.tokens || focusState.focusIndex >= props.tokens.length)
    ) {
      if (props.tokens && props.tokens.length) {
        setFocusState({ ...focusState, focusIndex: props.tokens.length - 1 });
      } else {
        setFocusState({
          ...focusState,
          focusRegion: FocusRegion.TextInput,
          focusIndex: 0,
        });
      }
    }

    // Make sure the focus is in range for suggestions
    if (
      focusState.focusRegion === FocusRegion.Suggestions &&
      (!props.suggestions || focusState.focusIndex >= props.suggestions.length)
    ) {
      if (props.suggestions && props.suggestions.length) {
        setFocusState({
          ...focusState,
          focusIndex: props.suggestions.length - 1,
        });
      } else {
        setFocusState({
          ...focusState,
          focusRegion: FocusRegion.TextInput,
          focusIndex: 0,
        });
      }
    }
  }, [props.tokens]);

  const deleteToken = React.useCallback(
    (index: number) => {
      if (!props.tokens || index >= props.tokens.length) {
        return;
      }

      const tokens = props.tokens.slice();
      tokens.splice(index, 1);

      if (props.onTokensChange) {
        props.onTokensChange(tokens, []);
      }

      // If we deleted the last token in the list, focus on the text field.
      if (
        focusState.focusRegion === FocusRegion.Tokens &&
        focusState.focusIndex >= tokens.length
      ) {
        setFocusState({
          ...focusState,
          focusRegion: FocusRegion.TextInput,
          focusIndex: 0,
        });
      } else if (focusState.focusRegion === FocusRegion.TextInput) {
        // If we got called from a mouse click on a button we might have updated
        // the DOM focus without updating our state yet so we should force the
        // focus back to the text region.
        updateFocus();
      }
    },
    [
      focusState.focusRegion,
      focusState.focusIndex,
      focusState.inComponent,
      props.tokens,
      props.onTokensChange,
    ]
  );

  const editToken = (index: number) => {
    const tokenText = (props.tokens || [])[index];
    deleteToken(index);

    setFocusState({
      ...focusState,
      focusRegion: FocusRegion.TextInput,
      focusIndex: 0,
    });
    setInputText(tokenText);

    // deleteToken will call onTokensChange but we still need to call
    // onTextChange.
    if (props.onTextChange) {
      props.onTextChange(tokenText);
    }
  };

  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLDivElement>) => {
      if (!rootElemRef.current) {
        return;
      }

      const textIndex = textInputRef.current
        ? textInputRef.current.selectionStart
        : 0;

      switch (evt.key) {
        case 'ArrowLeft':
          {
            // Track position within the text
            if (focusState.focusRegion === FocusRegion.TextInput) {
              // If we are at the far left, jump to the tokens.
              if (textIndex === 0 && props.tokens && props.tokens.length) {
                setFocusState({
                  ...focusState,
                  focusRegion: FocusRegion.Tokens,
                  focusIndex: props.tokens.length - 1,
                });
                evt.preventDefault();
              }
              return;
            }

            if (focusState.focusRegion === FocusRegion.Tokens) {
              if (focusState.focusIndex === 0) {
                return;
              }

              setFocusState({
                ...focusState,
                focusIndex: focusState.focusIndex - 1,
              });
              evt.preventDefault();
              return;
            }

            if (focusState.focusRegion === FocusRegion.Suggestions) {
              // If we're at the start pressing left should take us back to the
              // text region.
              if (focusState.focusIndex === 0) {
                setFocusState({
                  ...focusState,
                  focusRegion: FocusRegion.TextInput,
                  focusIndex: 0,
                });
                evt.preventDefault();
                return;
              }

              const suggestionIndex = focusState.focusIndex - 1;
              setFocusState({ ...focusState, focusIndex: suggestionIndex });
              evt.preventDefault();
              return;
            }
          }
          break;

        case 'ArrowRight':
          {
            if (focusState.focusRegion === FocusRegion.TextInput) {
              // If we are at the end of the text, pressing right should jump to
              // the suggestions.
              if (textIndex === inputText.length) {
                const suggestions = getSuggestionsToDisplay(props);
                if (suggestions.length) {
                  setFocusState({
                    ...focusState,
                    focusRegion: FocusRegion.Suggestions,
                    focusIndex: 0,
                  });
                  evt.preventDefault();
                }
              }
              return;
            }

            if (focusState.focusRegion === FocusRegion.Tokens) {
              // If we reach the end of the tokens, jump to the text input.
              if (
                !props.tokens ||
                focusState.focusIndex >= props.tokens.length - 1
              ) {
                setFocusState({
                  ...focusState,
                  focusRegion: FocusRegion.TextInput,
                  focusIndex: 0,
                });
                evt.preventDefault();
              } else {
                // Otherwise navigate within the set of tokens
                setFocusState({
                  ...focusState,
                  focusIndex: focusState.focusIndex + 1,
                });
                evt.preventDefault();
              }
              return;
            }

            if (focusState.focusRegion === FocusRegion.Suggestions) {
              const suggestions = getSuggestionsToDisplay(props);
              const suggestionIndex = focusState.focusIndex + 1;
              if (suggestionIndex >= suggestions.length) {
                return;
              }

              setFocusState({ ...focusState, focusIndex: suggestionIndex });
              evt.preventDefault();
              return;
            }
          }
          break;

        case 'ArrowDown':
          {
            const suggestions = getSuggestionsToDisplay(props);
            if (
              (focusState.focusRegion === FocusRegion.TextInput ||
                focusState.focusRegion === FocusRegion.Tokens) &&
              suggestions.length
            ) {
              setFocusState({
                ...focusState,
                focusRegion: FocusRegion.Suggestions,
                focusIndex: 0,
              });
              evt.preventDefault();
              return;
            }
          }
          break;

        case 'ArrowUp':
          {
            if (focusState.focusRegion === FocusRegion.Suggestions) {
              setFocusState({
                ...focusState,
                focusRegion: FocusRegion.TextInput,
                focusIndex: 0,
              });
              evt.preventDefault();
              return;
            }
          }
          break;

        case 'Backspace':
          {
            // If the user presses backspace while focussed on the suggestions we
            // should just apply it to the text region.
            if (focusState.focusRegion === FocusRegion.Suggestions) {
              setFocusState({
                ...focusState,
                focusRegion: FocusRegion.TextInput,
                focusIndex: 0,
              });
              evt.preventDefault();

              // Calling updateText rather than simply setting the state above
              // ensures we will update suggestions, if needed.
              const text = inputText.substr(0, inputText.length - 1);
              updateText(text);
              return;
            }
          }
          break;

        case 'Enter':
          {
            // If we press Enter while focussing on a token, it probably means we
            // want to edit it.
            if (focusState.focusRegion === FocusRegion.Tokens) {
              evt.preventDefault();
              editToken(focusState.focusIndex);
            }
          }
          break;

        default:
          {
            // With this one weird trick we can detect any printable characters
            // (so we can redirect them to the text entry where they were likely
            // intended to go).
            if (
              evt.key.length === 1 &&
              focusState.focusRegion === FocusRegion.Suggestions
            ) {
              setFocusState({
                ...focusState,
                focusRegion: FocusRegion.TextInput,
                focusIndex: 0,
              });
              evt.preventDefault();

              // As above, calling updateText rather than simply setting the state
              // above ensures we will update suggestions, if needed.
              const text = inputText + evt.key;
              updateText(text);
              return;
            }
          }
          break;
      }
    },
    [
      rootElemRef.current,
      textInputRef.current,
      props.tokens,
      props.suggestions,
      focusState.focusRegion,
      focusState.focusIndex,
      focusState.inComponent,
      inputText,
      updateText,
      editToken,
    ]
  );

  const onFocus = React.useCallback(
    (evt: React.FocusEvent<HTMLElement>) => {
      if (focusState.inComponent) {
        return;
      }

      setFocusState({
        ...focusState,
        inComponent: true,
      });
    },
    [focusState.focusRegion, focusState.focusIndex, focusState.inComponent]
  );

  const onBlur = React.useCallback(
    (evt: React.FocusEvent<HTMLElement>) => {
      // If the focus is still within this component we can just ignore the event.
      if (isPartOfComponent(evt.relatedTarget as Element | null)) {
        return;
      }

      // Reset the focus to point to the text field (since that's probably what
      // you want when you return to this component).
      setFocusState({
        focusRegion: FocusRegion.TextInput,
        focusIndex: 0,
        inComponent: false,
      });

      // Commit any text we were writing
      commitText();
    },
    [rootElemRef.current, commitText]
  );

  const onClick = React.useCallback((evt: React.MouseEvent<HTMLElement>) => {
    // We could call stopPropagation in each of the places where we handle click
    // events (so that we don't *also* handle them here) but that seems like
    // a layering violation in that ancestors should be able to detect if this
    // component was clicked by listening for click events.
    if (evt.defaultPrevented) {
      return;
    }
    evt.preventDefault();

    // Clicking any of the dead areas in the widget should focus the text box
    setFocusState({
      focusRegion: FocusRegion.TextInput,
      focusIndex: 0,
      inComponent: true,
    });
  }, []);

  const onTokenClick = React.useCallback(
    (evt: React.MouseEvent<HTMLSpanElement>) => {
      const chip = getAncestorWithClass(evt.target as HTMLElement, 'chip');
      if (!chip) {
        return;
      }

      const index = parseInt(chip.dataset.index!);
      editToken(index);
      evt.preventDefault();
    },
    [editToken]
  );

  const onTokenButtonClick = React.useCallback(
    (evt: React.MouseEvent<HTMLButtonElement>) => {
      const chip = getAncestorWithClass(evt.target as HTMLElement, 'chip');
      if (!chip) {
        return;
      }

      evt.preventDefault();
      evt.stopPropagation();
      const index = parseInt(chip.dataset.index!);
      deleteToken(index);
    },
    [deleteToken]
  );

  const onTokenKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLButtonElement>) => {
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        evt.preventDefault();
        // We do the actual handling of these in keyup because we don't want
        // auto-repeat behavior for these.
      }
    },
    []
  );

  const onTokenKeyUp = React.useCallback(
    (evt: React.KeyboardEvent<HTMLButtonElement>) => {
      const chip = getAncestorWithClass(evt.target as HTMLElement, 'chip');
      if (!chip) {
        return;
      }

      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        const index = parseInt(chip.dataset.index!);
        deleteToken(index);
      }
    },
    [deleteToken]
  );

  const onTextChange = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      updateText(evt.target.value);
    },
    [updateText]
  );

  const onTextCompositionStart = React.useCallback(
    (evt: React.CompositionEvent<HTMLInputElement>) => {
      isComposing.current = true;
    },
    [isComposing]
  );

  const onTextCompositionEnd = React.useCallback(
    (evt: React.CompositionEvent<HTMLInputElement>) => {
      isComposing.current = false;

      //
      // This should not be necessary but there is a difference between the order
      // of composition and input events as described here:
      //
      //  https://bugzilla.mozilla.org/show_bug.cgi?id=1305387#c8
      //
      // and:
      //
      //  https://github.com/w3c/uievents/issues/202
      //
      // As a result, on Fennec at this point this.state.text won't have been
      // updated yet and if we call props.onTextChange without updating it we
      // might re-render and clobber the incomplete input (or something like
      // that).
      //
      // If that bug ever gets resolved to match Chrome, then we can drop the
      // following two lines and use `this.props.onTextChange(this.state.text)`
      // below.
      const value = (evt.target as HTMLInputElement).value;
      updateText(value);

      if (props.onTextChange) {
        props.onTextChange(value);
      }
    },
    [isComposing, updateText, props.onTextChange]
  );

  const onTextKeyPress = React.useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        commitText();
      }
    },
    [commitText]
  );

  const onTextKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        evt.key === 'Backspace' &&
        !inputText.length &&
        props.tokens &&
        props.tokens.length
      ) {
        deleteToken(props.tokens.length - 1);

        const tokens = props.tokens ? props.tokens.slice() : [];
        const lastToken = tokens.pop() || '';

        setInputText(lastToken);

        if (props.onTokensChange) {
          props.onTokensChange(tokens, []);
        }
        if (props.onTextChange) {
          props.onTextChange(lastToken!);
        }
        // By *not* calling evt.preventDefault() here we'll end up actually
        // doing the backspace on the restored text.
        //
        // (I'm a bit unsure if that's the behaviour we want or not but
        // I *think* it is. You can't freely edit other items in the list, and
        // generally you only want to correct the _end_ of an auto-suggested
        // item since we match from the _start_. So, this behaviour might
        // change, but for now I think it's right.)
      }
    },
    [
      inputText,
      props.tokens,
      props.onTokensChange,
      props.onTextChange,
      deleteToken,
    ]
  );

  const onSuggestionClick = React.useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement>) => {
      evt.preventDefault();
      // Clobber any in-progress text because often you'll type a few
      // characters then choose a suggestion (i.e. autocomplete).
      setInputText('');
      // Focus on the text field.
      //
      // In some cases it might be more convenient to move the focus on the
      // next suggestion so you can do rapid entry of suggestions, but
      // generally it seems like you want to enter some text. If rapid entry
      // of multiple initial suggestions is common, perhaps we can distinguish
      // between the case where there is text in the text box and when there
      // is not.
      setFocusState({
        focusRegion: FocusRegion.TextInput,
        focusIndex: 0,
        inComponent: true,
      });
      // Explicitly update focus. We need to do this because if the focus was
      // already on the text region, then the layout effect to update the focus
      // will not run.
      updateFocus();

      if (props.onTokensChange) {
        const suggestion = (evt.target as HTMLAnchorElement).dataset
          .suggestion!;
        const tokens = (props.tokens || []).concat(suggestion);
        props.onTokensChange(tokens, [suggestion]);
      }
      if (props.onTextChange) {
        props.onTextChange('');
      }
    },
    [props.tokens, props.onTokensChange, props.onTextChange]
  );

  const classes = ['token-list', props.className];
  const placeholder = props.placeholder || '';
  const suggestions = getSuggestionsToDisplay(props);
  const suggestionsLabel = suggestions.length ? 'e.g.' : '';

  return (
    <div
      className={classes.join(' ')}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      ref={rootElemRef}
    >
      {(props.tokens || []).map((token, i) => {
        const linked =
          props.linkedTokens &&
          props.linkedTokens
            .map(token => token.toLowerCase())
            .includes(token.toLowerCase());
        let chipClassName = 'chip';
        if (linked) {
          chipClassName += ' -linked';
        }
        const tooltip = (linked && props.linkedTooltip) || undefined;
        return (
          <span
            key={i}
            className={chipClassName}
            title={tooltip}
            onClick={onTokenClick}
            data-index={i}
          >
            <span className="label">{token}</span>
            <button
              className="clear"
              aria-label="Delete"
              onClick={onTokenButtonClick}
              onKeyDown={onTokenKeyDown}
              onKeyUp={onTokenKeyUp}
              tabIndex={-1}
            >
              &#x2715;
            </button>
          </span>
        );
      })}
      <input
        className="textentry"
        type="text"
        value={inputText}
        placeholder={placeholder}
        onChange={onTextChange}
        onCompositionStart={onTextCompositionStart}
        onCompositionEnd={onTextCompositionEnd}
        onKeyPress={onTextKeyPress}
        onKeyDown={onTextKeyDown}
        tabIndex={focusState.focusRegion === FocusRegion.TextInput ? 0 : -1}
        ref={textInputRef}
      />
      <div
        className={
          'suggestions' + (props.loadingSuggestions ? ' -loading' : '')
        }
        aria-live="assertive"
        aria-atomic="true"
      >
        <label className="label">{suggestionsLabel}</label>
        {suggestions.length ? (
          <ul className="suggestion-list" hidden={!suggestions.length}>
            {suggestions.map((suggestion, index) =>
              renderSuggestion({
                suggestion,
                textToMatch: inputText,
                key: index,
                onClick: onSuggestionClick,
              })
            )}
          </ul>
        ) : null}
        {props.loadingSuggestions ? <LoadingIndicator /> : ''}
      </div>
    </div>
  );
};

function getSuggestionsToDisplay(props: Props): string[] {
  const uniqueSuggestions = new Set(props.suggestions);
  const tokensInUse = new Set(props.tokens);
  return [...new Set([...uniqueSuggestions].filter(x => !tokensInUse.has(x)))];
}

function renderSuggestion({
  suggestion,
  textToMatch,
  key,
  onClick,
}: {
  suggestion: string;
  textToMatch: string;
  key: number;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <li className="item" key={key}>
      <a href="#" data-suggestion={suggestion} onClick={onClick} tabIndex={-1}>
        {textToMatch.length &&
        suggestion.toLowerCase().startsWith(textToMatch.toLowerCase()) ? (
          <React.Fragment key={key}>
            <mark>{suggestion.substring(0, textToMatch.length)}</mark>
            {suggestion.substring(textToMatch.length)}
          </React.Fragment>
        ) : (
          suggestion
        )}
      </a>
    </li>
  );
}

export const TokenList = React.forwardRef<TokenListInterface, Props>(
  TokenListImpl
);
