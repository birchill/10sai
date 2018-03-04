import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  tags?: string[];
  text?: string;
  placeholder?: string;
  onChange?: (tags: string[]) => void;
  suggestions?: string[];
}

enum FocusRegion {
  TextInput,
  Tags,
  Suggestions,
}

interface State {
  text: string;
  tags: string[];
  focusRegion: FocusRegion;
  focusIndex: number;
}

export class TokenList extends React.Component<Props> {
  state: State = {
    text: '',
    tags: [],
    focusRegion: FocusRegion.TextInput,
    focusIndex: 0,
  };
  rootElem?: HTMLDivElement;
  textInput?: HTMLInputElement;
  tagButtons: HTMLButtonElement[];

  static get propTypes() {
    return {
      className: PropTypes.string,
      tags: PropTypes.arrayOf(PropTypes.string),
      text: PropTypes.string,
      placeholder: PropTypes.string,
      onChange: PropTypes.func,
      suggestions: PropTypes.arrayOf(PropTypes.string),
    };
  }

  constructor(props: Props) {
    super(props);

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleTextKeyPress = this.handleTextKeyPress.bind(this);
    this.handleTextKeyDown = this.handleTextKeyDown.bind(this);
    this.handleTagClick = this.handleTagClick.bind(this);
    this.handleTagKeyUp = this.handleTagKeyUp.bind(this);
    this.handleSuggestionClick = this.handleSuggestionClick.bind(this);

    this.renderSuggestion = this.renderSuggestion.bind(this);
  }

  componentWillMount() {
    this.setState({
      text: this.props.text || '',
      tags: this.props.tags || [],
    });
  }

