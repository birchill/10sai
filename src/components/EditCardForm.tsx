import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput';
import TokenList from './TokenList';
import { Card } from '../model';

interface Props {
  card: Card;
  onChange?: (topic: string, value: string | string[]) => void;
}

export class EditCardForm extends React.Component<Props> {
  questionTextBox?: CardFaceInput;

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
    this.handleTagChange = this.handleTagChange.bind(this);
    this.handleKeywordsChange = this.handleKeywordsChange.bind(this);
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

  handleTagChange(tags: string[]) {
    if (this.props.onChange) {
      this.props.onChange('tags', tags);
    }
  }

  handleKeywordsChange(tags: string[]) {
    if (this.props.onChange) {
      this.props.onChange('keywords', tags);
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
        <div className="keywords -yellow">
          <span className="icon -key" />
          <TokenList
            className="tokens -yellow -seamless"
            tokens={this.props.card.keywords || []}
            placeholder="Keywords"
            onChange={this.handleKeywordsChange}
            suggestions={['漢字', '漢', '字']}
          />
        </div>
        <div className="tags">
          <span className="icon -tag -grey" />
          <TokenList
            className="tokens -seamless"
            tokens={this.props.card.tags || []}
            placeholder="Tags"
            onChange={this.handleTagChange}
            suggestions={['N1', 'N2', 'N3']}
          />
        </div>
      </form>
    );
  }
}

export default EditCardForm;
