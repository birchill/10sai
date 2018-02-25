import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput.jsx';
import TokenList from './TokenList.tsx';

export class EditCardForm extends React.Component {
  static get propTypes() {
    return {
      // eslint-disable-next-line react/forbid-prop-types
      card: PropTypes.object.isRequired,
      onChange: PropTypes.func,
    };
  }

  constructor(props) {
    super(props);

    this.handlePromptChange = this.handlePromptChange.bind(this);
    this.handleAnswerChange = this.handleAnswerChange.bind(this);
    this.handleTagChange = this.handleTagChange.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
  }

  handlePromptChange(value) {
    if (this.props.onChange) {
      this.props.onChange('question', value);
    }
  }

  handleAnswerChange(value) {
    if (this.props.onChange) {
      this.props.onChange('answer', value);
    }
  }

  handleTagChange(tags) {
    if (this.props.onChange) {
      this.props.onChange('tags', tags);
    }
  }

  handleKeywordsChange(tags) {
    if (this.props.onChange) {
      this.props.onChange('keywords', tags);
    }
  }

  render() {
    return (
      <form className="form editcard-form" autoComplete="off">
        <CardFaceInput
          name="prompt"
          className="prompt"
          value={this.props.card.question || ''}
          placeholder="Prompt"
          required
          onChange={this.handlePromptChange}
          ref={questionTextBox => {
            this.questionTextBox = questionTextBox;
          }}
        />
        <hr className="card-divider divider" />
        <CardFaceInput
          name="answer"
          className="answer"
          value={this.props.card.answer || ''}
          placeholder="Answer"
          onChange={this.handleAnswerChange}
        />
        <div className="keywords -yellow">
          <span className="icon -key" />
          <TokenList
            className="tokens -yellow -seamless"
            tags={this.props.card.keywords || []}
            placeholder="Keywords"
            onChange={this.handleKeywordsChange}
          />
        </div>
        <div className="tags">
          <span className="icon -tag -grey" />
          <TokenList
            className="tokens -seamless"
            tags={this.props.card.tags || []}
            placeholder="Tags"
            onChange={this.handleTagChange}
          />
        </div>
      </form>
    );
  }
}

export default EditCardForm;