  componentWillReceiveProps(nextProps: Props) {
    const updatedState: Partial<State> = {
      text: nextProps.text || '',
      tags: nextProps.tags || [],
    };

    // Make sure the focus is in range for tags
    if (
      this.state.focusRegion === FocusRegion.Tags &&
      this.state.focusIndex >= updatedState.tags!.length
    ) {
      if (updatedState.tags!.length) {
        updatedState.focusIndex = updatedState.tags!.length - 1;
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

    switch (e.key) {
      case 'ArrowLeft':
        {
          if (this.state.focusRegion === FocusRegion.TextInput) {
            if (this.state.tags.length) {
              this.setState(
                {
                  focusRegion: FocusRegion.Tags,
                  focusIndex: this.state.tags.length - 1,
                },
                () => this.updateFocus()
              );
              e.preventDefault();
            }
            return;
          }

          if (this.state.focusRegion === FocusRegion.Tags) {
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
        }
        break;

      case 'ArrowRight':
        {
          if (this.state.focusRegion === FocusRegion.Tags) {
            if (this.state.focusIndex >= this.state.tags.length - 1) {
              this.setState(
                {
                  focusRegion: FocusRegion.TextInput,
                  focusIndex: 0,
                },
                () => this.updateFocus()
              );
              e.preventDefault();
            } else {
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
            if (this.state.focusIndex + 1 >= suggestions.length) {
              return;
            }

            this.setState({ focusIndex: this.state.focusIndex + 1 }, () =>
              this.updateFocus()
            );
            e.preventDefault();
            return;
          }
        }
        break;

      case 'ArrowDown':
        {
          if (
            (this.state.focusRegion === FocusRegion.TextInput ||
              this.state.focusRegion === FocusRegion.Tags) &&
            this.suggestionsToDisplay().length
          ) {
            this.setState(
              {
                focusRegion: FocusRegion.Suggestions,
                focusIndex: 0,
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

  handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    const tags = value.split(/[,、]/);

    // Make the new text the last tag, if any.
    this.setState({ text: tags[tags.length - 1] });

    // Add any extra non-empty tags
    const addedTags = tags
      .slice(0, -1)
      .map(tag => tag.trim())
      .filter(tag => tag);
    if (addedTags.length) {
      const tags = this.state.tags.concat(addedTags);
      // Since we're only adding tags, the existing focus should be fine.
      this.setState({ tags });

      if (this.props.onChange) {
        this.props.onChange(tags);
      }
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
      this.state.tags &&
      this.state.tags.length
    ) {
      this.deleteTag(this.state.tags.length - 1);
    }
  }

  commitText() {
    if (!this.state.text) {
      return;
    }

    const tags = this.state.tags.concat(this.state.text);
    // Presumably we are currently focussed on the text input so we don't need
    // to update focus here.
    this.setState({
      text: '',
      tags,
    });

    if (this.props.onChange) {
      this.props.onChange(tags);
    }
  }

  handleTagClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const index = parseInt((e.target as HTMLButtonElement).dataset.index!);
    this.deleteTag(index);
  }

  handleTagKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Delete') {
      e.preventDefault();
      const index = parseInt((e.target as HTMLButtonElement).dataset.index!);
      this.deleteTag(index);
    }
  }

  deleteTag(index: number) {
    if (!this.state.tags || index >= this.state.tags.length) {
      return;
    }

    const tags = this.state.tags.slice();
    tags.splice(index, 1);

    this.setState({ tags });

    if (this.props.onChange) {
      this.props.onChange(tags);
    }

    // If we deleted the last tag in the list, focus on the text field.
    if (
      this.state.focusRegion === FocusRegion.Tags &&
      this.state.focusIndex >= tags.length
    ) {
      this.setState(
        {
          focusRegion: FocusRegion.TextInput,
          focusIndex: 0,
        },
        () => this.updateFocus()
      );
    }
  }

  handleSuggestionClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const suggestion = (e.target as HTMLAnchorElement).dataset.suggestion!;
    const tags = this.state.tags.concat(suggestion);
    this.setState({ tags });

    if (this.props.onChange) {
      this.props.onChange(tags);
    }

    // TODO: Should we just always focus on the text field?
    // Keeping the focus on the suggestions makes it easy when you want to add
    // multiple, but I feel like most of the time you want to just add one.

    // If we deleted the last suggestion, focus the text field
    const updatedSuggestions = this.suggestionsToDisplay(tags);
    if (
      this.state.focusRegion === FocusRegion.Suggestions &&
      this.state.focusIndex >= updatedSuggestions.length
    ) {
      if (updatedSuggestions.length) {
        this.setState({ focusIndex: updatedSuggestions.length - 1 }, () =>
          this.updateFocus()
        );
      } else {
        this.setState(
          {
            focusRegion: FocusRegion.TextInput,
            focusIndex: 0,
          },
          () => this.updateFocus()
        );
      }
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

      case FocusRegion.Tags:
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

  suggestionsToDisplay(tags?: string[]): string[] {
    const uniqueSuggestions = new Set(this.props.suggestions);
    const tagsInUse = new Set(tags || this.state.tags);
    return [...new Set([...uniqueSuggestions].filter(x => !tagsInUse.has(x)))];
  }

  render() {
    const classes = ['token-list', this.props.className];
    const placeholder = this.props.placeholder || '';
    const suggestions = this.suggestionsToDisplay();

    return (
      <div
        className={classes.join(' ')}
        onKeyDown={this.handleKeyDown}
        onBlur={this.handleBlur}
        ref={elem => {
          this.rootElem = elem || undefined;
        }}
      >
        <div className="input">
          {this.state.tags.map((tag, i) => (
            <span key={i} className="chip">
              {tag}
              <button
                className="clear"
                aria-label="Delete"
                onClick={this.handleTagClick}
                onKeyUp={this.handleTagKeyUp}
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
            onKeyPress={this.handleTextKeyPress}
            onKeyDown={this.handleTextKeyDown}
            tabIndex={this.state.focusRegion === FocusRegion.TextInput ? 0 : -1}
            ref={textInput => {
              this.textInput = textInput || undefined;
            }}
          />
        </div>
        {suggestions.length ? (
          <div className="suggestions">
            <label className="label">e.g.</label>
            <ul className="suggestion-list" hidden={!suggestions.length}>
              {suggestions.map(this.renderSuggestion)}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  renderSuggestion(suggestion: string, i: number) {
    const textToMatch = this.state.text;
    const wordBreakCharacters = /([\s!"#$%&'()*+,\-./\\:;<=>?@[\]^_`{|}~\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\uffe0-\uffee\u3000-\u303f])/;

    return (
      <li className="item" key={i}>
        <a
          href="#"
          data-suggestion={suggestion}
          onClick={this.handleSuggestionClick}
          tabIndex={-1}
        >
          {suggestion.split(wordBreakCharacters).map((substring, i) => {
            if (textToMatch.length && substring.startsWith(textToMatch)) {
              return (
                <React.Fragment key={i}>
                  <mark>{textToMatch}</mark>
                  {substring.substring(textToMatch.length)}
                </React.Fragment>
              );
            } else {
              return substring;
            }
          })}
        </a>
      </li>
    );
  }
}

export default TokenList;
