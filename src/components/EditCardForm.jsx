import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput.jsx';

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

  render() {
    return (
      <form className="form editcard-form" autoComplete="off">
        <CardFaceInput
          name="prompt"
          value={this.props.card.question || ''}
          className="-textpanel -large"
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
          value={this.props.card.answer || ''}
          className="-textpanel -large"
          placeholder="Answer"
          onChange={this.handleAnswerChange}
        />
        <input
          type="text"
          name="keywords"
          className="-textpanel -yellow -focushighlight -icon -key"
          placeholder="Keywords"
        />
        <input
          type="text"
          name="tags"
          className="-textpanel -focushighlight -icon -tag"
          placeholder="Tags"
        />
      </form>
    );
  }
}

export default EditCardForm;
