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

export class TokenList extends React.Component<Props> {
  state: { text: string; tags: string[] } = { text: '', tags: [] };
  textInput?: HTMLInputElement;

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

    this.handleTextChange = this.handleTextChange.bind(this);
    this.handleTextKeyPress = this.handleTextKeyPress.bind(this);
    this.handleTextKeyDown = this.handleTextKeyDown.bind(this);
    this.handleTextBlur = this.handleTextBlur.bind(this);
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
    this.setState({
      text: nextProps.text || '',
      tags: nextProps.tags || [],
    });
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

  handleTextBlur(e: React.FocusEvent<HTMLInputElement>) {
    this.commitText();
  }

  commitText() {
    if (!this.state.text) {
      return;
    }

    const tags = this.state.tags.concat(this.state.text);
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

    const deletedLastTag = index === this.state.tags.length - 1;

    const tags = this.state.tags.slice();
    tags.splice(index, 1);

    this.setState({ tags });

    if (this.props.onChange) {
      this.props.onChange(tags);
    }

    // If we deleted the last tag, focus the text field
    if (deletedLastTag && this.textInput) {
      this.textInput.focus();
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
  }

  render() {
    const classes = ['token-list', this.props.className];
    const placeholder = this.props.placeholder || '';

    // Get all unique suggestions not already in use
    const uniqueSuggestions = new Set(this.props.suggestions);
    const tagsInUse = new Set(this.state.tags);
    const suggestionsToShow = [
      ...new Set([...uniqueSuggestions].filter(x => !tagsInUse.has(x))),
    ];

    return (
      <div className={classes.join(' ')}>
        <div className="input">
          {this.state.tags.map((tag, i) => (
            <span key={i} className="chip">
              {tag}
              <button
                className="clear"
                aria-label="Delete"
                onClick={this.handleTagClick}
                onKeyUp={this.handleTagKeyUp}
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
            onBlur={this.handleTextBlur}
            ref={textInput => {
              this.textInput = textInput || undefined;
            }}
          />
        </div>
        {suggestionsToShow.length ? (
          <div className="suggestions">
            <label className="label">e.g.</label>
            <ul className="suggestion-list" hidden={!suggestionsToShow.length}>
              {suggestionsToShow.map(this.renderSuggestion)}
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
