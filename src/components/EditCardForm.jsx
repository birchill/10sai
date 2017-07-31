import React from 'react';
import PropTypes from 'prop-types';

import CardFaceInput from './CardFaceInput.jsx';
import EditState from '../edit-states';

export class EditCardForm extends React.Component {
  static get propTypes() {
    return {
      active: PropTypes.bool.isRequired,
      editState: PropTypes.symbol.isRequired,
      card: PropTypes.object.isRequired,
      onChange: PropTypes.func,
    };
  }

  constructor(props) {
    super(props);

    this.assignSearchBox = elem => { this.searchBox = elem; };
    this.handlePromptChange = this.handlePromptChange.bind(this);
    this.handleAnswerChange = this.handleAnswerChange.bind(this);
  }

  componentDidMount() {
    if (this.props.active) this.activate();
  }

  componentDidUpdate(previousProps) {
    if (previousProps.active === this.props.active) {
      return;
    }

    if (this.props.active) {
      this.activate();
    }
  }

  activate() {
    if (this.props.editState === EditState.EMPTY && this.searchBox) {
      this.searchBox.focus();
    }
  }

  handlePromptChange(value) {
    if (this.props.onChange) {
      this.props.onChange('prompt', value);
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
        <div className="search-box">
          <input
            type="text"
            placeholder="Lookup"
            className="text-box -compact -rounded -search"
            ref={this.assignSearchBox} />
        </div>
        <CardFaceInput
          name="prompt"
          value={this.props.card.prompt || ''}
          className="-textpanel -large"
          placeholder="Prompt"
          required
          onChange={this.handlePromptChange} />
        <CardFaceInput
          name="answer"
          value={this.props.card.answer || ''}
          className="-textpanel -large"
          placeholder="Answer"
          onChange={this.handleAnswerChange} />
        <input
          type="text"
          name="keywords"
          className="-textpanel -yellow"
          placeholder="Keywords" />
        <input
          type="text"
          name="tags"
          className="-textpanel"
          placeholder="Tags" />
      </form>
    );
  }
}

export default EditCardForm;
