import React from 'react';
import PropTypes from 'prop-types';

interface Props {
  className?: string;
  tags?: string[];
  text?: string;
  placeholder?: string;
  onAddTag?: (tag: string) => void;
  onDeleteTag?: (tag: string, index: number) => void;
}

export class TokenList extends React.Component<Props> {
  state: { text: '' };
  textInput?: HTMLInputElement;

  static get propTypes() {
    return {
      className: PropTypes.string,
      tags: PropTypes.arrayOf(PropTypes.string),
      text: PropTypes.string,
      placeholder: PropTypes.string,
      onAddTag: PropTypes.func,
      onDeleteTag: PropTypes.func,
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
  }

  componentWillMount() {
    this.setState({ text: this.props.text || '' });
  }

  componentWillReceiveProps(nextProps: Props) {
    this.setState({ text: nextProps.text || '' });
  }

  handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    const newTags = value.split(/[,、]/);

    // Make the new text the last tag, if any.
    this.setState({ text: newTags[newTags.length - 1] });

    // If we have more than one tag, then add them
    if (this.props.onAddTag) {
      for (const tag of newTags.map(tag => tag.trim()).slice(0, -1)) {
        if (tag === '') {
          continue;
        }
        this.props.onAddTag(tag);
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
      this.props.tags &&
      this.props.tags.length
    ) {
      this.deleteTag(this.props.tags.length - 1);
    }
  }

  handleTextBlur(e: React.FocusEvent<HTMLInputElement>) {
    this.commitText();
  }

  commitText() {
    if (!this.state.text) {
      return;
    }

    const { text } = this.state;
    this.setState({ text: '' });
    if (this.props.onAddTag) {
      this.props.onAddTag(text);
    }
  }

  handleTagClick(e: React.MouseEvent<HTMLButtonElement>) {
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
    if (!this.props.tags || index >= this.props.tags.length) {
      return;
    }

    const deletedLastTag = index === this.props.tags.length - 1;

    if (this.props.onDeleteTag) {
      this.props.onDeleteTag(this.props.tags[index], index);
    }

    // If we deleted the last tag, focus the text field
    if (deletedLastTag && this.textInput) {
      this.textInput.focus();
    }
  }

  render() {
    const classes = ['token-list', this.props.className];
    const tags = this.props.tags || [];
    const placeholder = tags.length ? '' : this.props.placeholder || '';

    return (
      <div className={classes.join(' ')}>
        <div className="input">
          {tags.map((tag, i) => (
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
      </div>
    );
  }
}

export default TokenList;
