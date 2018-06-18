import React from 'react';
import PropTypes from 'prop-types';

import LoadingIndicator from './LoadingIndicator';

interface Props {
  className?: string;
  tokens?: string[];
  placeholder?: string;
  onTokensChange?: (tokens: string[], addedTokens: string[]) => void;
  onTextChange?: (text: string) => void;
  suggestions?: string[];
  loadingSuggestions?: boolean;
}

enum FocusRegion {
  TextInput,
  Tokens,
  Suggestions,
}

interface State {
  text: string;
  tokens: string[];
  focusRegion: FocusRegion;
  focusIndex: number;
}

export class TokenList extends React.PureComponent<Props> {
  state: State = {
    text: '',
    tokens: [],
    focusRegion: FocusRegion.TextInput,
    focusIndex: 0,
  };
  rootElem?: HTMLDivElement;
  textInput?: HTMLInputElement;
  composing: boolean = false;

  static get propTypes() {
    return {
      className: PropTypes.string,
      tokens: PropTypes.arrayOf(PropTypes.string),
      placeholder: PropTypes.string,
      onTokensChange: PropTypes.func,
      onTextChange: PropTypes.func,
      suggestions: PropTypes.arrayOf(PropTypes.string),
      loadingSuggestions: PropTypes.bool,
    };
  }

  constructor(props: Props) {
    super(props);

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleTextCompositionStart = this.handleTextCompositionStart.bind(
      this
    );
    this.handleTextCompositionEnd = this.handleTextCompositionEnd.bind(this);
    this.handleTextKeyPress = this.handleTextKeyPress.bind(this);
    this.handleTextKeyDown = this.handleTextKeyDown.bind(this);
    this.handleTokenClick = this.handleTokenClick.bind(this);
    this.handleTokenKeyDown = this.handleTokenKeyDown.bind(this);
    this.handleTokenKeyUp = this.handleTokenKeyUp.bind(this);
    this.handleSuggestionClick = this.handleSuggestionClick.bind(this);

    this.renderSuggestion = this.renderSuggestion.bind(this);
  }

  componentWillMount() {
    this.setState({ tokens: this.props.tokens || [] });
  }

  componentWillUnmount() {
    this.composing = false;
  }

  componentWillReceiveProps(nextProps: Props) {
    const updatedState: Partial<State> = { tokens: nextProps.tokens || [] };

    // Make sure the focus is in range for tokens
    if (
      this.state.focusRegion === FocusRegion.Tokens &&
      this.state.focusIndex >= updatedState.tokens!.length
    ) {
      if (updatedState.tokens!.length) {
        updatedState.focusIndex = updatedState.tokens!.length - 1;
      } else {
        updatedState.focusRegion = FocusRegion.TextInput;
        updatedState.focusIndex = 0;
      }
    }

    // Make sure the focus is in range for suggestions
    if (
      this.state.focusRegion === FocusRegion.Suggestions &&
      (!nextProps.suggestions ||
        this.state.focusIndex >= nextProps.suggestions.length)
    ) {
      if (nextProps.suggestions && nextProps.suggestions.length) {
        updatedState.focusIndex = nextProps.suggestions.length - 1;
      } else {
        updatedState.focusRegion = FocusRegion.TextInput;
        updatedState.focusIndex = 0;
      }
    }

    this.setState(updatedState);
  }

  handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!this.rootElem) {
      return;
    }

    const inlineMode =
      this.props.className &&
      this.props.className.split(' ').includes('-inline');
    const textIndex = this.textInput ? this.textInput.selectionStart : 0;

    switch (e.key) {
      case 'ArrowLeft':
        {
          // Track position within the text
          if (this.state.focusRegion === FocusRegion.TextInput) {
            // If we are at the far left, jump to the tokens.
            if (textIndex === 0 && this.state.tokens.length) {
              this.setState(
                {
                  focusRegion: FocusRegion.Tokens,
                  focusIndex: this.state.tokens.length - 1,
                },
                () => this.updateFocus()
              );
              e.preventDefault();
            }
            return;
          }

          if (this.state.focusRegion === FocusRegion.Tokens) {
            if (this.state.focusIndex === 0) {
              return;
            }

            this.setState(
              {
                focusIndex: this.state.focusIndex - 1,
              },
              () => this.updateFocus()
            );
            e.preventDefault();
            return;
          }

          if (this.state.focusRegion === FocusRegion.Suggestions) {
            if (this.state.focusIndex === 0) {
              // If we're at the start and in inline mode, pressing left should
              // take us back to the text region.
              if (inlineMode) {
                this.setState(
                  {
                    focusRegion: FocusRegion.TextInput,
                    focusIndex: 0,
                  },
                  () => this.updateFocus()
                );
                e.preventDefault();
              }
              return;
            }
            const suggestionIndex = this.state.focusIndex - 1;
            this.setState(
              {
                focusIndex: suggestionIndex,
                text: this.suggestionsToDisplay()[suggestionIndex],
              },
              () => this.updateFocus()
            );
            e.preventDefault();
            return;
          }
        }
        break;

      case 'ArrowRight':
        {
          if (this.state.focusRegion === FocusRegion.TextInput) {
            // If we are at the end of the text and we press right in inline
            // mode, jump to the suggestions.
            if (inlineMode && textIndex === this.state.text.length) {
              this.setState(
                {
                  focusRegion: FocusRegion.Suggestions,
                  focusIndex: 0,
                },
                () => this.updateFocus()
              );
              e.preventDefault();
            }
            return;
          }

          if (this.state.focusRegion === FocusRegion.Tokens) {
            // If we reach the end of the tokens, jump to the text input.
            if (this.state.focusIndex >= this.state.tokens.length - 1) {
              this.setState(
                {
                  focusRegion: FocusRegion.TextInput,
                  focusIndex: 0,
                },
                () => this.updateFocus()
              );
              e.preventDefault();
            } else {
              // Otherwise navigate within the set of tokens
              this.setState(
                {
                  focusIndex: this.state.focusIndex + 1,
                },
                () => this.updateFocus()
              );
              e.preventDefault();
            }
            return;
          }

          if (this.state.focusRegion === FocusRegion.Suggestions) {
            const suggestions = this.suggestionsToDisplay();
            const suggestionIndex = this.state.focusIndex + 1;
            if (suggestionIndex >= suggestions.length) {
              return;
            }

            this.setState(
              {
                focusIndex: suggestionIndex,
                text: suggestions[suggestionIndex],
              },
              () => this.updateFocus()
            );
            e.preventDefault();
            return;
          }
        }
        break;

      case 'ArrowDown':
        {
          const suggestions = this.suggestionsToDisplay();
          if (
            !inlineMode &&
            (this.state.focusRegion === FocusRegion.TextInput ||
              this.state.focusRegion === FocusRegion.Tokens) &&
            suggestions.length
          ) {
            this.setState(
              {
                focusRegion: FocusRegion.Suggestions,
                focusIndex: 0,
                text: suggestions[0],
              },
              () => this.updateFocus()
            );
            e.preventDefault();
            return;
          }
        }
        break;

      case 'ArrowUp':
        {
          if (this.state.focusRegion === FocusRegion.Suggestions) {
            this.setState(
              {
                focusRegion: FocusRegion.TextInput,
                focusIndex: 0,
              },
              () => this.updateFocus()
            );
            e.preventDefault();
            return;
          }
        }
        break;

      case 'Backspace':
        {
          // If the user presses backspace while focussed on the suggestions we
          // should just apply it to the text region.
          if (this.state.focusRegion === FocusRegion.Suggestions) {
            this.setState(
              {
                focusRegion: FocusRegion.TextInput,
                focusIndex: 0,
              },
              () => this.updateFocus()
            );
            e.preventDefault();

            // Calling updateText rather than simply setting the state above
            // ensures we will update suggestions, if needed.
            const text = this.state.text.substr(0, this.state.text.length - 1);
            this.updateText(text);
            return;
          }
        }
        break;

      default:
        {
          // With this one weird trick we can detect any printable characters
          // (so we can redirect them to the text entry where they were likely
          // intended to go).
          if (
            e.key.length === 1 &&
            this.state.focusRegion === FocusRegion.Suggestions
          ) {
            this.setState(
              {
                focusRegion: FocusRegion.TextInput,
                focusIndex: 0,
              },
              () => this.updateFocus()
            );
            e.preventDefault();

            // As above, calling updateText rather than simply setting the state
            // above ensures we will update suggestions, if needed.
            const text = this.state.text + e.key;
            this.updateText(text);
            return;
          }
        }
        break;
    }
  }

  handleBlur(e: React.FocusEvent<HTMLElement>) {
    const isPartOfComponent = (elem: Element | null): boolean => {
      if (!elem) {
        return false;
      }

      do {
        if (elem.parentElement === this.rootElem) {
          return true;
        }
        elem = elem.parentElement;
      } while (elem);

      return false;
    };

    // If the focus is still within this component we can just ignore the event.
    if (isPartOfComponent(e.relatedTarget as Element | null)) {
      return;
    }

    // Reset the focus to point to the text field (since that's probably what
    // you want when you return to this component).
    this.setState({
      focusRegion: FocusRegion.TextInput,
      focusIndex: 0,
    });

    // Commit any text we were writing
    this.commitText();
  }

  handleClick(e: React.MouseEvent<HTMLElement>) {
    // We could call stopPropagation in each of the places where we handle click
    // events (so that we don't *also* handle them here) but that seems like
    // a layering violation in that ancestors should be able to detect if this
    // component was clicked by listening for click events.
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();

    // Clicking any of the dead areas in the widget should focus the text box
    this.setState(
      {
        focusRegion: FocusRegion.TextInput,
        focusIndex: 0,
      },
      () => this.updateFocus()
    );
  }

  handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.updateText(e.target.value);
  }

  updateText(value: string) {
    const tokens = value.split(/[,、]/);

    // Make the new text the last token, if any.
    const text = tokens[tokens.length - 1];
    this.setState({ text });

    // Add any extra non-empty tokens
    const addedTokens = tokens
      .slice(0, -1)
      .map(token => token.trim())
      .filter(token => token);
    if (addedTokens.length) {
      const tokens = this.state.tokens.concat(addedTokens);
      // Since we're only adding tokens, the existing focus should be fine.
      this.setState({ tokens });

      if (this.props.onTokensChange) {
        this.props.onTokensChange(tokens, addedTokens);
      }
    }

    // We defer telling our owner until we finish composing since we don't
    // really want to suggestions to update while we're composing.
    if (!this.composing && this.props.onTextChange) {
      this.props.onTextChange(text);
    }
  }

  handleTextCompositionStart(e: React.CompositionEvent<HTMLInputElement>) {
    this.composing = true;
  }

  handleTextCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    this.composing = false;

    if (this.props.onTextChange) {
      this.props.onTextChange(this.state.text);
    }
  }

  handleTextKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitText();
    }
  }

  handleTextKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      e.key === 'Backspace' &&
      !this.state.text.length &&
      this.state.tokens &&
      this.state.tokens.length
    ) {
      this.deleteToken(this.state.tokens.length - 1);

      const tokens = this.state.tokens.slice();
      const lastToken = tokens.pop();

      this.setState({ tokens, text: lastToken });

      if (this.props.onTokensChange) {
        this.props.onTokensChange(tokens, []);
      }
      if (this.props.onTextChange) {
        this.props.onTextChange(lastToken!);
      }
      // By *not* calling e.preventDefault() here we'll end up actually doing
      // the backspace on the restored text.
      //
      // (I'm a bit unsure if that's the behaviour we want or not but I *think*
      // it is. You can't freely edit other items in the list, and generally you
      // only want to correct the _end_ of an auto-suggested item since we match
      // from the _start_. So, this behaviour might change, but for now I think
      // it's right.)
    }
  }

  commitText() {
    if (!this.state.text) {
      return;
    }

    const addedToken = this.state.text;
    const tokens = this.state.tokens.concat(addedToken);
    // Presumably we are currently focussed on the text input so we don't need
    // to update focus here.
    this.setState({
      text: '',
      tokens,
    });

    if (this.props.onTokensChange) {
      this.props.onTokensChange(tokens, [addedToken]);
    }
    if (this.props.onTextChange) {
      this.props.onTextChange('');
    }
  }

  handleTokenClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const index = parseInt((e.target as HTMLButtonElement).dataset.index!);
    this.deleteToken(index);
  }

  handleTokenKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      // We do the actual handling of these in keyup because we don't want
      // auto-repeat behavior for these.
    }
  }

  handleTokenKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const index = parseInt((e.target as HTMLButtonElement).dataset.index!);
      this.deleteToken(index);
    }
  }

  deleteToken(index: number) {
    if (!this.state.tokens || index >= this.state.tokens.length) {
      return;
    }

    const removedToken = this.state.tokens[index];
    const tokens = this.state.tokens.slice();
    tokens.splice(index, 1);

    this.setState({ tokens });

    if (this.props.onTokensChange) {
      this.props.onTokensChange(tokens, []);
    }

    // If we deleted the last token in the list, focus on the text field.
    if (
      this.state.focusRegion === FocusRegion.Tokens &&
      this.state.focusIndex >= tokens.length
    ) {
      this.setState(
        {
          focusRegion: FocusRegion.TextInput,
          focusIndex: 0,
        },
        () => this.updateFocus()
      );
    } else if (this.state.focusRegion === FocusRegion.TextInput) {
      // If we got called from a mouse click on a button we might have updated
      // the DOM focus without updating our state yet so we should force the
      // focus back to the text region.
      this.updateFocus();
    }
  }

  handleSuggestionClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const suggestion = (e.target as HTMLAnchorElement).dataset.suggestion!;
    const tokens = this.state.tokens.concat(suggestion);
    this.setState(
      {
        tokens,
        // Clobber any in-progress text because often you'll type a few
        // characters then choose a suggestion (i.e. autocomplete).
        text: '',
        // Focus on the text field.
        //
        // In some cases it might be more convenient to move the focus on the
        // next suggestion so you can do rapid entry of suggestions, but
        // generally it seems like you want to enter some text. If rapid entry
        // of multiple initial suggestions is common, perhaps we can distinguish
        // between the case where there is text in the text box and when there
        // is not.
        focusRegion: FocusRegion.TextInput,
        focusIndex: 0,
      },
      () => this.updateFocus()
    );

    if (this.props.onTokensChange) {
      this.props.onTokensChange(tokens, [suggestion]);
    }
    if (this.props.onTextChange) {
      this.props.onTextChange('');
    }
  }

  // Mirror the focus in the state to the actual DOM elements
  //
  // TODO: Perhaps we should just always call this in componentDidUpdate since
  // the focus index refer to a node that's yet to be rendered?
  // But would that cause the focus to jump sometimes? Do we need a flag to
  // detect if the focus has changed or not?
  updateFocus() {
    if (!this.rootElem) {
      return;
    }

    // We do this DOM hackery because it saves us from having to building
    // a dynamic list of references (which is tricky because React doesn't make
    // it easy to free those references).
    const getNthTokenButton = (i: number) =>
      this.rootElem!.querySelector(
        `.input > .chip:nth-of-type(${i + 1}) > .clear`
      ) as HTMLButtonElement | undefined;

    const getNthSuggestionLink = (i: number) =>
      this.rootElem!.querySelector(
        `.suggestion-list > .item:nth-of-type(${i + 1}) > a`
      ) as HTMLAnchorElement | undefined;

    switch (this.state.focusRegion) {
      case FocusRegion.TextInput:
        if (this.textInput) {
          this.textInput.focus();
        }
        break;

      case FocusRegion.Tokens:
        const button = getNthTokenButton(this.state.focusIndex);
        if (button) {
          button.focus();
        }
        break;

      case FocusRegion.Suggestions:
        const link = getNthSuggestionLink(this.state.focusIndex);
        if (link) {
          link.focus();
        }
        break;
    }
  }

  suggestionsToDisplay(tokens?: string[]): string[] {
    const uniqueSuggestions = new Set(this.props.suggestions);
    const tokensInUse = new Set(tokens || this.state.tokens);
    return [
      ...new Set([...uniqueSuggestions].filter(x => !tokensInUse.has(x))),
    ];
  }

  focus() {
    this.setState(
      {
        focusRegion: FocusRegion.TextInput,
        focusIndex: 0,
      },
      () => this.updateFocus()
    );
  }

  render() {
    const classes = ['token-list', this.props.className];
    const placeholder = this.props.placeholder || '';
    const suggestions = this.suggestionsToDisplay();
    let suggestionsLabel = '';
    if (suggestions.length) {
      suggestionsLabel = 'e.g.';
    } else if (
      this.props.className &&
      !this.props.className.split(' ').includes('-inline')
    ) {
      suggestionsLabel = '(No suggestions)';
    }

    return (
      <div
        className={classes.join(' ')}
        onKeyDown={this.handleKeyDown}
        onBlur={this.handleBlur}
        onClick={this.handleClick}
        ref={elem => {
          this.rootElem = elem || undefined;
        }}
      >
        <div className="input">
          {this.state.tokens.map((token, i) => (
            <span key={i} className="chip">
              {token}
              <button
                className="clear"
                aria-label="Delete"
                onClick={this.handleTokenClick}
                onKeyDown={this.handleTokenKeyDown}
                onKeyUp={this.handleTokenKeyUp}
                tabIndex={-1}
                data-index={i}
              >
                &#x2715;
              </button>
            </span>
          ))}
          <input
            className="textentry"
            type="text"
            value={this.state.text}
            placeholder={placeholder}
            onChange={this.handleTextChange}
            onCompositionStart={this.handleTextCompositionStart}
            onCompositionEnd={this.handleTextCompositionEnd}
            onKeyPress={this.handleTextKeyPress}
            onKeyDown={this.handleTextKeyDown}
            tabIndex={this.state.focusRegion === FocusRegion.TextInput ? 0 : -1}
            ref={textInput => {
              this.textInput = textInput || undefined;
            }}
          />
        </div>
        <div
          className={
            'suggestions' + (this.props.loadingSuggestions ? ' -loading' : '')
          }
          aria-live="assertive"
          aria-atomic="true"
        >
          <label className="label">{suggestionsLabel}</label>
          {suggestions.length ? (
            <ul className="suggestion-list" hidden={!suggestions.length}>
              {suggestions.map(this.renderSuggestion)}
            </ul>
          ) : null}
          {this.props.loadingSuggestions ? <LoadingIndicator /> : ''}
        </div>
      </div>
    );
  }

  renderSuggestion(suggestion: string, i: number) {
    const textToMatch = this.state.text;

    return (
      <li className="item" key={i}>
        <a
          href="#"
          data-suggestion={suggestion}
          onClick={this.handleSuggestionClick}
          tabIndex={-1}
        >
          {textToMatch.length &&
          suggestion.toLowerCase().startsWith(textToMatch.toLowerCase()) ? (
            <React.Fragment key={i}>
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
}

export default TokenList;
